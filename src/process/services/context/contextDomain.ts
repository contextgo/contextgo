/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ContextJobType =
  | 'session_compaction'
  | 'session_pattern_detection'
  | 'project_promotion'
  | 'space_memory_distillation'
  | 'connector_digest';

export type ContextJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ContextJobPriority = 'low' | 'medium' | 'high';

export type ContextJobSource =
  | 'runtime-hook'
  | 'conversation-lifecycle'
  | 'connector-sync'
  | 'manual'
  | 'hook'
  | 'lifecycle'
  | 'timer'
  | 'connector'
  | 'derived';

export type ContextExecutionBoundary = {
  kind: 'space-vault-root';
  spaceId: string;
  spaceName?: string;
  vaultRoot: string;
};

export type ContextJobTrigger = {
  kind: ContextJobSource;
  event: string;
  firedAt: string;
  label?: string;
};

export type SessionSignalKind =
  | 'user_interrupt'
  | 'repeated_request'
  | 'strategy_shift'
  | 'tool_failure_cluster'
  | 'memory_candidate_created'
  | 'memory_candidate_promoted'
  | 'context_window_prepared';

export type SessionSignal = {
  kind: SessionSignalKind;
  summary: string;
  detail?: string;
  score: number;
  occurredAt: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type ContextJob = {
  id: string;
  type: ContextJobType;
  status: ContextJobStatus;
  priority: ContextJobPriority;
  spaceId: string;
  threadId?: string;
  projectSlug?: string;
  source: ContextJobSource;
  trigger?: ContextJobTrigger;
  executionBoundary?: ContextExecutionBoundary;
  reason: string;
  payload: Readonly<Record<string, unknown>>;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type ContextJobDecision = {
  shouldQueue: boolean;
  priority: ContextJobPriority;
  reason: string;
};

export type SessionCompactionSnapshot = {
  userTurns: number;
  assistantReplies: number;
  interruptions: number;
  lastUserGoal?: string;
  lastAssistantOutcome?: string;
  recentSignals: readonly SessionSignal[];
};

export type ProjectPromotionCandidate = {
  projectSlug: string;
  summary: string;
  detail?: string;
  sourceThreadIds: readonly string[];
  confidence: number;
};

export type SessionCompactionArtifact = {
  threadId: string;
  profileId: string;
  profileKey: string;
  summary: string;
  detail?: string;
  noteTitle?: string;
  relativePath?: string;
  workingSetTitle?: string;
  workingSetRelativePath?: string;
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  signalKinds: readonly string[];
  candidateCount: number;
  pendingReviewCount: number;
  promotedCount: number;
  pressure: number;
  promotionCandidate?: ProjectPromotionCandidate;
};

export type ProjectPromotionArtifact = {
  projectSlug: string;
  noteTitle: string;
  relativePath: string;
  summary: string;
  sourceThreadIds: readonly string[];
};

export type ContextRunArtifact = {
  title: string;
  relativePath: string;
  summary: string;
};

export type SpaceMemoryDistillationArtifact = ContextRunArtifact & {
  spaceId: string;
};

export type ConnectorDigestArtifact = ContextRunArtifact & {
  spaceId: string;
};

export type ContextJobArtifact =
  | SessionCompactionArtifact
  | ProjectPromotionArtifact
  | SpaceMemoryDistillationArtifact
  | ConnectorDigestArtifact;

function sanitizeCompactionKeySegment(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'session';
}

export function createSessionCompactionProfileKey(threadId: string): string {
  return `session.compaction.${sanitizeCompactionKeySegment(threadId)}`;
}

export function createSessionCompactionProfileId(threadId: string): string {
  return `profile-session-compaction-${sanitizeCompactionKeySegment(threadId)}`;
}

export type ConnectorSourceKind =
  | 'im-thread'
  | 'knowledge-doc'
  | 'calendar-event'
  | 'repo-activity'
  | 'web-resource';

export type ConnectorSource = {
  connectorId: string;
  kind: ConnectorSourceKind;
  canonicalUri: string;
  title: string;
  spaceId: string;
  threadId?: string;
  updatedAt: string;
  tags: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
};
