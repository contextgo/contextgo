/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/services/database';
import type {
  ChunkStore,
  ContextEngineDependencies,
  ContextSourceStore,
  DocumentSnapshotStore,
  MemoryCandidateStore,
  MemoryStore,
  OperationLogStore,
  ProfileStore,
} from '../../../../../packages/context-engine/src/contracts';
import { DEFAULT_COMPACTION_POLICY } from '../../../../../packages/context-engine/src/compaction';
import { DEFAULT_FORGETTING_POLICY } from '../../../../../packages/context-engine/src/forgetting';
import { DEFAULT_PROMOTION_POLICY } from '../../../../../packages/context-engine/src/promotion';
import type { VectorIndexProvider } from '../../../../../packages/context-engine/src/vectorIndex';

class SqliteContextSourceStore implements ContextSourceStore {
  async getById(id: string) {
    const result = (await getDatabase()).getContextSource(id);
    return result.success ? (result.data ?? null) : null;
  }

  async listBySpace(spaceId: string) {
    const result = (await getDatabase()).listContextSourcesBySpace(spaceId);
    return result.success ? (result.data ?? []) : [];
  }

  async upsert(source: Parameters<ContextSourceStore['upsert']>[0]) {
    const result = (await getDatabase()).upsertContextSource(source);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to upsert context source');
    }
  }
}

class SqliteDocumentSnapshotStore implements DocumentSnapshotStore {
  async getById(id: string) {
    const result = (await getDatabase()).getContextDocument(id);
    return result.success ? (result.data ?? null) : null;
  }

  async listBySpace(spaceId: string) {
    const result = (await getDatabase()).listContextDocumentsBySpace(spaceId);
    return result.success ? (result.data ?? []) : [];
  }

  async save(snapshot: Parameters<DocumentSnapshotStore['save']>[0]) {
    const result = (await getDatabase()).saveContextDocument(snapshot);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save context document');
    }
  }
}

class SqliteChunkStore implements ChunkStore {
  async listByDocument(documentId: string) {
    const result = (await getDatabase()).listContextChunksByDocument(documentId);
    return result.success ? (result.data ?? []) : [];
  }

  async saveMany(chunks: Parameters<ChunkStore['saveMany']>[0]) {
    const result = (await getDatabase()).saveContextChunks(chunks);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save context chunks');
    }
  }
}

class SqliteMemoryStore implements MemoryStore {
  async getById(id: string) {
    const result = (await getDatabase()).getContextMemory(id);
    return result.success ? (result.data ?? null) : null;
  }

  async listBySpace(spaceId: string) {
    const result = (await getDatabase()).listContextMemoriesBySpace(spaceId);
    return result.success ? (result.data ?? []) : [];
  }

  async save(memory: Parameters<MemoryStore['save']>[0]) {
    const result = (await getDatabase()).saveContextMemory(memory);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save context memory');
    }
  }
}

class SqliteMemoryCandidateStore implements MemoryCandidateStore {
  async getById(id: string) {
    const result = (await getDatabase()).getContextMemoryCandidate(id);
    return result.success ? (result.data ?? null) : null;
  }

  async listBySpace(spaceId: string) {
    const result = (await getDatabase()).listContextMemoryCandidatesBySpace(spaceId);
    return result.success ? (result.data ?? []) : [];
  }

  async save(candidate: Parameters<MemoryCandidateStore['save']>[0]) {
    const result = (await getDatabase()).saveContextMemoryCandidate(candidate);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save context memory candidate');
    }
  }
}

class SqliteProfileStore implements ProfileStore {
  async getById(id: string) {
    const result = (await getDatabase()).getContextProfile(id);
    return result.success ? (result.data ?? null) : null;
  }

  async listBySpace(spaceId: string) {
    const result = (await getDatabase()).listContextProfilesBySpace(spaceId);
    return result.success ? (result.data ?? []) : [];
  }

  async save(profile: Parameters<ProfileStore['save']>[0]) {
    const result = (await getDatabase()).saveContextProfile(profile);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save context profile');
    }
  }
}

class SqliteOperationLogStore implements OperationLogStore {
  async append(operation: Parameters<OperationLogStore['append']>[0]) {
    const result = (await getDatabase()).appendContextOperation(operation);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to append context operation');
    }
  }

  async listSince(spaceId: string, cursor?: Parameters<OperationLogStore['listSince']>[1]) {
    const result = (await getDatabase()).listContextOperations(spaceId, cursor);
    return result.success ? (result.data ?? []) : [];
  }

  async getLatestCursor(spaceId: string) {
    const result = (await getDatabase()).getLatestContextOperationCursor(spaceId);
    return result.success ? (result.data ?? null) : null;
  }
}

export function createSqliteContextEngineDependencies(
  overrides?: Partial<ContextEngineDependencies['policies']> & { vectorIndex?: VectorIndexProvider }
): ContextEngineDependencies {
  return {
    sources: new SqliteContextSourceStore(),
    documents: new SqliteDocumentSnapshotStore(),
    chunks: new SqliteChunkStore(),
    memories: new SqliteMemoryStore(),
    candidates: new SqliteMemoryCandidateStore(),
    profiles: new SqliteProfileStore(),
    operations: new SqliteOperationLogStore(),
    policies: {
      promotion: overrides?.promotion ?? DEFAULT_PROMOTION_POLICY,
      compaction: overrides?.compaction ?? DEFAULT_COMPACTION_POLICY,
      forgetting: overrides?.forgetting ?? DEFAULT_FORGETTING_POLICY,
    },
    vectorIndex: overrides?.vectorIndex,
  };
}
