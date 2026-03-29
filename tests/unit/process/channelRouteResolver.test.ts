/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockProcessConfigGet, mockCreateConversation } = vi.hoisted(() => ({
  mockDb: {
    getConnectorInstances: vi.fn(),
    getRemoteIdentityByConnectorChat: vi.fn(),
    getConversation: vi.fn(),
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
  },
}));

import { ChannelRouteResolver, inferRemoteChatType } from '@process/channels/core/ChannelRouteResolver';
import type { IChannelBinding, IChannelUser, IConnectorInstance, IRemoteIdentity } from '@process/channels/types';

describe('ChannelRouteResolver', () => {
  const connector: IConnectorInstance = {
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

    mockDb.getConnectorInstances.mockReturnValue({ success: true, data: [connector] });
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: null });
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
      connectorId: connector.id,
      remoteUserId: 'user-1',
      remoteChatId: 'group:alpha',
      remoteChatType: 'group',
      authorizedAt: 100,
      lastActive: 200,
      legacyUserId: 'assistant_user_legacy',
    };
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: existingIdentity });

    const result = await (
      resolver as unknown as {
        ensureRemoteIdentity: (
          connector: IConnectorInstance,
          channelUser: IChannelUser,
          platformUserId: string,
          chatId: string,
          remoteChatType?: string,
          displayName?: string
        ) => Promise<IRemoteIdentity>;
      }
    ).ensureRemoteIdentity(connector, channelUser, 'user-2', 'group:alpha', 'group', 'Team Alpha');

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
      connectorId: connector.id,
      remoteUserId: 'user-1',
      remoteChatId: 'user:alpha',
      remoteChatType: 'direct',
      authorizedAt: 100,
      lastActive: 200,
      legacyUserId: 'assistant_user_legacy',
    };
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: existingIdentity });

    const result = await (
      resolver as unknown as {
        ensureRemoteIdentity: (
          connector: IConnectorInstance,
          channelUser: IChannelUser,
          platformUserId: string,
          chatId: string,
          remoteChatType?: string,
          displayName?: string
        ) => Promise<IRemoteIdentity>;
      }
    ).ensureRemoteIdentity(connector, channelUser, 'user-2', 'user:alpha', 'direct', 'User 2');

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
          connector: IConnectorInstance,
          platformUserId: string,
          platform: 'telegram',
          chatId: string,
          displayName?: string,
          remoteChatType?: string
        ) => Promise<IChannelUser>;
      }
    ).ensureChannelUserProjection(connector, 'user-1', 'telegram', 'user-1', 'Legacy User', 'direct');

    expect(result.id.startsWith('remote_identity_')).toBe(true);
    expect(mockDb.upsertRemoteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: connector.id,
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
    mockDb.getConnectorInstances.mockReturnValue({
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
            connector: IConnectorInstance,
            platformUserId: string,
            platform: 'telegram',
            chatId: string,
            displayName?: string,
            remoteChatType?: string
          ) => Promise<IChannelUser>;
        }
      ).ensureChannelUserProjection(connector, 'user-1', 'telegram', 'user-1', 'Legacy User', 'direct')
    ).rejects.toThrow('User not authorized');
  });

  it('skips remote_user bindings for group chats', async () => {
    const resolver = new ChannelRouteResolver();
    const defaultBinding: IChannelBinding = {
      id: 'binding-default',
      connectorId: connector.id,
      scopeType: 'connector_default',
      agentProfileId: 'agent-default',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    const remoteUserBinding: IChannelBinding = {
      id: 'binding-remote-user',
      connectorId: connector.id,
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
      (_connectorId: string, scopeType: IChannelBinding['scopeType']) => {
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
          connector: IConnectorInstance;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        connectorId: connector.id,
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
      connectorId: connector.id,
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
      (_connectorId: string, scopeType: IChannelBinding['scopeType']) => {
        if (scopeType === 'remote_chat') {
          return { success: true, data: [] };
        }
        if (scopeType === 'remote_user') {
          return { success: true, data: [remoteUserBinding] };
        }
        return { success: true, data: [] };
      }
    );

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IConnectorInstance;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_direct',
        connectorId: connector.id,
        remoteUserId: 'user-2',
        remoteChatId: 'user:alpha',
        remoteChatType: 'direct',
        authorizedAt: 100,
      },
      platform: 'telegram',
    });

    expect(result.id).toBe('binding-remote-user');
    expect(mockDb.getChannelBindingsForScope).toHaveBeenCalledWith(connector.id, 'remote_user', 'user-2');
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
