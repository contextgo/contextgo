/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDb,
  mockProcessConfigGet,
  mockCreateConversation,
  mockGetConversation,
  mockListAllConversations,
  mockReadCatalogForConversations,
} = vi.hoisted(() => ({
  mockDb: {
    getChannelAccounts: vi.fn(),
    getRemoteIdentityByChannelAccountChat: vi.fn(),
    getRemoteIdentityByChannelAccountPlatformChat: vi.fn(),
    getConversation: vi.fn(),
    getExternalSessionByChannelAccountRemote: vi.fn(),
    upsertExternalSession: vi.fn(),
    getLegacyChannelUserByPlatform: vi.fn(),
    ensureChannelUserMirror: vi.fn(),
    upsertRemoteIdentity: vi.fn(),
    getChannelBindingsForScope: vi.fn(),
    upsertChannelBinding: vi.fn(),
    getAgentProfile: vi.fn(),
    upsertAgentProfile: vi.fn(),
    updateConversation: vi.fn(),
    updateExternalSessionActivity: vi.fn(),
  },
  mockProcessConfigGet: vi.fn(),
  mockCreateConversation: vi.fn(),
  mockGetConversation: vi.fn(),
  mockListAllConversations: vi.fn(),
  mockReadCatalogForConversations: vi.fn(),
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: mockProcessConfigGet,
  },
}));

vi.mock('@/process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: {
    createConversation: mockCreateConversation,
    getConversation: mockGetConversation,
    listAllConversations: mockListAllConversations,
  },
}));

vi.mock('@process/channels/core/ProjectChannelPublicationService', () => ({
  ProjectChannelPublicationService: class {
    readCatalogForConversations = mockReadCatalogForConversations;
  },
}));

import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import { ChannelRouteResolver, inferRemoteChatType } from '@process/channels/core/ChannelRouteResolver';
import type { IChannelAccount, IChannelBinding, IChannelUser, IRemoteIdentity } from '@process/channels/types';

describe('ChannelRouteResolver', () => {
  const connector: IChannelAccount = {
    id: 'connector-1',
    platform: 'telegram',
    name: 'Telegram',
    enabled: true,
    status: 'running',
    createdAt: 1,
    updatedAt: 1,
  };

  const channelUser: IChannelUser = {
    id: 'remote_identity_existing',
    platformUserId: 'user-1',
    platformType: 'telegram',
    authorizedAt: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.getChannelAccounts.mockReturnValue({ success: true, data: [connector] });
    mockDb.getRemoteIdentityByChannelAccountChat.mockReturnValue({ success: true, data: null });
    mockDb.getRemoteIdentityByChannelAccountPlatformChat.mockReturnValue({ success: true, data: null });
    mockDb.getConversation.mockReturnValue({
      success: true,
      data: {
        id: 'conv-1',
        type: 'gemini',
        extra: {},
        externalSessionId: 'external_session_source',
        rootRunId: 'run-root-1',
      },
    });
    mockDb.getExternalSessionByChannelAccountRemote.mockReturnValue({ success: true, data: null });
    mockDb.upsertExternalSession.mockReturnValue({ success: true, data: true });
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({ success: true, data: null });
    mockDb.ensureChannelUserMirror.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_legacy',
        platformUserId: 'user-1',
        platformType: 'telegram',
        authorizedAt: 100,
      },
    });
    mockDb.upsertRemoteIdentity.mockReturnValue({ success: true, data: true });
    mockDb.getChannelBindingsForScope.mockReturnValue({ success: true, data: [] });
    mockDb.upsertChannelBinding.mockReturnValue({ success: true, data: true });
    mockDb.getAgentProfile.mockReturnValue({ success: true, data: null });
    mockDb.upsertAgentProfile.mockReturnValue({ success: true, data: true });
    mockDb.updateConversation.mockReturnValue({ success: true, data: true });
    mockDb.updateExternalSessionActivity.mockReturnValue({ success: true, data: true });

    mockProcessConfigGet.mockResolvedValue(undefined);
    mockGetConversation.mockResolvedValue(undefined);
    mockListAllConversations.mockResolvedValue([]);
    mockReadCatalogForConversations.mockResolvedValue({
      workspaces: [],
      agentProfiles: [],
      bindings: [],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    mockCreateConversation.mockResolvedValue({
      id: 'conv-1',
      type: 'gemini',
      extra: {},
    });
  });

  it('infers group chats from chat prefixes and provider chat types', () => {
    expect(inferRemoteChatType({ chatId: 'group:abc', platformUserId: 'user-1' })).toBe('group');
    expect(inferRemoteChatType({ chatId: 'oc_chat', platformUserId: 'user-1', remoteChatType: 'p2p' })).toBe('direct');
    expect(inferRemoteChatType({ chatId: '123', platformUserId: '123' })).toBe('direct');
  });

  it('preserves the existing remote user for group chats', async () => {
    const resolver = new ChannelRouteResolver();
    const existingIdentity: IRemoteIdentity = {
      id: 'remote_identity_group',
      channelAccountId: connector.id,
      remoteUserId: 'user-1',
      remoteChatId: 'group:alpha',
      remoteChatType: 'group',
      authorizedAt: 100,
      lastActive: 200,
      legacyUserId: 'assistant_user_legacy',
    };
    mockDb.getRemoteIdentityByChannelAccountChat.mockReturnValue({ success: true, data: existingIdentity });

    const result = await (
      resolver as unknown as {
        ensureRemoteIdentity: (
          connector: IChannelAccount,
          channelUser: IChannelUser,
          platformUserId: string,
          chatId: string,
          platformChatId?: string,
          remoteChatType?: string,
          displayName?: string
        ) => Promise<IRemoteIdentity>;
      }
    ).ensureRemoteIdentity(connector, channelUser, 'user-2', 'group:alpha', undefined, 'group', 'Team Alpha');

    expect(result.remoteUserId).toBe('user-1');
    expect(result.remoteChatType).toBe('group');
    expect(mockDb.upsertRemoteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteUserId: 'user-1',
        remoteChatType: 'group',
        legacyUserId: 'assistant_user_legacy',
      })
    );
  });

  it('refreshes the remote user for direct chats', async () => {
    const resolver = new ChannelRouteResolver();
    const existingIdentity: IRemoteIdentity = {
      id: 'remote_identity_direct',
      channelAccountId: connector.id,
      remoteUserId: 'user-1',
      remoteChatId: 'user:alpha',
      remoteChatType: 'direct',
      authorizedAt: 100,
      lastActive: 200,
      legacyUserId: 'assistant_user_legacy',
    };
    mockDb.getRemoteIdentityByChannelAccountChat.mockReturnValue({ success: true, data: existingIdentity });

    const result = await (
      resolver as unknown as {
        ensureRemoteIdentity: (
          connector: IChannelAccount,
          channelUser: IChannelUser,
          platformUserId: string,
          chatId: string,
          remoteChatType?: string,
          displayName?: string
        ) => Promise<IRemoteIdentity>;
      }
    ).ensureRemoteIdentity(connector, channelUser, 'user-2', 'user:alpha', undefined, 'direct', 'User 2');

    expect(result.remoteUserId).toBe('user-2');
    expect(result.remoteChatType).toBe('direct');
    expect(mockDb.upsertRemoteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteUserId: 'user-2',
        remoteChatType: 'direct',
        legacyUserId: 'assistant_user_legacy',
      })
    );
  });

  it('uses a stable runtime remote identity id when the same peer misses lookup repeatedly', async () => {
    const resolver = new ChannelRouteResolver();
    mockDb.getRemoteIdentityByChannelAccountChat.mockReturnValue({ success: true, data: null });
    mockDb.getRemoteIdentityByChannelAccountPlatformChat.mockReturnValue({ success: true, data: null });

    const ensureRemoteIdentity = (
      resolver as unknown as {
        ensureRemoteIdentity: (
          connector: IChannelAccount,
          channelUser: IChannelUser,
          platformUserId: string,
          chatId: string,
          platformChatId?: string,
          remoteChatType?: string,
          displayName?: string,
          peerScope?: 'chat' | 'thread',
          parentChatId?: string,
          threadId?: string
        ) => Promise<IRemoteIdentity>;
      }
    ).ensureRemoteIdentity;

    const first = await ensureRemoteIdentity(
      connector,
      channelUser,
      'wx-user-1',
      'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      'private',
      'wechat'
    );

    const second = await ensureRemoteIdentity(
      connector,
      channelUser,
      'wx-user-1',
      'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      'private',
      'wechat'
    );

    expect(first.id).toBe(second.id);
    expect(mockDb.upsertRemoteIdentity).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: first.id,
        remoteChatId: 'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      })
    );
    expect(mockDb.upsertRemoteIdentity).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: first.id,
        remoteChatId: 'o9cq809wakXhcmpa1ue2w_prIy0U@im.wechat',
      })
    );
  });

  it('bootstraps legacy direct-chat authorization when only one connector exists', async () => {
    const resolver = new ChannelRouteResolver();
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_legacy',
        platformUserId: 'user-1',
        platformType: 'telegram',
        displayName: 'Legacy User',
        authorizedAt: 88,
        sessionId: 'legacy-session-1',
      },
    });

    const result = await (
      resolver as unknown as {
        ensureChannelUserProjection: (
          connector: IChannelAccount,
          platformUserId: string,
          platform: 'telegram',
          chatId: string,
          platformChatId?: string,
          displayName?: string,
          remoteChatType?: string
        ) => Promise<IChannelUser>;
      }
    ).ensureChannelUserProjection(connector, 'user-1', 'telegram', 'user-1', undefined, 'Legacy User', 'direct');

    expect(result.id.startsWith('remote_identity_')).toBe(true);
    expect(mockDb.upsertRemoteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        channelAccountId: connector.id,
        remoteChatId: 'user-1',
        remoteChatType: 'direct',
        legacyUserId: 'assistant_user_legacy',
      })
    );
    expect(mockDb.ensureChannelUserMirror).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteIdentityId: expect.stringMatching(/^remote_identity_/),
        platformUserId: 'user-1',
        sessionId: 'legacy-session-1',
      })
    );
  });

  it('does not bootstrap legacy direct-chat authorization when multiple connectors share the platform', async () => {
    const resolver = new ChannelRouteResolver();
    mockDb.getChannelAccounts.mockReturnValue({
      success: true,
      data: [
        connector,
        {
          ...connector,
          id: 'connector-2',
        },
      ],
    });
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_legacy',
        platformUserId: 'user-1',
        platformType: 'telegram',
        authorizedAt: 88,
      },
    });

    await expect(
      (
        resolver as unknown as {
          ensureChannelUserProjection: (
            connector: IChannelAccount,
            platformUserId: string,
            platform: 'telegram',
            chatId: string,
            platformChatId?: string,
            displayName?: string,
            remoteChatType?: string
          ) => Promise<IChannelUser>;
        }
      ).ensureChannelUserProjection(connector, 'user-1', 'telegram', 'user-1', undefined, 'Legacy User', 'direct')
    ).rejects.toThrow('User not authorized');
  });

  it('creates a projected user for a published topic audience before a remote identity exists', async () => {
    const resolver = new ChannelRouteResolver();
    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        {
          id: 'binding-topic',
          channelAccountId: connector.id,
          scopeType: 'remote_chat',
          scopeKey: 'oc_group_1:thread:om_topic_root_1',
          agentProfileId: 'agent-topic',
          priority: 0,
          enabled: true,
          temporary: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const result = await (
      resolver as unknown as {
        ensureChannelUserProjection: (
          connector: IChannelAccount,
          platformUserId: string,
          platform: 'lark',
          chatId: string,
          platformChatId?: string,
          displayName?: string,
          remoteChatType?: string,
          peerScope?: 'chat' | 'thread',
          parentChatId?: string,
          threadId?: string
        ) => Promise<IChannelUser>;
      }
    ).ensureChannelUserProjection(
      { ...connector, platform: 'lark', name: 'Feishu' },
      'ou_user_1',
      'lark',
      'oc_group_1:thread:om_topic_root_1',
      'oc_group_1',
      'Topic User',
      'topic',
      'thread',
      'oc_group_1',
      'om_topic_root_1'
    );

    expect(result.id).toMatch(/^remote_identity_published_/);
    expect(result.platformUserId).toBe('ou_user_1');
    expect(result.platformType).toBe('lark');
  });

  it('creates a projected user for a topic when only the parent group is published', async () => {
    const resolver = new ChannelRouteResolver();
    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        {
          id: 'binding-group',
          channelAccountId: connector.id,
          scopeType: 'remote_chat',
          scopeKey: 'oc_group_1',
          agentProfileId: 'agent-group',
          priority: 0,
          enabled: true,
          temporary: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const result = await (
      resolver as unknown as {
        ensureChannelUserProjection: (
          connector: IChannelAccount,
          platformUserId: string,
          platform: 'lark',
          chatId: string,
          platformChatId?: string,
          displayName?: string,
          remoteChatType?: string,
          peerScope?: 'chat' | 'thread',
          parentChatId?: string,
          threadId?: string
        ) => Promise<IChannelUser>;
      }
    ).ensureChannelUserProjection(
      { ...connector, platform: 'lark', name: 'Feishu' },
      'ou_user_1',
      'lark',
      'oc_group_1:thread:om_topic_root_1',
      'oc_group_1',
      'Topic User',
      'topic',
      'thread',
      'oc_group_1',
      'om_topic_root_1'
    );

    expect(result.id).toMatch(/^remote_identity_published_/);
    expect(result.platformUserId).toBe('ou_user_1');
  });

  it('skips remote_user bindings for group chats', async () => {
    const resolver = new ChannelRouteResolver();
    const defaultBinding: IChannelBinding = {
      id: 'binding-default',
      channelAccountId: connector.id,
      scopeType: 'channel_account_default',
      agentProfileId: 'agent-default',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    const remoteUserBinding: IChannelBinding = {
      id: 'binding-remote-user',
      channelAccountId: connector.id,
      scopeType: 'remote_user',
      scopeKey: 'user-2',
      agentProfileId: 'agent-remote-user',
      priority: 10,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    mockDb.getChannelBindingsForScope.mockImplementation(
      (_channelAccountId: string, scopeType: IChannelBinding['scopeType']) => {
        if (scopeType === 'remote_chat') {
          return { success: true, data: [] };
        }
        if (scopeType === 'remote_user') {
          return { success: true, data: [remoteUserBinding] };
        }
        return { success: true, data: [defaultBinding] };
      }
    );

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IChannelAccount;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        channelAccountId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        authorizedAt: 100,
      },
      platform: 'telegram',
    });

    expect(result.id).toBe('binding-default');
    expect(mockDb.getChannelBindingsForScope).not.toHaveBeenCalledWith(connector.id, 'remote_user', 'user-2');
  });

  it('still uses remote_user bindings for direct chats', async () => {
    const resolver = new ChannelRouteResolver();
    const remoteUserBinding: IChannelBinding = {
      id: 'binding-remote-user',
      channelAccountId: connector.id,
      scopeType: 'remote_user',
      scopeKey: 'user-2',
      agentProfileId: 'agent-remote-user',
      priority: 10,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        {
          ...remoteUserBinding,
          channelAccountId: connector.id,
        },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IChannelAccount;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_direct',
        channelAccountId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'user:alpha',
        remoteChatType: 'direct',
        authorizedAt: 100,
      },
      platform: 'telegram',
    });

    expect(result.id).toBe('binding-remote-user');
    expect(mockDb.getChannelBindingsForScope).toHaveBeenCalledWith(connector.id, 'temporary_override', 'user:alpha');
  });

  it('prefers temporary overrides over durable chat bindings', async () => {
    const resolver = new ChannelRouteResolver();
    const temporaryOverride: IChannelBinding = {
      id: 'binding-temporary-override',
      channelAccountId: connector.id,
      scopeType: 'temporary_override',
      scopeKey: 'group:alpha',
      agentProfileId: 'agent-override',
      priority: 100,
      enabled: true,
      temporary: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const remoteChatBinding: IChannelBinding = {
      id: 'binding-remote-chat',
      channelAccountId: connector.id,
      scopeType: 'remote_chat',
      scopeKey: 'group:alpha',
      agentProfileId: 'agent-group-default',
      priority: 20,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    mockDb.getChannelBindingsForScope.mockImplementation(
      (_channelAccountId: string, scopeType: IChannelBinding['scopeType']) => {
        if (scopeType === 'temporary_override') {
          return { success: true, data: [temporaryOverride] };
        }
        if (scopeType === 'remote_chat') {
          return { success: true, data: [remoteChatBinding] };
        }
        return { success: true, data: [] };
      }
    );

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IChannelAccount;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        channelAccountId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        authorizedAt: 100,
      },
      platform: 'telegram',
    });

    expect(result.id).toBe('binding-temporary-override');
    expect(mockDb.getChannelBindingsForScope).toHaveBeenCalledWith(connector.id, 'temporary_override', 'group:alpha');
  });
  it('creates a temporary override binding directly from agentProfileId', async () => {
    const resolver = new ChannelRouteResolver();
    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [
        {
          id: 'agent-profile-openclaw',
          name: 'OpenClaw Publication',
          backend: 'openclaw-gateway',
          version: 1,
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      bindings: [],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IChannelAccount;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
          overrideAgentProfileId: string;
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        channelAccountId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'group:alpha:thread:9',
        remoteChatType: 'thread',
        authorizedAt: 100,
      },
      platform: 'telegram',
      overrideAgentProfileId: 'agent-profile-openclaw',
    });

    expect(result.scopeType).toBe('temporary_override');
    expect(result.scopeKey).toBe('group:alpha:thread:9');
    expect(result.agentProfileId).toBe('agent-profile-openclaw');
    expect(result.temporary).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        source: 'agent-select',
        overrideMode: 'agent-profile',
      })
    );
    expect(mockDb.upsertChannelBinding).toHaveBeenCalledWith(
      expect.objectContaining({ agentProfileId: 'agent-profile-openclaw' })
    );
  });

  it('ignores disabled bindings even if the repository returns them', async () => {
    const resolver = new ChannelRouteResolver();
    const disabledRemoteChatBinding: IChannelBinding = {
      id: 'binding-disabled-chat',
      channelAccountId: connector.id,
      scopeType: 'remote_chat',
      scopeKey: 'group:alpha',
      agentProfileId: 'agent-disabled',
      priority: 100,
      enabled: false,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const enabledDefaultBinding: IChannelBinding = {
      id: 'binding-default',
      channelAccountId: connector.id,
      scopeType: 'channel_account_default',
      agentProfileId: 'agent-default',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        { ...disabledRemoteChatBinding, channelAccountId: connector.id },
        { ...enabledDefaultBinding, channelAccountId: connector.id },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IChannelAccount;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        channelAccountId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        authorizedAt: 100,
      },
      platform: 'telegram',
    });

    expect(result.id).toBe('binding-default');
  });

  it('reconstructs google auth gemini models when creating conversations from published agents', async () => {
    const resolver = new ChannelRouteResolver();
    mockProcessConfigGet.mockResolvedValue([]);
    mockListAllConversations.mockResolvedValue([]);
    mockReadCatalogForConversations.mockResolvedValue({
      workspaces: [],
      agentProfiles: [],
      bindings: [],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    mockCreateConversation.mockResolvedValue({
      id: 'conv-google-auth',
      type: 'gemini',
      extra: {},
    });

    await (
      resolver as unknown as {
        createConversation: (
          platform: 'telegram',
          chatId: string,
          agentProfile: {
            id: string;
            name: string;
            backend: string;
            modelRef: {
              id: string;
              useModel: string;
              platform?: string;
              name?: string;
              baseUrl?: string;
            };
            version: number;
            archived: boolean;
            createdAt: number;
            updatedAt: number;
          }
        ) => Promise<{ id: string; type: string; extra: Record<string, never> }>;
      }
    ).createConversation('telegram', 'group:alpha', {
      id: 'agent-google-auth',
      name: 'Gemini Agent',
      backend: 'gemini',
      modelRef: {
        id: GOOGLE_AUTH_PROVIDER_ID,
        useModel: 'gemini-2.5-pro',
        platform: 'gemini-with-google-auth',
        name: 'Gemini',
        baseUrl: '',
      },
      version: 1,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    });

    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'gemini',
        model: expect.objectContaining({
          id: GOOGLE_AUTH_PROVIDER_ID,
          platform: 'gemini-with-google-auth',
          useModel: 'gemini-2.5-pro',
          apiKey: '',
        }),
      })
    );
  });

  it('restores the source space binding when creating a conversation from an older published agent profile', async () => {
    const resolver = new ChannelRouteResolver();
    mockProcessConfigGet.mockResolvedValue([]);
    mockGetConversation.mockResolvedValue({
      id: 'conversation-source-1',
      type: 'acp',
      extra: {
        spaceId: 'space-temp-1',
        workspace: '/workspace/project',
      },
    });
    mockCreateConversation.mockResolvedValue({
      id: 'conv-restored-space',
      type: 'gemini',
      extra: {},
    });

    await (
      resolver as unknown as {
        createConversation: (
          platform: 'telegram',
          chatId: string,
          agentProfile: {
            id: string;
            name: string;
            backend: string;
            workspaceRef?: string;
            publishedFromConversationId?: string;
            version: number;
            archived: boolean;
            createdAt: number;
            updatedAt: number;
          }
        ) => Promise<{ id: string; type: string; extra: Record<string, never> }>;
      }
    ).createConversation('telegram', 'group:alpha', {
      id: 'agent-legacy-publication',
      name: 'Legacy Publication',
      backend: 'gemini',
      workspaceRef: '/workspace/project',
      publishedFromConversationId: 'conversation-source-1',
      version: 1,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    });

    expect(mockGetConversation).toHaveBeenCalledWith('conversation-source-1');
    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          workspace: '/workspace/project',
          spaceId: 'space-temp-1',
        }),
      })
    );
  });

  it('creates published codex conversations as acp sessions with codex backend metadata', async () => {
    const resolver = new ChannelRouteResolver();
    mockProcessConfigGet.mockResolvedValue([]);
    mockCreateConversation.mockResolvedValue({
      id: 'conv-published-codex',
      type: 'acp',
      extra: {},
    });

    await (
      resolver as unknown as {
        createConversation: (
          platform: 'weixin',
          chatId: string,
          agentProfile: {
            id: string;
            name: string;
            backend: string;
            workspaceRef?: string;
            promptProfile?: Record<string, unknown>;
            modelRef?: {
              id: string;
              useModel: string;
              platform?: string;
              name?: string;
              baseUrl?: string;
            };
            version: number;
            archived: boolean;
            createdAt: number;
            updatedAt: number;
          }
        ) => Promise<{ id: string; type: string; extra: Record<string, never> }>;
      }
    ).createConversation('weixin', 'wx-user-1', {
      id: 'agent-published-codex',
      name: 'Published Codex',
      backend: 'codex',
      workspaceRef: '/workspace/project',
      promptProfile: {
        agentName: 'Published Codex',
        customAgentId: 'assistant-codex',
        cliPath: 'codex',
      },
      modelRef: {
        id: 'provider-codex',
        useModel: 'gpt-5.4',
        platform: 'openai',
        name: 'Codex',
        baseUrl: '',
      },
      version: 1,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    });

    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'acp',
        source: 'weixin',
        extra: expect.objectContaining({
          workspace: '/workspace/project',
          backend: 'codex',
          agentName: 'Published Codex',
          customAgentId: 'assistant-codex',
          cliPath: 'codex',
          currentModelId: 'gpt-5.4',
        }),
      })
    );
  });

  it('reuses an existing acp codex conversation for the same published external session', async () => {
    const resolver = new ChannelRouteResolver();
    mockDb.getConversation.mockReturnValue({
      success: true,
      data: {
        id: 'conv-codex-acp',
        type: 'acp',
        extra: {
          backend: 'codex',
        },
        externalSessionId: 'external_session_target',
        rootRunId: 'run-root-codex',
      },
    });

    const result = await (
      resolver as unknown as {
        ensureConversation: (params: {
          platform: 'weixin';
          chatId: string;
          externalSession: {
            id: string;
            bindingId: string;
            activeConversationId: string;
          };
          agentProfile: {
            id: string;
            backend: string;
          };
          forceNewConversation?: boolean;
        }) => Promise<{
          id: string;
          type: string;
          extra: Record<string, unknown>;
          externalSessionId?: string;
          rootRunId?: string;
        }>;
      }
    ).ensureConversation({
      platform: 'weixin',
      chatId: 'wx-user-1',
      externalSession: {
        id: 'external_session_target',
        bindingId: 'binding-target',
        activeConversationId: 'conv-codex-acp',
      },
      agentProfile: {
        id: 'agent-codex',
        backend: 'codex',
      },
    });

    expect(result.id).toBe('conv-codex-acp');
    expect(result.type).toBe('acp');
    expect(result.rootRunId).toBe('run-root-codex');
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it('mirrors a published profile and binding into the global db before creating an external session', async () => {
    const resolver = new ChannelRouteResolver();
    let mirroredProfile = false;
    let mirroredBinding = false;

    mockDb.getExternalSessionByChannelAccountRemote.mockReturnValue({ success: true, data: null });
    mockDb.upsertAgentProfile.mockImplementation(() => {
      mirroredProfile = true;
      return { success: true, data: true };
    });
    mockDb.upsertChannelBinding.mockImplementation(() => {
      mirroredBinding = mirroredProfile;
      return { success: true, data: true };
    });
    mockDb.upsertExternalSession.mockImplementation(() =>
      mirroredProfile && mirroredBinding
        ? { success: true, data: true }
        : { success: false, error: 'FOREIGN KEY constraint failed' }
    );

    const binding: IChannelBinding = {
      id: 'binding-published-1',
      channelAccountId: connector.id,
      scopeType: 'remote_user',
      scopeKey: 'user-1',
      agentProfileId: 'agent-published-1',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    const session = await (
      resolver as unknown as {
        ensureExternalSession: (
          connector: IChannelAccount,
          remoteIdentity: IRemoteIdentity,
          binding: IChannelBinding,
          agentProfile: {
            id: string;
            name: string;
            backend: string;
            workspaceRef?: string;
            version: number;
            archived: boolean;
            createdAt: number;
            updatedAt: number;
          }
        ) => Promise<{
          id: string;
          channelAccountId: string;
          remoteIdentityId: string;
          bindingId?: string;
          agentProfileId: string;
        }>;
      }
    ).ensureExternalSession(
      connector,
      {
        id: 'remote_identity_direct',
        channelAccountId: connector.id,
        remoteUserId: 'user-1',
        remoteChatId: 'user:alpha',
        remoteChatType: 'direct',
        authorizedAt: 100,
      },
      binding,
      {
        id: 'agent-published-1',
        name: 'Published Agent',
        backend: 'gemini',
        workspaceRef: '/workspace/project',
        version: 1,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
      }
    );

    expect(mockDb.upsertAgentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent-published-1',
      })
    );
    expect(mockDb.upsertChannelBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'binding-published-1',
        agentProfileId: 'agent-published-1',
      })
    );
    expect(mockDb.upsertExternalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingId: 'binding-published-1',
        agentProfileId: 'agent-published-1',
      })
    );
    expect(session.bindingId).toBe('binding-published-1');
    expect(session.agentProfileId).toBe('agent-published-1');
  });

  it('transfers conversation ownership when reusing an existing conversation', async () => {
    const resolver = new ChannelRouteResolver();

    const result = await (
      resolver as unknown as {
        ensureConversation: (params: {
          platform: 'telegram';
          chatId: string;
          externalSession: {
            id: string;
            bindingId: string;
            activeConversationId: string;
          };
          agentProfile: {
            id: string;
            backend: string;
          };
          forceNewConversation?: boolean;
        }) => Promise<{
          id: string;
          type: string;
          extra: Record<string, never>;
          externalSessionId?: string;
          rootRunId?: string;
        }>;
      }
    ).ensureConversation({
      platform: 'telegram',
      chatId: 'group:alpha',
      externalSession: {
        id: 'external_session_target',
        bindingId: 'binding-target',
        activeConversationId: 'conv-1',
      },
      agentProfile: {
        id: 'agent-1',
        backend: 'gemini',
      },
    });

    expect(result.externalSessionId).toBe('external_session_target');
    expect(mockDb.updateConversation).toHaveBeenCalledWith('conv-1', {
      externalSessionId: 'external_session_target',
      rootRunId: 'run-root-1',
    });
  });
});
