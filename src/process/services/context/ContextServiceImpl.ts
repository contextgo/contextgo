/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ContextEngineService,
  type ChunkRecord,
  type ContextEngineDependencies,
  type DocumentSnapshot,
  type MemoryCandidateEntry,
  type MemoryEntry,
  type ProfileSegment,
  type SourceRecord,
} from '../../../../packages/context-engine/src/index';
import type { ContextTier } from '../../../../packages/context-engine/src/domain';
import type { ContextOperation, ContextOperationType } from '../../../../packages/context-engine/src/operations';
import type { VectorIndexDocument } from '../../../../packages/context-engine/src/vectorIndex';
import { createSqliteContextEngineDependencies } from '../database/context/SqliteContextStores';
import { TextChunkingService, type TextChunkingConfig } from './TextChunkingService';

const ISO_NOW = (): string => new Date().toISOString();

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function estimateTokenCount(text: string | undefined): number {
  if (!text) {
    return 0;
  }
  const normalized = text.trim();
  return normalized ? Math.max(1, Math.ceil(normalized.length / 4)) : 0;
}

export class ContextServiceImpl extends ContextEngineService {
  private readonly textChunkingService: TextChunkingService;

  constructor(
    dependencies: ContextEngineDependencies = createSqliteContextEngineDependencies(),
    textChunkingService: TextChunkingService = new TextChunkingService()
  ) {
    super(dependencies);
    this.textChunkingService = textChunkingService;
  }

  async appendOperation(operation: ContextOperation): Promise<void> {
    await this.provider.operations.append(operation);
  }

  async appendSystemOperation(params: {
    spaceId: string;
    threadId?: string;
    type: ContextOperationType;
    entityId: string;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.appendOperation({
      id: createId('op'),
      spaceId: params.spaceId,
      threadId: params.threadId,
      actor: {
        kind: 'system',
        id: 'contextgo-runtime',
      },
      type: params.type,
      entityId: params.entityId,
      payload: params.payload,
      createdAt: ISO_NOW(),
    });
  }

  async saveMemory(
    memory: MemoryEntry,
    options?: { operationType?: ContextOperationType; threadId?: string }
  ): Promise<void> {
    await this.provider.memories.save(memory);
    await this.indexMemory(memory, options?.threadId);

    if (options?.operationType) {
      await this.appendSystemOperation({
        spaceId: memory.spaceId,
        threadId: options.threadId,
        type: options.operationType,
        entityId: memory.id,
        payload: {
          kind: memory.kind,
          summary: memory.summary,
          state: memory.state,
          confidence: memory.confidence,
          tier: memory.tier,
        },
      });
    }
  }

  async saveMemoryCandidate(
    candidate: MemoryCandidateEntry,
    options?: { operationType?: ContextOperationType; threadId?: string }
  ): Promise<void> {
    await this.provider.candidates.save(candidate);

    if (options?.operationType) {
      await this.appendSystemOperation({
        spaceId: candidate.spaceId,
        threadId: options.threadId ?? candidate.threadId,
        type: options.operationType,
        entityId: candidate.id,
        payload: {
          kind: candidate.kind,
          summary: candidate.summary,
          state: candidate.state,
          reviewStatus: candidate.reviewStatus,
          promotionScore: candidate.promotionScore,
          destination: candidate.destination,
        },
      });
    }
  }

  async saveProfile(
    profile: ProfileSegment,
    options?: { operationType?: ContextOperationType; threadId?: string }
  ): Promise<void> {
    await this.provider.profiles.save(profile);

    if (options?.operationType) {
      await this.appendSystemOperation({
        spaceId: profile.spaceId,
        threadId: options.threadId,
        type: options.operationType,
        entityId: profile.id,
        payload: {
          key: profile.key,
          summary: profile.summary,
          state: profile.state,
          confidence: profile.confidence,
          memoryCount: profile.memoryIds.length,
        },
      });
    }
  }

  async listProfiles(input: {
    spaceId: string;
    keyPrefix?: string;
    state?: ProfileSegment['state'];
  }): Promise<ProfileSegment[]> {
    const profiles = await this.provider.profiles.listBySpace(input.spaceId);
    return profiles.filter((profile) => {
      if (input.keyPrefix && !profile.key.startsWith(input.keyPrefix)) {
        return false;
      }
      if (input.state && profile.state !== input.state) {
        return false;
      }
      return true;
    });
  }

  async listMemoryCandidates(input: {
    spaceId: string;
    threadId?: string;
    state?: MemoryCandidateEntry['state'];
    reviewStatus?: MemoryCandidateEntry['reviewStatus'];
  }): Promise<MemoryCandidateEntry[]> {
    const candidates = await this.provider.candidates.listBySpace(input.spaceId);
    return candidates.filter((candidate) => {
      if (input.threadId && candidate.threadId !== input.threadId) {
        return false;
      }
      if (input.state && candidate.state !== input.state) {
        return false;
      }
      if (input.reviewStatus && candidate.reviewStatus !== input.reviewStatus) {
        return false;
      }
      return true;
    });
  }

  async approveMemoryCandidate(
    candidateId: string,
    reviewerId = 'human-reviewer'
  ): Promise<MemoryCandidateEntry | undefined> {
    const candidate = await this.provider.candidates.getById(candidateId);
    if (!candidate) {
      return undefined;
    }

    const now = ISO_NOW();
    if (candidate.destination === 'memory') {
      const memory: MemoryEntry = {
        id: createId('memory'),
        spaceId: candidate.spaceId,
        kind: candidate.kind,
        summary: candidate.summary,
        detail: candidate.detail,
        sourceIds: candidate.sourceIds,
        chunkIds: candidate.chunkIds,
        confidence: candidate.confidence,
        tier: candidate.tier,
        priority: candidate.priority,
        state: 'accepted',
        createdAt: now,
        updatedAt: now,
      };
      await this.saveMemory(memory, {
        operationType: 'memory.promoted',
        threadId: candidate.threadId,
      });
      const promotedCandidate: MemoryCandidateEntry = {
        ...candidate,
        state: 'promoted',
        reviewStatus: 'approved',
        promotedMemoryId: memory.id,
        reviewedAt: now,
        reviewedBy: reviewerId,
        updatedAt: now,
      };
      await this.saveMemoryCandidate(promotedCandidate, {
        operationType: 'memory.candidate_approved',
        threadId: candidate.threadId,
      });
      return promotedCandidate;
    }

    const approvedCandidate: MemoryCandidateEntry = {
      ...candidate,
      state: 'approved',
      reviewStatus: 'approved',
      reviewedAt: now,
      reviewedBy: reviewerId,
      updatedAt: now,
    };
    await this.saveMemoryCandidate(approvedCandidate, {
      operationType: 'memory.candidate_approved',
      threadId: candidate.threadId,
    });
    return approvedCandidate;
  }

  async promoteMemoryCandidateToDestination(
    candidateId: string,
    destination: MemoryCandidateEntry['destination'],
    reviewerId = 'human-reviewer'
  ): Promise<MemoryCandidateEntry | undefined> {
    const candidate = await this.provider.candidates.getById(candidateId);
    if (!candidate) {
      return undefined;
    }

    if (destination === 'memory') {
      return this.approveMemoryCandidate(candidateId, reviewerId);
    }

    const now = ISO_NOW();
    const promotedCandidate: MemoryCandidateEntry = {
      ...candidate,
      destination,
      state: 'approved',
      reviewStatus: 'approved',
      reviewedAt: now,
      reviewedBy: reviewerId,
      updatedAt: now,
    };

    await this.saveMemoryCandidate(promotedCandidate, {
      operationType: 'memory.candidate_approved',
      threadId: candidate.threadId,
    });

    return promotedCandidate;
  }

  async rejectMemoryCandidate(
    candidateId: string,
    reviewerId = 'human-reviewer'
  ): Promise<MemoryCandidateEntry | undefined> {
    const candidate = await this.provider.candidates.getById(candidateId);
    if (!candidate) {
      return undefined;
    }

    const rejectedCandidate: MemoryCandidateEntry = {
      ...candidate,
      state: 'rejected',
      reviewStatus: 'rejected',
      reviewedAt: ISO_NOW(),
      reviewedBy: reviewerId,
      updatedAt: ISO_NOW(),
    };
    await this.saveMemoryCandidate(rejectedCandidate, {
      operationType: 'memory.candidate_rejected',
      threadId: candidate.threadId,
    });
    return rejectedCandidate;
  }

  async saveChunks(chunks: readonly ChunkRecord[]): Promise<void> {
    await this.saveChunksWithMetadata(chunks);
  }

  async saveChunksWithMetadata(
    chunks: readonly ChunkRecord[],
    options?: {
      threadId?: string;
      metadata?: Readonly<Record<string, string | number | boolean>>;
    }
  ): Promise<void> {
    await this.provider.chunks.saveMany(chunks);
    if (this.provider.vectorIndex && chunks.length > 0) {
      const documents: VectorIndexDocument[] = chunks.map((chunk) => ({
        id: `chunk-${chunk.id}`,
        entityId: chunk.id,
        kind: 'chunk',
        spaceId: chunk.spaceId,
        threadId: options?.threadId,
        tier: chunk.tier,
        text: chunk.text,
        metadata: options?.metadata,
      }));
      await this.provider.vectorIndex.upsert(documents);
    }
  }

  async indexTextDocument(input: {
    spaceId: string;
    sourceId: string;
    content: string;
    tier: ContextTier;
    threadId?: string;
    title?: string;
    storageUri?: string;
    mimeType?: string;
    documentId?: string;
    checksum?: string;
    chunking?: TextChunkingConfig;
    vectorMetadata?: Readonly<Record<string, string | number | boolean>>;
  }): Promise<{ snapshot: DocumentSnapshot; chunks: readonly ChunkRecord[] }> {
    const documentId = input.documentId ?? createId('doc');
    const existingChunks = await this.provider.chunks.listByDocument(documentId);
    if (this.provider.vectorIndex && existingChunks.length > 0) {
      await this.provider.vectorIndex.deleteByEntityIds(existingChunks.map((chunk) => chunk.id));
    }
    await this.provider.chunks.deleteByDocument(documentId);

    const snapshot: DocumentSnapshot = {
      id: documentId,
      spaceId: input.spaceId,
      sourceId: input.sourceId,
      mimeType: input.mimeType ?? 'text/plain',
      storageUri: input.storageUri ?? `contextgo://source/${input.sourceId}`,
      title: input.title,
      checksum: input.checksum ?? createId('checksum'),
      tokenCount: estimateTokenCount(input.content),
      status: 'active',
      createdAt: ISO_NOW(),
    };
    await this.provider.documents.save(snapshot);

    const chunks = this.textChunkingService.buildChunks({
      spaceId: input.spaceId,
      documentId: snapshot.id,
      content: input.content,
      tier: input.tier,
      config: input.chunking,
    });
    await this.saveChunksWithMetadata(chunks, {
      threadId: input.threadId,
      metadata: input.vectorMetadata,
    });

    await this.appendSystemOperation({
      spaceId: input.spaceId,
      threadId: input.threadId,
      type: 'chunk.indexed',
      entityId: snapshot.id,
      payload: {
        sourceId: input.sourceId,
        chunkCount: chunks.length,
        tier: input.tier,
      },
    });

    return {
      snapshot,
      chunks,
    };
  }

  async listSources(spaceId: string): Promise<SourceRecord[]> {
    const sources = await this.provider.sources.listBySpace(spaceId);
    return [...sources];
  }

  async archiveSource(sourceId: string, threadId?: string): Promise<void> {
    const source = await this.provider.sources.getById(sourceId);
    if (!source || source.status === 'archived') {
      return;
    }

    const archivedSource: SourceRecord = {
      ...source,
      status: 'archived',
      updatedAt: ISO_NOW(),
    };
    await this.provider.sources.upsert(archivedSource);
    await this.appendSystemOperation({
      spaceId: source.spaceId,
      threadId,
      type: 'source.ingested',
      entityId: source.id,
      payload: {
        archived: true,
        canonicalUri: source.canonicalUri,
        artifactId: source.artifactId,
      },
    });
  }

  private async indexMemory(memory: MemoryEntry, threadId?: string): Promise<void> {
    if (!this.provider.vectorIndex) {
      return;
    }

    const document: VectorIndexDocument = {
      id: `memory-${memory.id}`,
      entityId: memory.id,
      kind: 'memory',
      spaceId: memory.spaceId,
      threadId,
      tier: memory.tier,
      text: memory.detail ? `${memory.summary}\n${memory.detail}` : memory.summary,
      metadata: {
        kind: memory.kind,
        priority: memory.priority,
        state: memory.state,
      },
    };

    await this.provider.vectorIndex.upsert([document]);
  }
}
