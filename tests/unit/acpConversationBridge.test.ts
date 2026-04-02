import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: vi.fn(() => '/tmp') } }));

const handlers: Record<string, (...args: any[]) => any> = {};
const hoisted = vi.hoisted(() => ({
  conversationListChangedEmit: vi.fn(),
  codexStart: vi.fn(async () => {}),
  codexWaitForServerReady: vi.fn(async () => {}),
  codexPing: vi.fn(async () => true),
  codexStop: vi.fn(async () => {}),
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
      installManagedRuntime: makeChannel('installManagedRuntime'),
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

const processConfigGetMock = vi.fn(async () => undefined);

vi.mock('../../src/process/utils/initStorage', () => ({
  ProcessConfig: {
    get: (...args: unknown[]) => processConfigGetMock(...args),
  },
}));

const listConfiguredOpenClawAgentsMock = vi.fn(() => []);

vi.mock('../../src/process/agent/openclaw/openclawConfig', () => ({
  listConfiguredOpenClawAgents: (...args: unknown[]) => listConfiguredOpenClawAgentsMock(...args),
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
}));

vi.mock('../../src/process/task/AcpAgentManager', () => ({ default: class AcpAgentManager {} }));
vi.mock('../../src/process/task/CodexAgentManager', () => ({ default: class CodexAgentManager {} }));
vi.mock('../../src/process/task/GeminiAgentManager', () => ({ GeminiAgentManager: class GeminiAgentManager {} }));

vi.mock('../../src/process/services/mcpServices/McpService', () => ({
  mcpService: { getSupportedTransportsForAgent: vi.fn(() => []) },
}));

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
    safeExecFileMock.mockReset();
    safeExecFileMock.mockResolvedValue({ stdout: '', stderr: '' });
    hoisted.codexStart.mockReset();
    hoisted.codexStart.mockResolvedValue(undefined);
    hoisted.codexWaitForServerReady.mockReset();
    hoisted.codexWaitForServerReady.mockResolvedValue(undefined);
    hoisted.codexPing.mockReset();
    hoisted.codexPing.mockResolvedValue(true);
    hoisted.codexStop.mockReset();
    hoisted.codexStop.mockResolvedValue(undefined);
    processConfigGetMock.mockImplementation(async (key: string) => {
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
    initAcpConversationBridge(taskManager, conversationService);
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

  it('imports an external session and emits a conversation list update', async () => {
    const result = await handlers['importExternalSession']({ provider: 'codex', sessionId: 'session-1' });

    expect(importSessionMock).toHaveBeenCalledWith({ provider: 'codex', sessionId: 'session-1' });
    expect(result.success).toBe(true);
    expect(hoisted.conversationListChangedEmit).toHaveBeenCalledWith({
      conversationId: 'imported-conversation',
      action: 'created',
      source: 'contextgo',
    });
  });

  it('runs the managed install command and refreshes runtime detection', async () => {
    const result = await handlers['installManagedRuntime']({ backend: 'codex' });

    expect(safeExecMock).toHaveBeenCalledWith('npm install -g @openai/codex', {
      timeout: 15 * 60 * 1000,
      env: { PATH: '/usr/bin' },
    });
    expect(vi.mocked(acpDetector.refreshDetectedAgents)).toHaveBeenCalled();
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

  it('expands OpenClaw into native agent entries when config defines multiple agents', async () => {
    vi.mocked(acpDetector.getDetectedAgents).mockReturnValue([
      { backend: 'gemini', name: 'Gemini' },
      { backend: 'openclaw-gateway', name: 'OpenClaw', cliPath: 'openclaw' },
    ] as any);
    listConfiguredOpenClawAgentsMock.mockReturnValue([
      {
        agentId: 'main',
        name: 'OpenClaw',
        workspace: '/Users/test/.openclaw/workspace',
        isDefault: true,
      },
      {
        agentId: 'reviewer',
        name: 'Reviewer (reviewer)',
        workspace: '/Users/test/.openclaw/workspace-reviewer',
        avatar: '🦞',
        isDefault: false,
      },
    ]);

    const result = await handlers['getAvailableAgents']();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        backend: 'gemini',
        name: 'Gemini',
        cliPath: 'gemini',
        runtimeSource: 'builtin',
        supportedTransports: [],
      }),
      expect.objectContaining({
        backend: 'openclaw-gateway',
        name: 'OpenClaw',
        cliPath: 'openclaw',
        runtimeSource: 'detected',
        openclawAgentId: 'main',
        workspace: '/Users/test/.openclaw/workspace',
        isDefault: true,
        supportedTransports: [],
      }),
      expect.objectContaining({
        backend: 'openclaw-gateway',
        name: 'Reviewer (reviewer)',
        cliPath: 'openclaw',
        runtimeSource: 'detected',
        openclawAgentId: 'reviewer',
        workspace: '/Users/test/.openclaw/workspace-reviewer',
        avatar: '🦞',
        isDefault: false,
        supportedTransports: [],
      }),
    ]);
  });

  it('merges configured runtime paths into available agents when PATH detection misses them', async () => {
    vi.mocked(acpDetector.getDetectedAgents).mockReturnValue([{ backend: 'gemini', name: 'Gemini' }] as any);
    processConfigGetMock.mockImplementation(async (key: string) => {
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
        supportedTransports: [],
      }),
      expect.objectContaining({
        backend: 'claude',
        name: 'Claude Code',
        cliPath: '/Applications/Claude Code.app/Contents/MacOS/claude',
        resolvedCliPath: '/Applications/Claude Code.app/Contents/MacOS/claude',
        runtimeSource: 'configured',
        supportedTransports: [],
      }),
      expect.objectContaining({
        backend: 'codex',
        name: 'Codex',
        cliPath: '/opt/codex/bin/codex',
        resolvedCliPath: '/opt/codex/bin/codex',
        acpArgs: [],
        runtimeSource: 'configured',
        supportedTransports: [],
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
        supportedTransports: [],
      })
    );
    expect(result.data[0]?.resolvedCliPath).toBe('/opt/homebrew/bin/gemini');
  });

  it('detectCliPath prefers the configured runtime path for built-in backends', async () => {
    processConfigGetMock.mockImplementation(async (key: string) => {
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
