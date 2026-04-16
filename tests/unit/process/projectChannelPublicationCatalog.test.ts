/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  IChannelAudienceEntry,
  IChannelBinding,
  IConnectorInstance,
  IRemoteIdentity,
} from '@process/channels/types';
import { ProjectChannelPublicationService } from '@process/channels/core/ProjectChannelPublicationService';
import { resolvePublishObjectCatalogEntry } from '@process/channels/utils';

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-publish-object-catalog-'));
  tempDirs.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((workspace) => fs.rm(workspace, { recursive: true, force: true })));
});

describe('ProjectChannelPublicationService publish object catalog', () => {
  it('resolves a publish-object catalog entry from exact identity, audience identity, and legacy alias candidates', async () => {
    const binding: IChannelBinding = {
      id: 'binding-topic-legacy',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'chat',
          nativeObjectId: 'oc_group_1:thread:om_topic_root_1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };
    const audience: IChannelAudienceEntry = {
      key: 'oc_group_1:thread:om_topic_root_1',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      remoteChatId: 'oc_group_1:thread:om_topic_root_1',
      platformChatId: 'oc_group_1',
      remoteChatType: 'topic',
      peerScope: 'thread',
      parentChatId: 'oc_group_1',
      threadId: 'om_topic_root_1',
      objectKey: 'om_topic_root_1',
      objectKind: 'topic',
      objectTitle: 'Ops Topic',
      objectSubtitle: 'In Core Ops Group',
      parentObjectKey: 'oc_group_1',
      parentObjectTitle: 'Core Ops Group',
      parentObjectKind: 'group',
      title: 'Ops Topic',
      subtitle: 'In Core Ops Group',
      lastActive: 2000,
    };

    const publishObject = resolvePublishObjectCatalogEntry({
      binding,
      audience,
      publishObjects: [
        {
          id: 'connector-lark::topic::om_topic_root_1::oc_group_1',
          channelAccountId: 'connector-lark',
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayProfile: {
            title: 'Ops Topic',
            subtitle: 'In Core Ops Group',
            parentTitle: 'Core Ops Group',
            source: 'inbound-learned',
            quality: 'resolved',
            resolvedAt: 2000,
          },
          aliases: ['oc_group_1:thread:om_topic_root_1'],
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
    });

    expect(publishObject?.id).toBe('connector-lark::topic::om_topic_root_1::oc_group_1');
  });

  it('backfills a persisted catalog entry by merging binding metadata with readable inbound identity facts', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

    const binding: IChannelBinding = {
      id: 'binding-topic-1',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Topic om_topic_root_1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

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
      channelAccountId: 'connector-lark',
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
      metadata: {
        parentTitle: 'Core Ops Group',
        objectSubtitle: 'In Core Ops Group',
      },
    };

    const entries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [remoteIdentity],
      channelAccounts: [connector],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        channelAccountId: 'connector-lark',
        nativeObjectType: 'topic',
        nativeObjectId: 'om_topic_root_1',
        parentNativeObjectId: 'oc_group_1',
        displayProfile: expect.objectContaining({
          title: 'Ops Topic',
          subtitle: 'In Core Ops Group',
          parentTitle: 'Core Ops Group',
          source: 'inbound-learned',
          quality: 'resolved',
        }),
      }),
    ]);

    const persistedCatalog = JSON.parse(
      await fs.readFile(path.join(workspace, '.contextgo/channels/publish-objects.json'), 'utf8')
    ) as {
      publishObjects: Array<{
        channelAccountId: string;
        nativeObjectId: string;
        displayProfile: { title: string; quality: string; source: string };
      }>;
    };

    expect(persistedCatalog.publishObjects).toEqual([
      expect.objectContaining({
        channelAccountId: 'connector-lark',
        nativeObjectId: 'om_topic_root_1',
        displayProfile: expect.objectContaining({
          title: 'Ops Topic',
          source: 'inbound-learned',
          quality: 'resolved',
        }),
      }),
    ]);
  });

  it('keeps a manual fallback catalog entry when no readable object title exists yet', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

    const binding: IChannelBinding = {
      id: 'binding-topic-fallback',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Topic om_topic_root_1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

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

    const entries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [],
      channelAccounts: [connector],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        nativeObjectId: 'om_topic_root_1',
        displayProfile: expect.objectContaining({
          title: 'Topic om_topic_root_1',
          source: 'manual',
          quality: 'fallback',
        }),
        refreshState: expect.objectContaining({
          status: 'needs-refresh',
          reason: 'manual-fallback',
        }),
      }),
    ]);
  });

  it('upgrades a fallback catalog entry to ready and stamps backfilledAt when later discovery repairs it', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

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
    const binding: IChannelBinding = {
      id: 'binding-topic-refresh',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Topic om_topic_root_1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

    const fallbackEntries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [],
      channelAccounts: [connector],
    });

    expect(fallbackEntries[0]?.refreshState).toEqual(
      expect.objectContaining({
        status: 'needs-refresh',
        reason: 'manual-fallback',
      })
    );

    const remoteIdentity: IRemoteIdentity = {
      id: 'remote-topic-refresh',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      remoteUserId: 'ou_user_1',
      remoteChatId: 'oc_group_1:thread:om_topic_root_1',
      platformChatId: 'oc_group_1',
      parentChatId: 'oc_group_1',
      threadId: 'om_topic_root_1',
      remoteChatType: 'topic',
      peerScope: 'thread',
      displayName: 'Ops Topic',
      authorizedAt: 1000,
      lastActive: 3000,
      metadata: {
        parentTitle: 'Core Ops Group',
        objectSubtitle: 'In Core Ops Group',
      },
    };

    const repairedEntries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [remoteIdentity],
      channelAccounts: [connector],
    });

    expect(repairedEntries).toEqual([
      expect.objectContaining({
        nativeObjectId: 'om_topic_root_1',
        displayProfile: expect.objectContaining({
          title: 'Ops Topic',
          quality: 'resolved',
        }),
        refreshState: expect.objectContaining({
          status: 'ready',
          backfilledAt: 3000,
        }),
      }),
    ]);
  });

  it('refreshes a previously read publication catalog through an explicit service refresh entrypoint', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

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
    const binding: IChannelBinding = {
      id: 'binding-topic-explicit-refresh',
      connectorId: 'connector-lark',
      channelAccountId: 'connector-lark',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Topic om_topic_root_1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

    await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [],
      channelAccounts: [connector],
    });

    const publicationCatalog = await service.readCatalogForWorkspaces([workspace]);
    const refreshedCatalog = await service.refreshCatalog({
      publicationCatalog,
      remoteIdentities: [
        {
          id: 'remote-topic-explicit-refresh',
          connectorId: 'connector-lark',
          channelAccountId: 'connector-lark',
          remoteUserId: 'ou_user_1',
          remoteChatId: 'oc_group_1:thread:om_topic_root_1',
          platformChatId: 'oc_group_1',
          parentChatId: 'oc_group_1',
          threadId: 'om_topic_root_1',
          remoteChatType: 'topic',
          peerScope: 'thread',
          displayName: 'Ops Topic',
          authorizedAt: 1000,
          lastActive: 3000,
          metadata: {
            parentTitle: 'Core Ops Group',
            objectSubtitle: 'In Core Ops Group',
          },
        },
      ],
      channelAccounts: [connector],
    });

    expect(refreshedCatalog.publishObjects).toEqual([
      expect.objectContaining({
        nativeObjectId: 'om_topic_root_1',
        displayProfile: expect.objectContaining({
          title: 'Ops Topic',
          quality: 'resolved',
        }),
        refreshState: expect.objectContaining({
          status: 'ready',
          backfilledAt: 3000,
        }),
      }),
    ]);
  });

  it('promotes plugin-resolved identities to official-pull when runtime metadata marks the display source', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

    const connector: IConnectorInstance = {
      id: 'connector-discord',
      platform: 'discord',
      name: 'Discord',
      enabled: true,
      configured: true,
      status: 'running',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const binding: IChannelBinding = {
      id: 'binding-discord-thread-1',
      connectorId: 'connector-discord',
      channelAccountId: 'connector-discord',
      scopeType: 'remote_chat',
      scopeKey: 'parent-channel:thread:thread-1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'thread',
          nativeObjectId: 'thread-1',
          parentNativeObjectId: 'parent-channel',
          displayName: 'Thread thread-1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

    await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [],
      channelAccounts: [connector],
    });

    const remoteIdentity: IRemoteIdentity = {
      id: 'remote-discord-thread-1',
      connectorId: 'connector-discord',
      channelAccountId: 'connector-discord',
      remoteUserId: 'discord-user-1',
      remoteChatId: 'parent-channel:thread:thread-1',
      platformChatId: 'parent-channel',
      parentChatId: 'parent-channel',
      threadId: 'thread-1',
      remoteChatType: 'thread',
      peerScope: 'thread',
      displayName: 'Incident follow-up',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        parentTitle: 'incident-room',
        objectSubtitle: 'In incident-room',
        containerId: 'guild-1',
        containerType: 'server',
        containerTitle: 'Ops Guild',
        displaySource: 'official-pull',
      },
    };

    const entries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [remoteIdentity],
      channelAccounts: [connector],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        channelAccountId: 'connector-discord',
        nativeObjectType: 'thread',
        nativeObjectId: 'thread-1',
        parentNativeObjectId: 'parent-channel',
        displayProfile: expect.objectContaining({
          title: 'Incident follow-up',
          subtitle: 'In incident-room',
          parentTitle: 'incident-room',
          source: 'official-pull',
          quality: 'resolved',
        }),
      }),
    ]);
  });

  it('resolves runtime publish object discovery during catalog refresh without bridge-side enrichment', async () => {
    const workspace = await createTempWorkspace();
    const service = new ProjectChannelPublicationService();

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

    const binding: IChannelBinding = {
      id: 'binding-discord-thread-rich',
      connectorId: 'connector-discord-rich',
      channelAccountId: 'connector-discord-rich',
      scopeType: 'remote_chat',
      scopeKey: 'parent-channel:thread:thread-1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'thread',
          nativeObjectId: 'thread-1',
          parentNativeObjectId: 'parent-channel',
          displayName: 'Thread thread-1',
          discoverySource: 'manual',
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    };

    const remoteIdentity: IRemoteIdentity = {
      id: 'remote-discord-thread-rich',
      connectorId: 'connector-discord-rich',
      channelAccountId: 'connector-discord-rich',
      remoteUserId: 'discord-user-1',
      remoteChatId: 'parent-channel:thread:thread-1',
      platformChatId: 'parent-channel',
      parentChatId: 'parent-channel',
      threadId: 'thread-1',
      remoteChatType: 'thread',
      peerScope: 'thread',
      displayName: 'Discord User 345678',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        containerId: 'guild-1',
        containerType: 'server',
      },
    };

    const resolveDiscoveryProvider = vi.fn((runtimeId: string) =>
      runtimeId === 'discord-runtime-rich'
        ? {
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
          }
        : null
    );

    const entries = await service.resolvePublishObjectCatalog(workspace, {
      bindings: [binding],
      remoteIdentities: [remoteIdentity],
      channelAccounts: [connector],
      resolveDiscoveryProvider,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        channelAccountId: 'connector-discord-rich',
        nativeObjectType: 'thread',
        nativeObjectId: 'thread-1',
        parentNativeObjectId: 'parent-channel',
        displayProfile: expect.objectContaining({
          title: 'Incident follow-up',
          subtitle: 'In incident-room',
          parentTitle: 'incident-room',
          source: 'official-pull',
          quality: 'resolved',
        }),
      }),
    ]);
    expect(resolveDiscoveryProvider).toHaveBeenCalledWith('discord-runtime-rich');
  });
});
