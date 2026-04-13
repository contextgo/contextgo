/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pairingRequestedEmit, userAuthorizedEmit, mockResolveConnectorInstance, mockInferRemoteChatType, mockDb, mockListAllConversations, mockReadCatalogForConversations } =
  vi.hoisted(() => ({
    pairingRequestedEmit: vi.fn(),
    userAuthorizedEmit: vi.fn(),
    mockResolveConnectorInstance: vi.fn(),
    mockInferRemoteChatType: vi.fn(),
    mockListAllConversations: vi.fn(),
    mockReadCatalogForConversations: vi.fn(),
    mockDb: {
      getConnectorInstances: vi.fn(),
      getPendingPairingRequests: vi.fn(),
      createPairingRequest: vi.fn(),
      getPairingRequestByCode: vi.fn(),
      updatePairingRequestStatus: vi.fn(),
      getRemoteIdentityByConnectorChat: vi.fn(),
      getRemoteIdentityByConnectorPlatformChat: vi.fn(),
      getLegacyChannelUserByPlatform: vi.fn(),
      getChannelUsers: vi.fn(),
      upsertRemoteIdentity: vi.fn(),
      ensureChannelUserMirror: vi.fn(),
    },
  }));

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    pairingRequested: { emit: pairingRequestedEmit },
    userAuthorized: { emit: userAuthorizedEmit },
  },
}));

vi.mock('@process/channels/core/ChannelRouteResolver', () => ({
  getChannelRouteResolver: vi.fn(() => ({
    resolveChannelAccount: mockResolveConnectorInstance,
    resolveConnectorInstance: mockResolveConnectorInstance,
  })),
  inferRemoteChatType: mockInferRemoteChatType,
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

vi.mock('@/process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: {
    listAllConversations: mockListAllConversations,
  },
}));

vi.mock('@process/channels/core/ProjectChannelPublicationService', () => ({
  ProjectChannelPublicationService: class {
    readCatalogForConversations = mockReadCatalogForConversations;
  },
}));

import { PairingService } from '@process/channels/pairing/PairingService';

describe('PairingService', () => {
  let services: PairingService[];

  beforeEach(() => {
    services = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'));
    vi.clearAllMocks();

    mockResolveConnectorInstance.mockResolvedValue({ id: 'connector-b' });
    mockInferRemoteChatType.mockImplementation(
      ({ chatId, platformUserId }: { chatId: string; platformUserId: string }) =>
        chatId === platformUserId || chatId.startsWith('user:')
          ? 'direct'
          : chatId.startsWith('group:')
            ? 'group'
            : undefined
    );

    mockDb.getConnectorInstances.mockReturnValue({
      success: true,
      data: [{ id: 'connector-b', platform: 'telegram' }],
    });
    mockDb.getPendingPairingRequests.mockReturnValue({ success: true, data: [] });
    mockDb.createPairingRequest.mockReturnValue({ success: true });
    mockDb.getPairingRequestByCode.mockReturnValue({ success: true, data: null });
    mockDb.updatePairingRequestStatus.mockReturnValue({ success: true, data: true });
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: null });
    mockDb.getRemoteIdentityByConnectorPlatformChat.mockReturnValue({ success: true, data: null });
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({ success: true, data: null });
    mockDb.getChannelUsers.mockReturnValue({ success: true, data: [] });
    mockListAllConversations.mockResolvedValue([]);
    mockReadCatalogForConversations.mockResolvedValue({
      workspaces: [],
      agentProfiles: [],
      bindings: [],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });
    mockDb.upsertRemoteIdentity.mockReturnValue({ success: true, data: true });
    mockDb.ensureChannelUserMirror.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_1',
        platformUserId: 'user-1',
        platformType: 'telegram',
        authorizedAt: Date.now(),
      },
    });
  });

  afterEach(() => {
    for (const service of services) {
      service.stop();
    }
    vi.useRealTimers();
  });

  function createService(): PairingService {
    const service = new PairingService();
    services.push(service);
    return service;
  }

  it('reuses only pending codes from the same connector scope', async () => {
    const service = createService();
    mockDb.getPendingPairingRequests.mockReturnValue({
      success: true,
      data: [
        {
          code: '111111',
          connectorId: 'connector-a',
          platformUserId: 'user-1',
          platformType: 'telegram',
          remoteChatId: 'chat-1',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          status: 'pending',
        },
        {
          code: '222222',
          connectorId: 'connector-b',
          platformUserId: 'user-1',
          platformType: 'telegram',
          remoteChatId: 'chat-1',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          status: 'pending',
        },
      ],
    });

    const result = await service.generatePairingCode('user-1', 'telegram', 'User 1', 'chat-1', 'telegram_b');

    expect(result.code).toBe('222222');
    expect(mockDb.createPairingRequest).not.toHaveBeenCalled();
  });

  it('checks pending pairing status within the current connector scope', async () => {
    const service = createService();
    mockDb.getPendingPairingRequests.mockReturnValue({
      success: true,
      data: [
        {
          code: '111111',
          connectorId: 'connector-a',
          platformUserId: 'user-1',
          platformType: 'telegram',
          remoteChatId: 'chat-1',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          status: 'pending',
        },
        {
          code: '222222',
          connectorId: 'connector-b',
          platformUserId: 'user-1',
          platformType: 'telegram',
          remoteChatId: 'chat-1',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          status: 'pending',
        },
      ],
    });

    const result = await service.getPendingRequestForUser('user-1', 'telegram', 'chat-1', 'telegram_b');

    expect(result?.code).toBe('222222');
  });

  it('requires an approved remote identity for direct chats', async () => {
    const service = createService();
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: null });
    mockDb.getChannelUsers.mockReturnValue({
      success: true,
      data: [
        {
          id: 'assistant_user_legacy',
          platformUserId: 'user-1',
          platformType: 'telegram',
          authorizedAt: Date.now(),
        },
      ],
    });

    const authorized = await service.isUserAuthorized('user-1', 'telegram', 'user-1', 'telegram_b');

    expect(authorized).toBe(false);
  });

  it('accepts legacy direct-chat authorization when only one connector exists', async () => {
    const service = createService();
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_legacy',
        platformUserId: 'user-1',
        platformType: 'telegram',
        authorizedAt: Date.now(),
      },
    });

    const authorized = await service.isUserAuthorized('user-1', 'telegram', 'user-1', 'telegram_b');

    expect(authorized).toBe(true);
  });

  it('does not accept legacy direct-chat authorization when multiple connectors share the platform', async () => {
    const service = createService();
    mockDb.getConnectorInstances.mockReturnValue({
      success: true,
      data: [
        { id: 'connector-a', platform: 'telegram' },
        { id: 'connector-b', platform: 'telegram' },
      ],
    });
    mockDb.getLegacyChannelUserByPlatform.mockReturnValue({
      success: true,
      data: {
        id: 'assistant_user_legacy',
        platformUserId: 'user-1',
        platformType: 'telegram',
        authorizedAt: Date.now(),
      },
    });

    const authorized = await service.isUserAuthorized('user-1', 'telegram', 'user-1', 'telegram_b');

    expect(authorized).toBe(false);
  });

  it('accepts authorization through parent platform chat for thread peers', async () => {
    const service = createService();
    mockDb.getRemoteIdentityByConnectorPlatformChat.mockReturnValue({
      success: true,
      data: {
        id: 'remote-parent-1',
        connectorId: 'connector-b',
        remoteUserId: 'user-1',
        remoteChatId: 'discord://guild/guild-1/channel/channel-parent-1',
        platformChatId: 'channel-parent-1',
        remoteChatType: 'group',
        authorizedAt: Date.now(),
      },
    });

    const authorized = await service.isUserAuthorized(
      'user-1',
      'discord',
      'channel-parent-1:thread:thread-1',
      'discord_default',
      'channel-parent-1'
    );

    expect(authorized).toBe(true);
    expect(mockDb.getRemoteIdentityByConnectorPlatformChat).toHaveBeenCalledWith('connector-b', 'channel-parent-1');
  });

  it('treats a published topic audience as authorized even before pairing identity exists', async () => {
    const service = createService();
    mockInferRemoteChatType.mockReturnValue('group');
    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        {
          id: 'binding-topic',
          connectorId: 'connector-b',
          channelAccountId: 'connector-b',
          scopeType: 'remote_chat',
          scopeKey: 'oc_topic_1:thread:om_topic_root_1',
          agentProfileId: 'agent-topic',
          priority: 0,
          enabled: true,
          temporary: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const authorized = await service.isUserAuthorized(
      'ou_user_1',
      'lark',
      'oc_topic_1:thread:om_topic_root_1',
      'lark_default',
      'oc_topic_1',
      'topic'
    );

    expect(authorized).toBe(true);
  });

  it('treats a published parent group audience as authorization for child topics', async () => {
    const service = createService();
    mockInferRemoteChatType.mockReturnValue('group');
    mockReadCatalogForConversations.mockResolvedValueOnce({
      workspaces: [],
      agentProfiles: [],
      bindings: [
        {
          id: 'binding-group',
          connectorId: 'connector-b',
          channelAccountId: 'connector-b',
          scopeType: 'remote_chat',
          scopeKey: 'oc_group_1',
          agentProfileId: 'agent-group',
          priority: 0,
          enabled: true,
          temporary: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      agentProfileWorkspaceById: {},
      bindingWorkspaceById: {},
    });

    const authorized = await service.isUserAuthorized(
      'ou_user_1',
      'lark',
      'oc_group_1:thread:om_topic_root_1',
      'lark_default',
      'oc_group_1',
      'topic'
    );

    expect(authorized).toBe(true);
  });

  it('authorizes a remote user directly without creating a pending pairing code', async () => {
    const service = createService();

    const result = await service.authorizeRemoteUser({
      platformUserId: 'wx-user-1',
      platformType: 'weixin',
      displayName: 'Scanner',
      chatId: 'wx-user-1',
      pluginId: 'weixin_default',
      metadata: {
        source: 'weixin-qr-login',
      },
    });

    expect(result.success).toBe(true);
    expect(mockDb.upsertRemoteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: 'connector-b',
        remoteChatId: 'wx-user-1',
        remoteUserId: 'wx-user-1',
        metadata: expect.objectContaining({ source: 'weixin-qr-login' }),
      })
    );
    expect(mockDb.updatePairingRequestStatus).not.toHaveBeenCalled();
    expect(userAuthorizedEmit).toHaveBeenCalledWith(expect.objectContaining({ id: result.user?.id }));
  });

  it('returns remote identity ids after approving pairing', async () => {
    const service = createService();
    mockDb.getPairingRequestByCode.mockReturnValue({
      success: true,
      data: {
        code: '654321',
        connectorId: 'connector-b',
        platformUserId: 'user-1',
        platformType: 'telegram',
        remoteChatId: 'chat-1',
        displayName: 'User 1',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        status: 'pending',
      },
    });

    const result = await service.approvePairing('654321');

    expect(result.success).toBe(true);
    expect(result.user?.id.startsWith('remote_identity_')).toBe(true);
    expect(result.user?.id).not.toBe('assistant_user_1');
    expect(userAuthorizedEmit).toHaveBeenCalledWith(expect.objectContaining({ id: result.user?.id }));
  });
});
