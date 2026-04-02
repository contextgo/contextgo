/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, randomUUID } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  ClipboardCollectResult,
  ClipboardConnectorSnapshot,
  ClipboardDailySummary,
  ClipboardStoredEvent,
  ClipboardStoreStats,
} from '@/common/types/connectors/clipboard';
import { resolveConnectorRepoDir, resolvePythonCommand } from './ClipboardObserverController.ts';

const execFile = promisify(execFileCallback);
const DEFAULT_RECENT_IMPORT_LIMIT = 200;

type ClipboardStoreBaseDirResolver = () => Promise<string>;

const defaultBaseDirResolver: ClipboardStoreBaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const baseDir = path.join(getDataPath(), 'store', 'connectors', 'clipboard');
  ensureDirectory(baseDir);
  return baseDir;
};

const ensureArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

const parseJsonFile = async <T>(filePath: string): Promise<T[]> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return ensureArray<T>(JSON.parse(content));
  } catch {
    return [];
  }
};

const writeJsonFile = async <T>(filePath: string, value: readonly T[]): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const normalizeIsoDate = (value: string): string => {
  return value.slice(0, 10);
};

const buildImportedEventId = (capturedAt: string, textHash: string, observerId: string): string => {
  return createHash('sha256').update(`${capturedAt}:${textHash}:${observerId}`).digest('hex');
};

const buildManualEventId = (snapshot: ClipboardConnectorSnapshot): string => {
  return createHash('sha256').update(`${snapshot.capturedAt}:${snapshot.text}`).digest('hex');
};

const isProbablyUrl = (text: string): boolean => /^https?:\/\//i.test(text.trim());

const extractDomain = (text: string): string | null => {
  try {
    const url = new URL(text.trim());
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
};

export class ClipboardStoreService {
  constructor(private readonly resolveBaseDir: ClipboardStoreBaseDirResolver = defaultBaseDirResolver) {}

  private async getBaseDir(): Promise<string> {
    return this.resolveBaseDir();
  }

  private async getEventsPath(): Promise<string> {
    return path.join(await this.getBaseDir(), 'events.json');
  }

  private async getSummariesPath(): Promise<string> {
    return path.join(await this.getBaseDir(), 'summaries.json');
  }

  private async readEvents(): Promise<ClipboardStoredEvent[]> {
    return parseJsonFile<ClipboardStoredEvent>(await this.getEventsPath());
  }

  private async writeEvents(events: readonly ClipboardStoredEvent[]): Promise<void> {
    const sorted = [...events].sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
    await writeJsonFile(await this.getEventsPath(), sorted);
  }

  private async readSummaries(): Promise<ClipboardDailySummary[]> {
    return parseJsonFile<ClipboardDailySummary>(await this.getSummariesPath());
  }

  private async writeSummaries(summaries: readonly ClipboardDailySummary[]): Promise<void> {
    const sorted = [...summaries].sort((left, right) => right.summaryDate.localeCompare(left.summaryDate));
    await writeJsonFile(await this.getSummariesPath(), sorted);
  }

  async getStats(): Promise<ClipboardStoreStats> {
    const baseDir = await this.getBaseDir();
    const [events, summaries] = await Promise.all([this.readEvents(), this.readSummaries()]);
    return {
      eventCount: events.length,
      summaryCount: summaries.length,
      lastCapturedAt: events[0]?.capturedAt,
      lastCollectedAt: summaries[0]?.generatedAt,
      storeDir: baseDir,
    };
  }

  async listRecentEvents(limit = 20): Promise<readonly ClipboardStoredEvent[]> {
    return (await this.readEvents()).slice(0, Math.max(1, limit));
  }

  async listSummaries(limit = 20): Promise<readonly ClipboardDailySummary[]> {
    return (await this.readSummaries()).slice(0, Math.max(1, limit));
  }

  async recordManualSnapshot(snapshot: ClipboardConnectorSnapshot): Promise<ClipboardStoredEvent> {
    const events = await this.readEvents();
    const capturedAt = new Date(snapshot.capturedAt).toISOString();
    const textHash = createHash('sha256').update(snapshot.text).digest('hex');
    const eventId = buildManualEventId(snapshot);
    const existing = events.find((event) => event.id === eventId);
    if (existing) {
      return existing;
    }

    const nextEvent: ClipboardStoredEvent = {
      id: eventId,
      capturedAt,
      contentType: isProbablyUrl(snapshot.text) ? 'url' : 'plain_text',
      textPreview: snapshot.text.slice(0, 280),
      textHash,
      sizeBytes: snapshot.textBytes,
      sourceApp: 'ContextGo Sample',
      observerId: 'contextgo-manual-sample',
      source: 'contextgo-sample',
      storedAt: new Date().toISOString(),
    };

    await this.writeEvents([nextEvent, ...events]);
    return nextEvent;
  }

  async syncRecentFromConnectorRepo(limit = DEFAULT_RECENT_IMPORT_LIMIT): Promise<number> {
    const repoDir = resolveConnectorRepoDir();
    const pythonCommand = await resolvePythonCommand();
    if (!repoDir || !pythonCommand) {
      return 0;
    }

    const { stdout } = await execFile(
      pythonCommand,
      ['-m', 'cgo', 'activity', 'clipboard', 'recent', '--json', '--limit', String(limit)],
      {
        cwd: repoDir,
        windowsHide: true,
        timeout: 20_000,
      }
    );

    const parsed = JSON.parse(stdout) as { events?: Array<Record<string, unknown>> };
    const importedEvents = ensureArray<Record<string, unknown>>(parsed.events);
    if (importedEvents.length === 0) {
      return 0;
    }

    const currentEvents = await this.readEvents();
    const existingIds = new Set(currentEvents.map((event) => event.id));
    const nextEvents = [...currentEvents];
    let imported = 0;

    for (const item of importedEvents) {
      const capturedAt = typeof item.captured_at === 'string' ? item.captured_at : new Date().toISOString();
      const textHash =
        typeof item.text_hash === 'string'
          ? item.text_hash
          : createHash('sha256').update(JSON.stringify(item)).digest('hex');
      const observerId = typeof item.observer_id === 'string' ? item.observer_id : 'clipboard_main';
      const id = buildImportedEventId(capturedAt, textHash, observerId);
      if (existingIds.has(id)) {
        continue;
      }

      existingIds.add(id);
      imported += 1;
      nextEvents.push({
        id,
        capturedAt,
        contentType: typeof item.content_type === 'string' ? item.content_type : 'plain_text',
        textPreview: typeof item.text_preview === 'string' ? item.text_preview : undefined,
        textHash,
        sizeBytes: typeof item.size_bytes === 'number' ? item.size_bytes : 0,
        sourceApp: typeof item.source_app === 'string' ? item.source_app : undefined,
        observerId,
        source: 'connector-import',
        storedAt: new Date().toISOString(),
      });
    }

    await this.writeEvents(nextEvents);
    return imported;
  }

  async collectDailySummary(
    summaryDate: string = normalizeIsoDate(new Date().toISOString())
  ): Promise<ClipboardCollectResult> {
    const importedEvents = await this.syncRecentFromConnectorRepo();
    const events = (await this.readEvents()).filter((event) => normalizeIsoDate(event.capturedAt) === summaryDate);
    const uniqueHashes = new Set(events.map((event) => event.textHash));
    const domainCounts = new Map<string, number>();

    for (const event of events) {
      const domain = event.textPreview ? extractDomain(event.textPreview) : null;
      if (!domain) {
        continue;
      }
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }

    const topDomains = [...domainCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }));

    const summary: ClipboardDailySummary = {
      id: randomUUID(),
      summaryDate,
      eventCount: events.length,
      uniqueHashCount: uniqueHashes.size,
      topDomains,
      generatedAt: new Date().toISOString(),
      source: importedEvents > 0 ? 'contextgo-collect+connector-import' : 'contextgo-collect',
    };

    const summaries = await this.readSummaries();
    const withoutExistingDate = summaries.filter((item) => item.summaryDate !== summaryDate);
    await this.writeSummaries([summary, ...withoutExistingDate]);

    return {
      summary,
      importedEvents,
      eventCount: events.length,
      summaryCount: withoutExistingDate.length + 1,
    };
  }

  async getStoreDir(): Promise<string> {
    return this.getBaseDir();
  }
}
