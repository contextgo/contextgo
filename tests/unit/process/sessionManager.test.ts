/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    getChannelSessions: vi.fn(),
    upsertChannelSession: vi.fn(),
    getExternalSession: vi.fn(),
    getChannelBinding: vi.fn(),
    deleteChannelBinding: vi.fn(),
    deleteChannelSession: vi.fn(),
  },
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

import { SessionManager } from '@process/channels/core/SessionManager';
import type { IChannelSession } from '@process/channels/types';

describe('SessionManager', () => {
  const baseSession: IChannelSession = {
    id: 'external_session_1',
    userId: 'remote_identity_1',
    agentType: 'gemini',
    conversationId: 'conversation-1',
    chatId: 'group:alpha',
    createdAt: 100,
    lastActivity: 200,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getChannelSessions.mockReturnValue({ success: true, data: [] });
    mockDb.upsertChannelSession.mockReturnValue({ success: true, data: true });
    mockDb.getExternalSession.mockReturnValue({ success: true, data: null });
    mockDb.getChannelBinding.mockReturnValue({ success: true, data: null });
    mockDb.deleteChannelBinding.mockReturnValue({ success: true, data: true });
    mockDb.deleteChannelSession.mockReturnValue({ success: true, data: true });
  });

  async function createManager(): Promise<SessionManager> {
    const manager = new SessionManager();
    await Promise.resolve();
    return manager;
  }

  it('removes temporary bindings when clearing a session', async () => {
    const manager = await createManager();
    mockDb.getExternalSession.mockReturnValue({
      success: true,
      data: {
        id: baseSession.id,
        bindingId: 'binding-temporary',
      },
    });
    mockDb.getChannelBinding.mockReturnValue({
      success: true,
      data: {
        id: 'binding-temporary',
        temporary: true,
      },
    });

    await manager.storeSession(baseSession);
    const cleared = await manager.clearSession(baseSession.userId, baseSession.chatId);

    expect(cleared).toBe(true);
    expect(mockDb.deleteChannelBinding).toHaveBeenCalledWith('binding-temporary');
    expect(mockDb.deleteChannelSession).toHaveBeenCalledWith(baseSession.id);
  });

  it('keeps durable bindings when clearing a session', async () => {
    const manager = await createManager();
    mockDb.getExternalSession.mockReturnValue({
      success: true,
      data: {
        id: baseSession.id,
        bindingId: 'binding-durable',
      },
    });
    mockDb.getChannelBinding.mockReturnValue({
      success: true,
      data: {
        id: 'binding-durable',
        temporary: false,
      },
    });

    await manager.storeSession(baseSession);
    const cleared = await manager.clearSession(baseSession.userId, baseSession.chatId);

    expect(cleared).toBe(true);
    expect(mockDb.deleteChannelBinding).not.toHaveBeenCalled();
    expect(mockDb.deleteChannelSession).toHaveBeenCalledWith(baseSession.id);
  });
});
