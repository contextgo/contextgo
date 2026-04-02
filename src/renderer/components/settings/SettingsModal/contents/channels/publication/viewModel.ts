/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getChannelAccountId,
  isSystemFallbackBinding,
  type ChannelBindingScopeType,
  type IChannelBinding,
} from '@process/channels/types';

export type DurableBindingScopeType = Exclude<ChannelBindingScopeType, 'temporary_override'>;

export type BindingDraft = {
  channelAccountId: string;
  scopeType: ChannelBindingScopeType;
  scopeKey: string;
  agentProfileId: string;
  temporary: boolean;
  priority: number;
};

function buildManualBindingId(channelAccountId: string, scopeType: ChannelBindingScopeType, scopeKey: string): string {
  const normalizedScopeKey = normalizeScopeKey(scopeType, scopeKey) || 'default';
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `binding_manual_${channelAccountId}_${scopeType}_${normalizedScopeKey}_${randomSuffix}`;
}

export function normalizeScopeKey(scopeType: ChannelBindingScopeType, scopeKey: string): string {
  if (scopeType === 'connector_default') {
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

export function findMatchingBinding(bindings: IChannelBinding[], draft: BindingDraft): IChannelBinding | undefined {
  const normalizedScopeKey = normalizeScopeKey(draft.scopeType, draft.scopeKey);
  return bindings.find(
    (binding) =>
      getChannelAccountId(binding) === draft.channelAccountId &&
      binding.scopeType === draft.scopeType &&
      Boolean(binding.temporary) === draft.temporary &&
      (binding.scopeKey ?? '') === normalizedScopeKey
  );
}

export function buildBindingPayload(bindings: IChannelBinding[], draft: BindingDraft): IChannelBinding {
  const now = Date.now();
  const normalizedScopeKey = normalizeScopeKey(draft.scopeType, draft.scopeKey);
  const existing = findMatchingBinding(bindings, draft);

  return {
    id: existing?.id ?? buildManualBindingId(draft.channelAccountId, draft.scopeType, normalizedScopeKey),
    connectorId: draft.channelAccountId,
    channelAccountId: draft.channelAccountId,
    scopeType: draft.scopeType,
    scopeKey: normalizedScopeKey || undefined,
    agentProfileId: draft.agentProfileId,
    priority: draft.priority,
    enabled: existing?.enabled ?? true,
    temporary: draft.temporary,
    fallbackAgentProfileId: existing?.fallbackAgentProfileId,
    metadata: {
      ...existing?.metadata,
      source: 'settings-publication-panel',
      operation: draft.temporary ? 'temporary-override' : 'durable-publication',
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
