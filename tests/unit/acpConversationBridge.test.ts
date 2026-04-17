import fs from 'node:fs';
import os from 'node:os';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: vi.fn(() => '/tmp') } }));

const handlers: Record<string, (...args: any[]) => any> = {};
const hoisted = vi.hoisted(() => ({
  conversationListChangedEmit: vi.fn(),
  managedRuntimeInstallEventEmit: vi.fn(),
  openClawAgentStart: vi.fn(async () => {}),
  openClawAgentStop: vi.fn(async () => {}),
  codexStart: vi.fn(async () => {}),
  codexWaitForServerReady: vi.fn(async () => {}),
  codexPing: vi.fn(async () => true),
  codexStop: vi.fn(async () => {}),
  processConfigGetMock: vi.fn(async () => undefined),
}));

function makeChannel(name: string) {
  return {
    provider: vi.fn((fn: (...args: any[]) => any) => {
      handlers[name] = fn;
    }),
    emit: vi.fn(),
    invoke: vi.fn(),
  };
}

vi.mock('../../src/common', () => ({
  ipcBridge: {
    conversation: {
      listChanged: {
        provider: vi.fn((fn: (...args: any[]) => any) => {
          handlers['conversation.listChanged'] = fn;
        }),
        emit: hoisted.conversationListChangedEmit,
        invoke: vi.fn(),
      },
    },
    acpConversation: {
      checkEnv: makeChannel('checkEnv'),
      detectCliPath: makeChannel('detectCliPath'),
      getAvailableAgents: makeChannel('getAvailableAgents'),
      listExternalSessions: makeChannel('listExternalSessions'),
      importExternalSession: makeChannel('importExternalSession'),
      refreshCustomAgents: makeChannel('refreshCustomAgents'),
      refreshDetectedAgents: makeChannel('refreshDetectedAgents'),
      installManagedRuntime: makeChannel('installManagedRuntime'),
      managedRuntimeInstallEvent: {
        provider: vi.fn(),
        emit: hoisted.managedRuntimeInstallEventEmit,
        invoke: vi.fn(),
      },
      getManagedRuntimeConfigLocation: makeChannel('getManagedRuntimeConfigLocation'),
      checkAgentHealth: makeChannel('checkAgentHealth'),
      getMode: makeChannel('getMode'),
      getModelInfo: makeChannel('getModelInfo'),
      probeModelInfo: makeChannel('probeModelInfo'),
      setModel: makeChannel('setModel'),
      setMode: makeChannel('setMode'),
      getConfigOptions: makeChannel('getConfigOptions'),
      setConfigOption: makeChannel('setConfigOption'),
    },
  },
}));

vi.mock('../../src/process/agent/acp/AcpDetector', () => ({
  acpDetector: {
    getDetectedAgents: vi.fn(() => []),
    refreshCustomAgents: vi.fn(async () => {}),
    refreshDetectedAgents: vi.fn(async () => {}),
  },
}));

vi.mock('../../src/process/utils/initStorage', () => ({
  ProcessConfig: {
    get: (...args: unknown[]) => hoisted.processConfigGetMock(...args),
  },
  getSkillsDir: vi.fn(() => '/tmp/skills'),
}));

const listConfiguredOpenClawAgentsMock = vi.fn(() => []);

vi.mock('../../src/process/agent/openclaw/openclawConfig', () => ({
  listConfiguredOpenClawAgents: (...args: unknown[]) => listConfiguredOpenClawAgentsMock(...args),
}));

vi.mock('../../src/process/agent/openclaw', () => ({
  OpenClawAgent: vi.fn(function MockOpenClawAgent() {
    return {
      start: hoisted.openClawAgentStart,
      stop: hoisted.openClawAgentStop,
    };
  }),
}));

vi.mock('../../src/process/agent/acp/AcpConnection', () => ({
  AcpConnection: vi.fn(() => ({
    connect: vi.fn(async () => {}),
    newSession: vi.fn(async () => {}),
    sendPrompt: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    getConfigOptions: vi.fn(() => []),
    getModels: vi.fn(() => []),
    getInitializeResponse: vi.fn(() => null),
  })),
}));

vi.mock('../../src/process/agent/acp/modelInfo', () => ({
  buildAcpModelInfo: vi.fn(() => ({})),
  summarizeAcpModelInfo: vi.fn(() => ({})),
}));

vi.mock('../../src/process/agent/codex/connection/CodexConnection', () => ({
  CodexConnection: vi.fn(function MockCodexConnection() {
    return {
      start: hoisted.codexStart,
      waitForServerReady: hoisted.codexWaitForServerReady,
      ping: hoisted.codexPing,
      stop: hoisted.codexStop,
    };
  }),
  getCodexConfigPath: vi.fn((runtimeRoot?: string) =>
    runtimeRoot ? `${runtimeRoot}/codex/config.toml` : '/Users/tester/.codex/config.toml'
  ),
  getCodexAuthPath: vi.fn((runtimeRoot?: string) => (runtimeRoot ? `${runtimeRoot}/codex/auth.json` : '/Users/tester/.codex/auth.json')),
}));

vi.mock('../../src/process/task/AcpAgentManager', () => ({ default: class AcpAgentManager {} }));
vi.mock('../../src/process/task/CodexAgentManager', () => ({ default: class CodexAgentManager {} }));
vi.mock('../../src/process/task/GeminiAgentManager', () => ({ GeminiAgentManager: class GeminiAgentManager {} }));

vi.mock('../../src/process/utils/mainLogger', () => ({
  mainLog: vi.fn(),
  mainWarn: vi.fn(),
}));

vi.mock('../../src/process/utils/tray', () => ({
  refreshTrayMenu: vi.fn(async () => {}),
}));

const safeExecMock = vi.fn(async () => ({ stdout: '', stderr: '' }));
const safeExecFileMock = vi.fn(async () => ({ stdout: '', stderr: '' }));
const getEnhancedEnvMock = vi.fn(() => ({ PATH: '/usr/bin' }));

vi.mock('../../src/process/utils/safeExec', () => ({
  safeExec: (...args: unknown[]) => safeExecMock(...args),
  safeExecFile: (...args: unknown[]) => safeExecFileMock(...args),
}));

vi.mock('../../src/process/utils/shellEnv', () => ({
  getEnhancedEnv: (...args: unknown[]) => getEnhancedEnvMock(...args),
}));

const listSessionsMock = vi.fn(async () => []);
const registerConversationMock = vi.fn(async () => {});
const importSessionMock = vi.fn(async () => ({
  id: 'imported-conversation',
  type: 'acp',
  source: 'contextgo',
  name: 'Imported',
  extra: { backend: 'codex', workspace: '/tmp/project', customWorkspace: true, acpSessionId: 'session-1' },
  createTime: Date.now(),
  modifyTime: Date.now(),
}));

vi.mock('../../src/process/bridge/services/ExternalSessionDiscoveryService', () => ({
  ExternalSessionDiscoveryService: vi.fn(function ExternalSessionDiscoveryService() {
    return {
      listSessions: listSessionsMock,
      importSession: importSessionMock,
    };
  }),
}));

import { initAcpConversationBridge } from '../../src/process/bridge/acpConversationBridge';
import type { IConversationService } from '../../src/process/services/IConversationService';
import type { IWorkerTaskManager } from '../../src/process/task/IWorkerTaskManager';
import { acpDetector } from '../../src/process/agent/acp/AcpDetector';

function makeTaskManager(overrides?: Partial<IWorkerTaskManager>): IWorkerTaskManager {
  return {
    getTask: vi.fn(() => undefined),
    getOrBuildTask: vi.fn(async () => {
      throw new Error('not found');
    }),
    addTask: vi.fn(),
    kill: vi.fn(),
    clear: vi.fn(),
    listTasks: vi.fn(() => []),
    ...overrides,
  };
}

describe('acpConversationBridge', () => {
  let taskManager: IWorkerTaskManager;
  let conversationService: IConversationService;

  beforeEach(() => {
    vi.clearAllMocks();
    safeExecMock.mockReset();
    safeExecMock.mockResolvedValue({ stdout: '', stderr: '' });
    safeExecFileMock.mockReset();
    safeExecFileMock.mockResolvedValue({ stdout: '', stderr: '' });
    hoisted.managedRuntimeInstallEventEmit.mockReset();
    hoisted.openClawAgentStart.mockReset();
    hoisted.openClawAgentStart.mockResolvedValue(undefined);
    hoisted.openClawAgentStop.mockReset();
    hoisted.openClawAgentStop.mockResolvedValue(undefined);
    hoisted.codexStart.mockReset();
    hoisted.codexStart.mockResolvedValue(undefined);
    hoisted.codexWaitForServerReady.mockReset();
    hoisted.codexWaitForServerReady.mockResolvedValue(undefined);
    hoisted.codexPing.mockReset();
    hoisted.codexPing.mockResolvedValue(true);
    hoisted.codexStop.mockReset();
    hoisted.codexStop.mockResolvedValue(undefined);
    registerConversationMock.mockReset();
    registerConversationMock.mockResolvedValue(undefined);
    hoisted.processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.config') return {};
      if (key === 'codex.config') return {};
      return undefined;
    });
    listConfiguredOpenClawAgentsMock.mockReturnValue([]);
    taskManager = makeTaskManager();
    conversationService = {
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      updateConversation: vi.fn(),
      getConversation: vi.fn(),
      createWithMigration: vi.fn(),
      listAllConversations: vi.fn(),
    };
    initAcpConversationBridge(taskManager, conversationService, {
      registerConversation: registerConversationMock,
    } as any);
  });

  // --- getMode ---

  it('returns { initialized: false } when no task exists for the conversation', async () => {
    vi.mocked(taskManager.getTask).mockReturnValue(undefined);

    const result = await handlers['getMode']({ conversationId: 'missing' });

    expect(result).toEqual({ success: true, data: { mode: 'default', initialized: false } });
  });

  it('uses injected taskManager to look up task by conversation id', async () => {
    vi.mocked(taskManager.getTask).mockReturnValue(undefined);

    await handlers['getMode']({ conversationId: 'c1' });

    expect(taskManager.getTask).toHaveBeenCalledWith('c1');
  });

  it('returns discovered external sessions through the bridge', async () => {
    listSessionsMock.mockResolvedValue([
      {
        provider: 'codex',
        sessionId: 'session-1',
        title: 'Resume me',
        workspace: '/tmp/project',
        updatedAt: 123,
      },
    ]);

    const result = await handlers['listExternalSessions']({});

    expect(result).toEqual({
      success: true,
      data: {
        sessions: [
          {
            provider: 'codex',
            sessionId: 'session-1',
            title: 'Resume me',
            workspace: '/tmp/project',
            updatedAt: 123,
          },
        ],
      },
    });
  });

  it('returns the Codex runtime config entries as a list', async () => {
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
      return targetPath === '/Users/tester/.codex/config.toml';
    });

    const result = await handlers['getManagedRuntimeConfigLocation']({ backend: 'codex' });

    expect(result).toEqual({
      success: true,
      data: {
        backend: 'codex',
        entries: [
          {
            kind: 'config',
            path: '/Users/tester/.codex/config.toml',
            exists: true,
          },
          {
            kind: 'auth',
            path: '/Users/tester/.codex/auth.json',
            exists: false,
          },
        ],
      },
    });

    existsSyncSpy.mockRestore();
  });

  it('returns project runtime config entries when a workspace is provided', async () => {
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
      return targetPath === '/tmp/project/.contextgo/codex/config.toml';
    });

    const result = await handlers['getManagedRuntimeConfigLocation']({ backend: 'codex', workspace: '/tmp/project' });

    expect(result).toEqual({
      success: true,
      data: {
        backend: 'codex',
        entries: [
          {
            kind: 'config',
            path: '/tmp/project/.contextgo/codex/config.toml',
            exists: true,
          },
          {
            kind: 'auth',
            path: '/tmp/project/.contextgo/codex/auth.json',
            exists: false,
          },
        ],
      },
    });

    existsSyncSpy.mockRestore();
  });

  it('returns the OpenCode runtime config entries as a list', async () => {
    const homeDir = os.homedir();
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
      return targetPath === `${homeDir}/.config/opencode/opencode.json`;
    });

    const result = await handlers['getManagedRuntimeConfigLocation']({ backend: 'opencode' });

    expect(result).toEqual({
      success: true,
      data: {
        backend: 'opencode',
        entries: [
          {
            kind: 'config',
            path: `${homeDir}/.config/opencode/opencode.json`,
            exists: true,
          },
          {
            kind: 'auth',
            path: `${homeDir}/.local/share/opencode/auth.json`,
            exists: false,
          },
        ],
      },
    });

    existsSyncSpy.mockRestore();
  });

  it('imports an external session and emits a conversation list update', async () => {
    const result = await handlers['importExternalSession']({ provider: 'codex', sessionId: 'session-1' });

    expect(importSessionMock).toHaveBeenCalledWith({ provider: 'codex', sessionId: 'session-1' });
    expect(result.success).toBe(true);
    expect(registerConversationMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'imported-conversation' }));
    expect(hoisted.conversationListChangedEmit).toHaveBeenCalledWith({
      conversationId: 'imported-conversation',
      action: 'created',
      source: 'contextgo',
    });
  });

  it('runs the managed install command and refreshes runtime detection', async () => {
    const result = await handlers['installManagedRuntime']({ backend: 'codex' });

    expect(safeExecMock).toHaveBeenCalledWith(
      'npm install -g @openai/codex',
      expect.objectContaining({
        timeout: 15 * 60 * 1000,
        env: { PATH: '/usr/bin' },
      })
    );
    expect(vi.mocked(acpDetector.refreshDetectedAgents)).toHaveBeenCalled();
    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'starting',
      message: 'Starting install for codex',
    });
    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'refreshing',
      stdout: '',
      stderr: '',
      message: 'Refreshing runtime detection for codex',
    });
    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'completed',
      stdout: '',
      stderr: '',
      exitCode: 0,
      message: 'Install completed for codex',
    });
    expect(result).toEqual({
      success: true,
      data: {
        backend: 'codex',
        command: 'npm install -g @openai/codex',
        stdout: '',
        stderr: '',
      },
    });
  });

  it('streams stdout and stderr chunks during managed install', async () => {
    safeExecMock.mockImplementation(
      async (
        _command: string,
        options?: { onStdoutChunk?: (chunk: string) => void; onStderrChunk?: (chunk: string) => void }
      ) => {
        options?.onStdoutChunk?.('fetching\n');
        options?.onStderrChunk?.('warning\n');
        return { stdout: 'fetching\n', stderr: 'warning\n' };
      }
    );

    await handlers['installManagedRuntime']({ backend: 'codex' });

    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'running',
      stream: 'stdout',
      chunk: 'fetching\n',
    });
    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'running',
      stream: 'stderr',
      chunk: 'warning\n',
    });
  });

  it('does not managed-install legacy openclaw runtime anymore', async () => {
    const result = await handlers['installManagedRuntime']({ backend: 'openclaw-gateway' });

    expect(safeExecMock).not.toHaveBeenCalled();
    expect(hoisted.openClawAgentStart).not.toHaveBeenCalled();
    expect(hoisted.managedRuntimeInstallEventEmit).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      msg: 'No managed install command is configured for openclaw-gateway',
    });
  });

  it('fails fast when managed install is not supported for the backend', async () => {
    const result = await handlers['installManagedRuntime']({ backend: 'gemini' });

    expect(safeExecMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      msg: 'No managed install command is configured for gemini',
    });
  });

  it('emits a failed install event when the managed install command errors', async () => {
    safeExecMock.mockRejectedValue(
      Object.assign(new Error('Command failed with exit code 1'), {
        stdout: 'partial stdout',
        stderr: 'fatal error',
        code: 1,
      })
    );

    const result = await handlers['installManagedRuntime']({ backend: 'codex' });

    expect(hoisted.managedRuntimeInstallEventEmit).toHaveBeenCalledWith({
      backend: 'codex',
      command: 'npm install -g @openai/codex',
      stage: 'failed',
      stdout: 'partial stdout',
      stderr: 'fatal error',
      exitCode: 1,
      message: 'fatal error',
    });
    expect(result).toEqual({
      success: false,
      msg: 'fatal error',
      data: {
        backend: 'codex',
        command: 'npm install -g @openai/codex',
        stdout: 'partial stdout',
        stderr: 'fatal error',
      },
    });
  });

  it('merges configured runtime paths into available agents when PATH detection misses them', async () => {
    vi.mocked(acpDetector.getDetectedAgents).mockReturnValue([{ backend: 'gemini', name: 'Gemini' }] as any);
    hoisted.processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.config') {
        return {
          claude: {
            cliPath: '/Applications/Claude Code.app/Contents/MacOS/claude',
          },
        };
      }
      if (key === 'codex.config') {
        return {
          cliPath: '/opt/codex/bin/codex',
        };
      }
      return undefined;
    });

    const result = await handlers['getAvailableAgents']();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        backend: 'gemini',
        name: 'Gemini',
        cliPath: 'gemini',
        runtimeSource: 'builtin',
      }),
      expect.objectContaining({
        backend: 'claude',
        name: 'Claude Code',
        cliPath: '/Applications/Claude Code.app/Contents/MacOS/claude',
        resolvedCliPath: '/Applications/Claude Code.app/Contents/MacOS/claude',
        runtimeSource: 'configured',
      }),
      expect.objectContaining({
        backend: 'codex',
        name: 'Codex',
        cliPath: '/opt/codex/bin/codex',
        resolvedCliPath: '/opt/codex/bin/codex',
        acpArgs: [],
        runtimeSource: 'configured',
      }),
    ]);
  });

  it('resolves Gemini to the actual executable path for runtime display', async () => {
    vi.mocked(acpDetector.getDetectedAgents).mockReturnValue([{ backend: 'gemini', name: 'Gemini' }] as any);
    safeExecFileMock.mockImplementation(async (command: string, args?: string[]) => {
      if ((command === 'which' || command === '/usr/bin/which') && args?.[0] === 'gemini') {
        return {
          stdout: '/opt/homebrew/bin/gemini\n',
          stderr: '',
        };
      }

      return {
        stdout: '',
        stderr: '',
      };
    });

    const result = await handlers['getAvailableAgents']();

    expect(safeExecFileMock).toHaveBeenCalledWith('/usr/bin/which', ['gemini'], {
      timeout: 1000,
      env: { PATH: '/usr/bin' },
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        backend: 'gemini',
        name: 'Gemini',
        cliPath: 'gemini',
        runtimeSource: 'builtin',
      })
    );
    expect(result.data[0]?.resolvedCliPath).toBe('/opt/homebrew/bin/gemini');
  });

  it('detectCliPath prefers the configured runtime path for built-in backends', async () => {
    hoisted.processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.config') return {};
      if (key === 'codex.config') {
        return {
          cliPath: '/opt/codex/bin/codex',
        };
      }
      return undefined;
    });

    const result = await handlers['detectCliPath']({ backend: 'codex' });

    expect(result).toEqual({
      success: true,
      data: {
        path: '/opt/codex/bin/codex',
      },
    });
  });

  it('uses codex login wording when codex authentication is missing', async () => {
    getEnhancedEnvMock.mockReturnValue({ PATH: '/usr/bin' });
    safeExecFileMock.mockRejectedValue(new Error('not logged in'));
    hoisted.codexStart.mockRejectedValue(new Error('authentication required'));

    vi.resetModules();
    const { initAcpConversationBridge: initBridge } = await import('../../src/process/bridge/acpConversationBridge');
    initBridge(taskManager, conversationService);

    const result = await handlers['checkAgentHealth']({ backend: 'codex' });

    expect(result).toEqual({
      success: false,
      msg: 'codex not authenticated',
      data: {
        available: false,
        error: 'authentication required',
      },
    });
    expect(hoisted.codexStart).toHaveBeenCalled();
  });

  it('treats codex stderr login status as authenticated during health checks', async () => {
    getEnhancedEnvMock.mockReturnValue({ PATH: '/usr/bin' });
    safeExecFileMock.mockResolvedValue({
      stdout: '',
      stderr: 'Logged in using an API key - sk-test',
    });

    vi.resetModules();
    const { initAcpConversationBridge: initBridge } = await import('../../src/process/bridge/acpConversationBridge');
    initBridge(taskManager, conversationService);

    const result = await handlers['checkAgentHealth']({ backend: 'codex' });

    expect(safeExecFileMock).toHaveBeenCalledWith('codex', ['login', 'status'], {
      timeout: 5000,
      env: { PATH: '/usr/bin' },
    });
    expect(result).toEqual({
      success: true,
      data: {
        available: true,
        latency: expect.any(Number),
      },
    });
  });

  it('still starts Codex when login status is unavailable but runtime is actually usable', async () => {
    getEnhancedEnvMock.mockReturnValue({ PATH: '/usr/bin' });
    safeExecFileMock.mockRejectedValue(new Error('status unavailable'));

    vi.resetModules();
    const { initAcpConversationBridge: initBridge } = await import('../../src/process/bridge/acpConversationBridge');
    initBridge(taskManager, conversationService);

    const result = await handlers['checkAgentHealth']({ backend: 'codex' });

    expect(hoisted.codexStart).toHaveBeenCalledWith('codex', expect.any(String));
    expect(hoisted.codexWaitForServerReady).toHaveBeenCalledWith(15000);
    expect(hoisted.codexPing).toHaveBeenCalledWith(5000);
    expect(result).toEqual({
      success: true,
      data: {
        available: true,
        latency: expect.any(Number),
      },
    });
  });
});
