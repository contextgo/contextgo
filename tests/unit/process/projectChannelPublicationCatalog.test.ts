/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IChannelBinding, IConnectorInstance, IRemoteIdentity } from '@process/channels/types';
import { ProjectChannelPublicationService } from '@process/channels/core/ProjectChannelPublicationService';

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
      }),
    ]);
  });
});
