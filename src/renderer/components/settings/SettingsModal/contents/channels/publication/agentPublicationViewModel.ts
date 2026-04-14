/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getChannelBindingPublishObject,
  getChannelPublishObjectCatalogEntryIdentity,
  getChannelAccountId,
  type IChannelActiveSessionEntry,
  type IChannelAccount,
  type IChannelAudienceEntry,
  type IChannelBinding,
  type IChannelPublishObjectCatalogEntry,
} from '@process/channels/types';

import {
  buildPublicationObjects,
  getPublicationObjectKindLabel,
  type PublicationObjectViewModel,
} from './objectViewModel';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

export type AgentPublicationObjectEntry = {
  key: string;
  channelAccount: IChannelAccount;
  object: PublicationObjectViewModel;
  currentSession?: IChannelActiveSessionEntry;
};

type BuildAgentPublicationObjectsParams = {
  channelAccounts: IChannelAccount[];
  audiences: IChannelAudienceEntry[];
  bindings: IChannelBinding[];
  publishObjects?: IChannelPublishObjectCatalogEntry[];
  sessions: IChannelActiveSessionEntry[];
};

function getRelevantSessions(
  channelAccountId: string,
  bindings: IChannelBinding[],
  sessions: IChannelActiveSessionEntry[]
): IChannelActiveSessionEntry[] {
  const bindingIds = new Set(bindings.map((binding) => binding.id));
  const objectKeys = new Set(
    bindings.map((binding) => binding.scopeKey).filter((value): value is string => Boolean(value))
  );

  return sessions.filter((session) => {
    if (getChannelAccountId(session) !== channelAccountId) {
      return false;
    }

    if (session.publicationBindingId && bindingIds.has(session.publicationBindingId)) {
      return true;
    }

    if (session.bindingId && bindingIds.has(session.bindingId)) {
      return true;
    }

    if (session.objectKey && objectKeys.has(session.objectKey)) {
      return true;
    }

    if (session.audienceKey && objectKeys.has(session.audienceKey)) {
      return true;
    }

    return false;
  });
}

function getSessionActiveConversationId(session: IChannelActiveSessionEntry): string | undefined {
  return session.activeConversationId ?? session.conversationId;
}

export function buildAgentPublicationObjects(
  params: BuildAgentPublicationObjectsParams
): AgentPublicationObjectEntry[] {
  const audienceMap = new Map(params.audiences.map((audience) => [audience.key, audience] as const));
  const entries: AgentPublicationObjectEntry[] = [];

  params.channelAccounts.forEach((channelAccount) => {
    const accountBindings = params.bindings.filter(
      (binding) => getChannelAccountId(binding) === channelAccount.id && binding.scopeType !== 'connector_default'
    );
    if (accountBindings.length === 0) {
      return;
    }

    const accountAudiences = params.audiences.filter((audience) => getChannelAccountId(audience) === channelAccount.id);
    const accountSessions = getRelevantSessions(channelAccount.id, accountBindings, params.sessions);

    const objects = buildPublicationObjects({
      platform: channelAccount.platform,
      audiences: accountAudiences,
      bindings: accountBindings,
      sessions: accountSessions,
      resolveBindingAudience: (binding) => {
        if (!binding.scopeKey) {
          return undefined;
        }

        return audienceMap.get(binding.scopeKey);
      },
      resolveBindingCatalogEntry: (binding) => {
        const channelAccountId = getChannelAccountId(binding);
        if (!channelAccountId || !params.publishObjects) {
          return undefined;
        }

        const publishObject = getChannelBindingPublishObject(binding);
        return params.publishObjects.find(
          (entry) =>
            entry.id ===
            getChannelPublishObjectCatalogEntryIdentity({
              id: '',
              channelAccountId,
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
            })
        );
      },
    }).filter((object) => object.bindings.length > 0);

    objects.forEach((object) => {
      const currentSession = object.sessions
        .filter((session) => Boolean(getSessionActiveConversationId(session)))
        .toSorted((left, right) => right.lastActivity - left.lastActivity)[0];

      entries.push({
        key: `${channelAccount.id}:${object.key}`,
        channelAccount,
        object,
        currentSession,
      });
    });
  });

  return entries.toSorted((left, right) => {
    const sessionDelta = (right.currentSession?.lastActivity ?? 0) - (left.currentSession?.lastActivity ?? 0);
    if (sessionDelta !== 0) {
      return sessionDelta;
    }

    const activityDelta = (right.object.lastActivity ?? 0) - (left.object.lastActivity ?? 0);
    if (activityDelta !== 0) {
      return activityDelta;
    }

    return left.object.title.localeCompare(right.object.title);
  });
}

export function buildPublishObjectOptionLabel(params: {
  channelAccount: IChannelAccount;
  audience: IChannelAudienceEntry;
  t: TranslationFn;
}): string {
  const title = params.audience.objectTitle ?? params.audience.title;
  const kindLabel = getPublicationObjectKindLabel(
    params.channelAccount.platform,
    params.audience.objectKind ?? (params.audience.scopeType === 'remote_user' ? 'dm' : 'chat'),
    params.t
  );
  const details = [
    params.audience.parentObjectTitle,
    params.audience.objectSubtitle ?? params.audience.subtitle,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  return [title, kindLabel, ...details].join(' · ');
}
