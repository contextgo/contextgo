/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelObjectKind,
  ChannelObjectParentKind,
  IChannelAudienceEntry,
  IRemoteIdentity,
  PluginType,
  UnifiedPeerScope,
} from '../types';

export type ChannelObjectDescriptor = {
  key: string;
  kind: ChannelObjectKind;
  title: string;
  subtitle?: string;
  parentKey?: string;
  parentTitle?: string;
  parentKind?: ChannelObjectParentKind;
  platformLabel?: string;
};

type ChannelObjectInput = {
  platform: PluginType;
  scopeType?: IChannelAudienceEntry['scopeType'];
  key: string;
  displayName?: string;
  subtitle?: string;
  remoteUserId?: string;
  remoteChatId?: string;
  platformChatId?: string;
  remoteChatType?: string;
  peerScope?: UnifiedPeerScope;
  parentChatId?: string;
  parentTitle?: string;
  threadId?: string;
  containerId?: string;
  containerType?: string;
  containerTitle?: string;
};

function looksTechnicalIdentifier(value?: string): boolean {
  if (!value) {
    return false;
  }

  return (
    value.includes('://') ||
    value.startsWith('user:') ||
    value.startsWith('group:') ||
    value.includes(':thread:') ||
    /^(?:ou_|oc_|on_|om_)/.test(value) ||
    value.endsWith('@im.wechat')
  );
}

export function toReadableChannelIdentifier(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const threadMarker = ':thread:';
  if (value.includes(threadMarker)) {
    return value.slice(value.indexOf(threadMarker) + threadMarker.length) || undefined;
  }

  if (value.startsWith('user:')) {
    return value.slice(5) || undefined;
  }

  if (value.startsWith('group:')) {
    return value.slice(6) || undefined;
  }

  if (value.includes('://')) {
    const segments = value.split('/').filter(Boolean);
    return segments.at(-1) || undefined;
  }

  if (/^(?:ou_|oc_|on_|om_)/.test(value) || value.endsWith('@im.wechat')) {
    return undefined;
  }

  return value;
}

function pickReadableChannelIdentifier(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const readable = toReadableChannelIdentifier(value);
    if (readable) {
      return readable;
    }
  }

  return undefined;
}

function getPlatformDefaultObjectLabel(platform: PluginType, kind: ChannelObjectKind): string {
  if (platform === 'weixin') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'Contact';
      case 'group':
        return 'Group Chat';
      default:
        return 'Chat';
    }
  }

  if (platform === 'lark') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'Direct Chat';
      case 'group':
        return 'Group';
      case 'topic':
        return 'Topic';
      case 'thread':
        return 'Topic';
      default:
        return 'Chat';
    }
  }

  if (platform === 'slack') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'DM';
      case 'channel':
        return 'Channel';
      case 'thread':
        return 'Thread';
      default:
        return 'Workspace Chat';
    }
  }

  if (platform === 'discord') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'DM';
      case 'server':
        return 'Server';
      case 'channel':
        return 'Channel';
      case 'thread':
        return 'Thread';
      default:
        return 'Channel';
    }
  }

  if (platform === 'telegram') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'Private Chat';
      case 'group':
        return 'Group';
      case 'channel':
        return 'Channel';
      case 'thread':
        return 'Topic Thread';
      default:
        return 'Chat';
    }
  }

  if (platform === 'dingtalk') {
    switch (kind) {
      case 'person':
      case 'dm':
        return 'Private Chat';
      case 'group':
        return 'Group';
      default:
        return 'Chat';
    }
  }

  return 'Chat';
}

function inferKind(input: ChannelObjectInput): ChannelObjectKind {
  if (input.scopeType === 'remote_user') {
    return input.platform === 'weixin' ? 'person' : 'dm';
  }

  const normalizedType = input.remoteChatType?.toLowerCase();
  const normalizedKey = input.key.toLowerCase();

  if (input.platform === 'discord') {
    if (normalizedType === 'thread' || input.peerScope === 'thread' || Boolean(input.threadId)) {
      return 'thread';
    }
    if (normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'group') {
      return 'channel';
    }
  }

  if (input.platform === 'slack') {
    if (normalizedType === 'thread' || input.peerScope === 'thread' || Boolean(input.threadId)) {
      return 'thread';
    }
    if (normalizedType === 'im' || normalizedType === 'mpim' || normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'channel' || normalizedType === 'group') {
      return 'channel';
    }
  }

  if (input.platform === 'lark') {
    if (normalizedType === 'topic' || normalizedKey.includes('/topic/')) {
      return 'topic';
    }
    if (normalizedType === 'thread' || input.peerScope === 'thread' || Boolean(input.threadId)) {
      return 'topic';
    }
    if (normalizedType === 'p2p' || normalizedType === 'private' || normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'group') {
      return 'group';
    }
  }

  if (normalizedType === 'topic' || normalizedKey.includes('/topic/')) {
    return 'topic';
  }
  if (normalizedType === 'thread' || input.peerScope === 'thread' || normalizedKey.includes('/thread/') || normalizedKey.includes(':thread:')) {
    return 'thread';
  }
  if (normalizedType === 'channel' || normalizedKey.includes('/channel/')) {
    return 'channel';
  }
  if (normalizedType === 'group' || normalizedType === 'supergroup' || normalizedKey.startsWith('group:') || normalizedKey.includes('/group/')) {
    return 'group';
  }
  if (normalizedType === 'direct' || normalizedType === 'dm' || normalizedType === 'private' || normalizedType === 'p2p' || normalizedKey.startsWith('user:') || normalizedKey.includes('/user/') || normalizedKey.includes('/friend/') || normalizedKey.includes('/dm/')) {
    return input.platform === 'weixin' ? 'person' : 'dm';
  }

  return 'chat';
}

function inferParentKind(platform: PluginType, kind: ChannelObjectKind, input: ChannelObjectInput): ChannelObjectParentKind | undefined {
  if ((kind === 'channel' || kind === 'server' || kind === 'space') && input.containerType === 'space') {
    return 'space';
  }

  if (kind === 'topic') {
    return platform === 'lark' ? 'group' : 'channel';
  }

  if (kind === 'thread') {
    if (platform === 'discord' || platform === 'slack') {
      return 'channel';
    }
    return 'chat';
  }

  if (kind === 'channel' && platform === 'discord') {
    return 'server';
  }

  return undefined;
}

function shouldPreferDisplayName(input: ChannelObjectInput, kind: ChannelObjectKind): boolean {
  if (!input.displayName || looksTechnicalIdentifier(input.displayName)) {
    return false;
  }

  if (input.platform === 'lark' && (kind === 'topic' || kind === 'thread') && input.displayName.startsWith('User ')) {
    return false;
  }

  return true;
}

export function describeChannelObject(input: ChannelObjectInput): ChannelObjectDescriptor {
  const kind = inferKind(input);
  const preferredTitle = shouldPreferDisplayName(input, kind) ? input.displayName : undefined;
  const fallbackId = pickReadableChannelIdentifier(
    input.threadId,
    input.platformChatId,
    input.remoteUserId,
    input.remoteChatId,
    input.key
  );
  const platformLabel = getPlatformDefaultObjectLabel(input.platform, kind);
  const title = preferredTitle || (fallbackId ? `${platformLabel} ${fallbackId}` : platformLabel);
  const inferredParentKind = inferParentKind(input.platform, kind, input);
  const useContainerParent = inferredParentKind === 'server' || inferredParentKind === 'space';
  const parentKey = useContainerParent
    ? input.containerId
    : input.parentChatId && input.parentChatId !== input.key
      ? input.parentChatId
      : undefined;
  const parentTitle = useContainerParent
    ? input.containerTitle || pickReadableChannelIdentifier(input.containerId)
    : (!input.parentTitle || looksTechnicalIdentifier(input.parentTitle) ? undefined : input.parentTitle) ||
      pickReadableChannelIdentifier(input.parentChatId, input.platformChatId);
  const parentKind = inferredParentKind;

  return {
    key: input.key,
    kind,
    title,
    subtitle: input.subtitle,
    parentKey,
    parentTitle: parentTitle && parentTitle !== title ? parentTitle : undefined,
    parentKind,
  };
}

export function describeAudienceObject(audience: IChannelAudienceEntry, platform: PluginType): ChannelObjectDescriptor {
  if (audience.objectKey && audience.objectKind && audience.objectTitle) {
    return {
      key: audience.objectKey,
      kind: audience.objectKind,
      title: audience.objectTitle,
      subtitle: audience.objectSubtitle,
      parentKey: audience.parentObjectKey,
      parentTitle: audience.parentObjectTitle,
      parentKind: audience.parentObjectKind,
    };
  }

  return describeChannelObject({
    platform,
    scopeType: audience.scopeType,
    key: audience.key,
    displayName: audience.displayName ?? audience.title,
    subtitle: audience.subtitle,
    remoteUserId: audience.remoteUserId,
    remoteChatId: audience.remoteChatId,
    platformChatId: audience.platformChatId,
    remoteChatType: audience.remoteChatType,
    peerScope: audience.peerScope,
    parentChatId: audience.parentChatId,
    threadId: audience.threadId,
  });
}

export function describeRemoteIdentityObject(identity: IRemoteIdentity, platform: PluginType): ChannelObjectDescriptor {
  return describeChannelObject({
    platform,
    scopeType: identity.remoteUserId && identity.remoteUserId === identity.remoteChatId ? 'remote_user' : 'remote_chat',
    key: identity.remoteChatId,
    displayName: identity.displayName,
    subtitle:
      typeof identity.metadata?.objectSubtitle === 'string'
        ? identity.metadata.objectSubtitle
        : typeof identity.metadata?.chatDescription === 'string'
          ? identity.metadata.chatDescription
          : undefined,
    remoteUserId: identity.remoteUserId,
    remoteChatId: identity.remoteChatId,
    platformChatId: identity.platformChatId,
    remoteChatType: identity.remoteChatType,
    peerScope: identity.peerScope,
    parentChatId: identity.parentChatId,
    parentTitle: typeof identity.metadata?.parentTitle === 'string' ? identity.metadata.parentTitle : undefined,
    threadId: identity.threadId,
    containerId: typeof identity.metadata?.containerId === 'string' ? identity.metadata.containerId : undefined,
    containerType: typeof identity.metadata?.containerType === 'string' ? identity.metadata.containerType : undefined,
    containerTitle: typeof identity.metadata?.containerTitle === 'string' ? identity.metadata.containerTitle : undefined,
  });
}
