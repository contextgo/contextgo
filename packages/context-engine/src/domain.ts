/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type Timestamp = string;

export type SpaceId = string;
export type ThreadId = string;
export type ArtifactId = string;
export type SourceRecordId = string;
export type DocumentSnapshotId = string;
export type ChunkId = string;
export type MemoryEntryId = string;
export type ProfileSegmentId = string;
export type ContextPackId = string;

export type SourceRecordKind =
  | 'conversation-message'
  | 'connector-document'
  | 'artifact'
  | 'manual-note'
  | 'web-clip'
  | 'system-rule';

export type SourceRecordStatus = 'active' | 'archived';

export type SourceRecord = {
  id: SourceRecordId;
  spaceId: SpaceId;
  threadId?: ThreadId;
  artifactId?: ArtifactId;
  kind: SourceRecordKind;
  title?: string;
  canonicalUri?: string;
  checksum?: string;
  tags: readonly string[];
  status: SourceRecordStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DocumentSnapshotStatus = 'active' | 'superseded' | 'archived';

export type DocumentSnapshot = {
  id: DocumentSnapshotId;
  spaceId: SpaceId;
  sourceId: SourceRecordId;
  mimeType: string;
  storageUri: string;
  title?: string;
  checksum: string;
  tokenCount: number;
  status: DocumentSnapshotStatus;
  createdAt: Timestamp;
};

export type ContextTier = 'working' | 'experiential' | 'factual' | 'source';

export type ChunkRecord = {
  id: ChunkId;
  spaceId: SpaceId;
  documentId: DocumentSnapshotId;
  sequence: number;
  text: string;
  tokenCount: number;
  contentHash: string;
  tier: ContextTier;
  embeddingKey?: string;
};

export type MemoryKind = 'fact' | 'preference' | 'constraint' | 'decision' | 'identity' | 'workflow';

export type MemoryPriority = 'low' | 'medium' | 'high' | 'critical';

export type MemoryEntryState = 'candidate' | 'accepted' | 'superseded' | 'archived' | 'rejected';

export type MemoryEntry = {
  id: MemoryEntryId;
  spaceId: SpaceId;
  kind: MemoryKind;
  summary: string;
  detail?: string;
  sourceIds: readonly SourceRecordId[];
  chunkIds: readonly ChunkId[];
  confidence: number;
  tier: Exclude<ContextTier, 'source'>;
  priority: MemoryPriority;
  state: MemoryEntryState;
  supersededById?: MemoryEntryId;
  expiresAt?: Timestamp;
  lastAccessedAt?: Timestamp;
  lastConfirmedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type MemoryCandidateId = string;

export type MemoryCandidateState = 'pending_review' | 'approved' | 'promoted' | 'rejected' | 'archived';

export type MemoryCandidateReviewStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected';

export type MemoryCandidateDestination = 'memory' | 'document' | 'board';

export type MemoryCandidateEntry = {
  id: MemoryCandidateId;
  spaceId: SpaceId;
  threadId?: ThreadId;
  kind: MemoryKind;
  tier: Exclude<ContextTier, 'source'>;
  summary: string;
  detail?: string;
  sourceIds: readonly SourceRecordId[];
  chunkIds: readonly ChunkId[];
  confidence: number;
  priority: MemoryPriority;
  evidenceCount: number;
  repeatedAcrossSources: number;
  recentReferenceCount: number;
  userConfirmed: boolean;
  manuallyPinned: boolean;
  executionBacked: boolean;
  contradictionDetected: boolean;
  promotionScore: number;
  promotionRationale: readonly string[];
  destination: MemoryCandidateDestination;
  state: MemoryCandidateState;
  reviewStatus: MemoryCandidateReviewStatus;
  promotedMemoryId?: MemoryEntryId;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProfileSegmentState = 'draft' | 'active' | 'superseded' | 'archived';

export type ProfileSegment = {
  id: ProfileSegmentId;
  spaceId: SpaceId;
  key: string;
  summary: string;
  memoryIds: readonly MemoryEntryId[];
  confidence: number;
  state: ProfileSegmentState;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ContextPackSectionKind = 'thread-state' | 'source' | 'artifact' | 'memory' | 'profile' | 'instruction';

export type ContextPackSection = {
  kind: ContextPackSectionKind;
  id: string;
  summary: string;
  tokenCount: number;
  priority: number;
};

export type ContextPackProvenance = {
  sourceIds: readonly SourceRecordId[];
  memoryIds: readonly MemoryEntryId[];
  profileIds: readonly ProfileSegmentId[];
  artifactIds: readonly ArtifactId[];
};

export type ContextPack = {
  id: ContextPackId;
  spaceId: SpaceId;
  threadId?: ThreadId;
  budgetTokens: number;
  sections: readonly ContextPackSection[];
  provenance: ContextPackProvenance;
  generatedAt: Timestamp;
};
