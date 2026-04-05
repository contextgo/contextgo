/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUILTIN_CHANNEL_TYPES } from '../../src/common/config/builtinChannels';

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
    authorizeRemoteUser: makeChannel('authorizeRemoteUser'),
    startWeixinLogin: makeChannel('startWeixinLogin'),
    getAuthorizedUsers: makeChannel('getAuthorizedUsers'),
    getAuthorizedTargets: makeChannel('getAuthorizedTargets'),
    revokeUser: makeChannel('revokeUser'),
    getActiveSessions: makeChannel('getActiveSessions'),
    getActiveSessionCatalog: makeChannel('getActiveSessionCatalog'),
    getChannelAccounts: makeChannel('getChannelAccounts'),
    createChannelAccount: makeChannel('createChannelAccount'),
    getConnectorInstances: makeChannel('getConnectorInstances'),
    upsertChannelAccount: makeChannel('upsertChannelAccount'),
    upsertConnectorInstance: makeChannel('upsertConnectorInstance'),
    deleteChannelAccount: makeChannel('deleteChannelAccount'),
    deleteConnectorInstance: makeChannel('deleteConnectorInstance'),
    getBindingCatalog: makeChannel('getBindingCatalog'),
    getBindings: makeChannel('getBindings'),
    upsertBinding: makeChannel('upsertBinding'),
    deleteBinding: makeChannel('deleteBinding'),
    prepareConversationPublication: makeChannel('prepareConversationPublication'),
    prepareConversationAgentProfile: makeChannel('prepareConversationAgentProfile'),
    continuationSession: makeChannel('continuationSession'),
    endContinuationSession: makeChannel('endContinuationSession'),
    setContinuationControlMode: makeChannel('setContinuationControlMode'),
    syncChannelSettings: makeChannel('syncChannelSettings'),
    weixinLoginQr: { emit: vi.fn(), on: vi.fn() },
    weixinLoginScanned: { emit: vi.fn(), on: vi.fn() },
  },
}));

const mockEnablePlugin = vi.fn(async () => ({ success: true }));
const mockDisablePlugin = vi.fn(async () => ({ success: true }));
const mockTestPlugin = vi.fn(async () => ({ success: true }));
const mockSyncChannelSettings = vi.fn(async () => ({ success: true }));
const mockGetPlugin = vi.fn();
vi.mock('@process/channels/core/ChannelManager', () => ({
  getChannelManager: vi.fn(() => ({
    enablePlugin: mockEnablePlugin,
    disablePlugin: mockDisablePlugin,
    testPlugin: mockTestPlugin,
    syncChannelSettings: mockSyncChannelSettings,
    getPluginManager: vi.fn(() => ({
      getPlugin: mockGetPlugin,
    })),
  })),
}));

vi.mock('@process/channels/pairing/PairingService', () => ({
  getPairingService: vi.fn(() => ({
    approvePairing: vi.fn(async () => ({ success: true })),
    rejectPairing: vi.fn(async () => ({ success: true })),
    authorizeRemoteUser: vi.fn(async () => ({ success: true })),
  })),
}));

const mockPrepareConversationPublication = vi.fn(async () => ({
  id: 'agent-profile-1',
  name: 'Prepared Agent',
  backend: 'openclaw-gateway',
  version: 1,
  archived: false,
  createdAt: 1000,
  updatedAt: 1000,
}));
const mockContinuationSession = vi.fn(async () => ({
  bindingId: 'binding-continuation-1',
  targetExternalSessionId: 'external-session-target-1',
  sourceExternalSessionId: 'external-session-source-1',
  conversationId: 'conversation-1',
  agentProfileId: 'agent-profile-1',
  mode: 'resume',
}));
vi.mock('@process/channels/core/ChannelContinuationService', () => ({
  getChannelContinuationService: vi.fn(() => ({
    continueSession: mockContinuationSession,
  })),
}));

vi.mock('@process/channels/core/ChannelPublicationService', () => ({
  getChannelPublicationService: vi.fn(() => ({
    prepareConversationPublication: mockPrepareConversationPublication,
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

const mockDeleteChannelPlugin = vi.fn(() => ({ success: true }));
const mockGetRemoteIdentities = vi.fn(() => ({ success: true, data: [] }));
const mockDeleteChannelUser = vi.fn(() => ({ success: true, data: true }));
const mockDbDeleteConnectorInstance = vi.fn(() => ({ success: true, data: true }));
const mockRunInTransaction = vi.fn((fn: () => unknown) => ({ success: true, data: fn() }));
const mockGetAllExternalSessions = vi.fn(() => ({ success: true, data: [] }));
const mockGetAllChannelControlLeases = vi.fn(() => ({ success: true, data: [] }));
vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => ({
    getRemoteIdentities: mockGetRemoteIdentities,
    deleteChannelUser: mockDeleteChannelUser,
    deleteChannelPlugin: mockDeleteChannelPlugin,
    deleteConnectorInstance: mockDbDeleteConnectorInstance,
    runInTransaction: mockRunInTransaction,
    getAllExternalSessions: mockGetAllExternalSessions,
    getAllChannelControlLeases: mockGetAllChannelControlLeases,
  })),
}));

import { initChannelBridge } from '../../src/process/bridge/channelBridge';
import type { IChannelRepository } from '../../src/process/services/database/IChannelRepository';
import type {
  IAgentProfile,
  IRemoteIdentity,
  IChannelBinding,
  IChannelPluginConfig,
  IChannelAuthorizedTarget,
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
    getChannelAuthorizedTargets: vi.fn(() => []),
    deleteChannelUser: vi.fn(),
    getChannelSessions: vi.fn(() => []),
    getConnectorInstances: vi.fn(() => []),
    upsertConnectorInstance: vi.fn(),
    deleteConnectorInstance: vi.fn(),
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
    mockGetPlugin.mockReset();
    mockGetPlugin.mockReturnValue(undefined);
    mockGetRemoteIdentities.mockReturnValue({ success: true, data: [] });
    mockDeleteChannelUser.mockReturnValue({ success: true, data: true });
    mockDbDeleteConnectorInstance.mockReturnValue({ success: true, data: true });
    mockRunInTransaction.mockImplementation((fn: () => unknown) => ({ success: true, data: fn() }));
    mockGetAllExternalSessions.mockReturnValue({ success: true, data: [] });
    mockGetAllChannelControlLeases.mockReturnValue({ success: true, data: [] });

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
      expect(types).toEqual(expect.arrayContaining(BUILTIN_CHANNEL_TYPES));
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'slack', name: 'Slack', enabled: false }),
          expect.objectContaining({ type: 'discord', name: 'Discord', enabled: false }),
        ])
      );
    });
  });

  // --- getAuthorizedUsers ---

  describe('getAuthorizedUsers', () => {
    it('returns users from repo', async () => {
      const user: IChannelUser = {
        id: 'u1',
        connectorId: 'telegram_default',
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

  // --- getAuthorizedTargets ---

  describe('getAuthorizedTargets', () => {
    it('returns targets from repo', async () => {
      const target: IChannelAuthorizedTarget = {
        id: 't1',
        connectorId: 'telegram_default',
        platformType: 'telegram',
        targetId: 'user:tg-123',
        targetType: 'direct',
        remoteUserId: 'tg-123',
        platformChatId: 'tg-123',
        authorizedAt: 1000,
      };
      vi.mocked(repo.getChannelAuthorizedTargets).mockReturnValue([target]);

      const result = await handlers['getAuthorizedTargets']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([target]);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getChannelAuthorizedTargets).mockImplementation(() => {
        throw new Error('target query failed');
      });

      const result = await handlers['getAuthorizedTargets']();

      expect(result.success).toBe(false);
      expect(result.msg).toBe('target query failed');
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

  describe('authorizeRemoteUser', () => {
    it('delegates direct authorization to pairing service', async () => {
      const result = await handlers['authorizeRemoteUser']({
        platformUserId: 'wx-user-1',
        platformType: 'weixin',
        displayName: 'Scanner',
        chatId: 'wx-user-1',
        pluginId: 'weixin_default',
        metadata: { source: 'weixin-qr-login' },
      });

      expect(result.success).toBe(true);
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

  describe('getActiveSessionCatalog', () => {
    it('returns platform-native object metadata for active sessions', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-discord',
        platform: 'discord',
        name: 'Discord Ops',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const session: IChannelSession = {
        id: 'external-session-1',
        userId: 'remote-discord-thread-1',
        agentType: 'codex',
        conversationId: 'conversation-1',
        workspace: '/tmp/discord-ops',
        createdAt: 1000,
        lastActivity: 2500,
      };
      const identity: IRemoteIdentity = {
        id: 'remote-discord-thread-1',
        connectorId: 'connector-discord',
        remoteUserId: 'discord-user-1',
        remoteChatId: 'discord://guild-1/channel-22/thread-77',
        platformChatId: 'channel-22',
        remoteChatType: 'thread',
        peerScope: 'thread',
        parentChatId: 'discord://guild-1/channel-22',
        threadId: '77',
        displayName: 'Incident Thread',
        authorizedAt: 1000,
        lastActive: 2500,
        metadata: {
          containerId: 'guild-1',
          containerType: 'server',
          containerTitle: 'Ops Guild',
        },
      };

      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([identity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([]);

      const result = await handlers['getActiveSessionCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'external-session-1',
          connectorId: 'connector-discord',
          objectKey: 'discord://guild-1/channel-22/thread-77',
          objectKind: 'thread',
          objectTitle: 'Incident Thread',
          parentObjectKey: 'discord://guild-1/channel-22',
          parentObjectKind: 'channel',
        }),
      ]);
    });

    it('uses Feishu parent chat names for topic objects in active session details', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-topic',
        platform: 'lark',
        name: 'Feishu Ops',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'lark-runtime-topic',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const session: IChannelSession = {
        id: 'external-session-topic-1',
        userId: 'remote-lark-topic-1',
        agentType: 'codex',
        conversationId: 'conversation-topic-1',
        workspace: '/tmp/feishu-topic',
        createdAt: 1000,
        lastActivity: 2600,
      };
      const identity: IRemoteIdentity = {
        id: 'remote-lark-topic-1',
        connectorId: 'connector-lark-topic',
        remoteUserId: 'ou_topic_user_1',
        remoteChatId: 'oc_group_1:thread:om_topic_root_1',
        platformChatId: 'oc_group_1',
        parentChatId: 'oc_group_1',
        threadId: 'om_topic_root_1',
        remoteChatType: 'topic',
        peerScope: 'thread',
        displayName: 'User 144e25',
        authorizedAt: 1000,
        lastActive: 2600,
      };

      mockGetPlugin.mockReturnValue({
        getChatDisplayData: vi.fn(async () => ({
          name: 'Core Ops Group',
          description: 'Incident command room',
          chatType: 'group',
        })),
        getUserDisplayData: vi.fn(async () => ({
          name: 'Alice Chen',
        })),
      });

      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([identity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([]);

      const result = await handlers['getActiveSessionCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'external-session-topic-1',
          connectorId: 'connector-lark-topic',
          audienceTitle: 'Topic om_topic_root_1',
          objectKey: 'oc_group_1:thread:om_topic_root_1',
          objectKind: 'topic',
          objectTitle: 'Topic om_topic_root_1',
          objectSubtitle: 'In Core Ops Group',
          parentObjectKey: 'oc_group_1',
          parentObjectTitle: 'Core Ops Group',
          parentObjectKind: 'group',
        }),
      ]);
      expect(mockGetPlugin).toHaveBeenCalledWith('lark-runtime-topic');
    });
  });

  describe('getConnectorInstances', () => {
    it('returns connector instances from repo', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-1',
        platform: 'telegram',
        name: 'Telegram Ops',
        enabled: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);

      const result = await handlers['getConnectorInstances']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([connector]);
    });
  });

  describe('upsertConnectorInstance', () => {
    it('upserts connector instance through repo', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-2',
        platform: 'slack',
        name: 'Slack Alerts',
        enabled: false,
        status: 'stopped',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const result = await handlers['upsertConnectorInstance']({ connector });

      expect(repo.upsertConnectorInstance).toHaveBeenCalledWith({
        ...connector,
        legacyPluginId: 'connector-2',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteConnectorInstance', () => {
    it('disables plugin, removes legacy plugin row, and deletes connector instance', async () => {
      vi.mocked(repo.getConnectorInstances).mockReturnValue([
        {
          id: 'connector-3',
          platform: 'weixin',
          name: 'WeChat',
          enabled: true,
          status: 'running',
          legacyPluginId: 'connector-3',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);

      const result = await handlers['deleteConnectorInstance']({ connectorId: 'connector-3' });

      expect(mockDisablePlugin).toHaveBeenCalledWith('connector-3');
      expect(mockDeleteChannelPlugin).toHaveBeenCalledWith('connector-3');
      expect(mockDbDeleteConnectorInstance).toHaveBeenCalledWith('connector-3');
      expect(result.success).toBe(true);
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
        configured: true,
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
        channelAccounts: [connector],
        agentProfiles: [profile],
        bindings: [{ ...binding, channelAccountId: binding.connectorId }],
        audiences: expect.arrayContaining([
          expect.objectContaining({
            key: 'group:alpha:thread:9',
            scopeType: 'remote_chat',
            title: 'Ops Topic',
            subtitle: 'peer group:alpha:thread:9 · parent group:alpha · thread 9',
            parentChatId: 'group:alpha',
            threadId: '9',
            objectKey: 'group:alpha:thread:9',
            objectKind: 'thread',
            objectTitle: 'Ops Topic',
            parentObjectKey: 'group:alpha',
            parentObjectKind: 'chat',
          }),
        ]),
      });
    });

    it('classifies Feishu topic audiences as topics with readable subtitles', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark',
        platform: 'lark',
        name: 'Feishu',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-topic-1',
        connectorId: 'connector-lark',
        remoteUserId: 'ou_user_1',
        remoteChatId: 'oc_group_1:thread:om_topic_root_1',
        platformChatId: 'oc_group_1',
        parentChatId: 'oc_group_1',
        threadId: 'om_topic_root_1',
        remoteChatType: 'topic',
        peerScope: 'thread',
        displayName: 'Ops Topic',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'oc_group_1:thread:om_topic_root_1',
            remoteChatType: 'topic',
            title: 'Ops Topic',
            subtitle: undefined,
            objectKind: 'topic',
            parentChatId: 'oc_group_1',
            threadId: 'om_topic_root_1',
          }),
        ])
      );
    });

    it('dedupes direct-chat audiences for Feishu so one DM only shows once', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-dm',
        platform: 'lark',
        name: 'Feishu',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-lark-dm-1',
        connectorId: 'connector-lark-dm',
        remoteUserId: 'ou_user_dm_1',
        remoteChatId: 'oc_dm_1',
        platformChatId: 'oc_dm_1',
        remoteChatType: 'p2p',
        peerScope: 'chat',
        displayName: 'Feishu DM',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual([
        expect.objectContaining({
          connectorId: 'connector-lark-dm',
          scopeType: 'remote_user',
          key: 'ou_user_dm_1',
          title: 'Feishu DM',
          remoteChatType: 'p2p',
        }),
      ]);
    });

    it('prefers real Feishu names for direct chats and group chats when the plugin can resolve them', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-rich',
        platform: 'lark',
        name: 'Feishu',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'lark-runtime-rich',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentities: IRemoteIdentity[] = [
        {
          id: 'remote-lark-group-1',
          connectorId: 'connector-lark-rich',
          remoteUserId: 'ou_user_group_1',
          remoteChatId: 'oc_group_1',
          platformChatId: 'oc_group_1',
          remoteChatType: 'group',
          peerScope: 'chat',
          displayName: 'User 144e25',
          authorizedAt: 1000,
          lastActive: 2200,
        },
        {
          id: 'remote-lark-dm-rich-1',
          connectorId: 'connector-lark-rich',
          remoteUserId: 'ou_user_dm_rich_1',
          remoteChatId: 'oc_dm_rich_1',
          platformChatId: 'oc_dm_rich_1',
          remoteChatType: 'p2p',
          peerScope: 'chat',
          displayName: 'User 92ab11',
          authorizedAt: 1000,
          lastActive: 2400,
        },
      ];

      mockGetPlugin.mockReturnValue({
        getChatDisplayData: vi.fn(async (chatId: string) => {
          if (chatId === 'oc_group_1') {
            return { name: 'Core Ops Group', description: 'Incident command room', chatType: 'group' };
          }
          return null;
        }),
        getUserDisplayData: vi.fn(async (userId: string) => {
          if (userId === 'ou_user_dm_rich_1') {
            return { name: 'Alice Chen' };
          }
          return null;
        }),
      });

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue(remoteIdentities);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            connectorId: 'connector-lark-rich',
            key: 'oc_group_1',
            scopeType: 'remote_chat',
            title: 'Core Ops Group',
            subtitle: 'Incident command room',
            objectTitle: 'Core Ops Group',
            objectSubtitle: 'Incident command room',
          }),
          expect.objectContaining({
            connectorId: 'connector-lark-rich',
            key: 'ou_user_dm_rich_1',
            scopeType: 'remote_user',
            title: 'Alice Chen',
            displayName: 'Alice Chen',
            subtitle: undefined,
          }),
        ])
      );
      expect(mockGetPlugin).toHaveBeenCalledWith('lark-runtime-rich');
    });

    it('keeps unresolved Feishu topic objects user-facing instead of exposing raw peer identifiers', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-unresolved-topic',
        platform: 'lark',
        name: 'Feishu',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-lark-unresolved-topic-1',
        connectorId: 'connector-lark-unresolved-topic',
        remoteUserId: 'ou_user_1',
        remoteChatId: 'oc_group_1:thread:om_topic_root_1',
        platformChatId: 'oc_group_1',
        parentChatId: 'oc_group_1',
        threadId: 'om_topic_root_1',
        remoteChatType: 'thread',
        peerScope: 'thread',
        displayName: 'User 144e25',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            connectorId: 'connector-lark-unresolved-topic',
            key: 'oc_group_1:thread:om_topic_root_1',
            title: 'Topic',
            subtitle: undefined,
            objectKind: 'topic',
            objectTitle: 'Topic om_topic_root_1',
          }),
        ])
      );
    });

    it('dedupes Discord direct-message audiences so one DM only shows once', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-discord-dm',
        platform: 'discord',
        name: 'Discord',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-discord-dm-1',
        connectorId: 'connector-discord-dm',
        remoteUserId: 'discord-user-1',
        remoteChatId: '1357924680',
        platformChatId: '1357924680',
        remoteChatType: 'dm',
        peerScope: 'chat',
        displayName: 'Discord DM',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual([
        expect.objectContaining({
          connectorId: 'connector-discord-dm',
          scopeType: 'remote_user',
          key: 'discord-user-1',
          title: 'Discord DM',
          remoteChatType: 'dm',
        }),
      ]);
    });

    it('dedupes WeChat personal audiences so one paired account shows one discovered target', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-weixin',
        platform: 'weixin',
        name: 'WeChat Personal',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-weixin-1',
        connectorId: 'connector-weixin',
        remoteUserId: 'wx-user-1',
        remoteChatId: 'wx-user-1',
        platformChatId: 'wx-user-1',
        remoteChatType: 'direct',
        displayName: 'Alice',
        authorizedAt: 1000,
        lastActive: 2000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual([
        expect.objectContaining({
          connectorId: 'connector-weixin',
          scopeType: 'remote_user',
          key: 'wx-user-1',
          title: 'Alice',
        }),
      ]);
    });

    it('returns configured and enabled connectors even before any audience is discovered', async () => {
      const readyConnector: IConnectorInstance = {
        id: 'connector-ready',
        platform: 'telegram',
        name: 'Telegram Ready',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const draftConnector: IConnectorInstance = {
        id: 'connector-draft',
        platform: 'telegram',
        name: 'Telegram Draft',
        enabled: true,
        configured: false,
        status: 'stopped',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const disabledConnector: IConnectorInstance = {
        id: 'connector-disabled',
        platform: 'slack',
        name: 'Slack Disabled',
        enabled: false,
        configured: true,
        status: 'stopped',
        createdAt: 1000,
        updatedAt: 1000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([readyConnector, draftConnector, disabledConnector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          connectors: [readyConnector],
          channelAccounts: [readyConnector],
        })
      );
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
      expect(result.data).toEqual([{ ...binding, channelAccountId: binding.connectorId }]);
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

  describe('prepareConversationPublication', () => {
    it('prepares a reusable agent profile before navigating into publication settings', async () => {
      const result = await handlers['prepareConversationAgentProfile']({ conversationId: 'conversation-1' });

      expect(mockPrepareConversationPublication).toHaveBeenCalledWith('conversation-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'agent-profile-1',
          name: 'Prepared Agent',
        })
      );
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

      expect(repo.upsertChannelBinding).toHaveBeenCalledWith({ ...binding, channelAccountId: binding.connectorId });
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

  describe('continuationSession', () => {
    it('returns continuation result data from service', async () => {
      const payload = {
        sourceConversationId: 'conversation-source',
        targetConnectorId: 'connector-1',
        targetChatId: 'group:ops',
      };

      const result = await handlers['continuationSession'](payload);

      expect(mockContinuationSession).toHaveBeenCalledWith(payload);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          bindingId: 'binding-continuation-1',
          targetExternalSessionId: 'external-session-target-1',
        })
      );
    });

    it('returns error when continuation service throws', async () => {
      mockContinuationSession.mockRejectedValueOnce(new Error('continuation failed'));

      const result = await handlers['continuationSession']({
        sourceConversationId: 'conversation-source',
        targetConnectorId: 'connector-1',
        targetChatId: 'group:ops',
      });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('continuation failed');
    });
  });
});
