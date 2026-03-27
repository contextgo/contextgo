/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pairingRequestedEmit, userAuthorizedEmit, mockResolveConnectorInstance, mockInferRemoteChatType, mockDb } =
  vi.hoisted(() => ({
    pairingRequestedEmit: vi.fn(),
    userAuthorizedEmit: vi.fn(),
    mockResolveConnectorInstance: vi.fn(),
    mockInferRemoteChatType: vi.fn(),
    mockDb: {
      getPendingPairingRequests: vi.fn(),
      createPairingRequest: vi.fn(),
      getPairingRequestByCode: vi.fn(),
      updatePairingRequestStatus: vi.fn(),
      getRemoteIdentityByConnectorChat: vi.fn(),
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
    resolveConnectorInstance: mockResolveConnectorInstance,
  })),
  inferRemoteChatType: mockInferRemoteChatType,
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
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

    mockDb.getPendingPairingRequests.mockReturnValue({ success: true, data: [] });
    mockDb.createPairingRequest.mockReturnValue({ success: true });
    mockDb.getPairingRequestByCode.mockReturnValue({ success: true, data: null });
    mockDb.updatePairingRequestStatus.mockReturnValue({ success: true, data: true });
    mockDb.getRemoteIdentityByConnectorChat.mockReturnValue({ success: true, data: null });
    mockDb.getChannelUsers.mockReturnValue({ success: true, data: [] });
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
