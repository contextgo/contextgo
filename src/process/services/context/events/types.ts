/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConnectorSource,
  ContextJob,
  ContextJobArtifact,
  GovernanceLifecycleEnvelope,
  ProjectPromotionCandidate,
  SessionCompactionSnapshot,
  SessionSignal,
} from '../contextDomain';
import type { MountedBoundaryTrace } from '../../../../../packages/context-engine/src/index';

export type ContextEventMap = {
  'context.window.prepared': {
    spaceId: string;
    threadId: string;
    projectSlug?: string;
    preparedAt: number;
    snapshot: SessionCompactionSnapshot;
    mountedBoundary?: MountedBoundaryTrace;
  };
  'session.turn.completed': {
    spaceId: string;
    threadId: string;
    projectSlug?: string;
    completedAt: number;
    snapshot: SessionCompactionSnapshot;
    promotionCandidate?: ProjectPromotionCandidate;
    mountedBoundary?: MountedBoundaryTrace;
  };
  'session.interrupted': {
    spaceId: string;
    threadId: string;
    projectSlug?: string;
    interruptedAt: number;
    snapshot: SessionCompactionSnapshot;
    mountedBoundary?: MountedBoundaryTrace;
  };
  'delegation.completed': GovernanceLifecycleEnvelope & {
    delegationSummary: string;
    snapshot: SessionCompactionSnapshot;
  };
  'session.signal.detected': {
    spaceId: string;
    threadId: string;
    projectSlug?: string;
    signal: SessionSignal;
  };
  'connector.source.ingested': {
    spaceId: string;
    threadId?: string;
    connectorId: string;
    source: ConnectorSource;
    sourceRecordId: string;
    title: string;
    canonicalUri: string;
    ingestedAt: string;
    summary: string;
  };
  'context.job.queued': {
    job: ContextJob;
  };
  'context.job.started': {
    job: ContextJob;
    startedAt: string;
  };
  'context.job.completed': {
    job: ContextJob;
    status: 'completed' | 'failed';
    completedAt: string;
    artifact?: ContextJobArtifact;
    error?: string;
  };
};

export type ContextEventName = keyof ContextEventMap;

export type ContextEvent<TName extends ContextEventName = ContextEventName> = {
  type: TName;
  payload: ContextEventMap[TName];
};

export type ContextEventHandler<TName extends ContextEventName> = (event: ContextEvent<TName>) => void | Promise<void>;
