/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';

import type {
  BrowserActivityEntry,
  BrowserActivityIngestInput,
  BrowserActivityIngestResult,
} from '@/common/types/connectors/browserActivity';
import type { ContextServiceImpl } from '@process/services/context/ContextServiceImpl';
import type { ConnectorSource } from '@process/services/context/contextDomain';
import type { ContextEventBus } from '@process/services/context/events/ContextEventBus';

import { BrowserActivityStoreService } from './BrowserActivityStoreService';

type SupportedContextService = Pick<ContextServiceImpl, 'ingestSource' | 'indexTextDocument'>;
type SupportedEventBus = Pick<ContextEventBus, 'emit'>;

const CONNECTOR_ID = 'contextgo-browser-extension';

function createStableId(prefix: string, spaceId: string, canonicalUri: string): string {
  return [prefix, createHash('sha256').update([spaceId, canonicalUri].join('|')).digest('hex')].join('-');
}

function buildChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildSummary(entry: BrowserActivityEntry): string {
  return `Captured browser activity from ${entry.domain}: ${entry.title}`;
}

function buildTags(entry: BrowserActivityEntry): string[] {
  return [
    'connector:browser-extension',
    `connector:${CONNECTOR_ID}`,
    `domain:${entry.domain}`,
    ...entry.tags,
  ].filter((tag, index, list) => list.indexOf(tag) === index);
}

export class BrowserActivityConnectorService {
  constructor(
    private readonly storeService: BrowserActivityStoreService,
    private readonly contextService: SupportedContextService,
    private readonly eventBus: SupportedEventBus
  ) {}

  async ingest(input: BrowserActivityIngestInput): Promise<BrowserActivityIngestResult> {
    const entry = this.storeService.createEntry(input);
    const canonicalUri = entry.url;
    const content = entry.textContent || entry.excerpt || entry.title;
    const checksum = buildChecksum(canonicalUri + '\n' + content);
    const sourceStableId = createStableId('browser-source', entry.spaceId, canonicalUri);
    const artifactId = createStableId('browser-artifact', entry.spaceId, canonicalUri);
    const documentId = createStableId('browser-document', entry.spaceId, canonicalUri);
    const tags = buildTags(entry);

    const sourceResult = await this.contextService.ingestSource({
      sourceId: sourceStableId,
      spaceId: entry.spaceId,
      threadId: entry.sessionId,
      artifactId,
      kind: 'web-clip',
      title: entry.title,
      canonicalUri,
      checksum,
      tags,
      createdAt: entry.visitedAt,
    });

    let chunkCount = 0;
    if (content.trim()) {
      const indexed = await this.contextService.indexTextDocument({
        documentId,
        spaceId: entry.spaceId,
        sourceId: sourceResult.source.id,
        content,
        tier: 'source',
        threadId: entry.sessionId,
        title: entry.title,
        storageUri: canonicalUri,
        checksum,
        mimeType: 'text/plain',
        chunking: {
          targetTokens: 180,
          overlapTokens: 24,
          minTokens: 24,
        },
        vectorMetadata: {
          connectorId: CONNECTOR_ID,
          domain: entry.domain,
          source: entry.source,
        },
      });
      chunkCount = indexed.chunks.length;
    }

    await this.storeService.save(entry);

    const connectorSource: ConnectorSource = {
      connectorId: CONNECTOR_ID,
      kind: 'web-resource',
      canonicalUri,
      title: entry.title,
      spaceId: entry.spaceId,
      threadId: entry.sessionId,
      updatedAt: entry.visitedAt,
      tags,
      metadata: {
        domain: entry.domain,
        source: entry.source,
        chunkCount,
      },
    };

    await this.eventBus.emit('connector.source.ingested', {
      spaceId: entry.spaceId,
      threadId: entry.sessionId,
      connectorId: CONNECTOR_ID,
      source: connectorSource,
      sourceRecordId: sourceResult.source.id,
      title: entry.title,
      canonicalUri,
      ingestedAt: entry.visitedAt,
      summary: buildSummary(entry),
    });

    return {
      entry,
      sourceId: sourceResult.source.id,
      documentId,
      chunkCount,
    };
  }

  async listRecent(spaceId: string, limit = 20): Promise<BrowserActivityEntry[]> {
    return this.storeService.listBySpace(spaceId, limit);
  }

  async getStatus(spaceId: string) {
    return this.storeService.getStatus(spaceId);
  }
}
