/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelBindingScopeType, IChannelBinding } from '@process/channels/types';

export type DurableBindingScopeType = Exclude<ChannelBindingScopeType, 'temporary_override'>;

export type BindingDraft = {
  connectorId: string;
  scopeType: ChannelBindingScopeType;
  scopeKey: string;
  agentProfileId: string;
  temporary: boolean;
  priority: number;
};

function buildManualBindingId(connectorId: string, scopeType: ChannelBindingScopeType, scopeKey: string): string {
  const normalizedScopeKey = normalizeScopeKey(scopeType, scopeKey) || 'default';
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `binding_manual_${connectorId}_${scopeType}_${normalizedScopeKey}_${randomSuffix}`;
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
} {
  return {
    durableBindings: bindings.filter((binding) => !binding.temporary),
    temporaryBindings: bindings.filter((binding) => binding.temporary),
  };
}

export function findMatchingBinding(bindings: IChannelBinding[], draft: BindingDraft): IChannelBinding | undefined {
  const normalizedScopeKey = normalizeScopeKey(draft.scopeType, draft.scopeKey);
  return bindings.find(
    (binding) =>
      binding.connectorId === draft.connectorId &&
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
    id: existing?.id ?? buildManualBindingId(draft.connectorId, draft.scopeType, normalizedScopeKey),
    connectorId: draft.connectorId,
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
