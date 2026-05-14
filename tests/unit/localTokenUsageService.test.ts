import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalTokenUsageService, parseLocalTokenUsagePayloadForTest } from '@/process/services/usage';

const tempDirs: string[] = [];

const createTempCacheRoot = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contextgo-local-usage-test-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('LocalTokenUsageService payload parsing', () => {
  it('normalizes Claude and OpenCode ccusage totals from totalCost fields', () => {
    const parsed = parseLocalTokenUsagePayloadForTest({
      daily: [
        {
          date: '2026-05-14',
          inputTokens: 100,
          outputTokens: 40,
          cacheCreationTokens: 10,
          cacheReadTokens: 20,
          totalTokens: 170,
          totalCost: 0.12,
          modelsUsed: ['claude-sonnet-4-6'],
        },
      ],
      totals: {
        inputTokens: 100,
        outputTokens: 40,
        cacheCreationTokens: 10,
        cacheReadTokens: 20,
        totalTokens: 170,
        totalCost: 0.12,
      },
    });

    expect(parsed.totals.totalTokens).toBe(170);
    expect(parsed.totals.totalCostUsd).toBe(0.12);
    expect(parsed.days[0]?.modelsUsed).toEqual(['claude-sonnet-4-6']);
  });

  it('normalizes Codex ccusage totals from costUSD and model maps', () => {
    const parsed = parseLocalTokenUsagePayloadForTest({
      daily: [
        {
          date: 'May 14, 2026',
          inputTokens: 1000,
          cachedInputTokens: 900,
          outputTokens: 80,
          reasoningOutputTokens: 12,
          totalTokens: 1080,
          costUSD: 0.33,
          models: {
            'gpt-5.5': {
              inputTokens: 1000,
              totalTokens: 1080,
            },
          },
        },
      ],
      totals: {
        inputTokens: 1000,
        cachedInputTokens: 900,
        outputTokens: 80,
        reasoningOutputTokens: 12,
        totalTokens: 1080,
        costUSD: 0.33,
      },
    });

    expect(parsed.totals.cachedInputTokens).toBe(900);
    expect(parsed.totals.totalCostUsd).toBe(0.33);
    expect(parsed.days[0]?.date).toBe('2026-05-14');
    expect(parsed.days[0]?.modelsUsed).toEqual(['gpt-5.5']);
  });

  it('serves cached reports on normal reads and only recomputes on forced refresh', async () => {
    const cacheRoot = await createTempCacheRoot();
    const previousHome = process.env.HOME;
    process.env.HOME = cacheRoot;
    await Promise.all([
      mkdir(path.join(cacheRoot, '.claude', 'projects'), { recursive: true }),
      mkdir(path.join(cacheRoot, '.codex'), { recursive: true }),
      mkdir(path.join(cacheRoot, '.local', 'share', 'opencode'), { recursive: true }),
    ]);
    const runCommand = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        daily: [
          {
            date: '2026-05-14',
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            costUSD: 0.01,
            models: { 'gpt-5.5': {} },
          },
        ],
        totals: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          costUSD: 0.01,
        },
      }),
      stderr: '',
    });
    const service = new LocalTokenUsageService(runCommand, () => new Date('2026-05-14T10:00:00Z'), {
      cacheRoot,
      refreshIntervalMs: 60_000,
      initialRefreshDelayMs: 60_000,
    });

    try {
      const first = await service.getReport();
      const callsAfterFirstRead = runCommand.mock.calls.length;
      const second = await service.getReport();
      const forced = await service.getReport({ forceRefresh: true });

      expect(first.totals.totalTokens).toBe(45);
      expect(second.totals.totalTokens).toBe(45);
      expect(forced.totals.totalTokens).toBe(45);
      expect(callsAfterFirstRead).toBe(3);
      expect(runCommand).toHaveBeenCalledTimes(6);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
