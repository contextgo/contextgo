/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextJobOrchestrator } from '../../ContextJobOrchestrator';
import type { ContextJobArtifact } from '../../contextDomain';
import type { ContextEventBus } from '../ContextEventBus';

function getPromotionCandidate(artifact: ContextJobArtifact | undefined) {
  if (!artifact || !('promotionCandidate' in artifact)) {
    return undefined;
  }

  return artifact.promotionCandidate;
}

export function registerContextJobProjector(
  bus: ContextEventBus,
  orchestrator: ContextJobOrchestrator = new ContextJobOrchestrator()
): void {
  bus.on('context.window.prepared', async (event) => {
    const job = orchestrator.createSessionCompactionJob({
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      projectSlug: event.payload.projectSlug,
      snapshot: event.payload.snapshot,
      source: 'runtime-hook',
    });

    if (job) {
      await bus.emit('context.job.queued', { job });
    }
  });

  bus.on('session.turn.completed', async (event) => {
    const compactionJob = orchestrator.createSessionCompactionJob({
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      projectSlug: event.payload.projectSlug,
      snapshot: event.payload.snapshot,
      source: 'runtime-hook',
    });

    if (compactionJob) {
      await bus.emit('context.job.queued', { job: compactionJob });
    }
  });

  bus.on('session.interrupted', async (event) => {
    const job = orchestrator.createSessionCompactionJob({
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      projectSlug: event.payload.projectSlug,
      snapshot: event.payload.snapshot,
      source: 'conversation-lifecycle',
    });

    if (job) {
      await bus.emit('context.job.queued', { job });
    }
  });

  bus.on('context.job.completed', async (event) => {
    if (event.payload.status !== 'completed' || event.payload.job.type !== 'session_compaction') {
      return;
    }

    const promotionCandidate = getPromotionCandidate(event.payload.artifact);
    if (!promotionCandidate) {
      return;
    }

    const promotionJob = orchestrator.createProjectPromotionJob({
      spaceId: event.payload.job.spaceId,
      threadId: event.payload.job.threadId || event.payload.job.id,
      candidate: promotionCandidate,
      source: 'runtime-hook',
    });

    if (promotionJob) {
      await bus.emit('context.job.queued', { job: promotionJob });
    }
  });
}
