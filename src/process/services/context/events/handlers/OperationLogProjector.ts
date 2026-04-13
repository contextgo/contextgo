/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextJobArtifact, ProjectPromotionArtifact, SessionCompactionArtifact } from '../../contextDomain';
import type { ContextServiceImpl } from '../../ContextServiceImpl';
import type { ContextEventBus } from '../ContextEventBus';

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSessionCompactionArtifact(artifact: ContextJobArtifact | undefined): artifact is SessionCompactionArtifact {
  return Boolean(artifact && 'profileKey' in artifact);
}

function isProjectPromotionArtifact(artifact: ContextJobArtifact | undefined): artifact is ProjectPromotionArtifact {
  return Boolean(artifact && 'relativePath' in artifact);
}

export function registerOperationLogProjector(
  bus: ContextEventBus,
  contextService: Pick<ContextServiceImpl, 'appendSystemOperation'>
): void {
  bus.on('session.signal.detected', async (event) => {
    await contextService.appendSystemOperation({
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      type: 'session.signal_detected',
      entityId: createId('signal'),
      payload: {
        projectSlug: event.payload.projectSlug,
        kind: event.payload.signal.kind,
        summary: event.payload.signal.summary,
        score: event.payload.signal.score,
        occurredAt: event.payload.signal.occurredAt,
      },
    });
  });

  bus.on('connector.source.ingested', async (event) => {
    await contextService.appendSystemOperation({
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      type: 'source.ingested',
      entityId: event.payload.sourceRecordId,
      payload: {
        connectorId: event.payload.connectorId,
        title: event.payload.title,
        canonicalUri: event.payload.canonicalUri,
        sourceKind: event.payload.source.kind,
        ingestedAt: event.payload.ingestedAt,
      },
    });
  });

  bus.on('context.job.queued', async (event) => {
    await contextService.appendSystemOperation({
      spaceId: event.payload.job.spaceId,
      threadId: event.payload.job.threadId,
      type: 'context.job_queued',
      entityId: event.payload.job.id,
      payload: {
        jobType: event.payload.job.type,
        priority: event.payload.job.priority,
        reason: event.payload.job.reason,
        projectSlug: event.payload.job.projectSlug,
        source: event.payload.job.source,
      },
    });
  });

  bus.on('context.job.completed', async (event) => {
    const artifact = event.payload.artifact;
    await contextService.appendSystemOperation({
      spaceId: event.payload.job.spaceId,
      threadId: event.payload.job.threadId,
      type: 'context.job_completed',
      entityId: event.payload.job.id,
      payload: {
        jobType: event.payload.job.type,
        projectSlug: event.payload.job.projectSlug,
        status: event.payload.status,
        artifactSummary: artifact?.summary,
        profileKey: isSessionCompactionArtifact(artifact) ? artifact.profileKey : undefined,
        pressure: isSessionCompactionArtifact(artifact) ? artifact.pressure : undefined,
        relativePath: isProjectPromotionArtifact(artifact) ? artifact.relativePath : undefined,
        noteTitle: isProjectPromotionArtifact(artifact) ? artifact.noteTitle : undefined,
        error: event.payload.error,
        completedAt: event.payload.completedAt,
      },
    });
  });
}
