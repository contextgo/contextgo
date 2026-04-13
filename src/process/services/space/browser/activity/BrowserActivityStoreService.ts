/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  BrowserActivityConnectorStatus,
  BrowserActivityEntry,
  BrowserActivityIngestInput,
} from '@/common/types/connectors/browserActivity';

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

type BrowserActivityStoreBaseDirResolver = () => Promise<string>;

const defaultBaseDirResolver: BrowserActivityStoreBaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const baseDir = path.join(getDataPath(), 'store', 'connectors', 'browser-activity');
  ensureDirectory(baseDir);
  return baseDir;
};

function normalizeUrl(input: string): string {
  const normalized = input.trim();
  const url = new URL(normalized);
  url.hash = '';
  return url.toString();
}

function normalizeTitle(input: string, url: string): string {
  const title = input.trim();
  return title || url;
}

function deriveDomain(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function normalizeVisitedAt(value?: string): string {
  const fallback = new Date().toISOString();
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function buildEntryId(spaceId: string, url: string, visitedAt: string): string {
  return createHash('sha256').update([spaceId, url, visitedAt].join('|')).digest('hex');
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

export class BrowserActivityStoreService {
  constructor(private readonly resolveBaseDir: BrowserActivityStoreBaseDirResolver = defaultBaseDirResolver) {}

  private async getBaseDir(): Promise<string> {
    return this.resolveBaseDir();
  }

  private async getEventsPath(): Promise<string> {
    return path.join(await this.getBaseDir(), 'events.json');
  }

  private async readEvents(): Promise<BrowserActivityEntry[]> {
    return parseJsonFile<BrowserActivityEntry>(await this.getEventsPath());
  }

  private async writeEvents(events: readonly BrowserActivityEntry[]): Promise<void> {
    const sorted = [...events].toSorted((left, right) => right.visitedAt.localeCompare(left.visitedAt));
    await writeJsonFile(await this.getEventsPath(), sorted);
  }

  createEntry(input: BrowserActivityIngestInput): BrowserActivityEntry {
    const normalizedSpaceId = input.spaceId.trim();
    if (!normalizedSpaceId) {
      throw new Error('Space ID is required.');
    }

    const url = normalizeUrl(input.url);
    const visitedAt = normalizeVisitedAt(input.visitedAt);
    return {
      id: buildEntryId(normalizedSpaceId, url, visitedAt),
      spaceId: normalizedSpaceId,
      sessionId: input.sessionId?.trim() || undefined,
      url,
      title: normalizeTitle(input.title, url),
      textContent: input.textContent?.trim() || undefined,
      excerpt: input.excerpt?.trim() || undefined,
      domain: deriveDomain(url),
      visitedAt,
      source: input.source ?? 'browser-extension',
      tags: normalizeTags(input.tags),
      metadata: input.metadata,
    };
  }

  async save(entry: BrowserActivityEntry): Promise<BrowserActivityEntry> {
    const events = await this.readEvents();
    const withoutExisting = events.filter((item) => item.id !== entry.id);
    await this.writeEvents([entry, ...withoutExisting]);
    return entry;
  }

  async listBySpace(spaceId: string, limit = 20): Promise<BrowserActivityEntry[]> {
    const events = await this.readEvents();
    return events.filter((entry) => entry.spaceId === spaceId.trim()).slice(0, Math.max(1, limit));
  }

  async getStatus(spaceId: string): Promise<BrowserActivityConnectorStatus> {
    const events = await this.listBySpace(spaceId, Number.MAX_SAFE_INTEGER);
    const latest = events[0];
    return {
      eventCount: events.length,
      latestVisitedAt: latest?.visitedAt,
      latestDomain: latest?.domain,
      latestTitle: latest?.title,
    };
  }
}
