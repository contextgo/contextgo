/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelPublishObjectCatalogSource,
  ChannelPublishObjectDisplayQuality,
  ChannelObjectKind,
  ChannelObjectParentKind,
  IChannelActiveSessionEntry,
  IChannelAudienceEntry,
  IChannelBinding,
  IChannelPublishObjectCatalogEntry,
  PluginType,
} from '@process/channels/types';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

export type PublicationObjectViewModel = {
  key: string;
  kind: ChannelObjectKind;
  title: string;
  subtitle?: string;
  parentKey?: string;
  parentTitle?: string;
  parentKind?: ChannelObjectParentKind;
  objectSource?: ChannelPublishObjectCatalogSource;
  objectQuality?: ChannelPublishObjectDisplayQuality;
  audiences: IChannelAudienceEntry[];
  bindings: IChannelBinding[];
  sessions: IChannelActiveSessionEntry[];
  primaryAudience?: IChannelAudienceEntry;
  lastActivity?: number;
};

type PublicationObjectSeed = {
  key: string;
  kind: ChannelObjectKind;
  title: string;
  subtitle?: string;
  parentKey?: string;
  parentTitle?: string;
  parentKind?: ChannelObjectParentKind;
  objectSource?: ChannelPublishObjectCatalogSource;
  objectQuality?: ChannelPublishObjectDisplayQuality;
  lastActivity?: number;
  audience?: IChannelAudienceEntry;
  binding?: IChannelBinding;
  session?: IChannelActiveSessionEntry;
};

function looksTechnicalScopeKey(value: string): boolean {
  return (
    value.includes('://') ||
    value.startsWith('user:') ||
    value.startsWith('group:') ||
    value.includes(':thread:') ||
    /^(?:ou_|oc_|on_|om_)/.test(value) ||
    value.endsWith('@im.wechat')
  );
}

function toReadableScopeKey(value: string): string | undefined {
  let candidate = value;
  const threadMarker = ':thread:';
  if (candidate.includes(threadMarker)) {
    candidate = candidate.slice(candidate.indexOf(threadMarker) + threadMarker.length) || '';
  } else if (candidate.startsWith('user:')) {
    candidate = candidate.slice(5) || '';
  } else if (candidate.startsWith('group:')) {
    candidate = candidate.slice(6) || '';
  } else if (candidate.includes('://')) {
    const segments = candidate.split('/').filter(Boolean);
    candidate = segments.at(-1) || '';
  }

  if (!candidate || looksTechnicalScopeKey(candidate)) {
    return undefined;
  }

  return candidate;
}

function getFallbackObjectTitle(platform: PluginType, kind: ChannelObjectKind): string {
  if (platform === 'weixin') {
    if (kind === 'person' || kind === 'dm') {
      return 'Contact';
    }
    if (kind === 'group') {
      return 'Group Chat';
    }
    return 'Chat';
  }

  if (platform === 'lark') {
    if (kind === 'dm') {
      return 'Direct Chat';
    }
    if (kind === 'group') {
      return 'Group';
    }
    if (kind === 'topic' || kind === 'thread') {
      return 'Topic';
    }
    return 'Chat';
  }

  if (platform === 'slack') {
    if (kind === 'dm') {
      return 'DM';
    }
    if (kind === 'channel') {
      return 'Channel';
    }
    if (kind === 'thread') {
      return 'Thread';
    }
    return 'Workspace Chat';
  }

  if (platform === 'discord') {
    if (kind === 'dm') {
      return 'DM';
    }
    if (kind === 'server') {
      return 'Server';
    }
    if (kind === 'channel') {
      return 'Channel';
    }
    if (kind === 'thread') {
      return 'Thread';
    }
    return 'Channel';
  }

  if (platform === 'telegram') {
    if (kind === 'dm') {
      return 'Private Chat';
    }
    if (kind === 'group') {
      return 'Group';
    }
    if (kind === 'channel') {
      return 'Channel';
    }
    if (kind === 'thread') {
      return 'Topic Thread';
    }
    return 'Chat';
  }

  return 'Chat';
}

function inferObjectKind(params: {
  platform: PluginType;
  key: string;
  scopeType?: IChannelAudienceEntry['scopeType'];
  remoteChatType?: string;
  peerScope?: IChannelAudienceEntry['peerScope'];
}): ChannelObjectKind {
  if (params.scopeType === 'remote_user') {
    return params.platform === 'weixin' ? 'person' : 'dm';
  }

  const normalizedType = params.remoteChatType?.toLowerCase();
  const normalizedKey = params.key.toLowerCase();

  if (params.platform === 'lark') {
    if (normalizedType === 'topic' || normalizedKey.includes('/topic/')) {
      return 'topic';
    }
    if (normalizedType === 'thread' || params.peerScope === 'thread' || normalizedKey.includes(':thread:')) {
      return 'topic';
    }
    if (normalizedType === 'p2p' || normalizedType === 'private' || normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'group') {
      return 'group';
    }
  }

  if (params.platform === 'slack') {
    if (normalizedType === 'thread' || params.peerScope === 'thread' || normalizedKey.includes(':thread:')) {
      return 'thread';
    }
    if (normalizedType === 'im' || normalizedType === 'mpim' || normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'channel' || normalizedType === 'group') {
      return 'channel';
    }
  }

  if (params.platform === 'discord') {
    if (normalizedType === 'thread' || params.peerScope === 'thread' || normalizedKey.includes(':thread:')) {
      return 'thread';
    }
    if (normalizedType === 'dm') {
      return 'dm';
    }
    if (normalizedType === 'group' || normalizedType === 'channel') {
      return 'channel';
    }
  }

  if (normalizedType === 'topic' || normalizedKey.includes('/topic/')) {
    return 'topic';
  }
  if (normalizedType === 'thread' || params.peerScope === 'thread' || normalizedKey.includes(':thread:')) {
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
    return params.platform === 'weixin' ? 'person' : 'dm';
  }

  return 'chat';
}

function resolveAudienceSeed(audience: IChannelAudienceEntry, platform: PluginType): PublicationObjectSeed {
  return {
    key: audience.objectKey ?? audience.key,
    kind:
      audience.objectKind ??
      inferObjectKind({
        platform,
        key: audience.key,
        scopeType: audience.scopeType,
        remoteChatType: audience.remoteChatType,
        peerScope: audience.peerScope,
      }),
    title: audience.objectTitle ?? audience.title,
    subtitle: audience.objectSubtitle ?? audience.subtitle,
    parentKey: audience.parentObjectKey,
    parentTitle: audience.parentObjectTitle,
    parentKind: audience.parentObjectKind,
    objectSource: audience.objectSource,
    objectQuality: audience.objectQuality,
    lastActivity: audience.lastActive,
    audience,
  };
}

function resolveSessionSeed(session: IChannelActiveSessionEntry, platform: PluginType): PublicationObjectSeed {
  return {
    key: session.objectKey ?? session.audienceKey ?? session.id,
    kind:
      session.objectKind ??
      inferObjectKind({
        platform,
        key: session.audienceKey ?? session.id,
      }),
    title: session.objectTitle ?? session.audienceTitle,
    subtitle: session.objectSubtitle,
    parentKey: session.parentObjectKey,
    parentTitle: session.parentObjectTitle,
    parentKind: session.parentObjectKind,
    objectSource: session.objectSource,
    objectQuality: session.objectQuality,
    lastActivity: session.lastActivity,
    session,
  };
}

function resolveBindingSeed(
  binding: IChannelBinding,
  platform: PluginType,
  catalogEntry?: IChannelPublishObjectCatalogEntry
): PublicationObjectSeed | null {
  if (!binding.scopeKey || binding.scopeType === 'connector_default') {
    return null;
  }

  const kind = inferObjectKind({
    platform,
    key: binding.scopeKey,
    scopeType: binding.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat',
  });
  const readableScopeKey = toReadableScopeKey(binding.scopeKey);
  const fallbackTitle = getFallbackObjectTitle(platform, kind);

  return {
    key: binding.scopeKey,
    kind,
    title:
      catalogEntry?.displayProfile.title ?? (readableScopeKey ? `${fallbackTitle} ${readableScopeKey}` : fallbackTitle),
    subtitle: catalogEntry?.displayProfile.subtitle,
    parentTitle: catalogEntry?.displayProfile.parentTitle,
    objectSource: catalogEntry?.displayProfile.source,
    objectQuality: catalogEntry?.displayProfile.quality ?? 'fallback',
    binding,
  };
}

function upsertObject(map: Map<string, PublicationObjectViewModel>, seed: PublicationObjectSeed): void {
  const existing = map.get(seed.key);
  if (!existing) {
    map.set(seed.key, {
      key: seed.key,
      kind: seed.kind,
      title: seed.title,
      subtitle: seed.subtitle,
      parentKey: seed.parentKey,
      parentTitle: seed.parentTitle,
      parentKind: seed.parentKind,
      objectSource: seed.objectSource,
      objectQuality: seed.objectQuality,
      audiences: seed.audience ? [seed.audience] : [],
      bindings: seed.binding ? [seed.binding] : [],
      sessions: seed.session ? [seed.session] : [],
      primaryAudience: seed.audience,
      lastActivity: seed.lastActivity,
    });
    return;
  }

  if (!existing.subtitle && seed.subtitle) {
    existing.subtitle = seed.subtitle;
  }
  if (!existing.parentTitle && seed.parentTitle) {
    existing.parentTitle = seed.parentTitle;
  }
  if (!existing.parentKey && seed.parentKey) {
    existing.parentKey = seed.parentKey;
  }
  if (!existing.parentKind && seed.parentKind) {
    existing.parentKind = seed.parentKind;
  }
  if (!existing.objectSource && seed.objectSource) {
    existing.objectSource = seed.objectSource;
  }
  if (!existing.objectQuality && seed.objectQuality) {
    existing.objectQuality = seed.objectQuality;
  }
  if (seed.lastActivity && (!existing.lastActivity || seed.lastActivity > existing.lastActivity)) {
    existing.lastActivity = seed.lastActivity;
  }
  if (seed.audience) {
    existing.audiences.push(seed.audience);
    existing.primaryAudience ??= seed.audience;
  }
  if (seed.binding) {
    existing.bindings.push(seed.binding);
  }
  if (seed.session) {
    existing.sessions.push(seed.session);
  }
}

export function buildPublicationObjects(params: {
  platform: PluginType;
  audiences: IChannelAudienceEntry[];
  bindings: IChannelBinding[];
  sessions: IChannelActiveSessionEntry[];
  resolveBindingAudience: (binding: IChannelBinding) => IChannelAudienceEntry | undefined;
  resolveBindingCatalogEntry?: (binding: IChannelBinding) => IChannelPublishObjectCatalogEntry | undefined;
}): PublicationObjectViewModel[] {
  const objectMap = new Map<string, PublicationObjectViewModel>();

  params.audiences.forEach((audience) => {
    upsertObject(objectMap, resolveAudienceSeed(audience, params.platform));
  });

  params.bindings.forEach((binding) => {
    const audience = params.resolveBindingAudience(binding);
    if (!audience) {
      const bindingSeed = resolveBindingSeed(binding, params.platform, params.resolveBindingCatalogEntry?.(binding));
      if (bindingSeed) {
        upsertObject(objectMap, bindingSeed);
      }
      return;
    }

    upsertObject(objectMap, {
      ...resolveAudienceSeed(audience, params.platform),
      binding,
    });
  });

  params.sessions.forEach((session) => {
    upsertObject(objectMap, resolveSessionSeed(session, params.platform));
  });

  return Array.from(objectMap.values()).toSorted((left, right) => {
    const publishedOrder = right.bindings.length - left.bindings.length;
    if (publishedOrder !== 0) {
      return publishedOrder;
    }

    const sessionOrder = right.sessions.length - left.sessions.length;
    if (sessionOrder !== 0) {
      return sessionOrder;
    }

    const qualityOrder = (left.objectQuality === 'fallback' ? 1 : 0) - (right.objectQuality === 'fallback' ? 1 : 0);
    if (qualityOrder !== 0) {
      return qualityOrder;
    }

    const activityOrder = (right.lastActivity ?? 0) - (left.lastActivity ?? 0);
    if (activityOrder !== 0) {
      return activityOrder;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getPublicationObjectKindLabel(platform: PluginType, kind: ChannelObjectKind, t: TranslationFn): string {
  const platformKey = `settings.channels.publication.objectKind.${platform}.${kind}`;
  const platformLabel = t(platformKey);
  if (platformLabel !== platformKey) {
    return platformLabel;
  }

  return t(`settings.channels.publication.objectKind.common.${kind}`);
}
