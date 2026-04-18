/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelPublishObjectChatDisplayData as RemoteChatDisplayData,
  ChannelPublishObjectDiscoveryProvider as RemoteDisplayResolver,
  ChannelPublishObjectRuntimeDisplaySource as RuntimeDisplaySource,
  ChannelPublishObjectUserDisplayData as RemoteUserDisplayData,
} from '@process/channels/plugins/BasePlugin';
import type { IChannelAccount, IRemoteIdentity } from '@process/channels/types';

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

function hasReadableDisplayName(value?: string): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return Boolean(normalized) && !looksLikeTechnicalIdentifier(normalized) && !normalized.startsWith('User ');
}

function getMetadataText(metadata: IRemoteIdentity['metadata'], key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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

function getDefaultDisplaySource(platform: IChannelAccount['platform']): RuntimeDisplaySource {
  return platform === 'dingtalk' ? 'runtime-resolved' : 'official-pull';
}

function normalizeDisplaySource(
  value: unknown,
  platform: IChannelAccount['platform']
): RuntimeDisplaySource | undefined {
  if (value === 'official-pull' || value === 'runtime-resolved') {
    return value;
  }

  return platform === 'lark' || platform === 'discord' || platform === 'dingtalk'
    ? getDefaultDisplaySource(platform)
    : undefined;
}

function pickPreferredDisplaySource(
  ...sources: Array<RuntimeDisplaySource | undefined>
): RuntimeDisplaySource | undefined {
  if (sources.includes('official-pull')) {
    return 'official-pull';
  }

  if (sources.includes('runtime-resolved')) {
    return 'runtime-resolved';
  }

  return undefined;
}

async function enrichIdentityForDisplay(
  identity: IRemoteIdentity,
  connector: IChannelAccount,
  resolver: RemoteDisplayResolver
): Promise<IRemoteIdentity> {
  const metadata = identity.metadata ?? {};
  const childObject = isChildRemoteObject(identity);
  const parentChatId = identity.platformChatId ?? identity.parentChatId ?? identity.remoteChatId;
  const objectChatId = childObject ? (identity.threadId ?? identity.remoteChatId) : parentChatId;
  const loadObjectChatDisplay = Boolean(
    objectChatId && !isDirectChatType(identity.remoteChatType) && typeof resolver.getChatDisplayData === 'function'
  );
  const loadParentChatDisplay = Boolean(
    childObject && parentChatId && parentChatId !== objectChatId && typeof resolver.getChatDisplayData === 'function'
  );

  const [objectChatDisplay, parentChatDisplay, userDisplay] = await Promise.all([
    loadObjectChatDisplay && objectChatId
      ? resolver.getChatDisplayData?.(objectChatId).catch((_error): null => null)
      : null,
    loadParentChatDisplay && parentChatId
      ? resolver.getChatDisplayData?.(parentChatId).catch((_error): null => null)
      : null,
    identity.remoteUserId && typeof resolver.getUserDisplayData === 'function'
      ? resolver.getUserDisplayData(identity.remoteUserId).catch((_error): null => null)
      : null,
  ]);

  const objectDisplaySource = pickPreferredDisplaySource(
    normalizeDisplaySource(objectChatDisplay?.source, connector.platform),
    loadObjectChatDisplay && objectChatDisplay ? getDefaultDisplaySource(connector.platform) : undefined
  );
  const parentDisplaySource = pickPreferredDisplaySource(
    normalizeDisplaySource(parentChatDisplay?.source, connector.platform),
    loadParentChatDisplay && parentChatDisplay ? getDefaultDisplaySource(connector.platform) : undefined
  );
  const userDisplaySource = pickPreferredDisplaySource(
    normalizeDisplaySource(userDisplay?.source, connector.platform),
    userDisplay ? getDefaultDisplaySource(connector.platform) : undefined
  );
  const chatName = childObject
    ? parentChatDisplay?.name?.trim() ||
      objectChatDisplay?.parentTitle?.trim() ||
      getMetadataText(metadata, 'parentTitle')
    : (connector.platform === 'lark' && childObject ? undefined : objectChatDisplay?.name?.trim()) ||
      getMetadataText(metadata, 'chatName');
  const chatDescription = objectChatDisplay?.description?.trim() || getMetadataText(metadata, 'chatDescription');
  const userDisplayName = userDisplay?.name?.trim() || getMetadataText(metadata, 'userDisplayName');
  const currentDisplayName = hasReadableDisplayName(identity.displayName) ? identity.displayName.trim() : undefined;
  const resolvedObjectName = connector.platform === 'lark' && childObject ? undefined : objectChatDisplay?.name?.trim();
  const resolvedParentTitle =
    parentChatDisplay?.name?.trim() ||
    objectChatDisplay?.parentTitle?.trim() ||
    getMetadataText(metadata, 'parentTitle');
  const resolvedObjectSubtitle =
    getMetadataText(metadata, 'objectSubtitle') ||
    (childObject ? (resolvedParentTitle ? `In ${resolvedParentTitle}` : undefined) : chatDescription);
  const resolvedContainerId =
    objectChatDisplay?.containerId?.trim() ||
    parentChatDisplay?.containerId?.trim() ||
    getMetadataText(metadata, 'containerId');
  const resolvedContainerType =
    objectChatDisplay?.containerType?.trim() ||
    parentChatDisplay?.containerType?.trim() ||
    getMetadataText(metadata, 'containerType');
  const resolvedContainerTitle =
    objectChatDisplay?.containerTitle?.trim() ||
    parentChatDisplay?.containerTitle?.trim() ||
    getMetadataText(metadata, 'containerTitle');
  const resolvedDisplaySource = pickPreferredDisplaySource(
    getMetadataText(metadata, 'displaySource') as RuntimeDisplaySource | undefined,
    objectDisplaySource,
    parentDisplaySource,
    userDisplaySource
  );

  let displayName = currentDisplayName;
  if (isDirectChatType(identity.remoteChatType)) {
    displayName = userDisplayName ?? currentDisplayName;
  } else if (childObject) {
    displayName = resolvedObjectName ?? currentDisplayName;
  } else {
    displayName = chatName ?? currentDisplayName;
  }

  return {
    ...identity,
    displayName: displayName ?? identity.displayName,
    remoteChatType: identity.remoteChatType ?? objectChatDisplay?.chatType ?? parentChatDisplay?.chatType,
    metadata: {
      ...metadata,
      ...(chatName ? { chatName } : {}),
      ...(chatDescription ? { chatDescription } : {}),
      ...(userDisplayName ? { userDisplayName } : {}),
      ...(resolvedParentTitle ? { parentTitle: resolvedParentTitle } : {}),
      ...(resolvedObjectSubtitle ? { objectSubtitle: resolvedObjectSubtitle } : {}),
      ...(resolvedContainerId ? { containerId: resolvedContainerId } : {}),
      ...(resolvedContainerType ? { containerType: resolvedContainerType } : {}),
      ...(resolvedContainerTitle ? { containerTitle: resolvedContainerTitle } : {}),
      ...(resolvedDisplaySource ? { displaySource: resolvedDisplaySource } : {}),
    },
  };
}

export async function enrichRemoteIdentitiesForPublishObjectDiscovery(
  remoteIdentities: readonly IRemoteIdentity[],
  connectors: readonly IChannelAccount[],
  resolveDiscoveryProvider?: (runtimeId: string) => RemoteDisplayResolver | null | undefined
): Promise<IRemoteIdentity[]> {
  if (remoteIdentities.length === 0 || connectors.length === 0) {
    return [...remoteIdentities];
  }

  if (!resolveDiscoveryProvider) {
    return [...remoteIdentities];
  }

  const connectorMap = new Map(connectors.map((connector) => [connector.id, connector] as const));
  const displayResolvers = new Map<string, RemoteDisplayResolver>();

  return Promise.all(
    remoteIdentities.map(async (identity) => {
      const connector = connectorMap.get(identity.channelAccountId);
      if (!connector || !['lark', 'discord', 'dingtalk'].includes(connector.platform)) {
        return identity;
      }

      const runtimeId = connector.legacyPluginId ?? connector.id;
      let resolver = displayResolvers.get(runtimeId);
      if (!resolver) {
        const discoveryProvider = resolveDiscoveryProvider(runtimeId);
        if (!discoveryProvider) {
          return identity;
        }
        resolver = discoveryProvider;
        displayResolvers.set(runtimeId, resolver);
      }

      return enrichIdentityForDisplay(identity, connector, resolver);
    })
  );
}
