/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClipboardStoreService } from '../../src/process/services/space/connectors/clipboard/ClipboardStoreService';

const tempDirs: string[] = [];

const createTempBaseDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-clipboard-store-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ClipboardStoreService', () => {
  it('records manual snapshots into ContextGo store', async () => {
    const baseDir = await createTempBaseDir();
    const service = new ClipboardStoreService(async () => baseDir);

    const event = await service.recordManualSnapshot({
      text: 'https://contextgo.io',
      truncated: false,
      textBytes: 20,
      capturedAt: 42_000,
      source: 'pbpaste',
    });

    expect(event.contentType).toBe('url');
    await expect(service.getStats()).resolves.toMatchObject({
      eventCount: 1,
    });
    await expect(service.listRecentEvents(5)).resolves.toHaveLength(1);
  });

  it('collects daily summaries from locally stored events', async () => {
    const baseDir = await createTempBaseDir();
    const service = new ClipboardStoreService(async () => baseDir);
    vi.spyOn(service, 'syncRecentFromConnectorRepo').mockResolvedValue(0);

    await service.recordManualSnapshot({
      text: 'https://contextgo.io/docs',
      truncated: false,
      textBytes: 26,
      capturedAt: Date.parse('2026-03-30T10:00:00.000Z'),
      source: 'pbpaste',
    });
    await service.recordManualSnapshot({
      text: 'hello contextgo',
      truncated: false,
      textBytes: 16,
      capturedAt: Date.parse('2026-03-30T12:00:00.000Z'),
      source: 'pbpaste',
    });

    const result = await service.collectDailySummary('2026-03-30');

    expect(result.eventCount).toBe(2);
    expect(result.summary.uniqueHashCount).toBe(2);
    expect(result.summary.topDomains[0]).toMatchObject({ domain: 'contextgo.io', count: 1 });
    await expect(service.listSummaries(5)).resolves.toHaveLength(1);
  });
});
