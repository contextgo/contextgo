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

  it('prefers temporary overrides over durable chat bindings', async () => {
    const resolver = new ChannelRouteResolver();
    const temporaryOverride: IChannelBinding = {
      id: 'binding-temporary-override',
      connectorId: connector.id,
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
      connectorId: connector.id,
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
      (_connectorId: string, scopeType: IChannelBinding['scopeType']) => {
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

    expect(result.id).toBe('binding-temporary-override');
    expect(mockDb.getChannelBindingsForScope).toHaveBeenCalledWith(connector.id, 'temporary_override', 'group:alpha');
  });

  it('creates a temporary override binding directly from agentProfileId', async () => {
    const resolver = new ChannelRouteResolver();
    mockDb.getAgentProfile.mockReturnValue({
      success: true,
      data: {
        id: 'agent-profile-openclaw',
        name: 'OpenClaw Publication',
        backend: 'openclaw-gateway',
        version: 1,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const result = await (
      resolver as unknown as {
        resolveBinding: (params: {
          connector: IConnectorInstance;
          remoteIdentity: IRemoteIdentity;
          platform: 'telegram';
          overrideAgentProfileId: string;
        }) => Promise<IChannelBinding>;
      }
    ).resolveBinding({
      connector,
      remoteIdentity: {
        id: 'remote_identity_group',
        connectorId: connector.id,
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
      connectorId: connector.id,
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
      connectorId: connector.id,
      scopeType: 'connector_default',
      agentProfileId: 'agent-default',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: 1,
      updatedAt: 1,
    };

    mockDb.getChannelBindingsForScope.mockImplementation(
      (_connectorId: string, scopeType: IChannelBinding['scopeType']) => {
        if (scopeType === 'temporary_override') {
          return { success: true, data: [] };
        }
        if (scopeType === 'remote_chat') {
          return { success: true, data: [disabledRemoteChatBinding] };
        }
        return { success: true, data: [enabledDefaultBinding] };
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
  });
});
