/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelObjectKind,
  ChannelObjectParentKind,
  IChannelAudienceEntry,
  IChannelBinding,
  IChannelPublishObject,
  IChannelPublishObjectCatalogEntry,
  IRemoteIdentity,
  PluginType,
  UnifiedPeerScope,
} from '../types';
import { getChannelBindingPublishObject, getChannelPublishObjectCatalogEntryIdentity } from '../types';

const CATALOG_SOURCE_PRIORITY: Record<IChannelPublishObjectCatalogEntry['displayProfile']['source'], number> = {
  'official-pull': 4,
  'runtime-resolved': 3,
  'inbound-learned': 2,
  manual: 1,
};

const CATALOG_QUALITY_PRIORITY: Record<IChannelPublishObjectCatalogEntry['displayProfile']['quality'], number> = {
  resolved: 3,
  inferred: 2,
  fallback: 1,
};

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

type ResolvePublishObjectCatalogEntryParams = {
  binding?: IChannelBinding;
  audience?: IChannelAudienceEntry;
  publishObjects?: readonly IChannelPublishObjectCatalogEntry[];
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

function buildPublishObjectCatalogEntryId(params: {
  channelAccountId: string;
  nativeObjectType: string;
  nativeObjectId: string;
  parentNativeObjectId?: string;
}): string {
  return getChannelPublishObjectCatalogEntryIdentity({
    id: '',
    channelAccountId: params.channelAccountId,
    nativeObjectType: params.nativeObjectType,
    nativeObjectId: params.nativeObjectId,
    parentNativeObjectId: params.parentNativeObjectId,
    displayProfile: {
      title: '',
      source: 'manual',
      quality: 'fallback',
      resolvedAt: 0,
    },
    createdAt: 0,
    updatedAt: 0,
  });
}

function getPublishObjectCatalogEntryIdFromAudience(
  audience: IChannelAudienceEntry,
  channelAccountId: string
): string | undefined {
  if (!audience.objectKey || !audience.objectKind) {
    return undefined;
  }

  return buildPublishObjectCatalogEntryId({
    channelAccountId,
    nativeObjectType: audience.objectKind,
    nativeObjectId: audience.objectKey,
    parentNativeObjectId: audience.parentObjectKey,
  });
}

function getPublishObjectCatalogEntryIdFromBinding(binding: IChannelBinding, channelAccountId: string): string {
  const publishObject = getChannelBindingPublishObject(binding);
  return buildPublishObjectCatalogEntryId({
    channelAccountId,
    nativeObjectType: publishObject.nativeObjectType,
    nativeObjectId: publishObject.nativeObjectId,
    parentNativeObjectId: publishObject.parentNativeObjectId,
  });
}

function getAliasCandidates(params: { binding?: IChannelBinding; audience?: IChannelAudienceEntry }): Set<string> {
  return new Set(
    [
      params.binding?.scopeKey,
      params.audience?.key,
      params.audience?.objectKey,
      params.audience?.remoteChatId,
      params.audience?.platformChatId,
    ].filter((value): value is string => Boolean(value))
  );
}

function getNativeObjectIdCandidates(params: {
  binding?: IChannelBinding;
  audience?: IChannelAudienceEntry;
}): Set<string> {
  return new Set(
    [
      params.audience?.objectKey,
      params.audience?.threadId,
      params.binding ? getChannelBindingPublishObject(params.binding).nativeObjectId : undefined,
    ].filter((value): value is string => Boolean(value))
  );
}

export function resolvePublishObjectCatalogEntry(
  params: ResolvePublishObjectCatalogEntryParams
): IChannelPublishObjectCatalogEntry | undefined {
  if (!params.publishObjects || params.publishObjects.length === 0) {
    return undefined;
  }

  const channelAccountId = params.audience?.channelAccountId ?? params.binding?.channelAccountId;
  if (!channelAccountId) {
    return undefined;
  }

  const publishObjectCatalog = new Map(
    params.publishObjects.map((publishObject) => [publishObject.id, publishObject] as const)
  );
  const exactBindingId = params.binding
    ? getPublishObjectCatalogEntryIdFromBinding(params.binding, channelAccountId)
    : undefined;
  if (exactBindingId) {
    const exactBindingEntry = publishObjectCatalog.get(exactBindingId);
    if (exactBindingEntry) {
      return exactBindingEntry;
    }
  }

  const exactAudienceId = params.audience
    ? getPublishObjectCatalogEntryIdFromAudience(params.audience, channelAccountId)
    : undefined;
  if (exactAudienceId) {
    const exactAudienceEntry = publishObjectCatalog.get(exactAudienceId);
    if (exactAudienceEntry) {
      return exactAudienceEntry;
    }
  }

  const aliasCandidates = getAliasCandidates(params);
  const nativeObjectIdCandidates = getNativeObjectIdCandidates(params);
  const preferredParentId = params.audience?.parentObjectKey;

  return params.publishObjects
    .filter((publishObject) => {
      if (publishObject.channelAccountId !== channelAccountId) {
        return false;
      }

      const matchesAlias = (publishObject.aliases ?? []).some((alias) => aliasCandidates.has(alias));
      const matchesNativeObjectId = nativeObjectIdCandidates.has(publishObject.nativeObjectId);
      return matchesAlias || matchesNativeObjectId;
    })
    .toSorted((left, right) => {
      const aliasDelta =
        ((right.aliases ?? []).some((alias) => aliasCandidates.has(alias)) ? 1 : 0) -
        ((left.aliases ?? []).some((alias) => aliasCandidates.has(alias)) ? 1 : 0);
      if (aliasDelta !== 0) {
        return aliasDelta;
      }

      const parentDelta =
        (right.parentNativeObjectId === preferredParentId ? 1 : 0) -
        (left.parentNativeObjectId === preferredParentId ? 1 : 0);
      if (parentDelta !== 0) {
        return parentDelta;
      }

      const qualityDelta =
        CATALOG_QUALITY_PRIORITY[right.displayProfile.quality] - CATALOG_QUALITY_PRIORITY[left.displayProfile.quality];
      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      const sourceDelta =
        CATALOG_SOURCE_PRIORITY[right.displayProfile.source] - CATALOG_SOURCE_PRIORITY[left.displayProfile.source];
      if (sourceDelta !== 0) {
        return sourceDelta;
      }

      return right.updatedAt - left.updatedAt;
    })[0];
}

export function getPlatformDefaultObjectLabel(platform: PluginType, kind: ChannelObjectKind): string {
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
    if (normalizedType === 'mpim') {
      return 'group';
    }
    if (normalizedType === 'im' || normalizedType === 'dm') {
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
  if (
    normalizedType === 'thread' ||
    input.peerScope === 'thread' ||
    normalizedKey.includes('/thread/') ||
    normalizedKey.includes(':thread:')
  ) {
    return 'thread';
  }
  if (normalizedType === 'channel' || normalizedKey.includes('/channel/')) {
    return 'channel';
  }
  if (
    normalizedType === 'group' ||
    normalizedType === 'supergroup' ||
    normalizedKey.startsWith('group:') ||
    normalizedKey.includes('/group/')
  ) {
    return 'group';
  }
  if (
    normalizedType === 'direct' ||
    normalizedType === 'dm' ||
    normalizedType === 'private' ||
    normalizedType === 'p2p' ||
    normalizedKey.startsWith('user:') ||
    normalizedKey.includes('/user/') ||
    normalizedKey.includes('/friend/') ||
    normalizedKey.includes('/dm/')
  ) {
    return input.platform === 'weixin' ? 'person' : 'dm';
  }

  return 'chat';
}

function inferParentKind(
  platform: PluginType,
  kind: ChannelObjectKind,
  input: ChannelObjectInput
): ChannelObjectParentKind | undefined {
  const containerParentKind =
    input.containerType === 'group' ||
    input.containerType === 'channel' ||
    input.containerType === 'server' ||
    input.containerType === 'space'
      ? input.containerType
      : undefined;

  if (
    (kind === 'channel' || kind === 'group' || kind === 'server' || kind === 'space') &&
    (containerParentKind === 'space' || containerParentKind === 'server')
  ) {
    return containerParentKind;
  }

  if (kind === 'topic') {
    if (containerParentKind === 'group') {
      return 'group';
    }

    return platform === 'lark' ? 'group' : 'channel';
  }

  if (kind === 'thread') {
    if (platform === 'discord' || platform === 'slack') {
      return 'channel';
    }

    if (containerParentKind === 'channel' || containerParentKind === 'group') {
      return containerParentKind;
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

function inferNativeObjectId(kind: ChannelObjectKind, input: ChannelObjectInput): string {
  if (kind === 'topic' || kind === 'thread') {
    return input.threadId || input.remoteChatId || input.platformChatId || input.key;
  }

  if (kind === 'person' || kind === 'dm') {
    return input.remoteUserId || input.platformChatId || input.remoteChatId || input.key;
  }

  return input.platformChatId || input.remoteChatId || input.key;
}

function inferParentNativeObjectId(kind: ChannelObjectKind, input: ChannelObjectInput): string | undefined {
  if (kind === 'topic' || kind === 'thread') {
    return input.parentChatId || input.platformChatId || input.containerId || undefined;
  }

  const parentKind = inferParentKind(input.platform, kind, input);
  if ((kind === 'channel' || kind === 'group') && (parentKind === 'space' || parentKind === 'server')) {
    return input.containerId;
  }

  return undefined;
}

export function inferChannelPublishObject(input: ChannelObjectInput): IChannelPublishObject {
  const kind = inferKind(input);
  const displayName = shouldPreferDisplayName(input, kind) ? input.displayName?.trim() : undefined;

  return {
    nativeObjectType: kind,
    nativeObjectId: inferNativeObjectId(kind, input),
    parentNativeObjectId: inferParentNativeObjectId(kind, input),
    displayName: displayName || undefined,
    discoverySource: 'inbound-learned',
    metadata: {
      ...(input.remoteChatId ? { remoteChatId: input.remoteChatId } : {}),
      ...(input.platformChatId ? { platformChatId: input.platformChatId } : {}),
      ...(input.parentChatId ? { parentChatId: input.parentChatId } : {}),
      ...(input.threadId ? { threadId: input.threadId } : {}),
    },
  };
}

export function inferAudiencePublishObject(
  audience: IChannelAudienceEntry,
  platform: PluginType
): IChannelPublishObject {
  return inferChannelPublishObject({
    platform,
    scopeType: audience.scopeType,
    key: audience.key,
    displayName: audience.objectTitle ?? audience.displayName ?? audience.title,
    subtitle: audience.objectSubtitle ?? audience.subtitle,
    remoteUserId: audience.remoteUserId,
    remoteChatId: audience.remoteChatId,
    platformChatId: audience.platformChatId,
    remoteChatType: audience.remoteChatType,
    peerScope: audience.peerScope,
    parentChatId: audience.parentChatId,
    parentTitle: audience.parentObjectTitle,
    threadId: audience.threadId,
  });
}

export function inferRemoteIdentityPublishObject(
  identity: IRemoteIdentity,
  platform: PluginType
): IChannelPublishObject {
  return inferChannelPublishObject({
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
    containerTitle:
      typeof identity.metadata?.containerTitle === 'string' ? identity.metadata.containerTitle : undefined,
  });
}

export function isChannelObjectFallbackTitle(params: {
  platform: PluginType;
  kind: ChannelObjectKind;
  title?: string;
  nativeObjectId?: string;
}): boolean {
  const normalizedTitle = params.title?.trim();
  if (!normalizedTitle) {
    return true;
  }

  const platformLabel = getPlatformDefaultObjectLabel(params.platform, params.kind);
  if (normalizedTitle === platformLabel) {
    return true;
  }

  return Boolean(params.nativeObjectId) && normalizedTitle === `${platformLabel} ${params.nativeObjectId}`;
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
  const useContainerParent =
    Boolean(input.containerId) &&
    Boolean(inferredParentKind) &&
    (input.containerType === inferredParentKind ||
      ((input.containerType === 'group' || input.containerType === 'channel') &&
        inferredParentKind === input.containerType));
  const parentKey = useContainerParent
    ? input.containerId
    : input.parentChatId && input.parentChatId !== input.key
      ? input.parentChatId
      : undefined;
  const parentTitle = useContainerParent
    ? input.containerTitle ||
      (!input.parentTitle || looksTechnicalIdentifier(input.parentTitle) ? undefined : input.parentTitle) ||
      pickReadableChannelIdentifier(input.containerId, input.parentChatId, input.platformChatId)
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
    containerTitle:
      typeof identity.metadata?.containerTitle === 'string' ? identity.metadata.containerTitle : undefined,
  });
}
