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
    await this.deps.operations.append(operation);
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

  async saveMemory(memory: MemoryEntry, options?: { operationType?: ContextOperationType; threadId?: string }): Promise<void> {
    await this.deps.memories.save(memory);
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
    await this.deps.candidates.save(candidate);

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

  async listMemoryCandidates(input: {
    spaceId: string;
    threadId?: string;
    state?: MemoryCandidateEntry['state'];
    reviewStatus?: MemoryCandidateEntry['reviewStatus'];
  }): Promise<MemoryCandidateEntry[]> {
    const candidates = await this.deps.candidates.listBySpace(input.spaceId);
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

  async approveMemoryCandidate(candidateId: string, reviewerId = 'human-reviewer'): Promise<MemoryCandidateEntry | undefined> {
    const candidate = await this.deps.candidates.getById(candidateId);
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
    const candidate = await this.deps.candidates.getById(candidateId);
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

  async rejectMemoryCandidate(candidateId: string, reviewerId = 'human-reviewer'): Promise<MemoryCandidateEntry | undefined> {
    const candidate = await this.deps.candidates.getById(candidateId);
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
    await this.deps.chunks.saveMany(chunks);
    if (this.deps.vectorIndex && chunks.length > 0) {
      const documents: VectorIndexDocument[] = chunks.map((chunk) => ({
        id: `chunk-${chunk.id}`,
        entityId: chunk.id,
        kind: 'chunk',
        spaceId: chunk.spaceId,
        tier: chunk.tier,
        text: chunk.text,
      }));
      await this.deps.vectorIndex.upsert(documents);
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
    chunking?: TextChunkingConfig;
  }): Promise<{ snapshot: DocumentSnapshot; chunks: readonly ChunkRecord[] }> {
    const snapshot: DocumentSnapshot = {
      id: createId('doc'),
      spaceId: input.spaceId,
      sourceId: input.sourceId,
      mimeType: input.mimeType ?? 'text/plain',
      storageUri: input.storageUri ?? `contextgo://source/${input.sourceId}`,
      title: input.title,
      checksum: createId('checksum'),
      tokenCount: estimateTokenCount(input.content),
      status: 'active',
      createdAt: ISO_NOW(),
    };
    await this.deps.documents.save(snapshot);

    const chunks = this.textChunkingService.buildChunks({
      spaceId: input.spaceId,
      documentId: snapshot.id,
      content: input.content,
      tier: input.tier,
      config: input.chunking,
    });
    await this.saveChunks(chunks);

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

  private async indexMemory(memory: MemoryEntry, threadId?: string): Promise<void> {
    if (!this.deps.vectorIndex) {
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

    await this.deps.vectorIndex.upsert([document]);
  }
}
