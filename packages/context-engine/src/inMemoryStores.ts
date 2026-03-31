/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_COMPACTION_POLICY } from './compaction';
import { DEFAULT_FORGETTING_POLICY } from './forgetting';
import { DEFAULT_PROMOTION_POLICY } from './promotion';
import type {
  ChunkRecord,
  DocumentSnapshot,
  MemoryCandidateEntry,
  MemoryEntry,
  ProfileSegment,
  SourceRecord,
} from './domain';
import type { ContextEngineDependencies } from './contracts';
import type { ContextOperation } from './operations';
import { InMemoryVectorIndexProvider, type VectorIndexProvider } from './vectorIndex';

function sortByCreatedAt<T extends { createdAt: string }>(items: Iterable<T>): T[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function createInMemoryContextEngineDependencies(
  seed?: Partial<{
    sources: readonly SourceRecord[];
    documents: readonly DocumentSnapshot[];
    chunks: readonly ChunkRecord[];
    memories: readonly MemoryEntry[];
    candidates: readonly MemoryCandidateEntry[];
    profiles: readonly ProfileSegment[];
    operations: readonly ContextOperation[];
    vectorIndex: VectorIndexProvider;
  }>
): ContextEngineDependencies {
  const sources = new Map((seed?.sources ?? []).map((item) => [item.id, item]));
  const documents = new Map((seed?.documents ?? []).map((item) => [item.id, item]));
  const chunks = new Map((seed?.chunks ?? []).map((item) => [item.id, item]));
  const memories = new Map((seed?.memories ?? []).map((item) => [item.id, item]));
  const candidates = new Map((seed?.candidates ?? []).map((item) => [item.id, item]));
  const profiles = new Map((seed?.profiles ?? []).map((item) => [item.id, item]));
  const operations: ContextOperation[] = [...(seed?.operations ?? [])];

  return {
    sources: {
      async getById(id) {
        return sources.get(id) ?? null;
      },
      async listBySpace(spaceId) {
        return sortByCreatedAt([...sources.values()].filter((item) => item.spaceId === spaceId));
      },
      async upsert(source) {
        sources.set(source.id, source);
      },
    },
    documents: {
      async getById(id) {
        return documents.get(id) ?? null;
      },
      async listBySpace(spaceId) {
        return sortByCreatedAt([...documents.values()].filter((item) => item.spaceId === spaceId));
      },
      async save(snapshot) {
        documents.set(snapshot.id, snapshot);
      },
    },
    chunks: {
      async listByDocument(documentId) {
        return [...chunks.values()]
          .filter((item) => item.documentId === documentId)
          .sort((left, right) => left.sequence - right.sequence);
      },
      async saveMany(items) {
        for (const item of items) {
          chunks.set(item.id, item);
        }
      },
    },
    memories: {
      async getById(id) {
        return memories.get(id) ?? null;
      },
      async listBySpace(spaceId) {
        return sortByCreatedAt([...memories.values()].filter((item) => item.spaceId === spaceId));
      },
      async save(memory) {
        memories.set(memory.id, memory);
      },
    },
    candidates: {
      async getById(id) {
        return candidates.get(id) ?? null;
      },
      async listBySpace(spaceId) {
        return sortByCreatedAt([...candidates.values()].filter((item) => item.spaceId === spaceId));
      },
      async save(candidate) {
        candidates.set(candidate.id, candidate);
      },
    },
    profiles: {
      async getById(id) {
        return profiles.get(id) ?? null;
      },
      async listBySpace(spaceId) {
        return sortByCreatedAt([...profiles.values()].filter((item) => item.spaceId === spaceId));
      },
      async save(profile) {
        profiles.set(profile.id, profile);
      },
    },
    operations: {
      async append(operation) {
        operations.push(operation);
      },
      async listSince(spaceId, cursor) {
        return operations.filter((item) => {
          if (item.spaceId !== spaceId) {
            return false;
          }
          if (!cursor) {
            return true;
          }
          return item.createdAt > cursor.createdAt || (item.createdAt === cursor.createdAt && item.id !== cursor.operationId);
        });
      },
      async getLatestCursor(spaceId) {
        const latest = operations.filter((item) => item.spaceId === spaceId).at(-1);
        if (!latest) {
          return null;
        }
        return {
          operationId: latest.id,
          createdAt: latest.createdAt,
        };
      },
    },
    policies: {
      promotion: DEFAULT_PROMOTION_POLICY,
      compaction: DEFAULT_COMPACTION_POLICY,
      forgetting: DEFAULT_FORGETTING_POLICY,
    },
    vectorIndex: seed?.vectorIndex ?? new InMemoryVectorIndexProvider(),
  };
}
