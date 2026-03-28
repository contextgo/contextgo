/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockProcessConfigGet, mockCreateConversation } = vi.hoisted(() => ({
  mockDb: {
    getRemoteIdentityByConnectorChat: vi.fn(),
    upsertRemoteIdentity: vi.fn(),
    getChannelBindingsForScope: vi.fn(),
    upsertChannelBinding: vi.fn(),
    getAgentProfile: vi.fn(),
    upsertAgentProfile: vi.fn(),
    getExternalSessionByConnectorRemote: vi.fn(),
    upsertExternalSession: vi.fn(),
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

    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: null });
    mockDb.upsertRemoteIdentity.mockReturnValue({ success: true, data: true });
    mockDb.getChannelBindingsForScope.mockReturnValue({ success: true, data: [] });
    mockDb.upsertChannelBinding.mockReturnValue({ success: true, data: true });
    mockDb.getAgentProfile.mockReturnValue({ success: true, data: null });
    mockDb.upsertAgentProfile.mockReturnValue({ success: true, data: true });
    mockDb.getExternalSessionByConnectorRemote.mockReturnValue({ success: true, data: null });
    mockDb.upsertExternalSession.mockReturnValue({ success: true, data: true });

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
      legacyUserId: channelUser.id,
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
      legacyUserId: channelUser.id,
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
      })
    );
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

  it('passes resolved space binding when creating a routed conversation', async () => {
    const resolver = new ChannelRouteResolver();

    await (
      resolver as unknown as {
        createConversation: (
          platform: 'telegram',
          chatId: string,
          profile: {
            backend: string;
            modelRef?: { id: string; useModel: string };
          },
          contextBinding: {
            spaceId?: string;
            mountId?: string;
            workspaceRef?: string;
          }
        ) => Promise<void>;
      }
    ).createConversation(
      'telegram',
      'group:alpha',
      {
        backend: 'codex',
        modelRef: {
          id: 'model-1',
          useModel: 'gpt-5-codex',
        },
      },
      {
        spaceId: 'space-alpha',
        mountId: 'mount-alpha',
        workspaceRef: '/workspace/alpha',
      }
    );

    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'codex',
        channelChatId: 'group:alpha',
        extra: expect.objectContaining({
          spaceId: 'space-alpha',
          mountId: 'mount-alpha',
          workingDirectory: '/workspace/alpha',
          workspace: '/workspace/alpha',
        }),
      })
    );
  });

  it('carries external-session context into newly created target sessions', async () => {
    const resolver = new ChannelRouteResolver();
    const binding: IChannelBinding = {
      id: 'binding-1',
      connectorId: connector.id,
      scopeType: 'remote_chat',
      scopeKey: 'group:alpha',
      agentProfileId: 'agent-1',
      priority: 10,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    await (
      resolver as unknown as {
        ensureExternalSession: (
          connector: IConnectorInstance,
          remoteIdentity: IRemoteIdentity,
          binding: IChannelBinding,
          agentProfile: {
            id: string;
            backend: string;
          },
          bindingContext: {
            spaceId?: string;
            mountId?: string;
            workspaceRef?: string;
          }
        ) => Promise<void>;
      }
    ).ensureExternalSession(
      connector,
      {
        id: 'remote-1',
        connectorId: connector.id,
        remoteChatId: 'group:alpha',
        authorizedAt: 100,
      },
      binding,
      {
        id: 'agent-1',
        backend: 'gemini',
      },
      {
        spaceId: 'space-source',
        mountId: 'mount-source',
        workspaceRef: '/workspace/source',
      }
    );

    expect(mockDb.upsertExternalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-source',
        mountId: 'mount-source',
        workspaceRef: '/workspace/source',
      })
    );
  });
});
