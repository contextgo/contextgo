/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: vi.fn(() => '/tmp') } }));

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

vi.mock('../../src/common/adapter/ipcBridge', () => ({
  channel: {
    getPluginStatus: makeChannel('getPluginStatus'),
    enablePlugin: makeChannel('enablePlugin'),
    disablePlugin: makeChannel('disablePlugin'),
    testPlugin: makeChannel('testPlugin'),
    getPendingPairings: makeChannel('getPendingPairings'),
    approvePairing: makeChannel('approvePairing'),
    rejectPairing: makeChannel('rejectPairing'),
    getAuthorizedUsers: makeChannel('getAuthorizedUsers'),
    revokeUser: makeChannel('revokeUser'),
    getActiveSessions: makeChannel('getActiveSessions'),
    getBindingCatalog: makeChannel('getBindingCatalog'),
    getBindings: makeChannel('getBindings'),
    upsertBinding: makeChannel('upsertBinding'),
    deleteBinding: makeChannel('deleteBinding'),
    handoffSession: makeChannel('handoffSession'),
    syncChannelSettings: makeChannel('syncChannelSettings'),
  },
}));

vi.mock('@process/channels/core/ChannelManager', () => ({
  getChannelManager: vi.fn(() => ({
    enablePlugin: vi.fn(async () => ({ success: true })),
    disablePlugin: vi.fn(async () => ({ success: true })),
    testPlugin: vi.fn(async () => ({ success: true })),
    syncChannelSettings: vi.fn(async () => ({ success: true })),
  })),
}));

vi.mock('@process/channels/pairing/PairingService', () => ({
  getPairingService: vi.fn(() => ({
    approvePairing: vi.fn(async () => ({ success: true })),
    rejectPairing: vi.fn(async () => ({ success: true })),
  })),
}));

const mockHandoffSession = vi.fn(async () => ({
  bindingId: 'binding-handoff-1',
  targetExternalSessionId: 'external-session-target-1',
  sourceExternalSessionId: 'external-session-source-1',
  conversationId: 'conversation-1',
  agentProfileId: 'agent-profile-1',
  mode: 'resume',
}));
vi.mock('@process/channels/core/ChannelHandoffService', () => ({
  getChannelHandoffService: vi.fn(() => ({
    handoffSession: mockHandoffSession,
  })),
}));

const mockGetLoadedExtensions = vi.fn(() => []);
const mockGetChannelPluginMeta = vi.fn(() => undefined);
const mockGetChannelPlugins = vi.fn(() => new Map());
vi.mock('@/extensions', () => ({
  ExtensionRegistry: {
    getInstance: vi.fn(() => ({
      getLoadedExtensions: mockGetLoadedExtensions,
      getChannelPluginMeta: mockGetChannelPluginMeta,
      getChannelPlugins: mockGetChannelPlugins,
    })),
  },
}));

vi.mock('@/extensions/assetProtocol', () => ({ toAssetUrl: vi.fn((p: string) => `asset://${p}`) }));

import { initChannelBridge } from '../../src/process/bridge/channelBridge';
import type { IChannelRepository } from '../../src/process/services/database/IChannelRepository';
import type {
  IAgentProfile,
  IRemoteIdentity,
  IChannelBinding,
  IChannelPluginConfig,
  IChannelUser,
  IChannelPairingRequest,
  IChannelSession,
  IConnectorInstance,
} from '../../src/process/channels/types';

function makeRepo(overrides?: Partial<IChannelRepository>): IChannelRepository {
  return {
    getChannelPlugins: vi.fn(() => []),
    getPendingPairingRequests: vi.fn(() => []),
    getChannelUsers: vi.fn(() => []),
    deleteChannelUser: vi.fn(),
    getChannelSessions: vi.fn(() => []),
    getConnectorInstances: vi.fn(() => []),
    getAgentProfiles: vi.fn(() => []),
    getRemoteIdentities: vi.fn(() => []),
    getChannelBindings: vi.fn(() => []),
    upsertChannelBinding: vi.fn(),
    deleteChannelBinding: vi.fn(),
    ...overrides,
  };
}

function makePlugin(type = 'telegram'): IChannelPluginConfig {
  return {
    id: type,
    type,
    name: type,
    enabled: true,
    status: 'running',
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe('channelBridge', () => {
  let repo: IChannelRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLoadedExtensions.mockReturnValue([]);
    mockGetChannelPluginMeta.mockReturnValue(undefined);
    mockGetChannelPlugins.mockReturnValue(new Map());

    repo = makeRepo();
    initChannelBridge(repo);
  });

  // --- getPluginStatus ---

  describe('getPluginStatus', () => {
    it('returns plugin data from repo combined with extension registry', async () => {
      const plugin = makePlugin('telegram');
      vi.mocked(repo.getChannelPlugins).mockReturnValue([plugin]);

      const result = await handlers['getPluginStatus']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'telegram' })]));
    });

    it('proceeds with empty plugin list when repo throws', async () => {
      vi.mocked(repo.getChannelPlugins).mockImplementation(() => {
        throw new Error('db unavailable');
      });

      const result = await handlers['getPluginStatus']();

      // Should still succeed, showing builtin channel types without DB data
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('includes builtin channel types even when not in DB', async () => {
      vi.mocked(repo.getChannelPlugins).mockReturnValue([]);

      const result = await handlers['getPluginStatus']();

      expect(result.success).toBe(true);
      const types = result.data.map((p: { type: string }) => p.type);
      expect(types).toContain('telegram');
    });
  });

  // --- getAuthorizedUsers ---

  describe('getAuthorizedUsers', () => {
    it('returns users from repo', async () => {
      const user: IChannelUser = {
        id: 'u1',
        platformUserId: 'tg-123',
        platformType: 'telegram',
        authorizedAt: 1000,
      };
      vi.mocked(repo.getChannelUsers).mockReturnValue([user]);

      const result = await handlers['getAuthorizedUsers']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([user]);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getChannelUsers).mockImplementation(() => {
        throw new Error('query failed');
      });

      const result = await handlers['getAuthorizedUsers']();

      expect(result.success).toBe(false);
      expect(result.msg).toBe('query failed');
    });
  });

  // --- revokeUser ---

  describe('revokeUser', () => {
    it('calls repo.deleteChannelUser with the given userId', async () => {
      const result = await handlers['revokeUser']({ userId: 'u1' });

      expect(repo.deleteChannelUser).toHaveBeenCalledWith('u1');
      expect(result.success).toBe(true);
    });

    it('returns error when repo.deleteChannelUser throws', async () => {
      vi.mocked(repo.deleteChannelUser).mockImplementation(() => {
        throw new Error('foreign key constraint');
      });

      const result = await handlers['revokeUser']({ userId: 'u1' });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('foreign key constraint');
    });
  });

  // --- getPendingPairings ---

  describe('getPendingPairings', () => {
    it('returns pending pairing requests from repo', async () => {
      const request: IChannelPairingRequest = {
        id: 'r1',
        code: 'ABC123',
        platformType: 'telegram',
        platformUserId: 'tg-456',
        requestedAt: 1000,
        expiresAt: 2000,
        status: 'pending',
      };
      vi.mocked(repo.getPendingPairingRequests).mockReturnValue([request]);

      const result = await handlers['getPendingPairings']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([request]);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getPendingPairingRequests).mockImplementation(() => {
        throw new Error('pairing table missing');
      });

      const result = await handlers['getPendingPairings']();

      expect(result.success).toBe(false);
      expect(result.msg).toBe('pairing table missing');
    });
  });

  // --- getActiveSessions ---

  describe('getActiveSessions', () => {
    it('returns active sessions from repo', async () => {
      const session: IChannelSession = {
        id: 's1',
        userId: 'u1',
        agentType: 'gemini',
        createdAt: 1000,
        lastActivity: 2000,
      };
      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);

      const result = await handlers['getActiveSessions']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([session]);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getChannelSessions).mockImplementation(() => {
        throw new Error('sessions unavailable');
      });

      const result = await handlers['getActiveSessions']();

      expect(result.success).toBe(false);
      expect(result.msg).toBe('sessions unavailable');
    });
  });

  // --- binding management ---

  describe('getBindingCatalog', () => {
    it('returns connectors, profiles, and bindings in one response', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-1',
        platform: 'telegram',
        name: 'Telegram',
        enabled: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const profile: IAgentProfile = {
        id: 'agent-profile-1',
        name: 'OpenClaw Publication',
        backend: 'openclaw-gateway',
        version: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const binding: IChannelBinding = {
        id: 'binding-1',
        connectorId: 'connector-1',
        scopeType: 'remote_chat',
        scopeKey: 'group:alpha',
        agentProfileId: 'agent-profile-1',
        priority: 10,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-1',
        connectorId: 'connector-1',
        remoteUserId: 'user-1',
        remoteChatId: 'group:alpha:thread:9',
        remoteChatType: 'thread',
        displayName: 'Ops Topic',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        connectors: [connector],
        agentProfiles: [profile],
        bindings: [binding],
        audiences: expect.arrayContaining([
          expect.objectContaining({
            key: 'group:alpha:thread:9',
            scopeType: 'remote_chat',
            title: 'Ops Topic',
            threadId: '9',
          }),
        ]),
      });
    });
  });

  describe('getBindings', () => {
    it('returns bindings from repo', async () => {
      const binding: IChannelBinding = {
        id: 'binding-1',
        connectorId: 'connector-1',
        scopeType: 'remote_chat',
        scopeKey: 'group:alpha',
        agentProfileId: 'agent-1',
        priority: 10,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);

      const result = await handlers['getBindings']({ connectorId: 'connector-1' });

      expect(repo.getChannelBindings).toHaveBeenCalledWith('connector-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([binding]);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getChannelBindings).mockImplementation(() => {
        throw new Error('bindings unavailable');
      });

      const result = await handlers['getBindings']({ connectorId: 'connector-1' });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('bindings unavailable');
    });
  });

  describe('upsertBinding', () => {
    it('upserts binding through repo', async () => {
      const binding: IChannelBinding = {
        id: 'binding-1',
        connectorId: 'connector-1',
        scopeType: 'remote_user',
        scopeKey: 'user-1',
        agentProfileId: 'agent-1',
        priority: 1,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const result = await handlers['upsertBinding']({ binding });

      expect(repo.upsertChannelBinding).toHaveBeenCalledWith(binding);
      expect(result.success).toBe(true);
    });

    it('returns error when repo throws', async () => {
      const binding: IChannelBinding = {
        id: 'binding-invalid',
        connectorId: 'connector-1',
        scopeType: 'connector_default',
        agentProfileId: 'agent-1',
        priority: 0,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      vi.mocked(repo.upsertChannelBinding).mockImplementation(() => {
        throw new Error('invalid binding scope');
      });

      const result = await handlers['upsertBinding']({ binding });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('invalid binding scope');
    });
  });

  describe('deleteBinding', () => {
    it('deletes binding through repo', async () => {
      const result = await handlers['deleteBinding']({ bindingId: 'binding-1' });

      expect(repo.deleteChannelBinding).toHaveBeenCalledWith('binding-1');
      expect(result.success).toBe(true);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.deleteChannelBinding).mockImplementation(() => {
        throw new Error('delete failed');
      });

      const result = await handlers['deleteBinding']({ bindingId: 'binding-1' });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('delete failed');
    });
  });

  describe('handoffSession', () => {
    it('returns handoff result data from service', async () => {
      const payload = {
        sourceConversationId: 'conversation-source',
        targetConnectorId: 'connector-1',
        targetChatId: 'group:ops',
      };

      const result = await handlers['handoffSession'](payload);

      expect(mockHandoffSession).toHaveBeenCalledWith(payload);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          bindingId: 'binding-handoff-1',
          targetExternalSessionId: 'external-session-target-1',
        })
      );
    });

    it('returns error when handoff service throws', async () => {
      mockHandoffSession.mockRejectedValueOnce(new Error('handoff failed'));

      const result = await handlers['handoffSession']({
        sourceConversationId: 'conversation-source',
        targetConnectorId: 'connector-1',
        targetChatId: 'group:ops',
      });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('handoff failed');
    });
  });
});
