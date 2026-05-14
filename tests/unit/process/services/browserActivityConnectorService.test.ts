/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContextEngineService,
  createInMemoryContextEngineDependencies,
} from '../../../../packages/context-engine/src/index';
import type { BrowserActivityEntry } from '../../../../src/common/types/connectors/browserActivity';
import { BrowserActivityConnectorService } from '../../../../src/process/services/space/browser/activity/BrowserActivityConnectorService';

const BASE_ENTRY: BrowserActivityEntry = {
  id: 'entry-1',
  spaceId: 'space-1',
  sessionId: 'thread-1',
  url: 'https://example.com/articles/contextgo',
  title: 'ContextGo Browser Activity',
  excerpt: 'Captured page summary',
  domain: 'example.com',
  visitedAt: '2026-04-10T08:00:00.000Z',
  source: 'manual-import',
  tags: ['workspace:alpha'],
};

describe('ContextEngineService ingestion lifecycle', () => {
  it('returns explicit lifecycle state for raw input with a persisted snapshot', async () => {
    const service = new ContextEngineService(createInMemoryContextEngineDependencies());

    const result = await service.ingestSource({
      spaceId: 'space-1',
      kind: 'web-clip',
      title: 'RFC Notes',
      rawContentRef: 'file:///tmp/rfc-notes.md',
      tokenCountEstimate: 120,
    });

    expect(result.lifecycle).toEqual({
      sourceRegistered: true,
      snapshotPersisted: true,
      chunksPrepared: false,
      indexReady: false,
    });
    expect(result.snapshot?.storageUri).toBe('file:///tmp/rfc-notes.md');
  });

  it('marks downstream indexing phases as incomplete when only the source is registered', async () => {
    const service = new ContextEngineService(createInMemoryContextEngineDependencies());

    const result = await service.ingestSource({
      spaceId: 'space-1',
      kind: 'manual-note',
      title: 'Scratchpad',
    });

    expect(result.lifecycle).toEqual({
      sourceRegistered: true,
      snapshotPersisted: false,
      chunksPrepared: false,
      indexReady: false,
    });
    expect(result.snapshot).toBeUndefined();
  });
});

describe('BrowserActivityConnectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ingests browser activity into the context engine and emits a connector source event', async () => {
    const storeService = {
      createEntry: vi.fn(() => BASE_ENTRY),
      save: vi.fn(async (entry: BrowserActivityEntry) => entry),
      listBySpace: vi.fn(async () => [BASE_ENTRY]),
      getStatus: vi.fn(async () => ({ eventCount: 1, latestDomain: 'example.com' })),
    };
    const contextService = {
      ingestSource: vi.fn(async () => ({
        source: { id: 'source-1' },
        lifecycle: {
          sourceRegistered: true,
          snapshotPersisted: false,
          chunksPrepared: false,
          indexReady: false,
        },
      })),
      indexTextDocument: vi.fn(async () => ({
        snapshot: { id: 'doc-1' },
        chunks: [{ id: 'chunk-1' }, { id: 'chunk-2' }],
      })),
    };
    const eventBus = {
      emit: vi.fn(async () => undefined),
    };

    const service = new BrowserActivityConnectorService(
      storeService as never,
      contextService as never,
      eventBus as never
    );

    const result = await service.ingest({
      spaceId: 'space-1',
      sessionId: 'thread-1',
      url: BASE_ENTRY.url,
      title: BASE_ENTRY.title,
      excerpt: BASE_ENTRY.excerpt,
      source: 'manual-import',
      tags: ['workspace:alpha'],
    });

    expect(storeService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-1',
        sessionId: 'thread-1',
        url: BASE_ENTRY.url,
      })
    );
    expect(contextService.ingestSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: expect.stringMatching(/^browser-source-/),
        artifactId: expect.stringMatching(/^browser-artifact-/),
        spaceId: 'space-1',
        threadId: 'thread-1',
        kind: 'web-clip',
        title: BASE_ENTRY.title,
        canonicalUri: BASE_ENTRY.url,
        createdAt: BASE_ENTRY.visitedAt,
      })
    );
    expect(contextService.indexTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: expect.stringMatching(/^browser-document-/),
        spaceId: 'space-1',
        sourceId: 'source-1',
        content: BASE_ENTRY.excerpt,
        tier: 'source',
        title: BASE_ENTRY.title,
        storageUri: BASE_ENTRY.url,
        vectorMetadata: expect.objectContaining({
          connectorId: 'contextgo-browser-extension',
          domain: 'example.com',
          source: 'manual-import',
        }),
      })
    );
    expect(storeService.save).toHaveBeenCalledWith(BASE_ENTRY);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'connector.source.ingested',
      expect.objectContaining({
        spaceId: 'space-1',
        threadId: 'thread-1',
        connectorId: 'contextgo-browser-extension',
        sourceRecordId: 'source-1',
        canonicalUri: BASE_ENTRY.url,
        title: BASE_ENTRY.title,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        entry: BASE_ENTRY,
        sourceId: 'source-1',
        documentId: expect.stringMatching(/^browser-document-/),
        chunkCount: 2,
      })
    );
  });

  it('stops immediately when browser activity normalization fails', async () => {
    const storeService = {
      createEntry: vi.fn(() => {
        throw new Error('Invalid URL');
      }),
      save: vi.fn(),
      listBySpace: vi.fn(),
      getStatus: vi.fn(),
    };
    const contextService = {
      ingestSource: vi.fn(),
      indexTextDocument: vi.fn(),
    };
    const eventBus = {
      emit: vi.fn(),
    };

    const service = new BrowserActivityConnectorService(
      storeService as never,
      contextService as never,
      eventBus as never
    );

    await expect(
      service.ingest({
        spaceId: 'space-1',
        url: 'not-a-url',
        title: 'Broken',
      })
    ).rejects.toThrow('Invalid URL');

    expect(contextService.ingestSource).not.toHaveBeenCalled();
    expect(contextService.indexTextDocument).not.toHaveBeenCalled();
    expect(storeService.save).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
