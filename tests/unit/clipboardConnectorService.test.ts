/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClipboardConnectorConfig } from '../../src/common/types/connectors/clipboard';
import {
  ClipboardConnectorService,
  normalizeClipboardConnectorConfig,
} from '../../src/process/services/space/connectors/clipboard/ClipboardConnectorService';

type ClipboardConfigStore = {
  get: <K extends 'connector.clipboard.config'>(
    key: K
  ) => Promise<{ 'connector.clipboard.config'?: ClipboardConnectorConfig }[K]>;
  set: <K extends 'connector.clipboard.config'>(
    key: K,
    value: { 'connector.clipboard.config'?: ClipboardConnectorConfig }[K]
  ) => Promise<{ 'connector.clipboard.config'?: ClipboardConnectorConfig }[K]>;
  snapshot: () => ClipboardConnectorConfig | undefined;
};

type MockObserverController = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getRuntimeDetails: ReturnType<typeof vi.fn>;
};

function createObserverController(
  overrides: Partial<Record<'running' | 'lastError', unknown>> = {}
): MockObserverController {
  let running = Boolean(overrides.running);
  let pid = overrides.running ? 4321 : undefined;
  let lastError = typeof overrides.lastError === 'string' ? overrides.lastError : undefined;

  return {
    start: vi.fn(async () => {
      running = true;
      pid = 4321;
      lastError = undefined;
      return {
        pid,
        repoDir: '/tmp/connector',
        command: 'python3',
        note: 'observer started',
      };
    }),
    stop: vi.fn(async () => {
      running = false;
      pid = undefined;
    }),
    getRuntimeDetails: vi.fn(() => ({
      running,
      pid,
      repoDir: '/tmp/connector',
      command: 'python3',
      lastError,
      note: running ? 'observer running' : undefined,
    })),
  };
}

function createStore(initial?: ClipboardConnectorConfig): ClipboardConfigStore {
  let state = initial;

  return {
    get: vi.fn(async () => state),
    set: vi.fn(async (_key, value) => {
      state = value;
      return value;
    }),
    snapshot: () => state,
  };
}

describe('normalizeClipboardConnectorConfig', () => {
  it('applies defaults and bounds to partial config', () => {
    expect(
      normalizeClipboardConnectorConfig({
        pollIntervalMs: 100,
        maxTextBytes: 10,
        retentionDays: 0,
        dedupeWindowSeconds: -1,
        ignoreApps: [' Finder ', 'Finder'],
        ignorePatterns: [' secret ', 'secret'],
      })
    ).toEqual({
      enabled: false,
      mode: 'macos-pasteboard',
      pollIntervalMs: 200,
      retainFullText: false,
      maxTextBytes: 256,
      retentionDays: 1,
      dedupeWindowSeconds: 0,
      ignoreApps: ['Finder'],
      ignorePatterns: ['secret'],
    });
  });
});

describe('ClipboardConnectorService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads defaults when no config exists', async () => {
    const service = new ClipboardConnectorService(createStore(), async () => '', 'darwin');

    await expect(service.getConfig()).resolves.toEqual({
      enabled: false,
      mode: 'macos-pasteboard',
      pollIntervalMs: 800,
      retainFullText: false,
      maxTextBytes: 32768,
      retentionDays: 30,
      dedupeWindowSeconds: 300,
      ignoreApps: [],
      ignorePatterns: [],
    });
  });

  it('persists normalized config updates', async () => {
    const store = createStore();
    const service = new ClipboardConnectorService(store, async () => '', 'darwin');

    const config = await service.setConfig({
      enabled: true,
      pollIntervalMs: 150,
      maxTextBytes: 1024,
      ignorePatterns: [' token ', 'token'],
    });

    expect(config.enabled).toBe(true);
    expect(config.pollIntervalMs).toBe(200);
    expect(config.maxTextBytes).toBe(1024);
    expect(config.ignorePatterns).toEqual(['token']);
    expect(store.snapshot()?.enabled).toBe(true);
  });

  it('records lifecycle timestamps when the managed observer starts and stops', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_717_000_000_000);
    const observer = createObserverController();
    const service = new ClipboardConnectorService(createStore(), async () => 'hello', 'darwin', observer);

    const started = await service.start();
    expect(started.lifecycle).toBe('running');
    expect(started.desiredState).toBe('running');
    expect(started.lastStartAt).toBe(1_717_000_000_000);

    const stopped = await service.stop();
    expect(stopped.lifecycle).toBe('stopped');
    expect(stopped.desiredState).toBe('stopped');
    expect(stopped.lastStopAt).toBe(1_717_000_000_000);
  });

  it('starts and stops the managed observer process', async () => {
    const observer = createObserverController();
    const service = new ClipboardConnectorService(createStore(), async () => 'hello', 'darwin', observer);

    const started = await service.start();
    expect(observer.start).toHaveBeenCalledOnce();
    expect(started).toMatchObject({
      lifecycle: 'running',
      desiredState: 'running',
      observerPid: 4321,
      observerRepoDir: '/tmp/connector',
      observerCommand: 'python3',
    });

    const stopped = await service.stop();
    expect(observer.stop).toHaveBeenCalledOnce();
    expect(stopped.lifecycle).toBe('stopped');
    expect(stopped.observerPid).toBeUndefined();
  });

  it('surfaces managed observer start failures in status', async () => {
    const observer = createObserverController();
    observer.start.mockRejectedValueOnce(new Error('observer launch failed'));
    const service = new ClipboardConnectorService(createStore(), async () => 'hello', 'darwin', observer);

    const status = await service.start();

    expect(status.lifecycle).toBe('error');
    expect(status.lastError).toBe('observer launch failed');
    expect(status.note).toBe('observer launch failed');
  });

  it('reports unsupported platforms as unavailable', async () => {
    const service = new ClipboardConnectorService(createStore(), async () => 'hello', 'linux');

    const status = await service.start();

    expect(status.lifecycle).toBe('error');
    expect(status.available).toBe(false);
    expect(status.lastError).toContain('macOS pasteboard only');
  });

  it('samples current clipboard text and truncates by config', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(42_000);
    const store = createStore({
      enabled: true,
      mode: 'macos-pasteboard',
      pollIntervalMs: 800,
      retainFullText: false,
      maxTextBytes: 256,
      retentionDays: 30,
      dedupeWindowSeconds: 300,
      ignoreApps: [],
      ignorePatterns: [],
    });
    const service = new ClipboardConnectorService(store, async () => 'a'.repeat(300), 'darwin');

    const snapshot = await service.sampleNow();

    expect(snapshot).toEqual({
      text: 'a'.repeat(256),
      truncated: true,
      textBytes: 256,
      capturedAt: 42_000,
      source: 'pbpaste',
    });
    await expect(service.getStatus()).resolves.toMatchObject({
      lastSampleAt: 42_000,
    });
  });

  it('skips ignored clipboard payloads', async () => {
    const store = createStore({
      enabled: true,
      mode: 'macos-pasteboard',
      pollIntervalMs: 800,
      retainFullText: false,
      maxTextBytes: 32768,
      retentionDays: 30,
      dedupeWindowSeconds: 300,
      ignoreApps: [],
      ignorePatterns: ['secret'],
    });
    const service = new ClipboardConnectorService(store, async () => 'contains secret token', 'darwin');

    await expect(service.sampleNow()).resolves.toBeNull();
  });
});
