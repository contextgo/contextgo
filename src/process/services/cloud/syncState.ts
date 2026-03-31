/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CloudStoredSyncState, CloudSyncState } from '@/common/types/cloud';

const DEFAULT_CURSOR = 0;

export function normalizeStoredSyncState(state?: CloudStoredSyncState): CloudStoredSyncState {
  return {
    cursor: Math.max(DEFAULT_CURSOR, state?.cursor ?? DEFAULT_CURSOR),
    languageUpdatedAt: state?.languageUpdatedAt,
    syncedLanguageUpdatedAt: state?.syncedLanguageUpdatedAt,
    lastSyncAt: state?.lastSyncAt,
  };
}

export function toCloudSyncState(state?: CloudStoredSyncState): CloudSyncState {
  const normalized = normalizeStoredSyncState(state);
  return {
    ...normalized,
    cursor: normalized.cursor ?? DEFAULT_CURSOR,
    pendingLanguageSync: shouldPushLanguage(normalized),
  };
}

export function shouldPushLanguage(state?: CloudStoredSyncState): boolean {
  const normalized = normalizeStoredSyncState(state);
  return Boolean(normalized.languageUpdatedAt && normalized.languageUpdatedAt !== normalized.syncedLanguageUpdatedAt);
}

export function markLanguageChanged(state: CloudStoredSyncState | undefined, updatedAt: string): CloudStoredSyncState {
  return {
    ...normalizeStoredSyncState(state),
    languageUpdatedAt: updatedAt,
  };
}

export function ensureLanguageTimestamp(
  state: CloudStoredSyncState | undefined,
  updatedAt: string
): CloudStoredSyncState {
  const normalized = normalizeStoredSyncState(state);
  if (normalized.languageUpdatedAt) {
    return normalized;
  }

  return {
    ...normalized,
    languageUpdatedAt: updatedAt,
  };
}

export function applyPulledLanguage(state: CloudStoredSyncState | undefined, updatedAt: string): CloudStoredSyncState {
  return {
    ...normalizeStoredSyncState(state),
    languageUpdatedAt: updatedAt,
    syncedLanguageUpdatedAt: updatedAt,
  };
}

export function markLanguageSynced(state: CloudStoredSyncState | undefined): CloudStoredSyncState {
  const normalized = normalizeStoredSyncState(state);
  if (!normalized.languageUpdatedAt) {
    return normalized;
  }

  return {
    ...normalized,
    syncedLanguageUpdatedAt: normalized.languageUpdatedAt,
  };
}

export function updateSyncCursor(state: CloudStoredSyncState | undefined, cursor: number): CloudStoredSyncState {
  const normalized = normalizeStoredSyncState(state);
  return {
    ...normalized,
    cursor: Math.max(normalized.cursor ?? DEFAULT_CURSOR, cursor),
  };
}

export function markSyncCompleted(state: CloudStoredSyncState | undefined, completedAt: string): CloudStoredSyncState {
  return {
    ...normalizeStoredSyncState(state),
    lastSyncAt: completedAt,
  };
}
