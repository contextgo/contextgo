/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Provider = (payload?: unknown) => Promise<unknown>;

let handlers: Record<string, Provider> = {};

const mockRefreshTrayMenu = vi.fn(async () => {});
const mockContextRuntimeService = {
  registerConversation: vi.fn(async () => {}),
  removeConversationContext: vi.fn(async () => {}),
};

const createCommand = (key: string) => ({
  provider: vi.fn((fn: Provider) => {
    handlers[key] = fn;
  }),
  invoke: vi.fn(),
  emit: vi.fn(),
});

const mockConversationService = {
  createConversation: vi.fn(async () => ({ id: 'conv-created', name: 'Created Conversation', source: 'contextgo' })),
  deleteConversation: vi.fn(async () => {}),
  updateConversation: vi.fn(async () => {}),
  getConversation: vi.fn(async () => ({ id: 'conv-1', source: 'contextgo', name: 'Original Name', type: 'gemini' })),
  createWithMigration: vi.fn(async () => ({ id: 'conv-migrated', source: 'contextgo' })),
  listAllConversations: vi.fn(async () => []),
};

const mockWorkerTaskManager = {
  getTask: vi.fn(),
  getOrBuildTask: vi.fn(async () => ({})),
  addTask: vi.fn(),
  kill: vi.fn(),
  clear: vi.fn(),
  listTasks: vi.fn(() => []),
};

const registerMocks = () => {
  vi.doMock('@/agent/gemini', () => ({
    GeminiAgent: class {},
    GeminiApprovalStore: { getInstance: vi.fn(() => ({})) },
  }));

  vi.doMock('@process/services/database', () => ({
    getDatabase: vi.fn(() => ({
      getUserConversations: vi.fn(() => ({ data: [] })),
    })),
  }));

  vi.doMock('@/common', () => ({
    ipcBridge: {
      openclawConversation: {
        getRuntime: createCommand('openclawConversation.getRuntime'),
        getModelInfo: createCommand('openclawConversation.getModelInfo'),
        setModel: createCommand('openclawConversation.setModel'),
      },
      conversation: {
        create: createCommand('conversation.create'),
        reloadContext: createCommand('conversation.reloadContext'),
        getAssociateConversation: createCommand('conversation.getAssociateConversation'),
        createWithConversation: createCommand('conversation.createWithConversation'),
        remove: createCommand('conversation.remove'),
        update: createCommand('conversation.update'),
        reset: createCommand('conversation.reset'),
        get: createCommand('conversation.get'),
        getWorkspace: createCommand('conversation.getWorkspace'),
        responseSearchWorkSpace: { invoke: vi.fn() },
        stop: createCommand('conversation.stop'),
        getSlashCommands: createCommand('conversation.getSlashCommands'),
        sendMessage: createCommand('conversation.sendMessage'),
        warmup: createCommand('conversation.warmup'),
        listMemoryCandidates: createCommand('conversation.listMemoryCandidates'),
        reviewMemoryCandidate: createCommand('conversation.reviewMemoryCandidate'),
        promoteMemoryCandidate: createCommand('conversation.promoteMemoryCandidate'),
        getProjectCapabilitySnapshot: createCommand('conversation.getProjectCapabilitySnapshot'),
        responseStream: { emit: vi.fn() },
        listChanged: { emit: vi.fn() },
        confirmation: {
          confirm: createCommand('conversation.confirmation.confirm'),
          list: createCommand('conversation.confirmation.list'),
        },
        approval: {
          check: createCommand('conversation.approval.check'),
        },
      },
    },
  }));

  vi.doMock('@process/utils/initStorage', () => ({
    ProcessConfig: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
    getBuiltinSkillsCopyDir: vi.fn(() => '/mock/builtin-skills'),
    getSystemDir: vi.fn(() => ({ cacheDir: '/mock/cache' })),
    getSkillsDir: vi.fn(() => '/mock/skills'),
    ProcessChat: { get: vi.fn(async () => []) },
  }));

  vi.doMock('@/process/task/agentUtils', () => ({
    prepareFirstMessage: vi.fn(),
  }));

  vi.doMock('@process/utils/tray', () => ({
    refreshTrayMenu: mockRefreshTrayMenu,
  }));

  vi.doMock('@/process/utils', () => ({
    copyFilesToDirectory: vi.fn(),
    readDirectoryRecursive: vi.fn(),
  }));

  vi.doMock('@/process/utils/openclawUtils', () => ({
    computeOpenClawIdentityHash: vi.fn(async () => 'identity-hash'),
  }));

  vi.doMock('@process/services/context/contextServiceSingleton', () => ({
    contextService: {},
    contextRuntimeService: mockContextRuntimeService,
  }));

  vi.doMock('@process/bridge/migrationUtils', () => ({
    migrateConversationToDatabase: vi.fn(),
  }));
};

let initConversationBridge: typeof import('@process/bridge/conversationBridge').initConversationBridge;

const getProvider = async (key: string): Promise<Provider> => {
  initConversationBridge(mockConversationService as any, mockWorkerTaskManager as any);

  const provider = handlers[key];
  if (!provider) {
    throw new Error(`Provider ${key} not registered`);
  }

  return provider;
};

describe('conversationBridge tray sync', () => {
  beforeAll(async () => {
    vi.resetModules();
    registerMocks();
    ({ initConversationBridge } = await import('@process/bridge/conversationBridge'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes tray menu after removing a conversation', async () => {
    const removeProvider = await getProvider('conversation.remove');

    const result = await removeProvider({ id: 'conv-1' });

    expect(result).toBe(true);
    expect(mockWorkerTaskManager.kill).toHaveBeenCalledWith('conv-1');
    expect(mockConversationService.deleteConversation).toHaveBeenCalledWith('conv-1');
    expect(mockContextRuntimeService.removeConversationContext).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-1' }),
      []
    );
    expect(mockRefreshTrayMenu).toHaveBeenCalledOnce();
  });

  it('refreshes tray menu after creating a conversation', async () => {
    const createProvider = await getProvider('conversation.create');

    const result = await createProvider({ type: 'gemini' });

    expect(result).toEqual({ id: 'conv-created', name: 'Created Conversation', source: 'contextgo' });
    expect(mockConversationService.createConversation).toHaveBeenCalledOnce();
    expect(mockRefreshTrayMenu).toHaveBeenCalledOnce();
  });

  it('refreshes tray menu after renaming a conversation', async () => {
    const updateProvider = await getProvider('conversation.update');

    const result = await updateProvider({
      id: 'conv-1',
      updates: { name: 'Renamed Conversation' },
    });

    expect(result).toBe(true);
    expect(mockConversationService.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      { name: 'Renamed Conversation' },
      undefined
    );
    expect(mockRefreshTrayMenu).toHaveBeenCalledOnce();
  });
});
