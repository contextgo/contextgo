/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isSystemFallbackBinding,
  type ChannelBindingScopeType,
  type IChannelBinding,
  type IChannelPublicationUpsertInput,
  type IChannelPublishObject,
} from '@process/channels/types';

export type DurableBindingScopeType = Exclude<ChannelBindingScopeType, 'temporary_override'>;

export type PublicationDraft = {
  existingPublicationId?: string;
  channelAccountId: string;
  scopeType: DurableBindingScopeType;
  scopeKey: string;
  agentProfileId: string;
  priority: number;
  publishObject?: IChannelPublishObject;
};

function buildManualBindingId(channelAccountId: string, scopeType: ChannelBindingScopeType, scopeKey: string): string {
  const normalizedScopeKey = normalizeScopeKey(scopeType, scopeKey) || 'default';
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `binding_manual_${channelAccountId}_${scopeType}_${normalizedScopeKey}_${randomSuffix}`;
}

export function normalizeScopeKey(scopeType: ChannelBindingScopeType, scopeKey: string): string {
  if (scopeType === 'channel_account_default') {
    return '';
  }

  return scopeKey.trim();
}

export function splitBindingsByLifetime(bindings: IChannelBinding[]): {
  durableBindings: IChannelBinding[];
  temporaryBindings: IChannelBinding[];
  systemFallbackBindings: IChannelBinding[];
} {
  return {
    durableBindings: bindings.filter((binding) => !binding.temporary && !isSystemFallbackBinding(binding)),
    temporaryBindings: bindings.filter((binding) => binding.temporary),
    systemFallbackBindings: bindings.filter((binding) => !binding.temporary && isSystemFallbackBinding(binding)),
  };
}

export function findMatchingBinding(bindings: IChannelBinding[], draft: PublicationDraft): IChannelBinding | undefined {
  const normalizedScopeKey = normalizeScopeKey(draft.scopeType, draft.scopeKey);
  return bindings.find(
    (binding) =>
      binding.channelAccountId === draft.channelAccountId &&
      binding.scopeType === draft.scopeType &&
      binding.temporary === false &&
      (binding.scopeKey ?? '') === normalizedScopeKey
  );
}

export function buildPublicationPayload(
  bindings: IChannelBinding[],
  draft: PublicationDraft
): IChannelPublicationUpsertInput {
  const normalizedScopeKey = normalizeScopeKey(draft.scopeType, draft.scopeKey);
  const existing =
    (draft.existingPublicationId
      ? bindings.find((binding) => binding.id === draft.existingPublicationId)
      : undefined) ?? findMatchingBinding(bindings, draft);

  return {
    channelAccountId: draft.channelAccountId,
    publicationId:
      existing?.id ??
      draft.existingPublicationId ??
      buildManualBindingId(draft.channelAccountId, draft.scopeType, normalizedScopeKey),
    scopeType: draft.scopeType,
    scopeKey: normalizedScopeKey,
    agentProfileId: draft.agentProfileId,
    priority: draft.priority,
    publishObject: draft.publishObject,
  };
}
