/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChunkId, MemoryEntryId, SpaceId, ThreadId } from './domain';

export type VectorIndexEntityKind = 'chunk' | 'memory';

export type VectorIndexTier = 'working' | 'experiential' | 'factual' | 'source';

export type VectorIndexDocument = {
  id: string;
  entityId: ChunkId | MemoryEntryId;
  kind: VectorIndexEntityKind;
  spaceId: SpaceId;
  threadId?: ThreadId;
  tier: VectorIndexTier;
  text: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type VectorSearchInput = {
  spaceId: SpaceId;
  query: string;
  topK: number;
  kinds?: readonly VectorIndexEntityKind[];
  tiers?: readonly VectorIndexTier[];
  threadId?: ThreadId;
};

export type VectorSearchHit = {
  id: string;
  entityId: string;
  kind: VectorIndexEntityKind;
  score: number;
  tier: VectorIndexTier;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export interface VectorIndexProvider {
  upsert(documents: readonly VectorIndexDocument[]): Promise<void>;
  deleteByEntityIds(entityIds: readonly string[]): Promise<void>;
  search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]>;
}

function normalizeTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function lexicalSimilarity(query: string, text: string): number {
  const queryTerms = normalizeTerms(query);
  if (queryTerms.length === 0) {
    return 0;
  }

  const haystack = text.toLowerCase();
  const matched = queryTerms.filter((term) => haystack.includes(term));
  return matched.length / queryTerms.length;
}

export class InMemoryVectorIndexProvider implements VectorIndexProvider {
  private readonly documents = new Map<string, VectorIndexDocument>();

  async upsert(documents: readonly VectorIndexDocument[]): Promise<void> {
    for (const document of documents) {
      this.documents.set(document.id, document);
    }
  }

  async deleteByEntityIds(entityIds: readonly string[]): Promise<void> {
    const entityIdSet = new Set(entityIds);
    for (const [id, document] of this.documents.entries()) {
      if (entityIdSet.has(document.entityId)) {
        this.documents.delete(id);
      }
    }
  }

  async search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]> {
    const allowedKinds = input.kinds ? new Set(input.kinds) : null;
    const allowedTiers = input.tiers ? new Set(input.tiers) : null;

    return [...this.documents.values()]
      .filter((document) => document.spaceId === input.spaceId)
      .filter((document) => (input.threadId ? !document.threadId || document.threadId === input.threadId : true))
      .filter((document) => (allowedKinds ? allowedKinds.has(document.kind) : true))
      .filter((document) => (allowedTiers ? allowedTiers.has(document.tier) : true))
      .map((document) => ({
        id: document.id,
        entityId: document.entityId,
        kind: document.kind,
        score: lexicalSimilarity(input.query, document.text),
        tier: document.tier,
        metadata: document.metadata,
      }))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.topK);
  }
}
