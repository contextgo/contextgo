import { describe, expect, it } from 'vitest';
import {
  applyPulledLanguage,
  ensureLanguageTimestamp,
  markLanguageChanged,
  markLanguageSynced,
  shouldPushLanguage,
  toCloudSyncState,
  updateSyncCursor,
} from '@process/services/cloud/syncState';

describe('cloud sync state helpers', () => {
  it('marks a local language change as pending until it is synced', () => {
    const changed = markLanguageChanged(undefined, '2026-03-28T10:00:00.000Z');

    expect(shouldPushLanguage(changed)).toBe(true);
    expect(toCloudSyncState(changed)).toMatchObject({
      cursor: 0,
      languageUpdatedAt: '2026-03-28T10:00:00.000Z',
      pendingLanguageSync: true,
    });
  });

  it('does not mark language for push when no local timestamp exists yet', () => {
    const state = toCloudSyncState(undefined);

    expect(state.pendingLanguageSync).toBe(false);
    expect(state.cursor).toBe(0);
  });
});

describe('cloud sync state application', () => {
  it('accepts pulled language timestamps and clears pending sync state', () => {
    const changed = markLanguageChanged(undefined, '2026-03-28T10:00:00.000Z');
    const pulled = applyPulledLanguage(changed, '2026-03-28T11:00:00.000Z');

    expect(shouldPushLanguage(pulled)).toBe(false);
    expect(toCloudSyncState(pulled)).toMatchObject({
      languageUpdatedAt: '2026-03-28T11:00:00.000Z',
      syncedLanguageUpdatedAt: '2026-03-28T11:00:00.000Z',
      pendingLanguageSync: false,
    });
  });

  it('keeps the larger cursor and can mark a prepared language as synced', () => {
    const prepared = ensureLanguageTimestamp(undefined, '2026-03-28T12:00:00.000Z');
    const withCursor = updateSyncCursor(prepared, 7);
    const synced = markLanguageSynced(withCursor);

    expect(toCloudSyncState(synced)).toMatchObject({
      cursor: 7,
      languageUpdatedAt: '2026-03-28T12:00:00.000Z',
      syncedLanguageUpdatedAt: '2026-03-28T12:00:00.000Z',
      pendingLanguageSync: false,
    });
  });
});
