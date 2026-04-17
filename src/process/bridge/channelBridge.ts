/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import { BUILTIN_CHANNEL_TYPES, getBuiltinChannel, isBuiltinChannelType } from '@/common/config/builtinChannels';
import {
  buildChannelCapabilityRegistry,
  getChannelNativeAgentSurfaceCapabilities,
} from '@process/channels/core/channelCapabilityRegistry';
import { getChannelManager } from '@process/channels/core/ChannelManager';
import { enrichRemoteIdentitiesForPublishObjectDiscovery } from '@process/channels/core/publishObjectDiscovery';
import {
  describeRemoteIdentityObject,
  inferRemoteIdentityPublishObject,
  isChannelObjectFallbackTitle,
  resolvePublishObjectCatalogEntry as resolveCatalogPublishObjectEntry,
} from '@process/channels/utils';
import { getChannelContinuationService } from '@process/channels/core/ChannelContinuationService';
import { getChannelPublicationService } from '@process/channels/core/ChannelPublicationService';
import { getPairingService } from '@process/channels/pairing/PairingService';
import { getDatabase } from '@process/services/database';
import { ExtensionRegistry } from '@process/extensions';
import { toAssetUrl } from '@process/extensions/protocol/assetProtocol';
import * as path from 'path';
import type {
  IChannelActiveSessionEntry,
  IChannelAudienceEntry,
  IChannelBinding,
  IChannelControlLease,
  IChannelBindingCatalog,
  IChannelPublicationCapabilitySummary,
  IChannelPublicationDiscoverySummary,
  IChannelPublicationEntry,
  IChannelPublicationUpsertInput,
  IChannelPublicationSnapshot,
  IChannelPublishObjectActiveSessionPointer,
  IChannelPublishObjectCatalogEntry,
  IChannelPublicationCatalogRefreshResult,
  IChannelPluginStatus,
  IChannelSession,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
  PluginType,
} from '@process/channels/types';
import {
  findConflictingChannelBinding,
  getChannelAccountId,
  getChannelBindingPublishObjectLabel,
  getChannelPublishObjectCatalogEntryIdentity,
  getChannelBindingSource,
  hasPluginCredentials,
  isSystemFallbackBinding,
  withChannelAccountId,
  withChannelBindingPublishObject,
} from '@process/channels/types';
import type { IChannelRepository } from '@process/services/database/IChannelRepository';
import { ProjectChannelPublicationService } from '@process/channels/core/ProjectChannelPublicationService';
import { conversationServiceSingleton } from '@process/services/conversationServiceSingleton';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toThreadParts(remoteChatId: string): { parentChatId?: string; threadId?: string } {
  const marker = ':thread:';
  const markerIndex = remoteChatId.indexOf(marker);
  if (markerIndex < 0) {
    return {};
  }

  return {
    parentChatId: remoteChatId.slice(0, markerIndex),
    threadId: remoteChatId.slice(markerIndex + marker.length) || undefined,
  };
}

type AudienceKind = 'Direct user' | 'Direct chat' | 'Group' | 'Channel' | 'Topic' | 'Thread' | 'Chat';

function looksLikeTechnicalIdentifier(value?: string): boolean {
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

function toReadableIdentifier(value?: string): string | undefined {
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

function isDirectChatType(remoteChatType?: string): boolean {
  const normalizedChatType = remoteChatType?.toLowerCase();
  return (
    normalizedChatType === 'direct' ||
    normalizedChatType === 'dm' ||
    normalizedChatType === 'private' ||
    normalizedChatType === 'p2p'
  );
}

function isChildRemoteObject(identity: IRemoteIdentity): boolean {
  return (
    identity.remoteChatType === 'topic' ||
    identity.remoteChatType === 'thread' ||
    identity.peerScope === 'thread' ||
    Boolean(identity.threadId)
  );
}

function inferAudienceKind(params: {
  scopeType: IChannelAudienceEntry['scopeType'];
  remoteChatType?: string;
  peerScope?: IRemoteIdentity['peerScope'];
  key: string;
}): AudienceKind {
  if (params.scopeType === 'remote_user') {
    return 'Direct user';
  }

  const normalizedChatType = params.remoteChatType?.toLowerCase();
  const normalizedKey = params.key.toLowerCase();

  if (normalizedChatType === 'topic' || normalizedKey.includes('/topic/')) {
    return 'Topic';
  }
  if (
    normalizedChatType === 'thread' ||
    params.peerScope === 'thread' ||
    normalizedKey.includes('/thread/') ||
    normalizedKey.includes(':thread:')
  ) {
    return 'Thread';
  }
  if (normalizedChatType === 'channel' || normalizedKey.includes('/channel/')) {
    return 'Channel';
  }
  if (
    normalizedChatType === 'group' ||
    normalizedChatType === 'supergroup' ||
    normalizedKey.startsWith('group:') ||
    normalizedKey.includes('/group/')
  ) {
    return 'Group';
  }
  if (
    isDirectChatType(normalizedChatType) ||
    normalizedKey.startsWith('user:') ||
    normalizedKey.includes('/user/') ||
    normalizedKey.includes('/friend/') ||
    normalizedKey.includes('/dm/') ||
    normalizedKey.includes('/p2p/')
  ) {
    return 'Direct chat';
  }

  return 'Chat';
}

function buildAudienceTitle(params: {
  kind: AudienceKind;
  displayName?: string;
  remoteUserId?: string;
  platformChatId?: string;
  remoteChatId: string;
  threadId?: string;
}): string {
  if (params.displayName && !looksLikeTechnicalIdentifier(params.displayName)) {
    return params.displayName;
  }

  const preferredId =
    params.threadId ||
    params.platformChatId ||
    params.remoteUserId ||
    toReadableIdentifier(params.remoteChatId) ||
    params.remoteChatId;

  if (!preferredId || looksLikeTechnicalIdentifier(preferredId)) {
    return params.kind;
  }

  return `${params.kind} ${preferredId}`;
}

function buildAudienceSubtitle(params: {
  kind: AudienceKind;
  remoteUserId?: string;
  remoteChatId?: string;
  platformChatId?: string;
  parentChatId?: string;
  threadId?: string;
}): string {
  const parts: string[] = [];

  if (params.remoteChatId) {
    parts.push(`peer ${params.remoteChatId}`);
  }

  if (params.remoteUserId && (!params.remoteChatId || params.kind === 'Direct user' || params.kind === 'Direct chat')) {
    parts.push(`user ${params.remoteUserId}`);
  }

  if (
    params.platformChatId &&
    params.platformChatId !== params.remoteChatId &&
    params.platformChatId !== params.threadId
  ) {
    parts.push(`transport ${params.platformChatId}`);
  }

  if (
    params.parentChatId &&
    params.parentChatId !== params.remoteChatId &&
    params.parentChatId !== params.platformChatId
  ) {
    parts.push(`parent ${params.parentChatId}`);
  }

  if (params.threadId && params.threadId !== params.platformChatId) {
    parts.push(`${params.kind === 'Topic' ? 'topic' : 'thread'} ${params.threadId}`);
  }

  return parts.length > 0 ? parts.join(' · ') : params.kind;
}

function getLarkRemoteDisplayName(identity: IRemoteIdentity): string | undefined {
  const candidate = identity.displayName?.trim();
  if (candidate && !looksLikeTechnicalIdentifier(candidate) && !candidate.startsWith('User ')) {
    return candidate;
  }

  if (isChildRemoteObject(identity)) {
    return undefined;
  }

  const userDisplayName =
    typeof identity.metadata?.userDisplayName === 'string' ? identity.metadata.userDisplayName.trim() : '';
  if (userDisplayName) {
    return userDisplayName;
  }

  const chatName = typeof identity.metadata?.chatName === 'string' ? identity.metadata.chatName.trim() : '';
  if (chatName) {
    return chatName;
  }

  return undefined;
}

function getLarkObjectSubtitle(identity: IRemoteIdentity): string | undefined {
  const subtitle = typeof identity.metadata?.objectSubtitle === 'string' ? identity.metadata.objectSubtitle.trim() : '';
  if (subtitle) {
    return subtitle;
  }

  const description =
    typeof identity.metadata?.chatDescription === 'string' ? identity.metadata.chatDescription.trim() : '';
  if (description) {
    return description;
  }

  return undefined;
}

function getMetadataText(metadata: IRemoteIdentity['metadata'], key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildPublishObjectCatalogMap(
  publishObjects: readonly IChannelPublishObjectCatalogEntry[]
): Map<string, IChannelPublishObjectCatalogEntry> {
  return new Map(publishObjects.map((publishObject) => [publishObject.id, publishObject] as const));
}

function resolvePublishObjectCatalogEntry(
  identity: IRemoteIdentity,
  connector: IConnectorInstance,
  publishObjectCatalog: Map<string, IChannelPublishObjectCatalogEntry>
): IChannelPublishObjectCatalogEntry | undefined {
  const publishObject = inferRemoteIdentityPublishObject(identity, connector.platform);
  const identityKey = getChannelPublishObjectCatalogEntryIdentity({
    id: '',
    channelAccountId: connector.id,
    nativeObjectType: publishObject.nativeObjectType,
    nativeObjectId: publishObject.nativeObjectId,
    parentNativeObjectId: publishObject.parentNativeObjectId,
    displayProfile: {
      title: '',
      source: 'manual',
      quality: 'fallback',
      resolvedAt: 0,
    },
    createdAt: 0,
    updatedAt: 0,
  });

  return publishObjectCatalog.get(identityKey);
}

function buildEphemeralPublishObjectCatalogEntry(
  identity: IRemoteIdentity,
  connector: IConnectorInstance
): IChannelPublishObjectCatalogEntry {
  const publishObject = inferRemoteIdentityPublishObject(identity, connector.platform);
  const descriptor = describeRemoteIdentityObject(identity, connector.platform);
  const title = publishObject.displayName ?? descriptor.title;
  const entry: IChannelPublishObjectCatalogEntry = {
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
        identity.metadata?.displaySource === 'official-pull' || identity.metadata?.displaySource === 'runtime-resolved'
          ? identity.metadata.displaySource
          : 'runtime-resolved',
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
  entry.id = getChannelPublishObjectCatalogEntryIdentity(entry);
  return entry;
}

function getFriendlyDisplayName(identity: IRemoteIdentity, connector?: IConnectorInstance): string | undefined {
  if (connector?.platform === 'lark') {
    return getLarkRemoteDisplayName(identity);
  }

  const candidate = identity.displayName?.trim();
  if (candidate && !looksLikeTechnicalIdentifier(candidate)) {
    return candidate;
  }

  return getMetadataText(identity.metadata, 'userDisplayName') ?? getMetadataText(identity.metadata, 'chatName');
}

function getFriendlySubtitle(identity: IRemoteIdentity, connector?: IConnectorInstance): string | undefined {
  if (connector?.platform === 'lark') {
    return getLarkObjectSubtitle(identity);
  }

  return getMetadataText(identity.metadata, 'objectSubtitle') ?? getMetadataText(identity.metadata, 'chatDescription');
}

function buildRemoteChatAudience(
  identity: IRemoteIdentity,
  connectorMap: Map<string, IConnectorInstance>,
  publishObjectCatalog: Map<string, IChannelPublishObjectCatalogEntry>
): IChannelAudienceEntry {
  const threadParts = toThreadParts(identity.remoteChatId);
  const parentChatId = identity.parentChatId ?? threadParts.parentChatId;
  const threadId = identity.threadId ?? threadParts.threadId;
  const peerScope = identity.peerScope ?? (threadId ? 'thread' : 'chat');
  const chatType = identity.remoteChatType ?? (peerScope === 'thread' ? 'thread' : undefined);
  const connector = connectorMap.get(getChannelAccountId(identity) ?? identity.connectorId);
  const kind =
    connector?.platform === 'lark' && (chatType === 'topic' || chatType === 'thread' || peerScope === 'thread')
      ? 'Topic'
      : inferAudienceKind({
          scopeType: 'remote_chat',
          remoteChatType: chatType,
          peerScope,
          key: identity.remoteChatId,
        });
  const friendlyDisplayName = getFriendlyDisplayName(identity, connector);
  const friendlySubtitle = getFriendlySubtitle(identity, connector);
  const title = buildAudienceTitle({
    kind,
    displayName: friendlyDisplayName,
    remoteUserId: identity.remoteUserId,
    platformChatId: identity.platformChatId,
    remoteChatId: identity.remoteChatId,
    threadId,
  });
  const subtitle =
    connector?.platform === 'lark'
      ? friendlySubtitle
      : (friendlySubtitle ??
        buildAudienceSubtitle({
          kind,
          remoteUserId: identity.remoteUserId,
          remoteChatId: identity.remoteChatId,
          platformChatId: identity.platformChatId,
          parentChatId,
          threadId,
        }));
  const objectDescriptor = connector
    ? describeRemoteIdentityObject(
        {
          ...identity,
          parentChatId,
          threadId,
          peerScope,
          remoteChatType: chatType,
        },
        connector.platform
      )
    : undefined;
  const resolvedPublishObject = connector
    ? resolvePublishObjectCatalogEntry(identity, connector, publishObjectCatalog)
    : undefined;

  return {
    key: identity.remoteChatId,
    connectorId: identity.connectorId,
    channelAccountId: getChannelAccountId(identity),
    scopeType: 'remote_chat',
    remoteIdentityId: identity.id,
    remoteUserId: identity.remoteUserId,
    remoteChatId: identity.remoteChatId,
    platformChatId: identity.platformChatId,
    remoteChatType: chatType,
    peerScope,
    parentChatId,
    threadId,
    displayName: friendlyDisplayName ?? identity.displayName,
    objectKey: objectDescriptor?.key,
    objectKind: objectDescriptor?.kind,
    objectTitle: resolvedPublishObject?.displayProfile.title ?? objectDescriptor?.title,
    objectSubtitle: resolvedPublishObject?.displayProfile.subtitle ?? objectDescriptor?.subtitle,
    parentObjectKey: objectDescriptor?.parentKey,
    parentObjectTitle: resolvedPublishObject?.displayProfile.parentTitle ?? objectDescriptor?.parentTitle,
    parentObjectKind: objectDescriptor?.parentKind,
    publishObjectCatalogEntryId: resolvedPublishObject?.id,
    objectSource: resolvedPublishObject?.displayProfile.source,
    objectQuality: resolvedPublishObject?.displayProfile.quality,
    objectRefreshState: resolvedPublishObject?.refreshState,
    title: resolvedPublishObject?.displayProfile.title ?? title,
    subtitle: resolvedPublishObject?.displayProfile.subtitle ?? subtitle,
    lastActive: identity.lastActive,
  };
}

function buildRemoteUserAudiences(
  identities: IRemoteIdentity[],
  connectorMap: Map<string, IConnectorInstance>,
  publishObjectCatalog: Map<string, IChannelPublishObjectCatalogEntry>
): IChannelAudienceEntry[] {
  const uniqueByUser = new Map<string, IRemoteIdentity>();

  for (const identity of identities) {
    if (!identity.remoteUserId) {
      continue;
    }
    if (
      identity.remoteChatType === 'group' ||
      identity.remoteChatType === 'thread' ||
      identity.remoteChatType === 'topic'
    ) {
      continue;
    }

    const current = uniqueByUser.get(identity.remoteUserId);
    if (!current || (identity.lastActive ?? 0) > (current.lastActive ?? 0)) {
      uniqueByUser.set(identity.remoteUserId, identity);
    }
  }

  return Array.from(uniqueByUser.values()).map((identity) => {
    const kind = inferAudienceKind({
      scopeType: 'remote_user',
      remoteChatType: identity.remoteChatType,
      peerScope: identity.peerScope,
      key: identity.remoteUserId!,
    });

    const connector = connectorMap.get(getChannelAccountId(identity) ?? identity.connectorId);
    const friendlyDisplayName = getFriendlyDisplayName(identity, connector);
    const friendlySubtitle = getFriendlySubtitle(identity, connector);
    const objectDescriptor = connector ? describeRemoteIdentityObject(identity, connector.platform) : undefined;
    const resolvedPublishObject = connector
      ? resolvePublishObjectCatalogEntry(identity, connector, publishObjectCatalog)
      : undefined;

    return {
      key: identity.remoteUserId!,
      connectorId: identity.connectorId,
      channelAccountId: getChannelAccountId(identity),
      scopeType: 'remote_user',
      remoteIdentityId: identity.id,
      remoteUserId: identity.remoteUserId,
      remoteChatId: identity.remoteChatId,
      platformChatId: identity.platformChatId,
      remoteChatType: identity.remoteChatType,
      peerScope: identity.peerScope,
      displayName: friendlyDisplayName ?? identity.displayName,
      objectKey: objectDescriptor?.key,
      objectKind: objectDescriptor?.kind,
      objectTitle: resolvedPublishObject?.displayProfile.title ?? objectDescriptor?.title,
      objectSubtitle: resolvedPublishObject?.displayProfile.subtitle ?? objectDescriptor?.subtitle,
      parentObjectKey: objectDescriptor?.parentKey,
      parentObjectTitle: resolvedPublishObject?.displayProfile.parentTitle ?? objectDescriptor?.parentTitle,
      parentObjectKind: objectDescriptor?.parentKind,
      publishObjectCatalogEntryId: resolvedPublishObject?.id,
      objectSource: resolvedPublishObject?.displayProfile.source,
      objectQuality: resolvedPublishObject?.displayProfile.quality,
      objectRefreshState: resolvedPublishObject?.refreshState,
      title:
        resolvedPublishObject?.displayProfile.title ??
        buildAudienceTitle({
          kind,
          displayName: friendlyDisplayName,
          remoteUserId: identity.remoteUserId,
          platformChatId: identity.platformChatId,
          remoteChatId: identity.remoteChatId || identity.remoteUserId!,
        }),
      subtitle:
        resolvedPublishObject?.displayProfile.subtitle ??
        (connector?.platform === 'lark'
          ? friendlySubtitle
          : (friendlySubtitle ??
            buildAudienceSubtitle({
              kind,
              remoteUserId: identity.remoteUserId,
              remoteChatId: identity.remoteChatId,
              platformChatId: identity.platformChatId,
            }))),
      lastActive: identity.lastActive,
    };
  });
}

function buildAudienceEntries(
  remoteIdentities: IRemoteIdentity[],
  connectors: IConnectorInstance[],
  publishObjects: readonly IChannelPublishObjectCatalogEntry[]
): IChannelAudienceEntry[] {
  const connectorMap = new Map(connectors.map((connector) => [connector.id, connector] as const));
  const publishObjectCatalog = buildPublishObjectCatalogMap(publishObjects);
  const remoteChatAudiences = remoteIdentities.map((identity) =>
    buildRemoteChatAudience(identity, connectorMap, publishObjectCatalog)
  );
  const remoteUserAudiences = buildRemoteUserAudiences(remoteIdentities, connectorMap, publishObjectCatalog);
  const remoteUserAudienceKeys = new Set(
    remoteUserAudiences
      .filter((audience) => audience.remoteUserId)
      .map((audience) => `${getChannelAccountId(audience)}::${audience.remoteUserId}`)
  );
  const visibleRemoteChatAudiences = remoteChatAudiences.filter((audience) => {
    if (!audience.remoteUserId) {
      return true;
    }

    const audienceOwnerKey = `${getChannelAccountId(audience)}::${audience.remoteUserId}`;
    const connector = connectorMap.get(getChannelAccountId(audience) ?? '');
    if (connector?.platform === 'weixin' || isDirectChatType(audience.remoteChatType)) {
      return !remoteUserAudienceKeys.has(audienceOwnerKey);
    }

    const kind = inferAudienceKind({
      scopeType: 'remote_chat',
      remoteChatType: audience.remoteChatType,
      peerScope: audience.peerScope,
      key: audience.key,
    });
    if (kind !== 'Direct chat') {
      return true;
    }

    return !remoteUserAudienceKeys.has(audienceOwnerKey);
  });

  return [...remoteUserAudiences, ...visibleRemoteChatAudiences].toSorted(
    (left, right) => (right.lastActive ?? 0) - (left.lastActive ?? 0)
  );
}

function buildActiveSessionEntries(params: {
  sessions: IChannelSession[];
  remoteIdentities: IRemoteIdentity[];
  connectors: IConnectorInstance[];
  bindings: IChannelBinding[];
  publishObjects: IChannelPublishObjectCatalogEntry[];
  externalSessions: IExternalSession[];
  controlLeases: import('@process/channels/types').IChannelControlLease[];
}): IChannelActiveSessionEntry[] {
  const remoteIdentityMap = new Map(params.remoteIdentities.map((identity) => [identity.id, identity] as const));
  const connectorMap = new Map(params.connectors.map((connector) => [connector.id, connector] as const));
  const bindingMap = new Map(params.bindings.map((binding) => [binding.id, binding] as const));
  const externalSessionMap = new Map(params.externalSessions.map((session) => [session.id, session] as const));
  const controlLeaseMap = new Map(params.controlLeases.map((lease) => [lease.externalSessionId, lease] as const));
  const publishObjectCatalog = buildPublishObjectCatalogMap(params.publishObjects);

  return params.sessions.map((session) => {
    const remoteIdentity = remoteIdentityMap.get(session.userId);
    const connector = remoteIdentity
      ? connectorMap.get(getChannelAccountId(remoteIdentity) ?? remoteIdentity.connectorId)
      : undefined;
    const externalSession = externalSessionMap.get(session.id);
    const binding = externalSession?.bindingId ? bindingMap.get(externalSession.bindingId) : undefined;
    const controlLease = controlLeaseMap.get(session.id);
    const publicationBindingId = binding?.id ?? externalSession?.bindingId;
    const activeConversationId = externalSession?.activeConversationId ?? session.conversationId;
    const friendlyAudienceTitle =
      remoteIdentity && connector ? getFriendlyDisplayName(remoteIdentity, connector) : undefined;
    const objectDescriptor =
      remoteIdentity && connector ? describeRemoteIdentityObject(remoteIdentity, connector.platform) : undefined;
    const resolvedPublishObject =
      remoteIdentity && connector
        ? resolvePublishObjectCatalogEntry(remoteIdentity, connector, publishObjectCatalog)
        : undefined;
    const effectivePublishObject =
      resolvedPublishObject ||
      (remoteIdentity && connector ? buildEphemeralPublishObjectCatalogEntry(remoteIdentity, connector) : undefined);

    return {
      id: session.id,
      externalSessionId: externalSession?.id ?? session.id,
      connectorId: connector?.id,
      channelAccountId: connector?.id,
      connectorName: connector?.name,
      channelAccountName: connector?.name,
      connectorPlatform: connector?.platform,
      channelAccountPlatform: connector?.platform,
      remoteIdentityId: remoteIdentity?.id,
      audienceTitle:
        resolvedPublishObject?.displayProfile.title ||
        friendlyAudienceTitle ||
        objectDescriptor?.title ||
        remoteIdentity?.displayName ||
        remoteIdentity?.remoteChatId ||
        session.chatId ||
        session.id,
      audienceKey: remoteIdentity?.remoteChatId || session.chatId,
      objectKey: objectDescriptor?.key,
      objectKind: objectDescriptor?.kind,
      objectTitle: effectivePublishObject?.displayProfile.title ?? objectDescriptor?.title,
      objectSubtitle: effectivePublishObject?.displayProfile.subtitle ?? objectDescriptor?.subtitle,
      parentObjectKey: objectDescriptor?.parentKey,
      parentObjectTitle: effectivePublishObject?.displayProfile.parentTitle ?? objectDescriptor?.parentTitle,
      parentObjectKind: objectDescriptor?.parentKind,
      publishObjectCatalogEntryId: effectivePublishObject?.id,
      objectSource: effectivePublishObject?.displayProfile.source,
      objectQuality: effectivePublishObject?.displayProfile.quality,
      objectRefreshState: effectivePublishObject?.refreshState,
      activeConversationId,
      conversationId: activeConversationId,
      workspace: session.workspace,
      agentType: session.agentType,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      publicationBindingId,
      bindingId: publicationBindingId,
      bindingTemporary: binding?.temporary,
      bindingSource: binding ? getChannelBindingSource(binding) : undefined,
      bindingSystemFallback: binding ? isSystemFallbackBinding(binding) : undefined,
      ownerKey: controlLease?.ownerKey,
      controlMode: controlLease?.controlMode,
      continuationMode: controlLease?.continuationMode,
      continuationSourceExternalSessionId: controlLease?.sourceExternalSessionId,
      continuationSourceConversationId: controlLease?.sourceConversationId,
      leaseUpdatedAt: controlLease?.updatedAt,
      leaseReleasedAt: controlLease?.releasedAt,
    };
  });
}

function attachPublishObjectActiveSessionPointers(params: {
  publishObjects: IChannelPublishObjectCatalogEntry[];
  bindings: IChannelBinding[];
  audiences: IChannelAudienceEntry[];
  activeSessions: IChannelActiveSessionEntry[];
}): IChannelPublishObjectCatalogEntry[] {
  const bindingMap = new Map(params.bindings.map((binding) => [binding.id, binding] as const));
  const audiencesByKey = new Map(params.audiences.map((audience) => [audience.key, audience] as const));
  const pointerByPublishObjectId = new Map<string, IChannelPublishObjectActiveSessionPointer>();

  for (const session of params.activeSessions) {
    const bindingId = session.publicationBindingId ?? session.bindingId;
    if (!bindingId) {
      continue;
    }

    const binding = bindingMap.get(bindingId);
    if (!binding) {
      continue;
    }

    const audience = binding.scopeKey ? audiencesByKey.get(binding.scopeKey) : undefined;
    const publishObjectId =
      session.publishObjectCatalogEntryId ??
      resolveCatalogPublishObjectEntry({
        binding,
        publishObjects: params.publishObjects,
        audience,
      })?.id;
    if (!publishObjectId) {
      continue;
    }

    const nextPointer: IChannelPublishObjectActiveSessionPointer = {
      externalSessionId: session.externalSessionId ?? session.id,
      activeConversationId: session.activeConversationId ?? session.conversationId,
      publicationBindingId: bindingId,
      workspace: session.workspace,
      agentType: session.agentType,
      lastActivity: session.lastActivity,
    };
    const currentPointer = pointerByPublishObjectId.get(publishObjectId);
    if (!currentPointer || nextPointer.lastActivity > currentPointer.lastActivity) {
      pointerByPublishObjectId.set(publishObjectId, nextPointer);
    }
  }

  return params.publishObjects.map((publishObject) => ({
    ...publishObject,
    activeSessionPointer: pointerByPublishObjectId.get(publishObject.id),
  }));
}

<<<<<<< HEAD
function buildPublicationEntries(params: {
  connectors: IConnectorInstance[];
  bindings: IChannelBinding[];
  audiences: IChannelAudienceEntry[];
  publishObjects: IChannelPublishObjectCatalogEntry[];
  activeSessions: IChannelActiveSessionEntry[];
}): IChannelPublicationEntry[] {
  const connectorMap = new Map(params.connectors.map((connector) => [connector.id, connector] as const));
  const audienceMap = new Map(params.audiences.map((audience) => [audience.key, audience] as const));
  const sessionsByBindingId = new Map<string, IChannelActiveSessionEntry[]>();

  for (const session of params.activeSessions) {
    const bindingId = session.publicationBindingId ?? session.bindingId;
    if (!bindingId) {
      continue;
    }

    const currentSessions = sessionsByBindingId.get(bindingId) ?? [];
    currentSessions.push(session);
    sessionsByBindingId.set(bindingId, currentSessions);
  }

  return params.bindings
    .filter((binding) => binding.scopeType !== 'connector_default')
    .flatMap((binding) => {
      const channelAccountId = getChannelAccountId(binding);
      if (!channelAccountId) {
        return [];
      }

      const audience = binding.scopeKey ? audienceMap.get(binding.scopeKey) : undefined;
      const publishObject = resolveCatalogPublishObjectEntry({
        binding,
        audience,
        publishObjects: params.publishObjects,
      });
      if (!publishObject) {
        return [];
      }

      const connector = connectorMap.get(channelAccountId);
      const currentSession = (sessionsByBindingId.get(binding.id) ?? []).toSorted(
        (left, right) => right.lastActivity - left.lastActivity
      )[0];

      return [
        {
          id: binding.id,
          agentProfileId: binding.agentProfileId,
          channelAccountId,
          channelAccountName: connector?.name,
          channelAccountPlatform: connector?.platform,
          publishObject,
          binding,
          currentSession,
          enabled: binding.enabled,
          createdAt: binding.createdAt,
          updatedAt: binding.updatedAt,
        },
      ];
    })
    .toSorted((left, right) => {
      const sessionDelta = (right.currentSession?.lastActivity ?? 0) - (left.currentSession?.lastActivity ?? 0);
      if (sessionDelta !== 0) {
        return sessionDelta;
      }

      return right.updatedAt - left.updatedAt;
    });
}

function buildPublicationDiscoverySummaries(params: {
  connectors: IConnectorInstance[];
  audiences: IChannelAudienceEntry[];
}): IChannelPublicationDiscoverySummary[] {
  return params.connectors.map((connector) => {
    const connectorAudiences = params.audiences.filter((audience) => {
      if (getChannelAccountId(audience) !== connector.id) {
        return false;
      }

      return audience.scopeType === 'remote_chat' || audience.scopeType === 'remote_user';
    });

    if (connectorAudiences.length === 0) {
      return {
        channelAccountId: connector.id,
        state: 'empty',
        discoveredCount: 0,
      };
    }

    const hasOfficialDiscovery = connectorAudiences.some(
      (audience) => audience.objectSource === 'official-pull' || audience.objectSource === 'runtime-resolved'
    );

    return {
      channelAccountId: connector.id,
      state: hasOfficialDiscovery ? 'official' : 'learned',
      discoveredCount: connectorAudiences.length,
    };
  });
}

function buildPublicationCapabilitySummaries(params: {
  connectors: IConnectorInstance[];
}): IChannelPublicationCapabilitySummary[] {
  return params.connectors.flatMap((connector) => {
    if (!isBuiltinChannelType(connector.platform)) {
      return [];
    }

    const builtinChannel = getBuiltinChannel(connector.platform);
    if (!builtinChannel) {
      return [];
    }

    return [
      {
        channelAccountId: connector.id,
        integrationModel: builtinChannel.integrationModel,
        discoveryMode: builtinChannel.discoveryMode,
        actionSurfaces: [...builtinChannel.actionSurfaces],
      },
    ];
  });
}

function normalizePublicationScopeKey(
  scopeType: IChannelPublicationUpsertInput['scopeType'],
  scopeKey: string
): string | undefined {
  if (scopeType === 'connector_default') {
    return undefined;
  }

  const normalizedScopeKey = scopeKey.trim();
  return normalizedScopeKey || undefined;
}

function buildPublicationBindingId(
  channelAccountId: string,
  scopeType: IChannelPublicationUpsertInput['scopeType'],
  scopeKey: string
): string {
  const normalizedScopeKey = normalizePublicationScopeKey(scopeType, scopeKey) ?? 'default';
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `binding_manual_${channelAccountId}_${scopeType}_${normalizedScopeKey}_${randomSuffix}`;
}

function buildBindingFromPublicationInput(params: {
  publication: IChannelPublicationUpsertInput;
  existingBinding?: IChannelBinding;
}): IChannelBinding {
  const now = Date.now();
  const existingMetadata =
    params.existingBinding?.metadata && typeof params.existingBinding.metadata === 'object'
      ? params.existingBinding.metadata
      : {};

  return {
    id:
      params.existingBinding?.id ??
      params.publication.publicationId ??
      buildPublicationBindingId(
        params.publication.channelAccountId,
        params.publication.scopeType,
        params.publication.scopeKey
      ),
    connectorId: params.publication.channelAccountId,
    channelAccountId: params.publication.channelAccountId,
    scopeType: params.publication.scopeType,
    scopeKey: normalizePublicationScopeKey(params.publication.scopeType, params.publication.scopeKey),
    agentProfileId: params.publication.agentProfileId,
    priority: params.publication.priority,
    enabled: params.existingBinding?.enabled ?? true,
    temporary: false,
    fallbackAgentProfileId: params.existingBinding?.fallbackAgentProfileId,
    metadata: {
      ...existingMetadata,
      source: 'settings-publication-panel',
      operation: 'durable-publication',
      ...(params.publication.publishObject ? { publishObject: params.publication.publishObject } : {}),
    },
    createdAt: params.existingBinding?.createdAt ?? now,
    updatedAt: now,
  };
}

function buildCatalogCapabilityRegistry(connectors: readonly IConnectorInstance[]): IChannelBindingCatalog['capabilityRegistry'] {
  return buildChannelCapabilityRegistry({
    platforms: connectors.map((connector) => connector.platform),
    includeBuiltinPlatforms: true,
  });
}

function buildPluginStatusNativeCapabilities(platform: PluginType): IChannelPluginStatus['nativeAgentCapabilities'] {
  return getChannelNativeAgentSurfaceCapabilities(platform);
}

/**
 * Initialize Channel IPC Bridge
 * Handles communication between renderer (Settings UI) and main process (Channel system)
 */
export function initChannelBridge(channelRepo: IChannelRepository): void {
  console.log('[ChannelBridge] Initializing...');
  const projectChannelPublicationService = new ProjectChannelPublicationService();

  const resolvePublicationPublishObjects = async (params: {
    publicationCatalog: import('@process/channels/core/ProjectChannelPublicationService').ProjectChannelPublicationCatalog;
    remoteIdentities: IRemoteIdentity[];
    connectors: IConnectorInstance[];
  }): Promise<IChannelPublishObjectCatalogEntry[]> => {
    if (params.publicationCatalog.workspaces.length === 0) {
      return [];
    }

    const manager = getChannelManager();
    const pluginManager = manager.getPluginManager?.();

    await Promise.all(
      params.publicationCatalog.workspaces.map((workspace) =>
        projectChannelPublicationService.resolvePublishObjectCatalog(workspace, {
          bindings: params.publicationCatalog.bindings.filter(
            (binding) => params.publicationCatalog.bindingWorkspaceById[binding.id] === workspace
          ),
          remoteIdentities: params.remoteIdentities,
          channelAccounts: params.connectors,
          resolveDiscoveryProvider: pluginManager
            ? (runtimeId) => pluginManager.getPlugin(runtimeId)?.getPublishObjectDiscoveryProvider()
            : undefined,
        })
      )
    );

    const refreshedCatalog = await projectChannelPublicationService.readCatalogForWorkspaces(
      params.publicationCatalog.workspaces
    );
    return refreshedCatalog.publishObjects;
  };

  const buildPublicationCatalogRefreshResult = (params: {
    channelAccountId?: string;
    publicationCatalog: import('@process/channels/core/ProjectChannelPublicationService').ProjectChannelPublicationCatalog;
    allConnectors: IConnectorInstance[];
    enrichedRemoteIdentities: IRemoteIdentity[];
    sessions: IChannelSession[];
    publishObjects: IChannelPublishObjectCatalogEntry[];
    externalSessions: IExternalSession[];
    controlLeases: IChannelControlLease[];
  }): IChannelPublicationCatalogRefreshResult => {
    const activeSessions = buildActiveSessionEntries({
      sessions: params.sessions,
      connectors: params.allConnectors,
      remoteIdentities: params.enrichedRemoteIdentities,
      bindings: params.publicationCatalog.bindings,
      publishObjects: params.publishObjects,
      externalSessions: params.externalSessions,
      controlLeases: params.controlLeases,
    });
    const audiences = buildAudienceEntries(
      params.enrichedRemoteIdentities,
      params.allConnectors,
      params.publishObjects
    );
    const publishObjects = attachPublishObjectActiveSessionPointers({
      publishObjects: params.publishObjects,
      bindings: params.publicationCatalog.bindings,
      audiences,
      activeSessions,
    });
    const connectors = params.allConnectors.filter((connector) => (connector.configured ?? false) && connector.enabled);
    const discoverySummaries = buildPublicationDiscoverySummaries({
      connectors,
      audiences,
    });
    const capabilitySummaries = buildPublicationCapabilitySummaries({
      connectors,
    });
    const publications = buildPublicationEntries({
      connectors,
      bindings: params.publicationCatalog.bindings,
      audiences,
      publishObjects,
      activeSessions,
    });
    const bindings = params.channelAccountId
      ? params.publicationCatalog.bindings.filter((binding) => getChannelAccountId(binding) === params.channelAccountId)
      : params.publicationCatalog.bindings;

    return {
      bindingCatalog: {
        connectors,
        channelAccounts: connectors,
        capabilityRegistry: buildCatalogCapabilityRegistry(params.allConnectors),
        agentProfiles: params.publicationCatalog.agentProfiles,
        bindings: bindings.map((binding) => withChannelAccountId(binding)),
        audiences,
        discoverySummaries: params.channelAccountId
          ? discoverySummaries.filter((summary) => summary.channelAccountId === params.channelAccountId)
          : discoverySummaries,
        capabilitySummaries: params.channelAccountId
          ? capabilitySummaries.filter((summary) => summary.channelAccountId === params.channelAccountId)
          : capabilitySummaries,
        publishObjects,
        publications: params.channelAccountId
          ? publications.filter((publication) => publication.channelAccountId === params.channelAccountId)
          : publications,
      },
      activeSessions,
    };
  };

  const readPublicationSnapshot = async (params?: {
    channelAccountId?: string;
    refreshPublishObjects?: boolean;
  }): Promise<IChannelPublicationSnapshot> => {
    const channelAccountId = params?.channelAccountId;
    const db = await getDatabase();
    const [sessions, allConnectors, remoteIdentities, conversations] = await Promise.all([
      channelRepo.getChannelSessions(),
      channelRepo.getConnectorInstances(),
      channelRepo.getRemoteIdentities(channelAccountId),
      conversationServiceSingleton.listAllConversations(),
    ]);
    const publicationCatalog = await projectChannelPublicationService.readCatalogForConversations(conversations);
    const externalSessionsResult = db.getAllExternalSessions();
    const controlLeasesResult = db.getAllChannelControlLeases();
    if (!externalSessionsResult.success || !externalSessionsResult.data) {
      throw new Error(externalSessionsResult.error || 'Failed to load external sessions');
    }
    if (!controlLeasesResult.success || !controlLeasesResult.data) {
      throw new Error(controlLeasesResult.error || 'Failed to load channel control leases');
    }

    const identitiesWithAccountId = remoteIdentities.map((identity) => withChannelAccountId(identity));
    const manager = getChannelManager();
    const pluginManager = manager.getPluginManager?.();
    const enrichedRemoteIdentities = await enrichRemoteIdentitiesForPublishObjectDiscovery(
      identitiesWithAccountId,
      allConnectors,
      pluginManager ? (runtimeId) => pluginManager.getPlugin(runtimeId)?.getPublishObjectDiscoveryProvider() : undefined
    );
    const publishObjects =
      params?.refreshPublishObjects === true
        ? await resolvePublicationPublishObjects({
            publicationCatalog,
            remoteIdentities: enrichedRemoteIdentities,
            connectors: allConnectors,
          })
        : publicationCatalog.publishObjects;
    const connectors = allConnectors.filter((connector) => (connector.configured ?? false) && connector.enabled);
    const bindings = channelAccountId
      ? publicationCatalog.bindings.filter((binding) => getChannelAccountId(binding) === channelAccountId)
      : publicationCatalog.bindings;
    const activeSessions = buildActiveSessionEntries({
      sessions,
      connectors: allConnectors,
      remoteIdentities: enrichedRemoteIdentities,
      bindings: publicationCatalog.bindings,
      publishObjects,
      externalSessions: externalSessionsResult.data,
      controlLeases: controlLeasesResult.data,
    }).filter((session) => {
      if (!channelAccountId) {
        return true;
      }

      return getChannelAccountId(session) === channelAccountId || session.connectorId === channelAccountId;
    });
    const catalogPublishObjects = attachPublishObjectActiveSessionPointers({
      publishObjects,
      bindings: publicationCatalog.bindings,
      audiences: buildAudienceEntries(enrichedRemoteIdentities, allConnectors, publishObjects),
      activeSessions,
    });
    const catalogAudiences = buildAudienceEntries(enrichedRemoteIdentities, allConnectors, catalogPublishObjects);
    const discoverySummaries = buildPublicationDiscoverySummaries({
      connectors,
      audiences: catalogAudiences,
    });
    const capabilitySummaries = buildPublicationCapabilitySummaries({
      connectors,
    });
    const publications = buildPublicationEntries({
      connectors,
      bindings: publicationCatalog.bindings,
      audiences: catalogAudiences,
      publishObjects: catalogPublishObjects,
      activeSessions,
    });
    const catalog: IChannelBindingCatalog = {
      connectors,
      channelAccounts: connectors,
      capabilityRegistry: buildCatalogCapabilityRegistry(allConnectors),
      agentProfiles: publicationCatalog.agentProfiles,
      bindings: bindings.map((binding) => withChannelAccountId(binding)),
      audiences: catalogAudiences,
      discoverySummaries: channelAccountId
        ? discoverySummaries.filter((summary) => summary.channelAccountId === channelAccountId)
        : discoverySummaries,
      capabilitySummaries: channelAccountId
        ? capabilitySummaries.filter((summary) => summary.channelAccountId === channelAccountId)
        : capabilitySummaries,
      publishObjects: catalogPublishObjects,
      publications: channelAccountId
        ? publications.filter((publication) => publication.channelAccountId === channelAccountId)
        : publications,
    };

    return {
      catalog,
      activeSessions,
      refreshedAt: Date.now(),
    };
  };

  // ==================== Plugin Management ====================

  /**
   * Get status of all plugins (including extension plugin metadata)
   */
  channel.getPluginStatus.provider(async () => {
    try {
      let dbPlugins: import('@process/channels/types').IChannelPluginConfig[] = [];
      let connectors: IConnectorInstance[] = [];

      try {
        dbPlugins = await channelRepo.getChannelPlugins();
      } catch (dbError) {
        console.warn('[ChannelBridge] getChannelPlugins failed, proceeding with connector-only list:', dbError);
      }

      try {
        connectors = await channelRepo.getConnectorInstances();
      } catch (dbError) {
        console.warn('[ChannelBridge] getConnectorInstances failed, proceeding with plugin-only list:', dbError);
      }

      const registry = ExtensionRegistry.getInstance();
      const extensions = registry.getLoadedExtensions();
      const connectorMap = new Map(connectors.map((connector) => [connector.id, connector]));
      const connectorByRuntimeId = new Map(
        connectors
          .filter((connector) => Boolean(connector.legacyPluginId))
          .map((connector) => [connector.legacyPluginId!, connector] as const)
      );

      const resolveExtensionMeta = (pluginType: string): IChannelPluginStatus['extensionMeta'] | undefined => {
        try {
          const meta = registry.getChannelPluginMeta(pluginType);
          if (!meta || typeof meta !== 'object') return undefined;
          const m = meta as Record<string, unknown>;
          const extensionMeta: NonNullable<IChannelPluginStatus['extensionMeta']> = {
            credentialFields: Array.isArray(m.credentialFields) ? m.credentialFields : undefined,
            configFields: Array.isArray(m.configFields) ? m.configFields : undefined,
            description: typeof m.description === 'string' ? m.description : undefined,
          };

          const ext = extensions.find((e) =>
            e.manifest.contributes.channelPlugins?.some((cp) => cp.type === pluginType)
          );
          if (ext) {
            extensionMeta.extensionName = ext.manifest.displayName || ext.manifest.name;
            const iconField = typeof m.icon === 'string' ? m.icon : undefined;
            if (iconField) {
              if (
                iconField.startsWith('http://') ||
                iconField.startsWith('https://') ||
                iconField.startsWith('data:') ||
                iconField.startsWith('file://') ||
                iconField.startsWith('aion-asset://')
              ) {
                extensionMeta.icon = iconField;
              } else {
                const absPath = path.isAbsolute(iconField) ? iconField : path.resolve(ext.directory, iconField);
                extensionMeta.icon = toAssetUrl(absPath);
              }
            }
          }

          return extensionMeta;
        } catch {
          return undefined;
        }
      };

      const enabledExtChannelTypes = new Set<string>();
      for (const [pluginType] of registry.getChannelPlugins()) {
        enabledExtChannelTypes.add(pluginType);
      }

      const statusMap = new Map<string, IChannelPluginStatus>();

      for (const plugin of dbPlugins) {
        const connector = connectorMap.get(plugin.id) ?? connectorByRuntimeId.get(plugin.id);
        const pluginType = connector?.platform ?? plugin.type;
        const isExtension = !isBuiltinChannelType(pluginType);
        const configured =
          connector?.configured ?? hasPluginCredentials(pluginType, connector?.credentials ?? plugin.credentials);

        if (!isExtension && !connector) {
          continue;
        }

        if (isExtension && !enabledExtChannelTypes.has(pluginType)) {
          continue;
        }

        const statusId = connector?.id ?? plugin.id;

        statusMap.set(statusId, {
          id: statusId,
          runtimeId: plugin.id,
          type: pluginType,
          name: connector?.name || plugin.name,
          enabled: connector?.enabled ?? plugin.enabled,
          connected: plugin.status === 'running',
          status: plugin.status,
          lastConnected: plugin.lastConnected,
          activeUsers: 0,
          hasToken: configured,
          isExtension,
          nativeAgentCapabilities: buildPluginStatusNativeCapabilities(pluginType),
          extensionMeta: isExtension ? resolveExtensionMeta(pluginType) : undefined,
        });
      }

      for (const connector of connectors) {
        if (statusMap.has(connector.id)) {
          continue;
        }

        const isExtension = !isBuiltinChannelType(connector.platform);
        if (isExtension && !enabledExtChannelTypes.has(connector.platform)) {
          continue;
        }

        statusMap.set(connector.id, {
          id: connector.id,
          runtimeId: connector.legacyPluginId ?? connector.id,
          type: connector.platform,
          name: connector.name,
          enabled: connector.enabled,
          connected: false,
          status: connector.status,
          activeUsers: 0,
          hasToken: connector.configured ?? hasPluginCredentials(connector.platform, connector.credentials),
          isExtension,
          nativeAgentCapabilities: buildPluginStatusNativeCapabilities(connector.platform),
          extensionMeta: isExtension ? resolveExtensionMeta(connector.platform) : undefined,
        });
      }

      for (const [pluginType, entry] of registry.getChannelPlugins()) {
        const alreadyVisible = Array.from(statusMap.values()).some((status) => status.type === pluginType);
        if (alreadyVisible) continue;
        const extensionMeta = resolveExtensionMeta(pluginType);
        const meta = entry.meta as { name?: string } | undefined;
        statusMap.set(pluginType, {
          id: pluginType,
          runtimeId: pluginType,
          type: pluginType,
          name: meta?.name || pluginType,
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
          isExtension: true,
          nativeAgentCapabilities: buildPluginStatusNativeCapabilities(pluginType),
          extensionMeta,
        });
      }

      for (const builtinType of BUILTIN_CHANNEL_TYPES) {
        const alreadyVisible = Array.from(statusMap.values()).some((status) => status.type === builtinType);
        if (alreadyVisible) continue;
        const builtinChannel = getBuiltinChannel(builtinType);
        statusMap.set(builtinChannel?.pluginId || builtinType, {
          id: builtinChannel?.pluginId || builtinType,
          runtimeId: builtinChannel?.pluginId || builtinType,
          type: builtinType,
          name: builtinChannel?.displayName || builtinType,
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
          isExtension: false,
          nativeAgentCapabilities: buildPluginStatusNativeCapabilities(builtinType),
        });
      }

      return { success: true, data: Array.from(statusMap.values()) };
    } catch (error) {
      console.error('[ChannelBridge] getPluginStatus error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Enable a plugin
   */
  channel.enablePlugin.provider(async ({ pluginId, config }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.enablePlugin(pluginId, config);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] enablePlugin error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Disable a plugin
   */
  channel.disablePlugin.provider(async ({ pluginId }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.disablePlugin(pluginId);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] disablePlugin error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Test plugin connection (validate token)
   */
  channel.testPlugin.provider(async ({ pluginId, token, extraConfig }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.testPlugin(pluginId, token, extraConfig);
      return { success: true, data: result };
    } catch (error) {
      console.error('[ChannelBridge] testPlugin error:', error);
      return { success: false, data: { success: false, error: getErrorMessage(error) } };
    }
  });

  // ==================== Pairing Management ====================

  /**
   * Get pending pairing requests
   */
  channel.getPendingPairings.provider(async () => {
    try {
      const data = await channelRepo.getPendingPairingRequests();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getPendingPairings error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Approve a pairing request
   * Delegates to PairingService to avoid duplicate logic
   */
  channel.approvePairing.provider(async ({ code }) => {
    try {
      const pairingService = getPairingService();
      const result = await pairingService.approvePairing(code);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      console.log(`[ChannelBridge] Approved pairing for code ${code}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] approvePairing error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Reject a pairing request
   * Delegates to PairingService to avoid duplicate logic
   */
  channel.rejectPairing.provider(async ({ code }) => {
    try {
      const pairingService = getPairingService();
      const result = await pairingService.rejectPairing(code);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      console.log(`[ChannelBridge] Rejected pairing code ${code}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] rejectPairing error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.authorizeRemoteUser.provider(
    async ({ platformUserId, platformType, displayName, chatId, pluginId, metadata }) => {
      try {
        const pairingService = getPairingService();
        const result = await pairingService.authorizeRemoteUser({
          platformUserId,
          platformType,
          displayName,
          chatId,
          pluginId,
          metadata,
        });

        if (!result.success) {
          return { success: false, msg: result.error };
        }

        return { success: true };
      } catch (error) {
        console.error('[ChannelBridge] authorizeRemoteUser error:', error);
        return { success: false, msg: getErrorMessage(error) };
      }
    }
  );

  channel.startWeixinLogin.provider(async () => {
    try {
      const { BrowserWindow } = await import('electron');
      const { WeixinLoginHandler } = await import('@process/channels/plugins/weixin/WeixinLoginHandler');
      const getWindow = () => BrowserWindow.getAllWindows()[0] ?? null;
      const handler = new WeixinLoginHandler(getWindow);
      const mainWindow = getWindow();

      const result = await handler.startLogin({
        onQR: (payload) => {
          channel.weixinLoginQr.emit(payload);
          mainWindow?.webContents.send('weixin:login:qr', payload);
        },
        onScanned: () => {
          channel.weixinLoginScanned.emit({});
          mainWindow?.webContents.send('weixin:login:scanned');
        },
        onDone: (payload) => {
          mainWindow?.webContents.send('weixin:login:done', payload);
        },
      });

      return { success: true, data: result };
    } catch (error) {
      console.error('[ChannelBridge] startWeixinLogin error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  // ==================== User Management ====================

  /**
   * Get all authorized users
   */
  channel.getAuthorizedUsers.provider(async () => {
    try {
      const data = await channelRepo.getChannelUsers();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getAuthorizedUsers error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Get all authorized targets
   */
  channel.getAuthorizedTargets.provider(async () => {
    try {
      const data = await channelRepo.getChannelAuthorizedTargets();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getAuthorizedTargets error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Revoke user authorization
   */
  channel.revokeUser.provider(async ({ userId }) => {
    try {
      // Delete user (cascades to sessions)
      await channelRepo.deleteChannelUser(userId);
      console.log(`[ChannelBridge] Revoked user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] revokeUser error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  // ==================== Session Management ====================

  /**
   * Get active sessions
   */
  channel.getActiveSessions.provider(async () => {
    try {
      const data = await channelRepo.getChannelSessions();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getActiveSessions error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.getActiveSessionCatalog.provider(async () => {
    try {
      const snapshot = await readPublicationSnapshot({ refreshPublishObjects: false });
      return {
        success: true,
        data: snapshot.activeSessions,
      };
    } catch (error) {
      console.error('[ChannelBridge] getActiveSessionCatalog error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  const listChannelAccounts = async () => {
    return channelRepo.getConnectorInstances();
  };

  const createChannelAccount = async (params: { platform: IConnectorInstance['platform']; name: string }) => {
    const manager = getChannelManager();
    return manager.createChannelAccount(params);
  };

  const upsertChannelAccount = async (channelAccount: IConnectorInstance) => {
    await channelRepo.upsertConnectorInstance({
      ...channelAccount,
      legacyPluginId: channelAccount.legacyPluginId ?? channelAccount.id,
    });
  };

  const deleteChannelAccount = async (channelAccountId: string) => {
    const manager = getChannelManager();
    const db = await getDatabase();
    const channelAccount = (await channelRepo.getConnectorInstances()).find((item) => item.id === channelAccountId);
    const runtimeId = channelAccount?.legacyPluginId ?? channelAccountId;

    const disableResult = await manager.disablePlugin(runtimeId);
    if (!disableResult.success) {
      console.warn('[ChannelBridge] deleteChannelAccount disablePlugin warning:', disableResult.error);
    }

    const deletionResult = db.runInTransaction(() => {
      const remoteIdentitiesResult = db.getRemoteIdentities(channelAccountId);
      if (!remoteIdentitiesResult.success) {
        throw new Error(remoteIdentitiesResult.error || `Failed to load remote identities for ${channelAccountId}`);
      }

      for (const remoteIdentity of remoteIdentitiesResult.data ?? []) {
        const deleteUserResult = db.deleteChannelUser(remoteIdentity.id);
        if (!deleteUserResult.success) {
          throw new Error(deleteUserResult.error || `Failed to delete authorized user ${remoteIdentity.id}`);
        }
      }

      const deletePluginResult = db.deleteChannelPlugin(runtimeId);
      if (!deletePluginResult.success) {
        throw new Error(deletePluginResult.error || `Failed to delete channel plugin ${runtimeId}`);
      }

      const deleteConnectorResult = db.deleteConnectorInstance(channelAccountId);
      if (!deleteConnectorResult.success) {
        throw new Error(deleteConnectorResult.error || `Failed to delete channel account ${channelAccountId}`);
      }
    });

    if (!deletionResult.success) {
      throw new Error(deletionResult.error || `Failed to delete channel account ${channelAccountId}`);
    }
  };

  channel.getChannelAccounts.provider(async () => {
    try {
      const data = await listChannelAccounts();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getChannelAccounts error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.getConnectorInstances.provider(async () => {
    try {
      const data = await listChannelAccounts();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getConnectorInstances error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.createChannelAccount.provider(async ({ platform, name }) => {
    try {
      const result = await createChannelAccount({ platform, name });
      if (!result.success) {
        return { success: false, msg: result.error };
      }
      return { success: true, data: result.data };
    } catch (error) {
      console.error('[ChannelBridge] createChannelAccount error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.upsertChannelAccount.provider(async ({ channelAccount }) => {
    try {
      await upsertChannelAccount(channelAccount);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] upsertChannelAccount error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.upsertConnectorInstance.provider(async ({ connector }) => {
    try {
      await upsertChannelAccount(connector);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] upsertConnectorInstance error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.deleteChannelAccount.provider(async ({ channelAccountId }) => {
    try {
      await deleteChannelAccount(channelAccountId);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] deleteChannelAccount error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.deleteConnectorInstance.provider(async ({ connectorId }) => {
    try {
      await deleteChannelAccount(connectorId);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] deleteConnectorInstance error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Get binding catalog for publication management.
   */
  channel.getBindingCatalog.provider(async (params?: { channelAccountId?: string; connectorId?: string }) => {
    try {
      const channelAccountId = params?.channelAccountId ?? params?.connectorId;
      const snapshot = await readPublicationSnapshot({
        channelAccountId,
        refreshPublishObjects: false,
      });
      return {
        success: true,
        data: snapshot.catalog,
      };
    } catch (error) {
      console.error('[ChannelBridge] getBindingCatalog error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.refreshPublicationCatalog.provider(async (params?: { channelAccountId?: string; connectorId?: string }) => {
    try {
      const channelAccountId = params?.channelAccountId ?? params?.connectorId;
      const db = await getDatabase();
      const [allConnectors, remoteIdentities, conversations, sessions] = await Promise.all([
        listChannelAccounts(),
        channelRepo.getRemoteIdentities(channelAccountId),
        conversationServiceSingleton.listAllConversations(),
        channelRepo.getChannelSessions(),
      ]);
      const publicationCatalog = await projectChannelPublicationService.readCatalogForConversations(conversations);
      const externalSessionsResult = db.getAllExternalSessions();
      const controlLeasesResult = db.getAllChannelControlLeases();
      if (!externalSessionsResult.success || !externalSessionsResult.data) {
        throw new Error(externalSessionsResult.error || 'Failed to load external sessions');
      }
      if (!controlLeasesResult.success || !controlLeasesResult.data) {
        throw new Error(controlLeasesResult.error || 'Failed to load channel control leases');
      }

      const identitiesWithAccountId = remoteIdentities.map((identity) => withChannelAccountId(identity));
      const manager = getChannelManager();
      const pluginManager = manager.getPluginManager?.();
      const enrichedRemoteIdentities = await enrichRemoteIdentitiesForPublishObjectDiscovery(
        identitiesWithAccountId,
        allConnectors,
        pluginManager
          ? (runtimeId) => pluginManager.getPlugin(runtimeId)?.getPublishObjectDiscoveryProvider()
          : undefined
      );
      const refreshedPublicationCatalog = await projectChannelPublicationService.refreshCatalog({
        publicationCatalog,
        remoteIdentities: enrichedRemoteIdentities,
        channelAccounts: allConnectors,
      });

      return {
        success: true,
        data: buildPublicationCatalogRefreshResult({
          channelAccountId,
          publicationCatalog: refreshedPublicationCatalog,
          allConnectors,
          enrichedRemoteIdentities,
          sessions,
          publishObjects: refreshedPublicationCatalog.publishObjects,
          externalSessions: externalSessionsResult.data,
          controlLeases: controlLeasesResult.data,
        }),
      };
    } catch (error) {
      console.error('[ChannelBridge] refreshPublicationCatalog error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.refreshPublicationSnapshot.provider(async (params?: { channelAccountId?: string; connectorId?: string }) => {
    try {
      const snapshot = await readPublicationSnapshot({
        channelAccountId: params?.channelAccountId ?? params?.connectorId,
        refreshPublishObjects: true,
      });
      return { success: true, data: snapshot };
    } catch (error) {
      console.error('[ChannelBridge] refreshPublicationSnapshot error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Get channel bindings
   */
  channel.getBindings.provider(async (params?: { channelAccountId?: string; connectorId?: string }) => {
    try {
      const channelAccountId = params?.channelAccountId ?? params?.connectorId;
      const conversations = await conversationServiceSingleton.listAllConversations();
      const publicationCatalog = await projectChannelPublicationService.readCatalogForConversations(conversations);
      const data = channelAccountId
        ? publicationCatalog.bindings.filter((binding) => getChannelAccountId(binding) === channelAccountId)
        : publicationCatalog.bindings;
      return { success: true, data: data.map((binding) => withChannelAccountId(binding)) };
    } catch (error) {
      console.error('[ChannelBridge] getBindings error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  const upsertPublication = async ({ publication }: { publication: IChannelPublicationUpsertInput }) => {
    try {
      const conversations = await conversationServiceSingleton.listAllConversations();
      const publicationCatalog = await projectChannelPublicationService.readCatalogForConversations(conversations);
      const existingBinding = publication.publicationId
        ? publicationCatalog.bindings.find((binding) => binding.id === publication.publicationId)
        : undefined;
      const normalizedBinding = withChannelBindingPublishObject(
        withChannelAccountId(
          buildBindingFromPublicationInput({
            publication,
            existingBinding,
          })
        )
      );
      const normalizedChannelAccountId = getChannelAccountId(normalizedBinding);
      if (!normalizedChannelAccountId) {
        throw new Error('Channel account is required before saving a durable IM binding');
      }

      const workspace = publicationCatalog.agentProfileWorkspaceById[normalizedBinding.agentProfileId];
      if (!workspace) {
        throw new Error(`Agent profile ${normalizedBinding.agentProfileId} is not bound to a project workspace`);
      }

      const conflictingBinding = findConflictingChannelBinding(
        publicationCatalog.bindings.filter((item) => getChannelAccountId(item) === normalizedChannelAccountId),
        normalizedBinding
      );
      if (conflictingBinding && conflictingBinding.agentProfileId !== normalizedBinding.agentProfileId) {
        const conflictingAgentName =
          publicationCatalog.agentProfiles.find((profile) => profile.id === conflictingBinding.agentProfileId)?.name ??
          conflictingBinding.agentProfileId;
        throw new Error(
          `Publish object "${getChannelBindingPublishObjectLabel(normalizedBinding)}" is already bound to Agent "${conflictingAgentName}". Unpublish or rebind it first.`
        );
      }

      await projectChannelPublicationService.upsertChannelBinding(workspace, normalizedBinding);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] upsertPublication error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  };

  const deletePublication = async ({ publicationId }: { publicationId: string }) => {
    try {
      const conversations = await conversationServiceSingleton.listAllConversations();
      const publicationCatalog = await projectChannelPublicationService.readCatalogForConversations(conversations);
      const workspace = publicationCatalog.bindingWorkspaceById[publicationId];
      if (!workspace) {
        throw new Error(`Publication ${publicationId} is not bound to a project workspace`);
      }

      await projectChannelPublicationService.deleteChannelBinding(workspace, publicationId);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] deletePublication error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  };

  channel.upsertPublication.provider(upsertPublication);
  channel.deletePublication.provider(deletePublication);

  const prepareConversationPublication = async (conversationId: string) => {
    const publicationService = getChannelPublicationService();
    return publicationService.prepareConversationPublication(conversationId);
  };

  channel.prepareConversationPublication.provider(async ({ conversationId }) => {
    try {
      const data = await prepareConversationPublication(conversationId);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] prepareConversationPublication error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.prepareConversationAgentProfile.provider(async ({ conversationId }) => {
    try {
      const data = await prepareConversationPublication(conversationId);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] prepareConversationAgentProfile error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Continue a source session/conversation in a target channel chat.
   */
  channel.continuationSession.provider(async (params) => {
    try {
      const continuationService = getChannelContinuationService();
      const data = await continuationService.continueSession(params);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] continuationSession error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.endContinuationSession.provider(async ({ targetExternalSessionId }) => {
    try {
      const continuationService = getChannelContinuationService();
      const data = await continuationService.releaseContinuation(targetExternalSessionId);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] endContinuationSession error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.setContinuationControlMode.provider(async ({ targetExternalSessionId, controlMode }) => {
    try {
      const continuationService = getChannelContinuationService();
      const data = await continuationService.updateContinuationControlMode(targetExternalSessionId, controlMode);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] setContinuationControlMode error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  console.log('[ChannelBridge] Initialized');
}
