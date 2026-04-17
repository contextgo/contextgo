/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ArtifactId,
  ChunkId,
  ChunkRecord,
  ContextPack,
  ContextTier,
  DocumentSnapshot,
  DocumentSnapshotId,
  MemoryCandidateEntry,
  MemoryCandidateId,
  MemoryEntry,
  MemoryEntryId,
  ProfileSegment,
  ProfileSegmentId,
  SourceRecord,
  SourceRecordId,
  SourceRecordKind,
  SpaceId,
  ThreadId,
  Timestamp,
} from './domain';
import type { CompactionCandidate, CompactionDecision, CompactionPolicy } from './compaction';
import type { ForgettingAssessment, ForgettingCandidate, ForgettingPolicy } from './forgetting';
import type { ContextOperation, ContextOperationCursor } from './operations';
import type { PromotionCandidate, PromotionDecision, PromotionPolicy } from './promotion';
import type { VectorIndexProvider, VectorSearchHit } from './vectorIndex';

export type IngestSourceInput = {
  sourceId?: SourceRecordId;
  spaceId: SpaceId;
  threadId?: ThreadId;
  artifactId?: ArtifactId;
  kind: SourceRecordKind;
  title?: string;
  canonicalUri?: string;
  checksum?: string;
  rawContentRef?: string;
  tokenCountEstimate?: number;
  tags?: readonly string[];
  createdAt?: Timestamp;
};

export type IngestSourceResult = {
  source: SourceRecord;
  snapshot?: DocumentSnapshot;
  chunkIds: readonly ChunkId[];
  operations: readonly ContextOperation[];
  lifecycle: IngestionLifecycle;
};

export type IngestionLifecycle = {
  sourceRegistered: boolean;
  snapshotPersisted: boolean;
  chunksPrepared: boolean;
  indexReady: boolean;
};

export type RetrievedMemory = {
  memory: MemoryEntry;
  score: number;
  matchedBy: readonly string[];
  vectorHits?: readonly VectorSearchHit[];
};

export type RetrievedChunk = {
  chunk: ChunkRecord;
  documentId: DocumentSnapshotId;
  score: number;
  matchedBy: readonly string[];
  vectorHits?: readonly VectorSearchHit[];
};

export type RetrieveContextInput = {
  spaceId: SpaceId;
  threadId?: ThreadId;
  projectSlug?: string;
  query: string;
  budgetTokens: number;
  memoryLimit?: number;
  chunkLimit?: number;
  includeProfiles?: boolean;
  includeSources?: boolean;
  includeChunks?: boolean;
  memoryTiers?: readonly Exclude<ContextTier, 'source'>[];
  searchMode?: 'lexical' | 'vector' | 'hybrid';
};

export type RetrieveContextResult = {
  memories: readonly RetrievedMemory[];
  chunks: readonly RetrievedChunk[];
  profiles: readonly ProfileSegment[];
  sources: readonly SourceRecord[];
  totalEstimatedTokens: number;
};

export type ContextAssemblyOverlays = {
  threadSummary?: string;
  mountedSections?: ContextPack['sections'];
  mountedProfiles?: readonly ProfileSegment[];
  pinnedInstructions?: readonly string[];
};

export type AssembleContextPackInput = {
  spaceId: SpaceId;
  threadId?: ThreadId;
  retrieval: RetrieveContextResult;
  budgetTokens: number;
  overlays?: ContextAssemblyOverlays;
  threadSummary?: string;
  mountedSections?: ContextPack['sections'];
  mountedProfiles?: readonly ProfileSegment[];
  pinnedInstructions?: readonly string[];
};

export type AssembleContextPackResult = {
  pack: ContextPack;
  omittedEntityIds: readonly string[];
};

export type EvaluatePromotionInput = {
  spaceId: SpaceId;
  candidate: PromotionCandidate;
};

export type EvaluateCompactionInput = {
  spaceId: SpaceId;
  candidate: CompactionCandidate;
};

export type AssessForgettingInput = {
  spaceId: SpaceId;
  candidate: ForgettingCandidate;
};

export type IContextService = {
  ingestSource(input: IngestSourceInput): Promise<IngestSourceResult>;
  retrieve(input: RetrieveContextInput): Promise<RetrieveContextResult>;
  assemble(input: AssembleContextPackInput): Promise<AssembleContextPackResult>;
  evaluatePromotion(input: EvaluatePromotionInput): Promise<PromotionDecision>;
  evaluateCompaction(input: EvaluateCompactionInput): Promise<CompactionDecision>;
  assessForgetting(input: AssessForgettingInput): Promise<ForgettingAssessment>;
};

export type ContextSourceStore = {
  getById(id: SourceRecordId): Promise<SourceRecord | null>;
  listBySpace(spaceId: SpaceId): Promise<readonly SourceRecord[]>;
  upsert(source: SourceRecord): Promise<void>;
};

export type DocumentSnapshotStore = {
  getById(id: DocumentSnapshotId): Promise<DocumentSnapshot | null>;
  listBySpace(spaceId: SpaceId): Promise<readonly DocumentSnapshot[]>;
  save(snapshot: DocumentSnapshot): Promise<void>;
};

export type ChunkStore = {
  listByDocument(documentId: DocumentSnapshotId): Promise<readonly ChunkRecord[]>;
  deleteByDocument(documentId: DocumentSnapshotId): Promise<void>;
  saveMany(chunks: readonly ChunkRecord[]): Promise<void>;
};

export type MemoryStore = {
  getById(id: MemoryEntryId): Promise<MemoryEntry | null>;
  listBySpace(spaceId: SpaceId): Promise<readonly MemoryEntry[]>;
  save(memory: MemoryEntry): Promise<void>;
};

export type MemoryCandidateStore = {
  getById(id: MemoryCandidateId): Promise<MemoryCandidateEntry | null>;
  listBySpace(spaceId: SpaceId): Promise<readonly MemoryCandidateEntry[]>;
  save(candidate: MemoryCandidateEntry): Promise<void>;
};

export type ProfileStore = {
  getById(id: ProfileSegmentId): Promise<ProfileSegment | null>;
  listBySpace(spaceId: SpaceId): Promise<readonly ProfileSegment[]>;
  save(profile: ProfileSegment): Promise<void>;
};

export type OperationLogStore = {
  append(operation: ContextOperation): Promise<void>;
  listSince(spaceId: SpaceId, cursor?: ContextOperationCursor): Promise<readonly ContextOperation[]>;
  getLatestCursor(spaceId: SpaceId): Promise<ContextOperationCursor | null>;
};

export type ContextEnginePolicySet = {
  promotion: PromotionPolicy;
  compaction: CompactionPolicy;
  forgetting: ForgettingPolicy;
};

export type ContextEngineProviderDependencies = {
  sources: ContextSourceStore;
  documents: DocumentSnapshotStore;
  chunks: ChunkStore;
  memories: MemoryStore;
  candidates: MemoryCandidateStore;
  profiles: ProfileStore;
  operations: OperationLogStore;
  vectorIndex?: VectorIndexProvider;
};

export type ContextEnginePolicyDependencies = {
  policies: ContextEnginePolicySet;
};

export type ContextEngineDependencies = ContextEngineProviderDependencies & ContextEnginePolicyDependencies;

export function splitContextEngineDependencies(deps: ContextEngineDependencies): {
  provider: ContextEngineProviderDependencies;
  policies: ContextEnginePolicySet;
} {
  const { policies, ...provider } = deps;
  return {
    provider,
    policies,
  };
}
