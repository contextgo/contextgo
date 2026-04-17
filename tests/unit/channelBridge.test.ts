/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUILTIN_CHANNEL_TYPES } from '../../src/common/config/builtinChannels';
import {
  describeRemoteIdentityObject,
  inferRemoteIdentityPublishObject,
  isChannelObjectFallbackTitle,
} from '../../src/process/channels/utils';
import {
  getChannelAccountId,
  getChannelBindingPublishObject,
  getChannelPublishObjectCatalogEntryIdentity,
  withChannelAccountId,
} from '../../src/process/channels/types';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: vi.fn(() => '/tmp') } }));

const publicationServiceMocks = vi.hoisted(() => ({
  listAllConversations: vi.fn(async () => []),
  readCatalogForConversations: vi.fn(),
  readCatalogForWorkspaces: vi.fn(),
  resolvePublishObjectCatalog: vi.fn(),
  refreshCatalog: vi.fn(),
  upsertChannelBinding: vi.fn(),
  deleteChannelBinding: vi.fn(),
}));

let currentRepo: IChannelRepository | null = null;
let resolvedPublishObjects: Array<Record<string, unknown>> = [];

function buildMockPublicationCatalog() {
  const agentProfiles = (currentRepo?.getAgentProfiles() ?? []).map((profile) =>
    Object.assign(
      { promptProfile: {}, toolPolicy: {}, memoryPolicy: {}, delegationPolicy: {}, archived: false },
      profile,
      { workspaceRef: profile.workspaceRef ?? `/tmp/workspaces/${profile.id}` }
    )
  );
  const agentProfileWorkspaceById = Object.fromEntries(
    agentProfiles.map((profile) => [profile.id, profile.workspaceRef ?? `/tmp/workspaces/${profile.id}`] as const)
  );
  const bindings = (currentRepo?.getChannelBindings() ?? []).map((binding) => withChannelAccountId(binding));
  const bindingWorkspaceById = Object.fromEntries(
    bindings.map(
      (binding) => [binding.id, agentProfileWorkspaceById[binding.agentProfileId] ?? '/tmp/workspaces/default'] as const
    )
  );
  const workspaces = [...new Set([...Object.values(agentProfileWorkspaceById), '/tmp/workspaces/default'])];

  return {
    workspaces,
    agentProfiles,
    bindings,
    publishObjects: resolvedPublishObjects,
    agentProfileWorkspaceById,
    bindingWorkspaceById,
  };
}

function buildMockPublishObjects(params: {
  bindings: readonly IChannelBinding[];
  remoteIdentities: readonly IRemoteIdentity[];
  channelAccounts: readonly IConnectorInstance[];
}) {
  const connectorMap = new Map(params.channelAccounts.map((connector) => [connector.id, connector] as const));
  const nextEntries = new Map<string, Record<string, unknown>>();

  for (const binding of params.bindings) {
    const channelAccountId = getChannelAccountId(binding);
    if (!channelAccountId) {
      continue;
    }

    const publishObject = getChannelBindingPublishObject(binding);
    const title = publishObject.displayName ?? publishObject.nativeObjectId;
    const entry = {
      id: '',
      channelAccountId,
      nativeObjectType: publishObject.nativeObjectType,
      nativeObjectId: publishObject.nativeObjectId,
      parentNativeObjectId: publishObject.parentNativeObjectId,
      displayProfile: {
        title,
        subtitle: typeof binding.metadata?.objectSubtitle === 'string' ? binding.metadata.objectSubtitle : undefined,
        parentTitle:
          typeof binding.metadata?.parentObjectTitle === 'string' ? binding.metadata.parentObjectTitle : undefined,
        source: publishObject.discoverySource === 'pulled' ? 'official-pull' : 'manual',
        quality: title === publishObject.nativeObjectId ? 'fallback' : 'inferred',
        resolvedAt: binding.updatedAt,
      },
      refreshState:
        title === publishObject.nativeObjectId
          ? {
              status: 'needs-refresh',
              reason: 'manual-fallback',
              updatedAt: binding.updatedAt,
            }
          : {
              status: 'ready',
              updatedAt: binding.updatedAt,
            },
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
    };
    entry.id = getChannelPublishObjectCatalogEntryIdentity(entry as never);
    nextEntries.set(entry.id, entry);
  }

  for (const identity of params.remoteIdentities) {
    const connectorId = getChannelAccountId(identity) ?? identity.connectorId;
    const connector = connectorMap.get(connectorId);
    if (!connector) {
      continue;
    }

    const publishObject = inferRemoteIdentityPublishObject(identity, connector.platform);
    const descriptor = describeRemoteIdentityObject(identity, connector.platform);
    const title = publishObject.displayName ?? descriptor.title;
    const entry = {
      id: '',
      channelAccountId: connector.id,
      nativeObjectType: publishObject.nativeObjectType,
      nativeObjectId: publishObject.nativeObjectId,
      parentNativeObjectId: publishObject.parentNativeObjectId,
      displayProfile: {
        title,
        subtitle: descriptor.subtitle,
        parentTitle: descriptor.parentTitle,
        source:
          identity.metadata?.displaySource === 'official-pull' ||
          identity.metadata?.displaySource === 'runtime-resolved'
            ? identity.metadata.displaySource
            : typeof identity.metadata?.chatName === 'string' || typeof identity.metadata?.userDisplayName === 'string'
              ? 'runtime-resolved'
              : 'inbound-learned',
        quality: isChannelObjectFallbackTitle({
          platform: connector.platform,
          kind: descriptor.kind,
          title,
          nativeObjectId: publishObject.nativeObjectId,
        })
          ? 'fallback'
          : 'resolved',
        resolvedAt: identity.lastActive ?? identity.authorizedAt,
      },
      refreshState: {
        status: 'ready',
        updatedAt: identity.lastActive ?? identity.authorizedAt,
      },
      createdAt: identity.authorizedAt,
      updatedAt: identity.lastActive ?? identity.authorizedAt,
    };
    entry.id = getChannelPublishObjectCatalogEntryIdentity(entry as never);
    nextEntries.set(entry.id, entry);
  }

  return Array.from(nextEntries.values());
}

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
    refreshPublicationSnapshot: makeChannel('refreshPublicationSnapshot'),
    getChannelAccounts: makeChannel('getChannelAccounts'),
    createChannelAccount: makeChannel('createChannelAccount'),
    getConnectorInstances: makeChannel('getConnectorInstances'),
    upsertChannelAccount: makeChannel('upsertChannelAccount'),
    upsertConnectorInstance: makeChannel('upsertConnectorInstance'),
    deleteChannelAccount: makeChannel('deleteChannelAccount'),
    deleteConnectorInstance: makeChannel('deleteConnectorInstance'),
    getBindingCatalog: makeChannel('getBindingCatalog'),
    refreshPublicationCatalog: makeChannel('refreshPublicationCatalog'),
    getBindings: makeChannel('getBindings'),
    upsertPublication: makeChannel('upsertPublication'),
    deletePublication: makeChannel('deletePublication'),
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

vi.mock('@process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: {
    listAllConversations: publicationServiceMocks.listAllConversations,
  },
}));

vi.mock('@process/channels/core/ProjectChannelPublicationService', () => ({
  ProjectChannelPublicationService: class ProjectChannelPublicationServiceMock {
    readCatalogForConversations = publicationServiceMocks.readCatalogForConversations;
    readCatalogForWorkspaces = publicationServiceMocks.readCatalogForWorkspaces;
    resolvePublishObjectCatalog = publicationServiceMocks.resolvePublishObjectCatalog;
    refreshCatalog = publicationServiceMocks.refreshCatalog;
    upsertChannelBinding = publicationServiceMocks.upsertChannelBinding;
    deleteChannelBinding = publicationServiceMocks.deleteChannelBinding;
  },
}));

import { initChannelBridge } from '../../src/process/bridge/channelBridge';
import type { IChannelRepository } from '../../src/process/services/database/IChannelRepository';
import type {
  IAgentProfile,
  IChannelActiveSessionEntry,
  IChannelBindingCatalog,
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
    resolvedPublishObjects = [];
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
    currentRepo = repo;
    publicationServiceMocks.listAllConversations.mockResolvedValue([]);
    publicationServiceMocks.readCatalogForConversations.mockImplementation(async () => buildMockPublicationCatalog());
    publicationServiceMocks.readCatalogForWorkspaces.mockImplementation(async () => buildMockPublicationCatalog());
    publicationServiceMocks.resolvePublishObjectCatalog.mockImplementation(async (_workspace: string, params) => {
      resolvedPublishObjects = buildMockPublishObjects(params);
      return resolvedPublishObjects;
    });
    publicationServiceMocks.refreshCatalog.mockImplementation(
      async ({ publicationCatalog, remoteIdentities, channelAccounts }) => {
        resolvedPublishObjects = buildMockPublishObjects({
          bindings: publicationCatalog.bindings,
          remoteIdentities,
          channelAccounts,
        });
        return {
          ...publicationCatalog,
          publishObjects: resolvedPublishObjects,
        };
      }
    );
    publicationServiceMocks.upsertChannelBinding.mockImplementation(
      async (_workspace: string, binding: IChannelBinding) => {
        currentRepo?.upsertChannelBinding(withChannelAccountId(binding));
        return withChannelAccountId(binding);
      }
    );
    publicationServiceMocks.deleteChannelBinding.mockImplementation(async (_workspace: string, bindingId: string) => {
      currentRepo?.deleteChannelBinding(bindingId);
      return true;
    });
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

    it('does not surface builtin legacy plugin rows as real instances without connector accounts', async () => {
      vi.mocked(repo.getChannelPlugins).mockReturnValue([
        {
          ...makePlugin('weixin'),
          id: 'weixin_default',
          name: 'Weixin Bot',
          enabled: true,
          status: 'running',
          credentials: {
            accountId: 'wx-account',
            botToken: 'wx-token',
          },
        },
      ]);
      vi.mocked(repo.getConnectorInstances).mockReturnValue([]);

      const result = await handlers['getPluginStatus']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'weixin_default',
            type: 'weixin',
            enabled: false,
            connected: false,
            status: 'stopped',
            hasToken: false,
          }),
        ])
      );
    });

    it('projects typed native capability mapping for builtin platforms', async () => {
      vi.mocked(repo.getChannelPlugins).mockReturnValue([]);
      vi.mocked(repo.getConnectorInstances).mockReturnValue([]);

      const result = await handlers['getPluginStatus']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'lark',
            nativeAgentCapabilities: expect.objectContaining({
              schemaVersion: 1,
              commandEntry: expect.objectContaining({
                support: 'full',
                officialSurfaces: expect.arrayContaining(['bot_menu']),
              }),
              threadReply: expect.objectContaining({
                support: 'full',
                officialSurfaces: expect.arrayContaining(['thread', 'topic']),
              }),
            }),
          }),
          expect.objectContaining({
            type: 'weixin',
            nativeAgentCapabilities: expect.objectContaining({
              schemaVersion: 1,
              commandEntry: expect.objectContaining({
                support: 'limited',
                officialSurfaces: [],
              }),
              menuEntry: expect.objectContaining({
                support: 'none',
                officialSurfaces: [],
              }),
            }),
          }),
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
    it('returns explicit publication and active-session pointer fields for active sessions', async () => {
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
        conversationId: 'conversation-stale-1',
        workspace: '/tmp/discord-ops',
        createdAt: 1000,
        lastActivity: 2500,
      };
      const binding: IChannelBinding = {
        id: 'binding-discord-thread-1',
        connectorId: 'connector-discord',
        scopeType: 'remote_chat',
        scopeKey: 'discord://guild-1/channel-22/thread-77',
        agentProfileId: 'agent-profile-1',
        priority: 10,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
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
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);
      mockGetAllExternalSessions.mockReturnValue({
        success: true,
        data: [
          {
            id: 'external-session-1',
            connectorId: 'connector-discord',
            remoteIdentityId: 'remote-discord-thread-1',
            bindingId: 'binding-discord-thread-1',
            agentProfileId: 'agent-profile-1',
            activeConversationId: 'conversation-current-1',
            state: 'active',
            createdAt: 1000,
            lastActivity: 2500,
          },
        ],
      });

      const result = await handlers['getActiveSessionCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'external-session-1',
          externalSessionId: 'external-session-1',
          connectorId: 'connector-discord',
          publicationBindingId: 'binding-discord-thread-1',
          bindingId: 'binding-discord-thread-1',
          activeConversationId: 'conversation-current-1',
          conversationId: 'conversation-current-1',
          objectKey: 'discord://guild-1/channel-22/thread-77',
          objectKind: 'thread',
          objectTitle: 'Incident Thread',
          parentObjectKey: 'discord://guild-1/channel-22',
          parentObjectKind: 'channel',
          publishObjectCatalogEntryId: 'connector-discord::thread::77::discord://guild-1/channel-22',
          objectRefreshState: expect.objectContaining({
            status: 'ready',
          }),
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
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
          getChatDisplayData: vi.fn(async () => ({
            name: 'Core Ops Group',
            description: 'Incident command room',
            chatType: 'group',
          })),
          getUserDisplayData: vi.fn(async () => ({
            name: 'Alice Chen',
          })),
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

    it('reads persisted publish objects without triggering refresh work', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-read-session',
        platform: 'lark',
        name: 'Feishu Persisted',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const session: IChannelSession = {
        id: 'external-session-read-1',
        userId: 'remote-lark-read-1',
        agentType: 'codex',
        conversationId: 'conversation-read-1',
        workspace: '/tmp/read-session',
        createdAt: 1000,
        lastActivity: 2600,
      };
      const identity: IRemoteIdentity = {
        id: 'remote-lark-read-1',
        connectorId: 'connector-lark-read-session',
        remoteUserId: 'ou_read_1',
        remoteChatId: 'oc_read_group_1',
        platformChatId: 'oc_read_group_1',
        remoteChatType: 'group',
        peerScope: 'chat',
        displayName: 'Fallback Group Name',
        authorizedAt: 1000,
        lastActive: 2600,
      };
      const persistedPublishObject = inferRemoteIdentityPublishObject(identity, connector.platform);

      resolvedPublishObjects = [
        {
          id: getChannelPublishObjectCatalogEntryIdentity({
            id: '',
            channelAccountId: 'connector-lark-read-session',
            nativeObjectType: persistedPublishObject.nativeObjectType,
            nativeObjectId: persistedPublishObject.nativeObjectId,
            parentNativeObjectId: persistedPublishObject.parentNativeObjectId,
            displayProfile: {
              title: 'Persisted Session Group',
              subtitle: 'Persisted from prior refresh',
              source: 'official-pull',
              quality: 'resolved',
              resolvedAt: 2600,
            },
            createdAt: 1000,
            updatedAt: 2600,
          }),
          channelAccountId: 'connector-lark-read-session',
          nativeObjectType: persistedPublishObject.nativeObjectType,
          nativeObjectId: persistedPublishObject.nativeObjectId,
          parentNativeObjectId: persistedPublishObject.parentNativeObjectId,
          displayProfile: {
            title: 'Persisted Session Group',
            subtitle: 'Persisted from prior refresh',
            source: 'official-pull',
            quality: 'resolved',
            resolvedAt: 2600,
          },
          createdAt: 1000,
          updatedAt: 2600,
        },
      ];

      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([identity]);

      const result = await handlers['getActiveSessionCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'external-session-read-1',
          connectorId: 'connector-lark-read-session',
          objectTitle: 'Persisted Session Group',
          objectSubtitle: 'Persisted from prior refresh',
          objectSource: 'official-pull',
        }),
      ]);
      expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
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
    it('reads the persisted publication catalog without triggering an implicit refresh', async () => {
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
        metadata: {
          publishObject: {
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            discoverySource: 'manual',
          },
        },
        createdAt: 1000,
        updatedAt: 1000,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([]);
      resolvedPublishObjects = [
        {
          id: 'connector-1::group::group:alpha::',
          channelAccountId: 'connector-1',
          nativeObjectType: 'group',
          nativeObjectId: 'group:alpha',
          displayProfile: {
            title: 'Alpha Group',
            source: 'manual',
            quality: 'fallback',
            resolvedAt: 1000,
          },
          refreshState: {
            status: 'needs-refresh',
            reason: 'manual-fallback',
            updatedAt: 1000,
          },
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
      expect(publicationServiceMocks.refreshCatalog).not.toHaveBeenCalled();
      expect(result.data?.publishObjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'connector-1::group::group:alpha::',
            displayProfile: expect.objectContaining({
              title: 'Alpha Group',
            }),
          }),
        ])
      );
    });

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
      expect(result.data).toEqual(
        expect.objectContaining({
          connectors: [connector],
          channelAccounts: [connector],
          capabilityRegistry: expect.objectContaining({
            schemaVersion: 1,
            platforms: expect.objectContaining({
              telegram: expect.objectContaining({
                platform: 'telegram',
                messageActionButtons: expect.objectContaining({
                  support: 'full',
                }),
              }),
              weixin: expect.objectContaining({
                platform: 'weixin',
                commandEntry: expect.objectContaining({
                  support: 'limited',
                  officialSurfaces: [],
                }),
              }),
            }),
          }),
          agentProfiles: [
            expect.objectContaining({
              id: 'agent-profile-1',
              name: 'OpenClaw Publication',
              backend: 'openclaw-gateway',
            }),
          ],
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
          publishObjects: [],
        })
      );
    });

    it('returns object-level active session pointers in publish object catalog entries', async () => {
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
        metadata: {
          publishObject: {
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            discoverySource: 'manual',
          },
        },
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-1',
        connectorId: 'connector-1',
        remoteUserId: 'user-1',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        displayName: 'Alpha Group',
        authorizedAt: 1000,
        lastActive: 2000,
      };
      const session: IChannelSession = {
        id: 'external-session-1',
        userId: 'remote-1',
        agentType: 'codex',
        conversationId: 'conversation-stale-1',
        workspace: '/tmp/workspace',
        createdAt: 1000,
        lastActivity: 2600,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);
      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      resolvedPublishObjects = [
        {
          id: 'connector-1::group::group:alpha::',
          channelAccountId: 'connector-1',
          nativeObjectType: 'group',
          nativeObjectId: 'group:alpha',
          displayProfile: {
            title: 'Alpha Group',
            source: 'manual',
            quality: 'fallback',
            resolvedAt: 1000,
          },
          refreshState: {
            status: 'needs-refresh',
            reason: 'manual-fallback',
            updatedAt: 1000,
          },
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      mockGetAllExternalSessions.mockReturnValue({
        success: true,
        data: [
          {
            id: 'external-session-1',
            connectorId: 'connector-1',
            remoteIdentityId: 'remote-1',
            bindingId: 'binding-1',
            agentProfileId: 'agent-profile-1',
            activeConversationId: 'conversation-current-1',
            state: 'active',
            createdAt: 1000,
            lastActivity: 2600,
          },
        ],
      });

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.publishObjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channelAccountId: 'connector-1',
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            activeSessionPointer: expect.objectContaining({
              externalSessionId: 'external-session-1',
              activeConversationId: 'conversation-current-1',
              publicationBindingId: 'binding-1',
              workspace: '/tmp/workspace',
            }),
          }),
        ])
      );
    });

    it('returns explicit publication entries in the publication snapshot', async () => {
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
        metadata: {
          publishObject: {
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            displayName: 'Alpha Group',
            discoverySource: 'manual',
          },
        },
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-1',
        connectorId: 'connector-1',
        remoteUserId: 'user-1',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        displayName: 'Alpha Group',
        authorizedAt: 1000,
        lastActive: 2000,
      };
      const session: IChannelSession = {
        id: 'external-session-1',
        userId: 'remote-1',
        agentType: 'codex',
        conversationId: 'conversation-stale-1',
        workspace: '/tmp/workspace',
        createdAt: 1000,
        lastActivity: 2600,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);
      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      resolvedPublishObjects = [
        {
          id: 'connector-1::group::group:alpha::',
          channelAccountId: 'connector-1',
          nativeObjectType: 'group',
          nativeObjectId: 'group:alpha',
          displayProfile: {
            title: 'Alpha Group',
            source: 'manual',
            quality: 'fallback',
            resolvedAt: 1000,
          },
          refreshState: {
            status: 'needs-refresh',
            reason: 'manual-fallback',
            updatedAt: 1000,
          },
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      mockGetAllExternalSessions.mockReturnValue({
        success: true,
        data: [
          {
            id: 'external-session-1',
            connectorId: 'connector-1',
            remoteIdentityId: 'remote-1',
            bindingId: 'binding-1',
            agentProfileId: 'agent-profile-1',
            activeConversationId: 'conversation-current-1',
            state: 'active',
            createdAt: 1000,
            lastActivity: 2600,
          },
        ],
      });

      const result = await handlers['refreshPublicationSnapshot']();

      expect(result.success).toBe(true);
      expect(result.data?.catalog.publications).toEqual([
        expect.objectContaining({
          id: 'binding-1',
          agentProfileId: 'agent-profile-1',
          channelAccountId: 'connector-1',
          channelAccountName: 'Telegram',
          channelAccountPlatform: 'telegram',
          enabled: true,
          publishObject: expect.objectContaining({
            id: 'connector-1::group::group:alpha::',
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            displayProfile: expect.objectContaining({
              title: 'Alpha Group',
            }),
          }),
          currentSession: expect.objectContaining({
            publicationBindingId: 'binding-1',
            activeConversationId: 'conversation-current-1',
          }),
        }),
      ]);
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
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
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
        })),
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

    it('marks Discord thread objects as official-pull when the plugin resolves thread and parent metadata', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-discord-rich',
        platform: 'discord',
        name: 'Discord',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'discord-runtime-rich',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-discord-thread-1',
        connectorId: 'connector-discord-rich',
        remoteUserId: 'discord-user-1',
        remoteChatId: 'parent-channel:thread:thread-1',
        platformChatId: 'parent-channel',
        parentChatId: 'parent-channel',
        threadId: 'thread-1',
        remoteChatType: 'thread',
        peerScope: 'thread',
        displayName: 'Discord User 345678',
        authorizedAt: 1000,
        lastActive: 2200,
        metadata: {
          containerId: 'guild-1',
          containerType: 'server',
        },
      };

      mockGetPlugin.mockReturnValue({
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
          getChatDisplayData: vi.fn(async (chatId: string) => {
            if (chatId === 'thread-1') {
              return {
                name: 'Incident follow-up',
                chatType: 'thread',
                parentTitle: 'incident-room',
                containerTitle: 'Ops Guild',
                source: 'official-pull',
              };
            }
            if (chatId === 'parent-channel') {
              return {
                name: 'incident-room',
                chatType: 'channel',
                containerTitle: 'Ops Guild',
                source: 'official-pull',
              };
            }
            return null;
          }),
          getUserDisplayData: vi.fn(async () => null),
        })),
      });

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            connectorId: 'connector-discord-rich',
            key: 'parent-channel:thread:thread-1',
            scopeType: 'remote_chat',
            title: 'Incident follow-up',
            subtitle: 'In incident-room',
            objectKind: 'thread',
            objectTitle: 'Incident follow-up',
            objectSubtitle: 'In incident-room',
            parentObjectKey: 'parent-channel',
            parentObjectTitle: 'incident-room',
            parentObjectKind: 'channel',
          }),
        ])
      );
      expect(mockGetPlugin).toHaveBeenCalledWith('discord-runtime-rich');
    });

    it('uses DingTalk cached runtime display names for private chats without claiming official-pull', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-dingtalk-rich',
        platform: 'dingtalk',
        name: 'DingTalk',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'dingtalk-runtime-rich',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-dingtalk-private-1',
        connectorId: 'connector-dingtalk-rich',
        remoteUserId: 'staff-1',
        remoteChatId: 'user:staff-1',
        platformChatId: 'user:staff-1',
        remoteChatType: 'private',
        peerScope: 'chat',
        displayName: 'User ff12ac',
        authorizedAt: 1000,
        lastActive: 2200,
      };

      mockGetPlugin.mockReturnValue({
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
          getUserDisplayData: vi.fn(async (userId: string) => {
            if (userId === 'staff-1') {
              return {
                name: 'Alice Wang',
                source: 'runtime-resolved',
              };
            }
            return null;
          }),
        })),
      });

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual([
        expect.objectContaining({
          connectorId: 'connector-dingtalk-rich',
          scopeType: 'remote_user',
          key: 'staff-1',
          title: 'Alice Wang',
          displayName: 'Alice Wang',
        }),
      ]);
      expect(mockGetPlugin).toHaveBeenCalledWith('dingtalk-runtime-rich');
    });

    it('marks DingTalk group objects as official-pull when the plugin resolves the group title through the official API', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-dingtalk-group-rich',
        platform: 'dingtalk',
        name: 'DingTalk',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'dingtalk-runtime-group-rich',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-dingtalk-group-1',
        connectorId: 'connector-dingtalk-group-rich',
        remoteUserId: 'staff-ops-1',
        remoteChatId: 'group:cid-open-ops-1',
        platformChatId: 'group:cid-open-ops-1',
        remoteChatType: 'group',
        peerScope: 'chat',
        displayName: 'group:cid-open-ops-1',
        authorizedAt: 1000,
        lastActive: 2400,
      };

      mockGetPlugin.mockReturnValue({
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
          getChatDisplayData: vi.fn(async (chatId: string) => {
            if (chatId === 'group:cid-open-ops-1') {
              return {
                name: 'Ops Review',
                chatType: 'group',
                source: 'official-pull',
              };
            }
            return null;
          }),
          getUserDisplayData: vi.fn(async () => null),
        })),
      });

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data?.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            connectorId: 'connector-dingtalk-group-rich',
            key: 'group:cid-open-ops-1',
            scopeType: 'remote_chat',
            title: 'Ops Review',
            objectKind: 'group',
            objectTitle: 'Ops Review',
          }),
        ])
      );
      expect(mockGetPlugin).toHaveBeenCalledWith('dingtalk-runtime-group-rich');
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

    it('reads persisted publish objects without triggering refresh work', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-read-catalog',
        platform: 'lark',
        name: 'Feishu Persisted Catalog',
        enabled: true,
        configured: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      };

      resolvedPublishObjects = [
        {
          id: 'connector-lark-read-catalog::group::oc_catalog_group_1::',
          channelAccountId: 'connector-lark-read-catalog',
          nativeObjectType: 'group',
          nativeObjectId: 'oc_catalog_group_1',
          displayProfile: {
            title: 'Persisted Catalog Group',
            subtitle: 'Persisted publication object',
            source: 'official-pull',
            quality: 'resolved',
            resolvedAt: 2400,
          },
          createdAt: 1000,
          updatedAt: 2400,
        },
      ];

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([]);

      const result = await handlers['getBindingCatalog']();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          connectors: [connector],
          channelAccounts: [connector],
          publishObjects: [
            expect.objectContaining({
              channelAccountId: 'connector-lark-read-catalog',
              nativeObjectId: 'oc_catalog_group_1',
              displayProfile: expect.objectContaining({
                title: 'Persisted Catalog Group',
                source: 'official-pull',
              }),
            }),
          ],
        })
      );
      expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
    });
  });

  describe('refreshPublicationSnapshot', () => {
    it('returns one explicit snapshot payload for publication refresh', async () => {
      const connector: IConnectorInstance = {
        id: 'connector-lark-refresh',
        platform: 'lark',
        name: 'Feishu',
        enabled: true,
        configured: true,
        status: 'running',
        legacyPluginId: 'lark-runtime-refresh',
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-lark-refresh-1',
        connectorId: 'connector-lark-refresh',
        channelAccountId: 'connector-lark-refresh',
        remoteUserId: 'ou_refresh_1',
        remoteChatId: 'oc_refresh_group_1',
        platformChatId: 'oc_refresh_group_1',
        remoteChatType: 'group',
        peerScope: 'chat',
        displayName: 'User 92ab11',
        authorizedAt: 1000,
        lastActive: 2400,
      };
      const session: IChannelSession = {
        id: 'external-session-refresh-1',
        userId: 'remote-lark-refresh-1',
        agentType: 'codex',
        conversationId: 'conversation-refresh-1',
        workspace: '/tmp/workspaces/agent-profile-1',
        createdAt: 1000,
        lastActivity: 2400,
      };

      mockGetPlugin.mockReturnValue({
        getPublishObjectDiscoveryProvider: vi.fn(() => ({
          getChatDisplayData: vi.fn(async (chatId: string) => {
            if (chatId === 'oc_refresh_group_1') {
              return {
                name: 'Refresh Group',
                description: 'Explicit snapshot refresh',
                chatType: 'group',
                source: 'official-pull',
              };
            }
            return null;
          }),
        })),
      });

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);
      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);

      const result = (await handlers['refreshPublicationSnapshot']()) as {
        success: boolean;
        data?: {
          catalog: IChannelBindingCatalog;
          activeSessions: IChannelActiveSessionEntry[];
          refreshedAt: number;
        };
      };

      expect(result.success).toBe(true);
      expect(result.data?.catalog.audiences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            connectorId: 'connector-lark-refresh',
            key: 'oc_refresh_group_1',
            title: 'Refresh Group',
            objectSource: 'official-pull',
          }),
        ])
      );
      expect(result.data?.activeSessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'external-session-refresh-1',
            connectorId: 'connector-lark-refresh',
            objectTitle: 'Refresh Group',
          }),
        ])
      );
      expect(result.data?.catalog.discoverySummaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channelAccountId: 'connector-lark-refresh',
            state: 'official',
            discoveredCount: 1,
          }),
        ])
      );
      expect(result.data?.catalog.capabilitySummaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channelAccountId: 'connector-lark-refresh',
            integrationModel: 'official-bot-platform',
            discoveryMode: 'official-pull',
            actionSurfaces: expect.arrayContaining(['menu-entry', 'card-action-callbacks', 'thread-aware-reply']),
          }),
        ])
      );
      expect(typeof result.data?.refreshedAt).toBe('number');
      expect(publicationServiceMocks.resolvePublishObjectCatalog).toHaveBeenCalled();
    });
  });

  describe('refreshPublicationCatalog', () => {
    it('returns an explicitly refreshed publication snapshot with binding catalog and active sessions', async () => {
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
        metadata: {
          publishObject: {
            nativeObjectType: 'group',
            nativeObjectId: 'group:alpha',
            discoverySource: 'manual',
          },
        },
        createdAt: 1000,
        updatedAt: 1000,
      };
      const remoteIdentity: IRemoteIdentity = {
        id: 'remote-1',
        connectorId: 'connector-1',
        remoteUserId: 'user-1',
        remoteChatId: 'group:alpha',
        remoteChatType: 'group',
        displayName: 'Alpha Group',
        authorizedAt: 1000,
        lastActive: 2000,
      };
      const session: IChannelSession = {
        id: 'external-session-1',
        userId: 'remote-1',
        agentType: 'codex',
        conversationId: 'conversation-stale-1',
        workspace: '/tmp/workspace',
        createdAt: 1000,
        lastActivity: 2600,
      };

      vi.mocked(repo.getConnectorInstances).mockReturnValue([connector]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getRemoteIdentities).mockReturnValue([remoteIdentity]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);
      vi.mocked(repo.getChannelSessions).mockReturnValue([session]);
      mockGetAllExternalSessions.mockReturnValue({
        success: true,
        data: [
          {
            id: 'external-session-1',
            connectorId: 'connector-1',
            remoteIdentityId: 'remote-1',
            bindingId: 'binding-1',
            agentProfileId: 'agent-profile-1',
            activeConversationId: 'conversation-current-1',
            state: 'active',
            createdAt: 1000,
            lastActivity: 2600,
          },
        ],
      });

      const result = await handlers['refreshPublicationCatalog']();

      expect(result.success).toBe(true);
      expect(publicationServiceMocks.refreshCatalog).toHaveBeenCalledOnce();
      expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
      expect(result.data).toEqual(
        expect.objectContaining({
          bindingCatalog: expect.objectContaining({
            connectors: [connector],
            bindings: [{ ...binding, channelAccountId: binding.connectorId }],
            publishObjects: expect.arrayContaining([
              expect.objectContaining({
                channelAccountId: 'connector-1',
                nativeObjectId: 'group:alpha',
                displayProfile: expect.objectContaining({
                  title: 'Alpha Group',
                }),
              }),
            ]),
          }),
          activeSessions: expect.arrayContaining([
            expect.objectContaining({
              id: 'external-session-1',
              publicationBindingId: 'binding-1',
              activeConversationId: 'conversation-current-1',
              objectTitle: 'Alpha Group',
            }),
          ]),
        })
      );
    });
  });

  describe('getBindings', () => {
    it('returns bindings from repo', async () => {
      const profile: IAgentProfile = {
        id: 'agent-1',
        name: 'Ops Agent',
        backend: 'codex',
        workspaceRef: '/tmp/workspaces/agent-1',
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
        agentProfileId: 'agent-1',
        priority: 10,
        enabled: true,
        temporary: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      vi.mocked(repo.getAgentProfiles).mockReturnValue([profile]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([binding]);

      const result = await handlers['getBindings']({ connectorId: 'connector-1' });

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

  describe('upsertPublication', () => {
    it('upserts binding through repo', async () => {
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Ops Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          version: 1,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
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

      const result = await handlers['upsertPublication']({
        publication: {
          publicationId: 'binding-1',
          channelAccountId: 'connector-1',
          scopeType: 'remote_user',
          scopeKey: 'user-1',
          agentProfileId: 'agent-1',
          priority: 1,
        },
      });

      expect(repo.upsertChannelBinding).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'binding-1',
          connectorId: binding.connectorId,
          channelAccountId: binding.connectorId,
          scopeType: 'remote_user',
          scopeKey: 'user-1',
          agentProfileId: 'agent-1',
          priority: 1,
          enabled: true,
          temporary: false,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          metadata: {
            source: 'settings-publication-panel',
            operation: 'durable-publication',
            publishObject: {
              nativeObjectType: 'remote_user',
              nativeObjectId: 'user-1',
              parentNativeObjectId: undefined,
              displayName: undefined,
              discoverySource: 'manual',
              metadata: undefined,
            },
          },
        })
      );
      expect(publicationServiceMocks.upsertChannelBinding).toHaveBeenCalledWith(
        '/tmp/workspaces/agent-1',
        expect.objectContaining({
          id: 'binding-1',
          connectorId: 'connector-1',
          channelAccountId: 'connector-1',
        })
      );
      expect(result.success).toBe(true);
    });

    it('returns a readable conflict when another agent already owns the publish object', async () => {
      vi.mocked(repo.getChannelBindings).mockReturnValue([
        {
          id: 'binding-existing',
          connectorId: 'connector-1',
          channelAccountId: 'connector-1',
          scopeType: 'remote_chat',
          scopeKey: 'legacy-scope',
          agentProfileId: 'agent-1',
          priority: 1,
          enabled: true,
          temporary: false,
          metadata: {
            publishObject: {
              nativeObjectType: 'topic',
              nativeObjectId: 'om_topic_root_1',
              parentNativeObjectId: 'oc_group_1',
              displayName: 'Ops Topic',
              discoverySource: 'manual',
            },
          },
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Incident Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          promptProfile: {},
          toolPolicy: {},
          memoryPolicy: {},
          delegationPolicy: {},
          version: 1,
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ]);
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Incident Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          promptProfile: {},
          toolPolicy: {},
          memoryPolicy: {},
          delegationPolicy: {},
          version: 1,
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'agent-2',
          name: 'Support Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-2',
          promptProfile: {},
          toolPolicy: {},
          memoryPolicy: {},
          delegationPolicy: {},
          version: 1,
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ]);

      const result = await handlers['upsertPublication']({
        publication: {
          publicationId: 'binding-2',
          channelAccountId: 'connector-1',
          scopeType: 'remote_chat',
          scopeKey: 'other-scope',
          agentProfileId: 'agent-2',
          priority: 1,
          publishObject: {
            nativeObjectType: 'topic',
            nativeObjectId: 'om_topic_root_1',
            parentNativeObjectId: 'oc_group_1',
            displayName: 'Ops Topic',
            discoverySource: 'manual',
          },
        },
      });

      expect(repo.upsertChannelBinding).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.msg).toContain('Incident Agent');
      expect(result.msg).toContain('Ops Topic');
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Ops Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          version: 1,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      vi.mocked(repo.upsertChannelBinding).mockImplementation(() => {
        throw new Error('invalid binding scope');
      });

      const result = await handlers['upsertPublication']({
        publication: {
          publicationId: 'binding-invalid',
          channelAccountId: 'connector-1',
          scopeType: 'connector_default',
          scopeKey: '',
          agentProfileId: 'agent-1',
          priority: 0,
        },
      });

      expect(result.success).toBe(false);
      expect(result.msg).toBe('invalid binding scope');
    });
  });

  describe('deletePublication', () => {
    it('deletes binding through repo', async () => {
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Ops Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          version: 1,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([
        {
          id: 'binding-1',
          connectorId: 'connector-1',
          channelAccountId: 'connector-1',
          scopeType: 'remote_chat',
          scopeKey: 'group:alpha',
          agentProfileId: 'agent-1',
          priority: 10,
          enabled: true,
          temporary: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      const result = await handlers['deletePublication']({ publicationId: 'binding-1' });

      expect(repo.deleteChannelBinding).toHaveBeenCalledWith('binding-1');
      expect(publicationServiceMocks.deleteChannelBinding).toHaveBeenCalledWith('/tmp/workspaces/agent-1', 'binding-1');
      expect(result.success).toBe(true);
    });

    it('returns error when repo throws', async () => {
      vi.mocked(repo.getAgentProfiles).mockReturnValue([
        {
          id: 'agent-1',
          name: 'Ops Agent',
          backend: 'codex',
          workspaceRef: '/tmp/workspaces/agent-1',
          version: 1,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      vi.mocked(repo.getChannelBindings).mockReturnValue([
        {
          id: 'binding-1',
          connectorId: 'connector-1',
          channelAccountId: 'connector-1',
          scopeType: 'remote_chat',
          scopeKey: 'group:alpha',
          agentProfileId: 'agent-1',
          priority: 10,
          enabled: true,
          temporary: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);
      vi.mocked(repo.deleteChannelBinding).mockImplementation(() => {
        throw new Error('delete failed');
      });

      const result = await handlers['deletePublication']({ publicationId: 'binding-1' });

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
