/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceId, ThreadId, Timestamp } from './domain';

export type ContextOperationType =
  | 'thread.bound'
  | 'source.ingested'
  | 'document.snapshotted'
  | 'chunk.indexed'
  | 'memory.candidate_created'
  | 'memory.candidate_approved'
  | 'memory.candidate_rejected'
  | 'memory.proposed'
  | 'memory.promoted'
  | 'memory.rejected'
  | 'memory.superseded'
  | 'memory.archived'
  | 'profile.compacted'
  | 'profile.archived'
  | 'context.assembled'
  | 'sync.checkpointed';

export type ContextActorKind = 'user' | 'assistant' | 'system' | 'replica';

export type ContextActor = {
  kind: ContextActorKind;
  id: string;
};

export type ContextOperation = {
  id: string;
  spaceId: SpaceId;
  threadId?: ThreadId;
  replicaId?: string;
  actor: ContextActor;
  type: ContextOperationType;
  entityId: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: Timestamp;
};

export type ContextOperationCursor = {
  operationId: string;
  createdAt: Timestamp;
};
