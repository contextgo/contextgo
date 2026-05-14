/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ContextJobOrchestrator,
  createContextJobTriggerLabel,
  createPlannedContextJob,
} from '../ContextJobOrchestrator';
import type { ContextExecutionBoundaryResolver } from '../projectContext/ContextExecutionBoundaryResolver';
import type { ContextEventBus } from './ContextEventBus';
import { ContextTriggerRegistry } from './triggers/ContextTriggerRegistry';
import { CONTEXT_ENGINE_BUILTIN_TRIGGERS } from './triggers/builtinTriggers';
import type { ContextTriggerDispatchInput } from './triggers/types';
import type {
  ContextJob,
  ContextJobArtifact,
  ContextJobPriority,
  ContextJobSource,
  ProjectPromotionCandidate,
} from '../contextDomain';

function normalizeSource(source: ContextJobSource): ContextJobSource {
  if (source === 'runtime-hook') {
    return 'hook';
  }
  if (source === 'conversation-lifecycle') {
    return 'lifecycle';
  }
  if (source === 'connector-sync') {
    return 'connector';
  }
  return source;
}

function getPromotionCandidate(artifact: ContextJobArtifact | undefined) {
  if (!artifact || !('promotionCandidate' in artifact)) {
    return undefined;
  }

  return artifact.promotionCandidate;
}

export class ContextTriggerRouter {
  constructor(
    private readonly bus: Pick<ContextEventBus, 'on' | 'emit'>,
    private readonly boundaryResolver: Pick<ContextExecutionBoundaryResolver, 'resolve'>,
    private readonly orchestrator: ContextJobOrchestrator = new ContextJobOrchestrator(),
    private readonly registry: ContextTriggerRegistry = new ContextTriggerRegistry(CONTEXT_ENGINE_BUILTIN_TRIGGERS)
  ) {}

  register(): void {
    this.bus.on('context.window.prepared', async (event) => {
      await this.dispatchTrigger({
        triggerId: 'hook.context-window-prepared',
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        projectSlug: event.payload.projectSlug,
        snapshot: event.payload.snapshot,
        firedAt: new Date(event.payload.preparedAt).toISOString(),
      });
    });

    this.bus.on('session.turn.completed', async (event) => {
      await this.dispatchTrigger({
        triggerId: 'hook.session-turn-completed',
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        projectSlug: event.payload.projectSlug,
        snapshot: event.payload.snapshot,
        firedAt: new Date(event.payload.completedAt).toISOString(),
      });
    });

    this.bus.on('session.interrupted', async (event) => {
      await this.dispatchTrigger({
        triggerId: 'lifecycle.session-interrupted',
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        projectSlug: event.payload.projectSlug,
        snapshot: event.payload.snapshot,
        firedAt: new Date(event.payload.interruptedAt).toISOString(),
      });
    });

    this.bus.on('delegation.completed', async (event) => {
      if (!event.payload.spaceId || !event.payload.threadId || !event.payload.snapshot) {
        return;
      }

      await this.dispatchTrigger({
        triggerId: 'lifecycle.delegation-completed',
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        projectSlug: event.payload.projectSlug,
        snapshot: event.payload.snapshot,
        sourceSummary: event.payload.sourceSummary,
        reason: event.payload.sourceSummary ?? event.payload.delegationSummary,
        firedAt: event.payload.occurredAt,
        triggerEvent: 'delegation.completed',
        triggerLabel: 'Delegation completed',
      });
    });

    this.bus.on('connector.source.ingested', async (event) => {
      await this.dispatchTrigger({
        triggerId: 'connector.connector-digest',
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        priority: 'medium',
        reason: event.payload.summary,
        payload: {
          connectorId: event.payload.connectorId,
          sourceRecordId: event.payload.sourceRecordId,
          canonicalUri: event.payload.canonicalUri,
          title: event.payload.title,
          sourceKind: event.payload.source.kind,
          summary: event.payload.summary,
        },
        firedAt: event.payload.ingestedAt,
        triggerEvent: 'connector.source.ingested',
        triggerLabel: event.payload.connectorId + ': ' + event.payload.title,
      });
    });

    this.bus.on('context.job.completed', async (event) => {
      if (event.payload.status !== 'completed' || event.payload.job.type !== 'session_compaction') {
        return;
      }

      const promotionCandidate = getPromotionCandidate(event.payload.artifact);
      if (!promotionCandidate) {
        return;
      }

      await this.dispatchTrigger({
        triggerId: 'derived.project-promotion',
        spaceId: event.payload.job.spaceId,
        threadId: event.payload.job.threadId || event.payload.job.id,
        projectSlug: event.payload.job.projectSlug,
        candidate: promotionCandidate,
        firedAt: event.payload.completedAt,
      });
    });
  }

  getTriggerRegistry(): ContextTriggerRegistry {
    return this.registry;
  }

  async dispatchTrigger(input: ContextTriggerDispatchInput): Promise<ContextJob | undefined> {
    const trigger = this.registry.getOrThrow(input.triggerId);
    const executionBoundary = await this.boundaryResolver.resolve(input.spaceId);

    if (trigger.builder === 'session_compaction') {
      if (!input.threadId || !input.snapshot) {
        throw new Error(`Trigger ${trigger.id} requires threadId and snapshot`);
      }

      const job = this.orchestrator.createSessionCompactionJob({
        spaceId: input.spaceId,
        threadId: input.threadId,
        projectSlug: input.projectSlug,
        snapshot: input.snapshot,
        source: normalizeSource(trigger.source),
        executionBoundary,
        triggerEvent: input.triggerEvent ?? trigger.event,
        triggerLabel:
          input.triggerLabel ??
          createContextJobTriggerLabel({
            source: trigger.source,
            event: input.triggerEvent ?? trigger.event,
            label: trigger.label,
          }),
        triggeredAt: input.firedAt,
        reasonOverride: input.reason,
        lifecycleSummary: input.sourceSummary ?? input.reason,
      });

      if (job) {
        await this.bus.emit('context.job.queued', { job });
      }

      return job;
    }

    if (trigger.builder === 'project_promotion') {
      if (!input.threadId || !input.candidate) {
        throw new Error(`Trigger ${trigger.id} requires threadId and promotion candidate`);
      }

      const job = this.orchestrator.createProjectPromotionJob({
        spaceId: input.spaceId,
        threadId: input.threadId,
        candidate: input.candidate,
        source: normalizeSource(trigger.source),
        executionBoundary,
        triggerEvent: input.triggerEvent ?? trigger.event,
        triggerLabel:
          input.triggerLabel ??
          createContextJobTriggerLabel({
            source: trigger.source,
            event: input.triggerEvent ?? trigger.event,
            label: trigger.label,
          }),
        triggeredAt: input.firedAt,
      });

      if (job) {
        await this.bus.emit('context.job.queued', { job });
      }

      return job;
    }

    const job = createPlannedContextJob({
      type: trigger.jobType,
      priority: input.priority ?? trigger.defaultPriority ?? 'medium',
      spaceId: input.spaceId,
      projectSlug: input.projectSlug,
      threadId: input.threadId,
      source: trigger.source,
      executionBoundary,
      triggerEvent: input.triggerEvent ?? trigger.event,
      triggerLabel:
        input.triggerLabel ??
        createContextJobTriggerLabel({
          source: trigger.source,
          event: input.triggerEvent ?? trigger.event,
          label: trigger.label,
        }),
      triggeredAt: input.firedAt,
      reason: input.reason ?? input.sourceSummary ?? trigger.defaultReason,
      payload: input.payload,
    });
    await this.bus.emit('context.job.queued', { job });
    return job;
  }

  async queueTimerTrigger(input: {
    triggerId: string;
    spaceId: string;
    priority?: ContextJobPriority;
    reason?: string;
    payload?: Readonly<Record<string, unknown>>;
    projectSlug?: string;
    threadId?: string;
    firedAt?: string;
    triggerEvent?: string;
    triggerLabel?: string;
  }): Promise<ContextJob | undefined> {
    return this.dispatchTrigger({
      triggerId: input.triggerId,
      spaceId: input.spaceId,
      priority: input.priority,
      reason: input.reason,
      payload: input.payload,
      projectSlug: input.projectSlug,
      threadId: input.threadId,
      firedAt: input.firedAt,
      triggerEvent: input.triggerEvent,
      triggerLabel: input.triggerLabel,
    });
  }

  async queueManualJob(input: {
    triggerId: string;
    spaceId: string;
    priority?: ContextJobPriority;
    reason?: string;
    payload?: Readonly<Record<string, unknown>>;
    projectSlug?: string;
    threadId?: string;
    snapshot?: Parameters<ContextJobOrchestrator['createSessionCompactionJob']>[0]['snapshot'];
    candidate?: ProjectPromotionCandidate;
    firedAt?: string;
    triggerEvent?: string;
    triggerLabel?: string;
  }): Promise<ContextJob | undefined> {
    return this.dispatchTrigger({
      triggerId: input.triggerId,
      spaceId: input.spaceId,
      priority: input.priority,
      reason: input.reason,
      payload: input.payload,
      projectSlug: input.projectSlug,
      threadId: input.threadId,
      snapshot: input.snapshot,
      candidate: input.candidate,
      firedAt: input.firedAt,
      triggerEvent: input.triggerEvent,
      triggerLabel: input.triggerLabel,
    });
  }

  async queueConnectorDigest(input: {
    spaceId: string;
    reason?: string;
    payload?: Readonly<Record<string, unknown>>;
    projectSlug?: string;
    threadId?: string;
    firedAt?: string;
    triggerEvent?: string;
    triggerLabel?: string;
  }): Promise<ContextJob | undefined> {
    return this.dispatchTrigger({
      triggerId: 'connector.connector-digest',
      spaceId: input.spaceId,
      reason: input.reason,
      payload: input.payload,
      projectSlug: input.projectSlug,
      threadId: input.threadId,
      firedAt: input.firedAt,
      triggerEvent: input.triggerEvent,
      triggerLabel: input.triggerLabel,
    });
  }
}
