/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContextExecutionBoundary,
  ContextJob,
  ContextJobDecision,
  ContextJobPriority,
  ContextJobSource,
  ContextJobType,
  ProjectPromotionCandidate,
  SessionCompactionSnapshot,
  SessionSignal,
} from './contextDomain';

const INTERRUPTION_PRIORITY_THRESHOLD = 1;
const REPEATED_REQUEST_THRESHOLD = 2;
const PROMOTION_CONFIDENCE_THRESHOLD = 0.72;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function countSignals(signals: readonly SessionSignal[], kind: SessionSignal['kind']): number {
  return signals.filter(signal => signal.kind === kind).length;
}

function choosePriority(levels: readonly ContextJobPriority[]): ContextJobPriority {
  if (levels.includes('high')) {
    return 'high';
  }
  if (levels.includes('medium')) {
    return 'medium';
  }
  return 'low';
}

export class ContextJobOrchestrator {
  decideSessionCompaction(input: {
    spaceId: string;
    threadId: string;
    snapshot: SessionCompactionSnapshot;
  }): ContextJobDecision {
    const repeatedRequests = countSignals(input.snapshot.recentSignals, 'repeated_request');
    const interruptions = countSignals(input.snapshot.recentSignals, 'user_interrupt');
    const strategyShifts = countSignals(input.snapshot.recentSignals, 'strategy_shift');
    const meaningfulActivity = input.snapshot.userTurns + input.snapshot.assistantReplies;

    if (meaningfulActivity < 2 && repeatedRequests < REPEATED_REQUEST_THRESHOLD && interruptions < INTERRUPTION_PRIORITY_THRESHOLD) {
      return {
        shouldQueue: false,
        priority: 'low',
        reason: 'Not enough session activity to justify compaction yet.',
      };
    }

    const priority = choosePriority([
      interruptions >= INTERRUPTION_PRIORITY_THRESHOLD ? 'high' : 'low',
      repeatedRequests >= REPEATED_REQUEST_THRESHOLD ? 'high' : 'low',
      strategyShifts > 0 ? 'medium' : 'low',
      meaningfulActivity >= 4 ? 'medium' : 'low',
    ]);

    return {
      shouldQueue: true,
      priority,
      reason: `Session compaction triggered by activity=${meaningfulActivity}, interruptions=${interruptions}, repeatedRequests=${repeatedRequests}, strategyShifts=${strategyShifts}.`,
    };
  }

  createSessionCompactionJob(input: {
    spaceId: string;
    threadId: string;
    projectSlug?: string;
    snapshot: SessionCompactionSnapshot;
    source: ContextJobSource;
    executionBoundary?: ContextExecutionBoundary;
    triggerEvent?: string;
    triggerLabel?: string;
    triggeredAt?: string;
  }): ContextJob | undefined {
    const decision = this.decideSessionCompaction({
      spaceId: input.spaceId,
      threadId: input.threadId,
      snapshot: input.snapshot,
    });

    if (!decision.shouldQueue) {
      return undefined;
    }

    return this.createTriggeredJob({
      type: 'session_compaction',
      status: 'queued',
      priority: decision.priority,
      spaceId: input.spaceId,
      threadId: input.threadId,
      projectSlug: input.projectSlug,
      source: input.source,
      executionBoundary: input.executionBoundary,
      triggerEvent: input.triggerEvent,
      triggerLabel: input.triggerLabel,
      triggeredAt: input.triggeredAt,
      reason: decision.reason,
      payload: {
        snapshot: input.snapshot,
      },
    });
  }

  createProjectPromotionJob(input: {
    spaceId: string;
    threadId: string;
    candidate: ProjectPromotionCandidate;
    source: ContextJobSource;
    executionBoundary?: ContextExecutionBoundary;
    triggerEvent?: string;
    triggerLabel?: string;
    triggeredAt?: string;
  }): ContextJob | undefined {
    if (input.candidate.confidence < PROMOTION_CONFIDENCE_THRESHOLD) {
      return undefined;
    }

    return this.createTriggeredJob({
      type: 'project_promotion',
      status: 'queued',
      priority: input.candidate.confidence >= 0.86 ? 'high' : 'medium',
      spaceId: input.spaceId,
      threadId: input.threadId,
      projectSlug: input.candidate.projectSlug,
      source: input.source,
      executionBoundary: input.executionBoundary,
      triggerEvent: input.triggerEvent,
      triggerLabel: input.triggerLabel,
      triggeredAt: input.triggeredAt,
      reason: `Promotion candidate is stable enough for project wiki (confidence=${input.candidate.confidence.toFixed(2)}).`,
      payload: {
        candidate: input.candidate,
      },
    });
  }

  createTriggeredJob(input: Omit<ContextJob, 'id' | 'queuedAt' | 'trigger'> & {
    triggerEvent?: string;
    triggerLabel?: string;
    triggeredAt?: string;
  }): ContextJob {
    const queuedAt = new Date().toISOString();
    return {
      ...input,
      id: createId('context-job'),
      queuedAt,
      trigger: input.triggerEvent
        ? {
            kind: input.source,
            event: input.triggerEvent,
            firedAt: input.triggeredAt ?? queuedAt,
            label: input.triggerLabel,
          }
        : undefined,
    };
  }
}

export function collectSessionSignalKinds(signals: readonly SessionSignal[]): string[] {
  return Array.from(new Set(signals.map(signal => signal.kind))).sort((left, right) => left.localeCompare(right));
}

export function buildPromotionCandidateFromSummary(input: {
  projectSlug: string;
  summary: string;
  detail?: string;
  sourceThreadIds: readonly string[];
  confidence: number;
}): ProjectPromotionCandidate {
  return {
    projectSlug: input.projectSlug,
    summary: input.summary,
    detail: input.detail,
    sourceThreadIds: input.sourceThreadIds,
    confidence: input.confidence,
  };
}

export function createContextExecutionBoundary(input: {
  spaceId: string;
  vaultRoot: string;
  spaceName?: string;
}): ContextExecutionBoundary {
  return {
    kind: 'space-vault-root',
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    vaultRoot: input.vaultRoot,
  };
}

export function createContextJobTriggerLabel(input: {
  source: ContextJobSource;
  event: string;
  label?: string;
}): string {
  return input.label || `${input.source}:${input.event}`;
}

export function createPlannedContextJob(input: {
  type: ContextJobType;
  priority: ContextJobPriority;
  spaceId: string;
  threadId?: string;
  projectSlug?: string;
  source: ContextJobSource;
  executionBoundary?: ContextExecutionBoundary;
  triggerEvent: string;
  triggerLabel?: string;
  triggeredAt?: string;
  reason: string;
  payload?: Readonly<Record<string, unknown>>;
}): ContextJob {
  return new ContextJobOrchestrator().createTriggeredJob({
    type: input.type,
    status: 'queued',
    priority: input.priority,
    spaceId: input.spaceId,
    threadId: input.threadId,
    projectSlug: input.projectSlug,
    source: input.source,
    executionBoundary: input.executionBoundary,
    triggerEvent: input.triggerEvent,
    triggerLabel: input.triggerLabel,
    triggeredAt: input.triggeredAt,
    reason: input.reason,
    payload: input.payload ?? {},
  });
}
