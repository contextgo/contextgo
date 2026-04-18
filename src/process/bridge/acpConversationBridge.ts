/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpDetector } from '@process/agent/acp/AcpDetector';
import { AcpConnection } from '@process/agent/acp/AcpConnection';
import { getClaudeSettingsPath } from '@process/agent/acp/utils';
import { buildAcpModelInfo, summarizeAcpModelInfo } from '@process/agent/acp/modelInfo';
import { CodexConnection, getCodexAuthPath, getCodexConfigPath } from '@process/agent/codex/connection/CodexConnection';
import { USER_SETTINGS_PATH } from '@process/agent/gemini/cli/settings';
import { ProcessConfig } from '@process/utils/initStorage';
import { refreshTrayMenu } from '@process/utils/tray';
import type { IConversationService } from '@process/services/IConversationService';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';
import AcpAgentManager from '@process/task/AcpAgentManager';
import CodexAgentManager from '@process/task/CodexAgentManager';
import { GeminiAgentManager } from '@process/task/GeminiAgentManager';
import { mainLog, mainWarn } from '@/process/utils/mainLogger';
import { ipcBridge } from '@/common';
import {
  ACP_BACKENDS_ALL,
  isManagedRuntimeInstallableBackend,
  type AcpBackend,
  type MANAGED_RUNTIME_INSTALLABLE_BACKENDS,
  type ManagedRuntimeConfigEntry,
  type ManagedRuntimeInstallEvent,
} from '@/common/types/acpTypes';
import { isProjectRuntimeBackend } from '@/common/types/projectRuntime';
import { ExternalSessionDiscoveryService } from './services/ExternalSessionDiscoveryService';
import * as os from 'os';
import fs from 'node:fs';
import path from 'node:path';
import { safeExec, safeExecFile } from '@process/utils/safeExec';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { contextRuntimeService } from '@process/services/context/contextServiceSingleton';
import { ProjectRuntimeService } from '@process/services/runtime/ProjectRuntimeService';

const refreshTrayMenuSafely = async (): Promise<void> => {
  try {
    await refreshTrayMenu();
  } catch (error) {
    console.warn('[acpConversationBridge] Failed to refresh tray menu:', error);
  }
};

type RuntimeAwareDetectedAgent = ReturnType<typeof acpDetector.getDetectedAgents>[number] & {
  runtimeSource?: 'builtin' | 'detected' | 'configured';
  resolvedCliPath?: string;
};

const MANAGED_RUNTIME_INSTALL_COMMANDS: Record<(typeof MANAGED_RUNTIME_INSTALLABLE_BACKENDS)[number], string> = {
  claude: 'npm install -g @anthropic-ai/claude-code',
  codex: 'npm install -g @openai/codex',
  opencode: 'npm install -g @opencode-ai/cli',
};

const emitManagedRuntimeInstallEvent = (event: ManagedRuntimeInstallEvent): void => {
  ipcBridge.acpConversation.managedRuntimeInstallEvent.emit(event);
};

function getManagedRuntimeInstallCommand(backend: AcpBackend): string | null {
  if (!isManagedRuntimeInstallableBackend(backend)) {
    return null;
  }

  return MANAGED_RUNTIME_INSTALL_COMMANDS[backend as (typeof MANAGED_RUNTIME_INSTALLABLE_BACKENDS)[number]];
}

async function getCodexAuthStatus(cliPath?: string): Promise<{
  loginStatus: string;
  isAuthenticated: boolean;
  hasCodexApiKey: boolean;
  hasOpenAiApiKey: boolean;
  hasChatGptSession: boolean;
}> {
  const env = getEnhancedEnv();
  const codexCommand = cliPath?.trim() || 'codex';
  let loginStatus = 'unknown';
  let isAuthenticated = false;

  try {
    const result = await safeExecFile(codexCommand, ['login', 'status'], {
      timeout: 5000,
      env,
    });
    loginStatus = result.stdout.trim() || result.stderr.trim() || loginStatus;
    isAuthenticated = /logged in/i.test(loginStatus) && !/not logged in/i.test(loginStatus);
  } catch (error) {
    mainWarn('[ACP codex]', 'Failed to read codex login status during health check', error);
  }

  return {
    loginStatus,
    isAuthenticated,
    hasCodexApiKey: Boolean(env.CODEX_API_KEY),
    hasOpenAiApiKey: Boolean(env.OPENAI_API_KEY),
    hasChatGptSession: /chatgpt/i.test(loginStatus),
  };
}

function isCodexAuthenticationError(errorMsg: string): boolean {
  const lowerError = errorMsg.toLowerCase();
  return (
    lowerError.includes('auth') ||
    lowerError.includes('login') ||
    lowerError.includes('api key') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('not authenticated')
  );
}

const resolveUserPath = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  const pathApi = process.platform === 'win32' ? path.win32 : path.posix;
  if (trimmed.startsWith('~')) {
    return pathApi.resolve(trimmed.replace(/^~(?=$|[\\/])/, os.homedir()));
  }

  return pathApi.resolve(trimmed);
};

async function resolveRuntimeDisplayPath(cliPath?: string): Promise<string | undefined> {
  const trimmed = cliPath?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/^['"]|['"]$/g, '');
  const looksLikePath = normalized.startsWith('~') || normalized.includes('/') || normalized.includes('\\');

  if (looksLikePath) {
    const resolvedPath = resolveUserPath(normalized);
    return resolvedPath;
  }

  if (/\s/.test(normalized)) {
    return undefined;
  }

  const env = getEnhancedEnv();

  try {
    const result = await safeExecFile(process.platform === 'win32' ? 'where' : '/usr/bin/which', [normalized], {
      timeout: 1000,
      env,
    });
    const resolved = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    if (!resolved) {
      throw new Error('Command path lookup returned no output');
    }

    return resolved;
  } catch {
    const candidateDirs = [
      ...(env.PATH || '').split(path.delimiter),
      ...(process.platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin'] : []),
    ]
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const dir of candidateDirs) {
      const candidatePath = path.join(dir, normalized);

      try {
        fs.accessSync(candidatePath, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
        return candidatePath;
      } catch {
        continue;
      }
    }

    return undefined;
  }
}

function resolveManagedRuntimeConfigEntries(backend: AcpBackend, runtimeRoot?: string): ManagedRuntimeConfigEntry[] {
  const homeDir = os.homedir();
  const globalOpencodeConfigPath =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'opencode', 'opencode.json')
      : path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'opencode', 'opencode.json');
  const globalOpencodeAuthPath =
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'opencode', 'auth.json')
      : path.join(process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), 'opencode', 'auth.json');

  switch (backend) {
    case 'gemini':
      return [{ kind: 'config', path: USER_SETTINGS_PATH, exists: fs.existsSync(USER_SETTINGS_PATH) }];
    case 'claude':
      return [
        {
          kind: 'config',
          path: getClaudeSettingsPath(runtimeRoot),
          exists: fs.existsSync(getClaudeSettingsPath(runtimeRoot)),
        },
      ];
    case 'codex':
      return [
        {
          kind: 'config',
          path: getCodexConfigPath(runtimeRoot),
          exists: fs.existsSync(getCodexConfigPath(runtimeRoot)),
        },
        {
          kind: 'auth',
          path: getCodexAuthPath(runtimeRoot),
          exists: fs.existsSync(getCodexAuthPath(runtimeRoot)),
        },
      ];
    case 'opencode': {
      const configPath = runtimeRoot ? path.join(runtimeRoot, 'opencode', 'opencode.json') : globalOpencodeConfigPath;
      const authPath = runtimeRoot ? path.join(runtimeRoot, 'opencode', 'auth.json') : globalOpencodeAuthPath;
      return [
        {
          kind: 'config',
          path: configPath,
          exists: fs.existsSync(configPath),
        },
        {
          kind: 'auth',
          path: authPath,
          exists: fs.existsSync(authPath),
        },
      ];
    }
    default:
      return [];
  }
}

async function getRuntimeAwareDetectedAgents(): Promise<RuntimeAwareDetectedAgent[]> {
  const detectedAgents: RuntimeAwareDetectedAgent[] = acpDetector.getDetectedAgents().map((agent) => ({
    ...agent,
    runtimeSource: agent.backend === 'gemini' ? 'builtin' : 'detected',
  }));
  const acpConfig = await ProcessConfig.get('acp.config');
  const codexConfig = await ProcessConfig.get('codex.config');

  const getConfiguredCliPath = (backend: RuntimeAwareDetectedAgent['backend']): string | undefined => {
    if (backend === 'codex') {
      return codexConfig?.cliPath?.trim() || undefined;
    }

    if (!(backend in ACP_BACKENDS_ALL) || backend === 'custom') {
      return undefined;
    }

    return acpConfig?.[backend as AcpBackend]?.cliPath?.trim() || undefined;
  };

  const detectedBackends = new Set<RuntimeAwareDetectedAgent['backend']>();

  for (const agent of detectedAgents) {
    detectedBackends.add(agent.backend);

    const configuredCliPath = getConfiguredCliPath(agent.backend);
    const fallbackCliPath =
      agent.backend === 'gemini' ? ACP_BACKENDS_ALL.gemini.cliCommand || agent.cliPath : agent.cliPath;
    const effectiveCliPath = configuredCliPath || fallbackCliPath;

    if (effectiveCliPath) {
      agent.cliPath = effectiveCliPath;
    }

    agent.resolvedCliPath = await resolveRuntimeDisplayPath(effectiveCliPath);
  }

  for (const [backend, config] of Object.entries(ACP_BACKENDS_ALL)) {
    const typedBackend = backend as AcpBackend;
    if (typedBackend === 'gemini' || typedBackend === 'custom') {
      continue;
    }

    const configuredCliPath = getConfiguredCliPath(typedBackend);
    if (!configuredCliPath || detectedBackends.has(typedBackend)) {
      continue;
    }

    detectedAgents.push({
      backend: typedBackend,
      name: config.name,
      cliPath: configuredCliPath,
      resolvedCliPath: await resolveRuntimeDisplayPath(configuredCliPath),
      acpArgs: config.acpArgs,
      runtimeSource: 'configured',
    });
  }

  return detectedAgents;
}

export function initAcpConversationBridge(
  workerTaskManager: IWorkerTaskManager,
  conversationService: IConversationService,
  contextRuntime: Pick<typeof contextRuntimeService, 'registerConversation'> = contextRuntimeService
): void {
  const getExternalSessionDiscovery = () =>
    new ExternalSessionDiscoveryService(conversationService, {
      availableBackends: new Set(acpDetector.getDetectedAgents().map((agent) => agent.backend)),
    });

  // Debug provider to check environment variables
  ipcBridge.acpConversation.checkEnv.provider(() => {
    return Promise.resolve({
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '[SET]' : '[NOT SET]',
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? '[SET]' : '[NOT SET]',
        NODE_ENV: process.env.NODE_ENV || '[NOT SET]',
      },
    });
  });

  // 保留旧的detectCliPath接口用于向后兼容，但使用新检测器的结果
  ipcBridge.acpConversation.detectCliPath.provider(async ({ backend }) => {
    const agents = await getRuntimeAwareDetectedAgents();
    const agent = agents.find((a) => a.backend === backend);

    if (agent?.cliPath) {
      return { success: true, data: { path: agent.cliPath } };
    }

    return {
      success: false,
      msg: `${backend} CLI not found. Please install it and ensure it's accessible.`,
    };
  });

  // 新的ACP检测接口 - 基于全局标记位
  ipcBridge.acpConversation.getAvailableAgents.provider(async () => {
    try {
      const agents = await getRuntimeAwareDetectedAgents();
      return { success: true, data: agents };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.listExternalSessions.provider(async () => {
    try {
      const sessions = await getExternalSessionDiscovery().listSessions();
      return {
        success: true,
        data: { sessions },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.importExternalSession.provider(async (params) => {
    try {
      const conversation = await getExternalSessionDiscovery().importSession(params);
      await contextRuntime.registerConversation(conversation);
      ipcBridge.conversation.listChanged.emit({
        conversationId: conversation.id,
        action: 'created',
        source: conversation.source || 'contextgo',
      });
      await refreshTrayMenuSafely();
      return {
        success: true,
        data: { conversation },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Refresh custom agents detection - called when custom agents config changes
  ipcBridge.acpConversation.refreshCustomAgents.provider(async () => {
    try {
      await acpDetector.refreshCustomAgents();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.refreshDetectedAgents.provider(async () => {
    try {
      await acpDetector.refreshDetectedAgents();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.getManagedRuntimeConfigLocation.provider(async ({ backend, workspace }) => {
    try {
      const runtimeRoot = workspace
        ? (
            await new ProjectRuntimeService().resolve(workspace, {
              backend: isProjectRuntimeBackend(backend) ? backend : undefined,
              allowMutations: false,
              persistDefaultPolicy: false,
            })
          ).runtimeRoot
        : undefined;
      const entries = resolveManagedRuntimeConfigEntries(backend, runtimeRoot);
      if (entries.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          backend,
          entries,
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.importProjectRuntime.provider(async ({ workspace, backend }) => {
    try {
      const resolvedRuntime = await new ProjectRuntimeService().importCurrentGlobalRuntime(workspace, backend);

      return {
        success: true,
        data: {
          backend,
          policy: resolvedRuntime.policy,
          effectiveSource: resolvedRuntime.effectiveSource,
          runtimeRoot: resolvedRuntime.runtimeRoot,
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.resetProjectRuntime.provider(async ({ workspace, backend }) => {
    try {
      const resolvedRuntime = await new ProjectRuntimeService().resetProjectRuntimeOverride(workspace, backend);

      return {
        success: true,
        data: {
          backend,
          policy: resolvedRuntime.policy,
          effectiveSource: resolvedRuntime.effectiveSource,
          runtimeRoot: resolvedRuntime.runtimeRoot,
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.saveProjectRuntimePolicy.provider(async ({ workspace, policy }) => {
    try {
      const resolvedRuntime = await new ProjectRuntimeService().saveProjectRuntimePolicy(workspace, policy);

      return {
        success: true,
        data: {
          policy: resolvedRuntime.policy,
          effectiveSource: resolvedRuntime.effectiveSource,
          runtimeRoot: resolvedRuntime.runtimeRoot,
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcBridge.acpConversation.installManagedRuntime.provider(async ({ backend }) => {
    const command = getManagedRuntimeInstallCommand(backend);
    if (!command) {
      return {
        success: false,
        msg: `No managed install command is configured for ${backend}`,
      };
    }

    emitManagedRuntimeInstallEvent({
      backend,
      command,
      stage: 'starting',
      message: `Starting install for ${backend}`,
    });

    try {
      const result = await safeExec(command, {
        timeout: 15 * 60 * 1000,
        env: getEnhancedEnv(),
        onStdoutChunk: (chunk) => {
          emitManagedRuntimeInstallEvent({
            backend,
            command,
            stage: 'running',
            stream: 'stdout',
            chunk,
          });
        },
        onStderrChunk: (chunk) => {
          emitManagedRuntimeInstallEvent({
            backend,
            command,
            stage: 'running',
            stream: 'stderr',
            chunk,
          });
        },
      });

      emitManagedRuntimeInstallEvent({
        backend,
        command,
        stage: 'refreshing',
        stdout: result.stdout,
        stderr: result.stderr,
        message: `Refreshing runtime detection for ${backend}`,
      });

      await acpDetector.refreshDetectedAgents();

      emitManagedRuntimeInstallEvent({
        backend,
        command,
        stage: 'completed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        message: `Install completed for ${backend}`,
      });

      return {
        success: true,
        data: {
          backend,
          command,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    } catch (error) {
      const stdout = typeof error === 'object' && error && 'stdout' in error ? String(error.stdout || '') : '';
      const stderr = typeof error === 'object' && error && 'stderr' in error ? String(error.stderr || '') : '';
      const errorMsg = error instanceof Error ? error.message : String(error);
      const exitCode = typeof error === 'object' && error && 'code' in error ? Number(error.code) : null;

      emitManagedRuntimeInstallEvent({
        backend,
        command,
        stage: 'failed',
        stdout,
        stderr,
        exitCode: Number.isFinite(exitCode) ? exitCode : null,
        message: stderr.trim() || stdout.trim() || errorMsg,
      });

      return {
        success: false,
        msg: stderr.trim() || stdout.trim() || errorMsg,
        data: {
          backend,
          command,
          stdout,
          stderr,
        },
      };
    }
  });

  // Check agent health by sending a real test message
  // This is the most reliable way to verify an agent can actually respond
  ipcBridge.acpConversation.checkAgentHealth.provider(async ({ backend }) => {
    const startTime = Date.now();

    // Step 1: Check if CLI is installed
    const agents = await getRuntimeAwareDetectedAgents();
    const agent = agents.find((a) => a.backend === backend);

    // Skip CLI check for claude (uses npx) and codex (has its own detection).
    if (!agent?.cliPath && backend !== 'claude' && backend !== 'codex') {
      return {
        success: false,
        msg: `${backend} CLI not found`,
        data: { available: false, error: 'CLI not installed' },
      };
    }

    const tempDir = os.tmpdir();

    // Step 2: Handle Codex separately - it uses MCP protocol, not ACP
    if (backend === 'codex') {
      const authStatus = await getCodexAuthStatus(agent?.cliPath);
      const codexConnection = new CodexConnection();
      try {
        // Start Codex MCP server
        await codexConnection.start(agent?.cliPath || 'codex', tempDir);

        // Wait for server to be ready and ping it
        await codexConnection.waitForServerReady(15000);
        const pingResult = await codexConnection.ping(5000);

        if (!pingResult) {
          throw new Error('Codex server not responding to ping');
        }

        const latency = Date.now() - startTime;
        void codexConnection.stop();

        return {
          success: true,
          data: { available: true, latency },
        };
      } catch (error) {
        try {
          void codexConnection.stop();
        } catch {
          // Ignore stop errors
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        if (isCodexAuthenticationError(errorMsg)) {
          const fallbackError =
            authStatus.loginStatus && authStatus.loginStatus !== 'unknown'
              ? authStatus.loginStatus
              : 'Codex authentication required. Please run "codex login" or configure CODEX_API_KEY / OPENAI_API_KEY.';
          return {
            success: false,
            msg: 'codex not authenticated',
            data: { available: false, error: errorMsg || fallbackError },
          };
        }

        if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('command not found')) {
          return {
            success: false,
            msg: `codex not available`,
            data: { available: false, error: errorMsg },
          };
        }

        return {
          success: false,
          msg: `codex health check failed: ${errorMsg}`,
          data: { available: false, error: errorMsg },
        };
      }
    }

    // Step 3: For ACP-based agents (claude, gemini, codex, opencode, etc.)
    const connection = new AcpConnection();

    try {
      // Connect to the agent
      await connection.connect(backend, agent?.cliPath, tempDir, agent?.acpArgs);

      // Create a new session
      await connection.newSession(tempDir);

      // Send a minimal test message - just need to verify we can communicate
      // Using a simple prompt that should get a quick response
      await connection.sendPrompt('hi');

      // If we get here, the agent responded successfully
      const latency = Date.now() - startTime;

      // Clean up
      await connection.disconnect();

      return {
        success: true,
        data: { available: true, latency },
      };
    } catch (error) {
      // Clean up on error
      try {
        await connection.disconnect();
      } catch {
        // Ignore disconnect errors
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      const lowerError = errorMsg.toLowerCase();

      // Check for authentication-related errors
      if (
        lowerError.includes('auth') ||
        lowerError.includes('login') ||
        lowerError.includes('credential') ||
        lowerError.includes('api key') ||
        lowerError.includes('unauthorized') ||
        lowerError.includes('forbidden')
      ) {
        return {
          success: false,
          msg: `${backend} not authenticated`,
          data: { available: false, error: 'Not authenticated' },
        };
      }

      return {
        success: false,
        msg: `${backend} health check failed: ${errorMsg}`,
        data: { available: false, error: errorMsg },
      };
    }
  });

  // Get current session mode for ACP/Gemini agents
  // 获取 ACP/Gemini 代理的当前会话模式
  // Use getTaskById (cache-only) to avoid spawning a worker process on read-only queries
  ipcBridge.acpConversation.getMode.provider(({ conversationId }) => {
    const task = workerTaskManager.getTask(conversationId);
    if (
      !task ||
      !(task instanceof AcpAgentManager || task instanceof GeminiAgentManager || task instanceof CodexAgentManager)
    ) {
      return Promise.resolve({
        success: true,
        data: { mode: 'default', initialized: false },
      });
    }
    return Promise.resolve({ success: true, data: task.getMode() });
  });

  // Get model info for ACP/Codex agents
  // 获取 ACP/Codex 代理的模型信息
  // Use getTaskById (cache-only) to avoid spawning a worker process on read-only queries
  ipcBridge.acpConversation.getModelInfo.provider(({ conversationId }) => {
    const task = workerTaskManager.getTask(conversationId);
    if (!task || !(task instanceof AcpAgentManager || task instanceof CodexAgentManager)) {
      return Promise.resolve({ success: true, data: { modelInfo: null } });
    }
    return Promise.resolve({
      success: true,
      data: { modelInfo: task.getModelInfo() },
    });
  });

  ipcBridge.acpConversation.probeModelInfo.provider(async ({ backend }) => {
    const agents = await getRuntimeAwareDetectedAgents();
    const agent = agents.find((item) => item.backend === backend);

    if (!agent?.cliPath && backend !== 'claude' && backend !== 'codex') {
      return {
        success: false,
        msg: `${backend} CLI not found`,
      };
    }

    const connection = new AcpConnection();
    const tempDir = os.tmpdir();

    try {
      await connection.connect(backend, agent?.cliPath, tempDir, agent?.acpArgs);
      await connection.newSession(tempDir);

      const modelInfo = buildAcpModelInfo(connection.getConfigOptions(), connection.getModels());
      if (backend === 'codex') {
        const initializeResult = connection.getInitializeResponse() as unknown as Record<string, unknown> | null;
        mainLog('[ACP codex]', 'probeModelInfo completed', {
          initializeAgentInfo: initializeResult?.agentInfo || null,
          modelInfo: summarizeAcpModelInfo(modelInfo),
        });
      }

      return { success: true, data: { modelInfo } };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (backend === 'codex') {
        mainWarn('[ACP codex]', 'probeModelInfo failed', errorMsg);
      }
      return { success: false, msg: errorMsg };
    } finally {
      try {
        await connection.disconnect();
      } catch {
        // Ignore cleanup failures for best-effort probes
      }
    }
  });

  // Set model for ACP agents
  // 设置 ACP 代理的模型
  ipcBridge.acpConversation.setModel.provider(async ({ conversationId, modelId }) => {
    try {
      const task = await workerTaskManager.getOrBuildTask(conversationId);
      if (!task || !(task instanceof AcpAgentManager)) {
        return {
          success: false,
          msg: 'Conversation not found or not an ACP agent',
        };
      }
      return {
        success: true,
        data: { modelInfo: await task.setModel(modelId) },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, msg: errorMsg };
    }
  });

  // Set session mode for ACP/Gemini agents.
  // 设置 ACP/Gemini 代理的会话模式。
  ipcBridge.acpConversation.setMode.provider(async ({ conversationId, mode }) => {
    try {
      const task = await workerTaskManager.getOrBuildTask(conversationId);
      if (!task) {
        return { success: false, msg: 'Conversation not found' };
      }
      if (
        !(task instanceof AcpAgentManager || task instanceof GeminiAgentManager || task instanceof CodexAgentManager)
      ) {
        return {
          success: false,
          msg: 'Mode switching not supported for this agent type',
        };
      }
      return await task.setMode(mode);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, msg: errorMsg };
    }
  });

  // Get non-model config options for ACP agents (e.g., reasoning effort)
  // 获取 ACP 代理的非模型配置选项（如推理级别）
  // Use getTaskById (cache-only) to avoid spawning a worker process on read-only queries
  ipcBridge.acpConversation.getConfigOptions.provider(({ conversationId }) => {
    const task = workerTaskManager.getTask(conversationId);
    if (!task || !(task instanceof AcpAgentManager)) {
      return Promise.resolve({ success: true, data: { configOptions: [] } });
    }
    return Promise.resolve({
      success: true,
      data: { configOptions: task.getConfigOptions() },
    });
  });

  // Set a config option value for ACP agents (e.g., reasoning effort)
  // 设置 ACP 代理的配置选项值（如推理级别）
  ipcBridge.acpConversation.setConfigOption.provider(async ({ conversationId, configId, value }) => {
    try {
      const task = await workerTaskManager.getOrBuildTask(conversationId);
      if (!task || !(task instanceof AcpAgentManager)) {
        return {
          success: false,
          msg: 'Conversation not found or not an ACP agent',
        };
      }
      const configOptions = await task.setConfigOption(configId, value);
      return { success: true, data: { configOptions } };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, msg: errorMsg };
    }
  });
}
