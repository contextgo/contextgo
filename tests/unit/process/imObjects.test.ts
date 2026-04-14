/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { IRemoteIdentity } from '@process/channels/types';
import { describeRemoteIdentityObject, inferRemoteIdentityPublishObject } from '@process/channels/utils';

describe('imObjects platform recognition', () => {
  it('uses Slack workspace container identity as the parent of a channel publish object', () => {
    const identity: IRemoteIdentity = {
      id: 'remote-slack-channel-1',
      connectorId: 'connector-slack',
      remoteUserId: 'U123',
      remoteChatId: 'C123',
      platformChatId: 'C123',
      remoteChatType: 'channel',
      displayName: 'Deployments',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        containerId: 'T123',
        containerType: 'space',
        containerTitle: 'Ops Workspace',
      },
    };

    const publishObject = inferRemoteIdentityPublishObject(identity, 'slack');
    const descriptor = describeRemoteIdentityObject(identity, 'slack');

    expect(publishObject).toEqual(
      expect.objectContaining({
        nativeObjectType: 'channel',
        nativeObjectId: 'C123',
        parentNativeObjectId: 'T123',
      })
    );
    expect(descriptor).toEqual(
      expect.objectContaining({
        kind: 'channel',
        title: 'Deployments',
        parentKey: 'T123',
        parentKind: 'space',
        parentTitle: 'Ops Workspace',
      })
    );
  });

  it('classifies Slack mpim chats as groups instead of direct chats', () => {
    const identity: IRemoteIdentity = {
      id: 'remote-slack-mpim-1',
      connectorId: 'connector-slack',
      remoteUserId: 'U234',
      remoteChatId: 'G234',
      platformChatId: 'G234',
      remoteChatType: 'mpim',
      displayName: 'Release War Room',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        containerId: 'T123',
        containerType: 'space',
        containerTitle: 'Ops Workspace',
      },
    };

    const publishObject = inferRemoteIdentityPublishObject(identity, 'slack');
    const descriptor = describeRemoteIdentityObject(identity, 'slack');

    expect(publishObject).toEqual(
      expect.objectContaining({
        nativeObjectType: 'group',
        nativeObjectId: 'G234',
      })
    );
    expect(descriptor).toEqual(
      expect.objectContaining({
        kind: 'group',
        title: 'Release War Room',
      })
    );
  });

  it('uses Telegram container metadata to describe forum topic parents as channels', () => {
    const identity: IRemoteIdentity = {
      id: 'remote-telegram-thread-1',
      connectorId: 'connector-telegram',
      remoteUserId: 'telegram-user-1',
      remoteChatId: '-100123:thread:42',
      platformChatId: '-100123',
      parentChatId: '-100123',
      threadId: '42',
      peerScope: 'thread',
      remoteChatType: 'thread',
      displayName: 'Release planning',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        containerId: '-100123',
        containerType: 'channel',
        containerTitle: 'Release Announcements',
      },
    };

    const descriptor = describeRemoteIdentityObject(identity, 'telegram');

    expect(descriptor).toEqual(
      expect.objectContaining({
        kind: 'thread',
        title: 'Release planning',
        parentKey: '-100123',
        parentKind: 'channel',
        parentTitle: 'Release Announcements',
      })
    );
  });

  it('uses Lark container metadata to describe topic parents as groups when no readable parent title exists', () => {
    const identity: IRemoteIdentity = {
      id: 'remote-lark-topic-1',
      connectorId: 'connector-lark',
      remoteUserId: 'ou_user_1',
      remoteChatId: 'oc_group_1:thread:om_topic_root_1',
      platformChatId: 'oc_group_1',
      parentChatId: 'oc_group_1',
      threadId: 'om_topic_root_1',
      peerScope: 'thread',
      remoteChatType: 'topic',
      displayName: 'Incident Triage',
      authorizedAt: 1000,
      lastActive: 2000,
      metadata: {
        containerId: 'oc_group_1',
        containerType: 'group',
        containerTitle: 'Core Ops Group',
      },
    };

    const descriptor = describeRemoteIdentityObject(identity, 'lark');

    expect(descriptor).toEqual(
      expect.objectContaining({
        kind: 'topic',
        title: 'Incident Triage',
        parentKey: 'oc_group_1',
        parentKind: 'group',
        parentTitle: 'Core Ops Group',
      })
    );
  });
});
