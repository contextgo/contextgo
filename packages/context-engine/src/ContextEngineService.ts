/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type AssembleContextPackInput,
  type AssembleContextPackResult,
  type ContextEngineDependencies,
  type EvaluateCompactionInput,
  type EvaluatePromotionInput,
  type IContextService,
  type IngestSourceInput,
  type IngestSourceResult,
  type RetrieveContextInput,
  type RetrieveContextResult,
  type RetrievedChunk,
  type RetrievedMemory,
  type AssessForgettingInput,
} from './contracts';
import { decideCompaction } from './compaction';
import { assessForgetting } from './forgetting';
import { decidePromotion } from './promotion';
import type {
  ChunkRecord,
  ContextPackSection,
  ContextPackSectionKind,
  ContextPack,
  ContextTier,
  DocumentSnapshot,
  MemoryEntry,
  SourceRecord,
} from './domain';
import type { ContextOperation, ContextOperationType } from './operations';
import type { VectorIndexTier, VectorSearchHit } from './vectorIndex';

const ISO_NOW = (): string => new Date().toISOString();

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function estimateTokenCount(text: string | undefined): number {
  if (!text) {
    return 0;
  }

  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function scoreMemoryPriority(memory: MemoryEntry): number {
  switch (memory.priority) {
    case 'critical':
      return 18;
    case 'high':
      return 12;
    case 'medium':
      return 6;
    case 'low':
    default:
      return 0;
  }
}

function scoreMemoryState(memory: MemoryEntry): number {
  switch (memory.state) {
    case 'accepted':
      return 24;
    case 'candidate':
      return 8;
    case 'superseded':
      return -12;
    case 'archived':
    case 'rejected':
      return -24;
    default:
      return 0;
  }
}

function scoreTier(tier: Exclude<ContextTier, 'source'>): number {
  switch (tier) {
    case 'working':
      return 10;
    case 'experiential':
      return 8;
    case 'factual':
    default:
      return 6;
  }
}

function scoreMemoryLexical(memory: MemoryEntry, queryTerms: readonly string[]): RetrievedMemory | null {
  if (queryTerms.length === 0) {
    return {
      memory,
      score: scoreMemoryPriority(memory) + scoreMemoryState(memory) + scoreTier(memory.tier),
      matchedBy: [],
      vectorHits: [],
    };
  }

  const haystack = `${memory.summary} ${memory.detail ?? ''}`.toLowerCase();
  const matchedBy = queryTerms.filter((term) => haystack.includes(term));
  if (matchedBy.length === 0) {
    return null;
  }

  const score =
    matchedBy.length * 15 +
    scoreMemoryPriority(memory) +
    scoreMemoryState(memory) +
    scoreTier(memory.tier) +
    Math.round(memory.confidence * 20);

  return {
    memory,
    score,
    matchedBy,
    vectorHits: [],
  };
}

function scoreChunkLexical(chunk: ChunkRecord, queryTerms: readonly string[]): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const haystack = chunk.text.toLowerCase();
  return queryTerms.filter((term) => haystack.includes(term)).length * 12;
}

function scoreProjectAffinity(metadata: Readonly<Record<string, string | number | boolean>> | undefined, projectSlug: string | undefined): number {
  if (!projectSlug || !metadata) {
    return 0;
  }

  return metadata.projectSlug === projectSlug ? 18 : 0;
}

function dedupe<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function makeOperation(
  input: IngestSourceInput,
  type: ContextOperationType,
  entityId: string,
  payload: Readonly<Record<string, unknown>>
): ContextOperation {
  return {
    id: createId('op'),
    spaceId: input.spaceId,
    threadId: input.threadId,
    actor: {
      kind: 'system',
      id: 'context-engine',
    },
    type,
    entityId,
    payload,
    createdAt: input.createdAt ?? ISO_NOW(),
  };
}

function buildSection(
  kind: ContextPackSectionKind,
  summary: string,
  priority: number,
  id = createId('section')
): ContextPackSection {
  return {
    kind,
    id,
    summary,
    priority,
    tokenCount: estimateTokenCount(summary),
  };
}

function toVectorTierSet(input: RetrieveContextInput): readonly VectorIndexTier[] {
  const tiers: VectorIndexTier[] = input.memoryTiers ? [...input.memoryTiers] : ['working', 'experiential', 'factual'];
  if (input.includeChunks) {
    tiers.push('source');
  }
  return tiers;
}

export class ContextEngineService implements IContextService {
  constructor(protected readonly deps: ContextEngineDependencies) {}

  async ingestSource(input: IngestSourceInput): Promise<IngestSourceResult> {
    const now = input.createdAt ?? ISO_NOW();
    const source: SourceRecord = {
      id: input.sourceId ?? createId('source'),
      spaceId: input.spaceId,
      threadId: input.threadId,
      artifactId: input.artifactId,
      kind: input.kind,
      title: input.title,
      canonicalUri: input.canonicalUri,
      checksum: input.checksum,
      tags: input.tags ?? [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.deps.sources.upsert(source);

    const operations: ContextOperation[] = [
      makeOperation(input, 'source.ingested', source.id, {
        kind: source.kind,
        title: source.title,
        canonicalUri: source.canonicalUri,
      }),
    ];

    let snapshot: DocumentSnapshot | undefined;
    if (input.rawContentRef) {
      snapshot = {
        id: createId('doc'),
        spaceId: input.spaceId,
        sourceId: source.id,
        mimeType: 'text/plain',
        storageUri: input.rawContentRef,
        title: input.title,
        checksum: input.checksum ?? source.checksum ?? createId('checksum'),
        tokenCount: input.tokenCountEstimate ?? estimateTokenCount(input.title),
        status: 'active',
        createdAt: now,
      };

      await this.deps.documents.save(snapshot);
      operations.push(
        makeOperation(input, 'document.snapshotted', snapshot.id, {
          sourceId: source.id,
          storageUri: snapshot.storageUri,
        })
      );
    }

    for (const operation of operations) {
      await this.deps.operations.append(operation);
    }

    return {
      source,
      snapshot,
      chunkIds: [],
      operations,
    };
  }

  async retrieve(input: RetrieveContextInput): Promise<RetrieveContextResult> {
    const queryTerms = normalizeQueryTerms(input.query);
    const searchMode = input.searchMode ?? 'hybrid';
    const includeChunks = input.includeChunks ?? false;

    const [allMemories, allProfiles, allSources, documents] = await Promise.all([
      this.deps.memories.listBySpace(input.spaceId),
      input.includeProfiles === false ? Promise.resolve([]) : this.deps.profiles.listBySpace(input.spaceId),
      input.includeSources === false ? Promise.resolve([]) : this.deps.sources.listBySpace(input.spaceId),
      includeChunks ? this.deps.documents.listBySpace(input.spaceId) : Promise.resolve([]),
    ]);
    const activeSources = allSources.filter((source) => source.status === 'active');
    const activeSourceIds = new Set(activeSources.map((source) => source.id));

    const memoryTierFilter = input.memoryTiers ? new Set(input.memoryTiers) : null;
    const eligibleMemories = allMemories.filter((memory) =>
      memoryTierFilter ? memoryTierFilter.has(memory.tier) : true
    );

    const lexicalMemories = new Map<string, RetrievedMemory>();
    if (searchMode !== 'vector') {
      for (const memory of eligibleMemories) {
        const scored = scoreMemoryLexical(memory, queryTerms);
        if (scored && scored.score > 0) {
          lexicalMemories.set(memory.id, scored);
        }
      }
    }

    const chunkById = new Map<string, ChunkRecord>();
    const documentByChunkId = new Map<string, DocumentSnapshot>();
    if (includeChunks) {
      for (const document of documents) {
        if (!activeSourceIds.has(document.sourceId)) {
          continue;
        }
        const chunks = await this.deps.chunks.listByDocument(document.id);
        for (const chunk of chunks) {
          chunkById.set(chunk.id, chunk);
          documentByChunkId.set(chunk.id, document);
        }
      }
    }

    const lexicalChunkHits = new Map<string, RetrievedChunk>();
    if (includeChunks && searchMode !== 'vector') {
      for (const chunk of chunkById.values()) {
        const score = scoreChunkLexical(chunk, queryTerms);
        if (score <= 0) {
          continue;
        }
        const matchedBy = queryTerms.filter((term) => chunk.text.toLowerCase().includes(term));
        lexicalChunkHits.set(chunk.id, {
          chunk,
          documentId: chunk.documentId,
          score,
          matchedBy,
          vectorHits: [],
        });
      }
    }

    const vectorHits =
      this.deps.vectorIndex && searchMode !== 'lexical'
        ? await this.deps.vectorIndex.search({
            spaceId: input.spaceId,
            threadId: input.threadId,
            projectSlug: input.projectSlug,
            query: input.query,
            topK: Math.max(input.memoryLimit ?? 8, input.chunkLimit ?? 6, 8),
            kinds: includeChunks ? ['memory', 'chunk'] : ['memory'],
            tiers: toVectorTierSet(input),
          })
        : [];

    const memoryVectorHits = new Map<string, VectorSearchHit[]>();
    const chunkVectorHits = new Map<string, VectorSearchHit[]>();
    for (const hit of vectorHits) {
      if (hit.kind === 'memory') {
        const existing = memoryVectorHits.get(hit.entityId) ?? [];
        existing.push(hit);
        memoryVectorHits.set(hit.entityId, existing);
      } else if (hit.kind === 'chunk') {
        const existing = chunkVectorHits.get(hit.entityId) ?? [];
        existing.push(hit);
        chunkVectorHits.set(hit.entityId, existing);
      }
    }

    const fusedMemories = new Map<string, RetrievedMemory>();
    for (const memory of eligibleMemories) {
      const lexical = lexicalMemories.get(memory.id);
      const vector = memoryVectorHits.get(memory.id) ?? [];
      if (!lexical && vector.length === 0 && queryTerms.length > 0) {
        continue;
      }
      const topVectorScore = vector[0]?.score ?? 0;
      const projectAffinityScore = Math.max(
        scoreProjectAffinity(memoryVectorHits.get(memory.id)?.[0]?.metadata, input.projectSlug),
        scoreProjectAffinity(vector[0]?.metadata, input.projectSlug)
      );
      const score = (lexical?.score ?? 0) + Math.round(topVectorScore * 40) + projectAffinityScore;
      fusedMemories.set(memory.id, {
        memory,
        score,
        matchedBy: lexical?.matchedBy ?? [],
        vectorHits: vector,
      });
    }

    const memories = [...fusedMemories.values()]
      .filter((item) => item.score > 0 || queryTerms.length === 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.memoryLimit ?? 8);

    const fusedChunks = new Map<string, RetrievedChunk>();
    if (includeChunks) {
      for (const chunk of chunkById.values()) {
        const lexical = lexicalChunkHits.get(chunk.id);
        const vector = chunkVectorHits.get(chunk.id) ?? [];
        if (!lexical && vector.length === 0) {
          continue;
        }
        const topVectorScore = vector[0]?.score ?? 0;
        const projectAffinityScore = scoreProjectAffinity(vector[0]?.metadata, input.projectSlug);
        fusedChunks.set(chunk.id, {
          chunk,
          documentId: chunk.documentId,
          score: (lexical?.score ?? 0) + Math.round(topVectorScore * 35) + projectAffinityScore,
          matchedBy: lexical?.matchedBy ?? [],
          vectorHits: vector,
        });
      }
    }

    const chunks = [...fusedChunks.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, input.chunkLimit ?? 6);

    const relatedSourceIds = new Set<string>(memories.flatMap((item) => item.memory.sourceIds));
    for (const chunkHit of chunks) {
      const document = documentByChunkId.get(chunkHit.chunk.id);
      if (document) {
        const source = activeSources.find((item) => item.id === document.sourceId);
        if (source) {
          relatedSourceIds.add(source.id);
        }
      }
    }

    const sourceTerms = new Set(queryTerms);
    const sources = activeSources.filter((source) => {
      if (relatedSourceIds.has(source.id)) {
        return true;
      }
      const sourceText = `${source.title ?? ''} ${source.tags.join(' ')}`.toLowerCase();
      return [...sourceTerms].some((term) => sourceText.includes(term));
    });

    const profiles = allProfiles.filter(
      (profile) =>
        profile.state === 'active' &&
        profile.memoryIds.some((memoryId: string) => memories.some((item) => item.memory.id === memoryId))
    );

    const totalEstimatedTokens =
      memories.reduce(
        (sum, item) => sum + estimateTokenCount(`${item.memory.summary} ${item.memory.detail ?? ''}`),
        0
      ) +
      chunks.reduce((sum, item) => sum + estimateTokenCount(item.chunk.text), 0) +
      profiles.reduce((sum, item) => sum + estimateTokenCount(item.summary), 0) +
      sources.reduce((sum, item) => sum + estimateTokenCount(`${item.title ?? ''} ${item.tags.join(' ')}`), 0);

    return {
      memories,
      chunks,
      profiles,
      sources,
      totalEstimatedTokens,
    };
  }

  async assemble(input: AssembleContextPackInput): Promise<AssembleContextPackResult> {
    const sections: ContextPackSection[] = [];

    if (input.threadSummary) {
      sections.push(buildSection('thread-state', input.threadSummary, 100, `thread-${input.threadId ?? 'space'}`));
    }
    for (const mountedSection of input.mountedSections ?? []) {
      sections.push({ ...mountedSection });
    }
    for (const profile of input.mountedProfiles ?? []) {
      sections.push(buildSection('compaction', profile.summary, 88 + Math.round(profile.confidence * 4), `compaction-${profile.id}`));
    }
    for (const [index, instruction] of (input.pinnedInstructions ?? []).entries()) {
      sections.push(buildSection('instruction', instruction, 110 - index, `instruction-${index}`));
    }

    for (const profile of input.retrieval.profiles) {
      sections.push(buildSection('profile', profile.summary, 84 + Math.round(profile.confidence * 10), profile.id));
    }

    for (const memory of input.retrieval.memories) {
      sections.push(
        buildSection(
          'memory',
          memory.memory.detail ? `${memory.memory.summary}\n${memory.memory.detail}` : memory.memory.summary,
          60 + Math.round(memory.score / 2),
          memory.memory.id
        )
      );
    }

    for (const chunk of input.retrieval.chunks) {
      sections.push(
        buildSection('source', chunk.chunk.text, 44 + Math.round(chunk.score / 3), `chunk-${chunk.chunk.id}`)
      );
    }

    for (const source of input.retrieval.sources) {
      const sourceSummary = [source.title, source.tags.length > 0 ? `tags: ${source.tags.join(', ')}` : undefined]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(' · ');
      if (sourceSummary) {
        sections.push(buildSection('source', sourceSummary, 36, source.id));
      }
    }

    sections.sort((left, right) => right.priority - left.priority);

    const keptSections: ContextPackSection[] = [];
    const omittedEntityIds: string[] = [];
    let spentTokens = 0;

    for (const section of sections) {
      if (spentTokens + section.tokenCount > input.budgetTokens && keptSections.length > 0) {
        omittedEntityIds.push(section.id);
        continue;
      }
      keptSections.push(section);
      spentTokens += section.tokenCount;
    }

    const pack: ContextPack = {
      id: createId('pack'),
      spaceId: input.spaceId,
      threadId: input.threadId,
      budgetTokens: input.budgetTokens,
      sections: keptSections,
      provenance: {
        sourceIds: dedupe(input.retrieval.sources.map((source) => source.id)),
        memoryIds: dedupe(input.retrieval.memories.map((item) => item.memory.id)),
        profileIds: dedupe(input.retrieval.profiles.map((profile) => profile.id)),
        artifactIds: [],
      },
      generatedAt: ISO_NOW(),
    };

    const operation: ContextOperation = {
      id: createId('op'),
      spaceId: input.spaceId,
      threadId: input.threadId,
      actor: {
        kind: 'system',
        id: 'context-engine',
      },
      type: 'context.assembled',
      entityId: pack.id,
      payload: {
        sectionCount: pack.sections.length,
        omittedEntityIds,
        budgetTokens: input.budgetTokens,
      },
      createdAt: pack.generatedAt,
    };
    await this.deps.operations.append(operation);

    return {
      pack,
      omittedEntityIds,
    };
  }

  async evaluatePromotion(input: EvaluatePromotionInput) {
    return decidePromotion(input.candidate, this.deps.policies.promotion);
  }

  async evaluateCompaction(input: EvaluateCompactionInput) {
    return decideCompaction(input.candidate, this.deps.policies.compaction);
  }

  async assessForgetting(input: AssessForgettingInput) {
    return assessForgetting(input.candidate, this.deps.policies.forgetting);
  }
}
