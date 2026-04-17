import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: vi.fn(() => '/tmp') } }));

const { readWorkspaceCommandLibraryMock, mockContextRuntimeService } = vi.hoisted(() => ({
  readWorkspaceCommandLibraryMock: vi.fn(async () => null),
  mockContextRuntimeService: {
    registerConversation: vi.fn(async () => {}),
    removeConversationContext: vi.fn(async () => {}),
    recordConversationStopped: vi.fn(async () => {}),
    prepareOutgoingTurn: vi.fn(
      async ({
        agentInput,
        agentContent,
      }: {
        agentInput: string;
        agentContent: string;
      }) => ({
        agentInput,
        agentContent,
      })
    ),
  },
}));

// Capture provider handlers so tests can invoke them directly
const handlers: Record<string, (...args: unknown[]) => unknown> = {};
function makeChannel(name: string) {
  return {
    provider: vi.fn((fn: (...args: unknown[]) => unknown) => {
      handlers[name] = fn;
    }),
    emit: vi.fn(),
    invoke: vi.fn(),
  };
}

const applyBeforeUserPromptMock = vi.fn(async (_conversation: unknown, input: string) => ({
  content: input,
  appliedHooks: [],
}));
const prepareFirstMessageMock = vi.fn(async (msg: string) => msg);
const getDatabaseMock = vi.fn(async () => ({
  getExternalSession: vi.fn(() => ({ success: true, data: null })),
  getExternalSessionByActiveConversation: vi.fn(() => ({ success: true, data: null })),
  getChannelControlLease: vi.fn(() => ({ success: true, data: null })),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      create: makeChannel('create'),
      createWithConversation: makeChannel('createWithConversation'),
      get: makeChannel('get'),
      getAssociateConversation: makeChannel('getAssociateConversation'),
      remove: makeChannel('remove'),
      update: makeChannel('update'),
      reset: makeChannel('reset'),
      warmup: makeChannel('warmup'),
      stop: makeChannel('stop'),
      sendMessage: makeChannel('sendMessage'),
      getSlashCommands: makeChannel('getSlashCommands'),
      reloadContext: makeChannel('reloadContext'),
      listMemoryCandidates: makeChannel('listMemoryCandidates'),
      reviewMemoryCandidate: makeChannel('reviewMemoryCandidate'),
      promoteMemoryCandidate: makeChannel('promoteMemoryCandidate'),
      getWorkspace: makeChannel('getWorkspace'),
      getProjectCapabilitySnapshot: makeChannel('getProjectCapabilitySnapshot'),
      responseSearchWorkSpace: makeChannel('responseSearchWorkSpace'),
      confirmation: {
        confirm: makeChannel('confirmation.confirm'),
        list: makeChannel('confirmation.list'),
      },
      approval: {
        check: makeChannel('approval.check'),
      },
      listChanged: { emit: vi.fn() },
    },
    openclawConversation: {
      getRuntime: makeChannel('openclawConversation.getRuntime'),
      getModelInfo: makeChannel('openclawConversation.getModelInfo'),
      setModel: makeChannel('openclawConversation.setModel'),
    },
  },
}));

vi.mock('@process/services/database', () => ({
  getDatabase: (...args: unknown[]) => getDatabaseMock(...args),
}));

vi.mock('@process/utils/initStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@process/utils/initStorage')>();
  return {
    ...actual,
    ProcessChat: { get: vi.fn(async () => []) },
    getSkillsDir: vi.fn(() => '/skills'),
    getBuiltinSkillsCopyDir: vi.fn(() => '/builtin-skills'),
    getSystemDir: vi.fn(() => ({ cacheDir: '/cache' })),
  };
});

vi.mock('@process/bridge/services/workspaceAutomation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@process/bridge/services/workspaceAutomation')>();
  return {
    ...actual,
    readWorkspaceCommandLibrary: (...args: unknown[]) => readWorkspaceCommandLibraryMock(...args),
    resolveWorkspacePath: (workspace?: string) => workspace,
  };
});

vi.mock('@process/bridge/migrationUtils', () => ({
  migrateConversationToDatabase: vi.fn(async () => {}),
}));

vi.mock('@process/agent/gemini', () => ({
  GeminiAgent: { buildFileServer: vi.fn(() => ({})) },
  GeminiApprovalStore: { createKeysFromConfirmation: vi.fn(() => []) },
}));

vi.mock('@process/utils', () => ({
  copyFilesToDirectory: vi.fn(async () => []),
  readDirectoryRecursive: vi.fn(async () => null),
  ensureDirectory: vi.fn(),
  getDataPath: vi.fn(() => '/tmp'),
  resolveBrandStoragePath: vi.fn(() => '/tmp/contextgo.db'),
}));

vi.mock('@process/utils/openclawUtils', () => ({
  computeOpenClawIdentityHash: vi.fn(async () => 'hash'),
}));

vi.mock('@process/task/agentUtils', () => ({
  prepareFirstMessage: (...args: unknown[]) => prepareFirstMessageMock(...args),
}));

vi.mock('@process/services/context/contextServiceSingleton', () => ({
  contextService: {},
  contextRuntimeService: mockContextRuntimeService,
}));

vi.mock('@process/bridge/services/AssistantHookRuntime', () => ({
  AssistantHookRuntime: vi.fn(function AssistantHookRuntime() {
    return {
      applyBeforeUserPrompt: (...args: unknown[]) => applyBeforeUserPromptMock(...args),
    };
  }),
}));

vi.mock('@process/utils/tray', () => ({
  refreshTrayMenu: vi.fn(async () => undefined),
}));

import { initConversationBridge } from '../../src/process/bridge/conversationBridge';
import type { IConversationService } from '../../src/process/services/IConversationService';
import type { ISpaceService } from '../../src/process/services/space/ISpaceService';
import type { IWorkerTaskManager } from '../../src/process/task/IWorkerTaskManager';
import type { TChatConversation } from '../../src/common/config/storage';

function makeService(overrides?: Partial<IConversationService>): IConversationService {
  return {
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversation: vi.fn(),
    getConversation: vi.fn(async () => undefined),
    createWithMigration: vi.fn(),
    listAllConversations: vi.fn(async () => []),
    ...overrides,
  };
}

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

function makeSpaceService(overrides?: Partial<ISpaceService>): ISpaceService {
  return {
    getSpace: vi.fn(async () => undefined),
    listSpaces: vi.fn(async () => []),
    createSpace: vi.fn(async () => {
      throw new Error('not implemented');
    }),
    updateSpace: vi.fn(async () => undefined),
    getSpaceCommandLibrary: vi.fn(async () => []),
    saveSpaceCommandLibrary: vi.fn(async () => []),
    openSpaceVault: vi.fn(async () => ({ opened: true, fallback: 'none', target: '/tmp/vault', obsidianInstalled: true })),
    renameSpace: vi.fn(async () => {}),
    archiveSpace: vi.fn(async () => {}),
    ensureDefaultSpace: vi.fn(async () => ({
      id: 'space-default',
      name: 'Default Space',
      engine: 'vault',
      createTime: 1,
      modifyTime: 1,
    })),
    ...overrides,
  };
}

function makeConversation(id: string, workspace = '/ws', spaceId = 'space-1'): TChatConversation {
  return { id, type: 'gemini', name: 'test', extra: { workspace, spaceId } } as unknown as TChatConversation;
}

describe('conversationBridge', () => {
  let service: IConversationService;
  let taskManager: IWorkerTaskManager;
  let spaceService: ISpaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    readWorkspaceCommandLibraryMock.mockResolvedValue(null);
    applyBeforeUserPromptMock.mockResolvedValue({
      content: 'hooked prompt',
      appliedHooks: ['guard'],
    });
    prepareFirstMessageMock.mockImplementation(async (msg: string) => msg);
    // Re-register providers by re-initializing the bridge
    service = makeService();
    taskManager = makeTaskManager();
    spaceService = makeSpaceService();
    initConversationBridge(service, taskManager, spaceService);
  });

  describe('getAssociateConversation — listAllConversations path', () => {
    it('returns data from injected service without calling getDatabase()', async () => {
      const current = makeConversation('c1', '/ws/project');
      const sibling = makeConversation('c2', '/ws/project');
      const other = makeConversation('c3', '/other');

      vi.mocked(service.getConversation).mockResolvedValue(current);
      vi.mocked(service.listAllConversations).mockResolvedValue([current, sibling, other]);

      const handler = handlers['getAssociateConversation'];
      const result = await handler({ conversation_id: 'c1' });

      expect(service.listAllConversations).toHaveBeenCalled();
      // Only conversations with matching workspace should be returned
      expect(result).toHaveLength(2);
      expect(result.map((c: TChatConversation) => c.id)).toEqual(expect.arrayContaining(['c1', 'c2']));
    });

    it('returns empty array when repo returns empty list', async () => {
      const current = makeConversation('c1', '/ws/project');
      vi.mocked(service.getConversation).mockResolvedValue(current);
      vi.mocked(service.listAllConversations).mockResolvedValue([]);

      const handler = handlers['getAssociateConversation'];
      const result = await handler({ conversation_id: 'c1' });

      expect(result).toEqual([]);
    });

    it('returns empty array when current conversation has no workspace', async () => {
      const noWorkspace = { id: 'c1', type: 'gemini', name: 'test', extra: {} } as unknown as TChatConversation;
      vi.mocked(service.getConversation).mockResolvedValue(noWorkspace);
      vi.mocked(service.listAllConversations).mockClear();

      const handler = handlers['getAssociateConversation'];
      const result = await handler({ conversation_id: 'c1' });

      expect(result).toEqual([]);
    });

    it('returns empty array when current conversation is not found', async () => {
      vi.mocked(service.getConversation).mockResolvedValue(undefined);

      const handler = handlers['getAssociateConversation'];
      const result = await handler({ conversation_id: 'missing' });

      expect(result).toEqual([]);
    });
  });

  describe('createWithConversation — getOrBuildTask rejection', () => {
    it('does not produce unhandled rejection when getOrBuildTask fails', async () => {
      const conversation = makeConversation('new-id');
      vi.mocked(service.createWithMigration).mockResolvedValue(conversation);

      // getOrBuildTask rejects (conversation not yet persisted — race condition)
      const rejectingTaskManager = makeTaskManager({
        getOrBuildTask: vi.fn().mockRejectedValue(new Error('Conversation not found: new-id')),
      });
      initConversationBridge(service, rejectingTaskManager, spaceService);

      // Should complete without throwing / unhandled rejection
      const result = await handlers['createWithConversation']({
        conversation,
        sourceConversationId: undefined,
        migrateSchedule: false,
      });

      expect(result).toEqual(conversation);
      expect(rejectingTaskManager.getOrBuildTask).toHaveBeenCalledWith('new-id');
    });
  });

  describe('createWithConversation — migration params passthrough', () => {
    it('passes sourceWorkspace through to createWithMigration', async () => {
      const conversation = makeConversation('migrated-id');
      vi.mocked(service.createWithMigration).mockResolvedValue(conversation);

      await handlers['createWithConversation']({
        conversation,
        sourceConversationId: 'source-id',
        migrateSchedule: true,
        sourceWorkspace: '/source/workspace',
      });

      expect(service.createWithMigration).toHaveBeenCalledWith({
        conversation,
        sourceConversationId: 'source-id',
        migrateSchedule: true,
        sourceWorkspace: '/source/workspace',
      });
    });
  });

  describe('sendMessage — hook runtime integration', () => {
    it('keeps raw user content but passes transformed prompt to gemini worker payload', async () => {
      const conversation = makeConversation('c1', '/ws/project');
      const sendMessage = vi.fn(async () => undefined);
      const geminiTask = {
        type: 'gemini',
        workspace: '/ws/project',
        sendMessage,
      } as unknown as import('../../src/process/task/IAgentManager').IAgentManager;

      vi.mocked(service.getConversation).mockResolvedValue(conversation);
      vi.mocked(taskManager.getOrBuildTask).mockResolvedValue(geminiTask);

      const handler = handlers['sendMessage'];
      const result = await handler({ conversation_id: 'c1', input: 'raw prompt', files: [] });

      expect(result).toEqual({ success: true });
      expect(applyBeforeUserPromptMock).toHaveBeenCalledWith(conversation, 'raw prompt');
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'raw prompt',
          content: 'raw prompt',
          agentInput: 'hooked prompt',
          agentContent: 'hooked prompt',
        })
      );
    });

    it('applies skills injection on top of hook-transformed prompt', async () => {
      const conversation = makeConversation('c2', '/ws/project');
      const sendMessage = vi.fn(async () => undefined);
      const acpTask = {
        type: 'acp',
        workspace: '/ws/project',
        sendMessage,
      } as unknown as import('../../src/process/task/IAgentManager').IAgentManager;

      vi.mocked(service.getConversation).mockResolvedValue(conversation);
      vi.mocked(taskManager.getOrBuildTask).mockResolvedValue(acpTask);
      prepareFirstMessageMock.mockResolvedValue('skills + hooked prompt');

      const handler = handlers['sendMessage'];
      const result = await handler({
        conversation_id: 'c2',
        input: 'raw prompt',
        files: [],
        injectSkills: ['star-office-helper'],
      });

      expect(result).toEqual({ success: true });
      expect(prepareFirstMessageMock).toHaveBeenCalledWith('hooked prompt', {
        enabledSkills: ['star-office-helper'],
      });
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'raw prompt',
          agentContent: expect.stringContaining('skills + hooked prompt'),
        })
      );
    });
  });

  describe('warmup', () => {
    it('calls getOrBuildTask for the given conversation_id', async () => {
      const handler = handlers['warmup'];
      await handler({ conversation_id: 'test-id' });

      expect(taskManager.getOrBuildTask).toHaveBeenCalledWith('test-id');
    });

    it('calls initAgent() when task type is "acp"', async () => {
      const initAgent = vi.fn();
      const acpTask = { type: 'acp', initAgent };
      vi.mocked(taskManager.getOrBuildTask).mockResolvedValue(acpTask as any);

      const handler = handlers['warmup'];
      await handler({ conversation_id: 'acp-id' });

      expect(taskManager.getOrBuildTask).toHaveBeenCalledWith('acp-id');
      expect(initAgent).toHaveBeenCalled();
    });

    it('does not call initAgent when task type is not "acp"', async () => {
      const initAgent = vi.fn();
      const geminiTask = { type: 'gemini', initAgent };
      vi.mocked(taskManager.getOrBuildTask).mockResolvedValue(geminiTask as any);

      const handler = handlers['warmup'];
      await handler({ conversation_id: 'gemini-id' });

      expect(taskManager.getOrBuildTask).toHaveBeenCalledWith('gemini-id');
      expect(initAgent).not.toHaveBeenCalled();
    });

    it('silently ignores errors (best-effort)', async () => {
      vi.mocked(taskManager.getOrBuildTask).mockRejectedValue(new Error('Task build failed'));

      const handler = handlers['warmup'];
      await expect(handler({ conversation_id: 'failing-id' })).resolves.toBeUndefined();

      expect(taskManager.getOrBuildTask).toHaveBeenCalledWith('failing-id');
    });
  });

  describe('getSlashCommands', () => {
    it('returns workspace-managed libraries even when runtime commands are skipped', async () => {
      vi.mocked(service.getConversation).mockResolvedValue(makeConversation('c1', '/workspace', 'space-1'));
      readWorkspaceCommandLibraryMock.mockResolvedValue([
        {
          id: 'plan',
          enabled: true,
          name: 'workspace-plan',
          description: 'Workspace plan',
          template: 'Write the workspace plan first.',
        },
        {
          id: 'workspace-triage',
          enabled: true,
          name: 'triage',
          description: 'Workspace triage',
          template: 'Use workspace triage.',
        },
      ]);

      const handler = handlers['getSlashCommands'];
      const result = (await handler({
        conversation_id: 'c1',
        includeRuntimeCommands: false,
      })) as {
        success: boolean;
        data: { commands: Array<{ name: string }>; managedLibrary: Array<Record<string, unknown>> };
      };

      expect(result.success).toBe(true);
      expect(result.data.commands).toEqual([]);
      expect(result.data.managedLibrary[0]).toEqual({
        id: 'plan',
        enabled: true,
        name: 'workspace-plan',
        description: 'Workspace plan',
        template: 'Write the workspace plan first.',
      });
      expect(result.data.managedLibrary).toContainEqual({
        id: 'workspace-triage',
        enabled: true,
        name: 'triage',
        description: 'Workspace triage',
        template: 'Use workspace triage.',
      });
      expect(spaceService.getSpaceCommandLibrary).toHaveBeenCalledWith('space-1');
      expect(readWorkspaceCommandLibraryMock).toHaveBeenCalledWith('/workspace');
    });

    it('merges Space commands before project-local commands and lets project-local override by name case-insensitively', async () => {
      vi.mocked(service.getConversation).mockResolvedValue(makeConversation('c1', '/workspace', 'space-commands'));
      vi.mocked(spaceService.getSpaceCommandLibrary).mockResolvedValue([
        {
          id: 'space-plan',
          enabled: true,
          name: 'plan',
          description: 'Shared Space plan',
          template: 'Use the shared Space plan template.',
        },
        {
          id: 'space-verify',
          enabled: true,
          name: 'verify',
          description: 'Shared Space verify',
          template: 'Run the shared Space verification checklist.',
        },
      ]);
      readWorkspaceCommandLibraryMock.mockResolvedValue([
        {
          id: 'project-plan',
          enabled: true,
          name: 'PLAN',
          description: 'Project-local override',
          template: 'Use the project-local plan template.',
        },
        {
          id: 'project-ship',
          enabled: true,
          name: 'ship',
          description: 'Project-local ship',
          template: 'Ship the current change safely.',
        },
      ]);

      const handler = handlers['getSlashCommands'];
      const result = (await handler({
        conversation_id: 'c1',
        includeRuntimeCommands: false,
      })) as {
        success: boolean;
        data: { commands: Array<{ name: string }>; managedLibrary: Array<Record<string, unknown>> };
      };

      expect(result.success).toBe(true);
      expect(result.data.commands).toEqual([]);
      expect(result.data.managedLibrary).toEqual([
        {
          id: 'space-verify',
          enabled: true,
          name: 'verify',
          description: 'Shared Space verify',
          template: 'Run the shared Space verification checklist.',
        },
        {
          id: 'project-plan',
          enabled: true,
          name: 'PLAN',
          description: 'Project-local override',
          template: 'Use the project-local plan template.',
        },
        {
          id: 'project-ship',
          enabled: true,
          name: 'ship',
          description: 'Project-local ship',
          template: 'Ship the current change safely.',
        },
      ]);
    });

    it('returns no managed commands when the conversation has no workspace', async () => {
      vi.mocked(service.getConversation).mockResolvedValue({
        id: 'c1',
        type: 'gemini',
        name: 'No Workspace',
        extra: { spaceId: 'space-1' },
      } as unknown as TChatConversation);

      const handler = handlers['getSlashCommands'];
      const result = (await handler({
        conversation_id: 'c1',
        includeRuntimeCommands: false,
      })) as {
        success: boolean;
        data: { commands: Array<{ name: string }>; managedLibrary: Array<Record<string, unknown>> };
      };

      expect(result.success).toBe(true);
      expect(result.data.commands).toEqual([]);
      expect(result.data.managedLibrary).toEqual([]);
      expect(spaceService.getSpaceCommandLibrary).toHaveBeenCalledWith('space-1');
      expect(readWorkspaceCommandLibraryMock).not.toHaveBeenCalled();
    });

    it('includes ACP runtime commands when requested', async () => {
      const loadAcpSlashCommands = vi.fn(async () => [{ name: 'remote', description: 'Remote command' }]);
      vi.mocked(service.getConversation).mockResolvedValue({
        id: 'acp-1',
        type: 'acp',
        name: 'ACP',
        extra: { workspace: '/workspace', spaceId: 'space-1' },
      } as unknown as TChatConversation);
      vi.mocked(taskManager.getTask).mockReturnValue({
        type: 'acp',
        loadAcpSlashCommands,
      } as unknown as ReturnType<IWorkerTaskManager['getTask']>);

      const handler = handlers['getSlashCommands'];
      const result = (await handler({ conversation_id: 'acp-1' })) as {
        success: boolean;
        data: { commands: Array<{ name: string }>; managedLibrary: Array<Record<string, unknown>> };
      };

      expect(result.success).toBe(true);
      expect(loadAcpSlashCommands).toHaveBeenCalled();
      expect(result.data.commands).toEqual([{ name: 'remote', description: 'Remote command' }]);
      expect(Array.isArray(result.data.managedLibrary)).toBe(true);
    });
  });
});
