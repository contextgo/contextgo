/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDatabase,
  mockGetTask,
  dbState,
  failExternalSessionUpsert,
  mockListAllConversations,
  mockReadCatalogForConversations,
} = vi.hoisted(() => {
  const state = {
    connector: {
      id: 'connector-wechat',
      platform: 'weixin',
      name: 'WeChat',
      enabled: true,
      status: 'running',
      createdAt: 1,
      updatedAt: 1,
    },
    remoteIdentity: {
      id: 'remote_identity_target',
      channelAccountId: 'connector-wechat',
      remoteUserId: 'wx_user_1',
      remoteChatId: 'group:wechat-team',
      remoteChatType: 'group',
      displayName: 'Ops Group',
      authorizedAt: 100,
      lastActive: 100,
    },
    sourceExternalSession: {
      id: 'external_session_source',
      channelAccountId: 'connector-src',
      remoteIdentityId: 'remote_identity_source',
      bindingId: 'binding-source',
      agentProfileId: 'agent_profile_source',
      activeConversationId: 'conversation_source',
      state: 'active',
      createdAt: 100,
      lastActivity: 200,
      metadata: {},
    },
    sourceAgentProfile: {
      id: 'agent_profile_source',
      name: 'Source Agent',
      backend: 'codex',
      modelRef: {
        id: 'model-provider-1',
        useModel: 'gpt-4.1',
      },
      workspaceRef: '/workspace/source',
      toolPolicy: {},
      memoryPolicy: {},
      delegationPolicy: {},
      version: 1,
      archived: false,
      createdAt: 100,
      updatedAt: 100,
    },
    conversation: {
      id: 'conversation_source',
      createTime: 100,
      modifyTime: 100,
      name: 'Source Conversation',
      type: 'acp',
      extra: {
        backend: 'codex',
        workspace: '/workspace/source',
      },
      model: {
        id: 'model-provider-1',
        useModel: 'gpt-4.1',
      },
      source: 'contextgo',
    },
    bindings: [] as Array<Record<string, unknown>>,
    externalSessions: new Map<string, Record<string, unknown>>(),
    mirroredSessions: [] as Array<Record<string, unknown>>,
  };

  let shouldFailExternalSessionUpsert = false;

  const cloneMap = (source: Map<string, Record<string, unknown>>): Map<string, Record<string, unknown>> =>
    new Map(Array.from(source.entries()).map(([k, v]) => [k, { ...v }]));

  const runInTransaction = (fn: () => unknown) => {
    const snapshotBindings = state.bindings.map((entry) => ({ ...entry }));
    const snapshotExternal = cloneMap(state.externalSessions);
    const snapshotMirrored = state.mirroredSessions.map((entry) => ({ ...entry }));
    try {
      const data = fn();
      return { success: true, data };
    } catch (error: unknown) {
      state.bindings = snapshotBindings;
      state.externalSessions = snapshotExternal;
      state.mirroredSessions = snapshotMirrored;
      return { success: false, error: error instanceof Error ? error.message : 'transaction failed' };
    }
  };

  const db = {
    getChannelAccount: vi.fn((_channelAccountId: string) => ({ success: true, data: state.connector })),
    getRemoteIdentityByChannelAccountChat: vi.fn((_channelAccountId: string, _chatId: string) => ({
      success: true,
      data: state.remoteIdentity,
    })),
    getExternalSession: vi.fn((sessionId: string) => ({
      success: true,
      data: sessionId === state.sourceExternalSession.id ? state.sourceExternalSession : null,
    })),
    getExternalSessionByActiveConversation: vi.fn((conversationId: string) => ({
      success: true,
      data: conversationId === state.conversation.id ? state.sourceExternalSession : null,
    })),
    getAgentProfile: vi.fn((profileId: string) => ({
      success: true,
      data: profileId === state.sourceAgentProfile.id ? state.sourceAgentProfile : null,
    })),
    getAgentProfileByPublishedConversation: vi.fn((_conversationId: string) => ({
      success: true,
      data: null,
    })),
    upsertAgentProfile: vi.fn((_profile: unknown) => ({ success: true, data: true })),
    getConversation: vi.fn((conversationId: string) => ({
      success: conversationId === state.conversation.id,
      data: conversationId === state.conversation.id ? state.conversation : undefined,
      error: conversationId === state.conversation.id ? undefined : 'Conversation not found',
    })),
    upsertRemoteIdentity: vi.fn((_identity: unknown) => ({ success: true, data: true })),
    upsertChannelBinding: vi.fn((binding: Record<string, unknown>) => {
      state.bindings.push(binding);
      return { success: true, data: true };
    }),
    getExternalSessionByChannelAccountRemote: vi.fn((_channelAccountId: string, remoteIdentityId: string) => {
      const found =
        Array.from(state.externalSessions.values()).find((session) => session.remoteIdentityId === remoteIdentityId) ??
        null;
      return { success: true, data: found };
    }),
    upsertExternalSession: vi.fn((session: Record<string, unknown>) => {
      if (shouldFailExternalSessionUpsert) {
        return { success: false, error: 'external session write failed' };
      }
      state.externalSessions.set(String(session.id), session);
      return { success: true, data: true };
    }),
    upsertChannelControlLease: vi.fn((_lease: Record<string, unknown>) => ({ success: true, data: true })),
    deleteChannelControlLease: vi.fn((_externalSessionId: string) => ({ success: true, data: true })),
    upsertChannelSession: vi.fn((session: Record<string, unknown>) => {
      state.mirroredSessions.push(session);
      return { success: true, data: true };
    }),
    runInTransaction: vi.fn(runInTransaction),
  };

  return {
    mockGetDatabase: vi.fn(async () => db),
    mockGetTask: vi.fn(),
    mockListAllConversations: vi.fn(),
    mockReadCatalogForConversations: vi.fn(),
    dbState: state,
    failExternalSessionUpsert: {
      get: () => shouldFailExternalSessionUpsert,
      set: (value: boolean) => {
        shouldFailExternalSessionUpsert = value;
      },
    },
  };
});

vi.mock('@process/services/database', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('@/process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: {
    listAllConversations: mockListAllConversations,
  },
}));

vi.mock('@process/channels/core/ProjectChannelPublicationService', () => ({
  ProjectChannelPublicationService: class {
    readCatalogForConversations = mockReadCatalogForConversations;

    resolveConversationWorkspace(conversation: { extra?: Record<string, unknown> }) {
      return typeof conversation.extra?.workspace === 'string' ? conversation.extra.workspace : undefined;
    }

    async getAgentProfileByPublishedConversation() {
      return null;
    }

    async getAgentProfile(_workspace: string, profileId: string) {
      return profileId === dbState.sourceAgentProfile.id ? dbState.sourceAgentProfile : null;
    }
  },
}));

vi.mock('@process/task/workerTaskManagerSingleton', () => ({
  workerTaskManager: {
    getTask: mockGetTask,
  },
}));

import { ChannelContinuationService } from '@process/channels/core/ChannelContinuationService';

describe('ChannelContinuationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.bindings = [];
    dbState.externalSessions = new Map();
    dbState.mirroredSessions = [];
    failExternalSessionUpsert.set(false);
    mockGetTask.mockReturnValue(undefined);
    mockListAllConversations.mockResolvedValue([]);
    mockReadCatalogForConversations.mockResolvedValue({
      workspaces: [],
      agentProfiles: [dbState.sourceAgentProfile],
      bindings: [],
      agentProfileWorkspaceById: { [dbState.sourceAgentProfile.id]: dbState.sourceAgentProfile.workspaceRef },
      bindingWorkspaceById: {},
    });
  });

  it('creates remote_chat continuation binding and mirrors target session in resume mode', async () => {
    const service = new ChannelContinuationService();

    const result = await service.continueSession({
      sourceExternalSessionId: 'external_session_source',
      targetChannelAccountId: 'connector-wechat',
      targetChatId: 'group:wechat-team',
      mode: 'resume',
    });

    expect(result.mode).toBe('resume');
    expect(dbState.bindings).toHaveLength(1);
    expect(dbState.bindings[0]).toEqual(
      expect.objectContaining({
        scopeType: 'remote_chat',
        scopeKey: 'group:wechat-team',
        agentProfileId: 'agent_profile_source',
      })
    );
    expect(dbState.bindings[0]?.metadata).toEqual(
      expect.objectContaining({
        routeTarget: expect.objectContaining({
          type: 'external_session',
          id: 'external_session_source',
          mode: 'resume',
        }),
      })
    );

    const targetSession = dbState.externalSessions.get(result.targetExternalSessionId);
    expect(targetSession).toEqual(
      expect.objectContaining({
        channelAccountId: 'connector-wechat',
        remoteIdentityId: 'remote_identity_target',
        activeConversationId: 'conversation_source',
        bindingId: result.bindingId,
      })
    );

    expect(dbState.externalSessions.get('external_session_source')).toEqual(
      expect.objectContaining({
        activeConversationId: undefined,
        metadata: expect.objectContaining({
          continuation: expect.objectContaining({
            transferredConversationId: 'conversation_source',
            targetExternalSessionId: result.targetExternalSessionId,
          }),
        }),
      })
    );
  });

  it('rejects continuation when source conversation has running task and policy is reject', async () => {
    const service = new ChannelContinuationService();
    mockGetTask.mockReturnValue({
      status: 'running',
      stop: vi.fn(),
    });

    await expect(
      service.continueSession({
        sourceExternalSessionId: 'external_session_source',
        targetChannelAccountId: 'connector-wechat',
        targetChatId: 'group:wechat-team',
        conflictPolicy: 'reject',
      })
    ).rejects.toThrow('Source conversation has a running task');

    expect(dbState.bindings).toHaveLength(0);
  });

  it('rolls back binding write when external session upsert fails', async () => {
    const service = new ChannelContinuationService();
    failExternalSessionUpsert.set(true);

    await expect(
      service.continueSession({
        sourceExternalSessionId: 'external_session_source',
        targetChannelAccountId: 'connector-wechat',
        targetChatId: 'group:wechat-team',
      })
    ).rejects.toThrow('external session write failed');

    expect(dbState.bindings).toHaveLength(0);
    expect(dbState.externalSessions.size).toBe(0);
    expect(dbState.mirroredSessions).toHaveLength(0);
  });

  it('falls back to agent_profile target when source only provides conversation', async () => {
    const service = new ChannelContinuationService();
    const db = await mockGetDatabase();
    vi.mocked(db.getExternalSessionByActiveConversation).mockReturnValueOnce({
      success: true,
      data: null,
    });

    const result = await service.continueSession({
      sourceConversationId: 'conversation_source',
      targetChannelAccountId: 'connector-wechat',
      targetChatId: 'group:wechat-team',
      mode: 'resume',
    });

    expect(result.conversationId).toBe('conversation_source');
    expect(dbState.bindings[0]?.metadata).toEqual(
      expect.objectContaining({
        routeTarget: expect.objectContaining({
          type: 'agent_profile',
        }),
        continuation: expect.objectContaining({
          resumeConversationId: 'conversation_source',
        }),
      })
    );
  });
});
