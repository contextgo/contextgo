/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveContextEngineAssistantRuntime } from '../../projectContext/ContextEngineAssistantRuntimeResolver';
import type { IChannelRun } from '@process/channels/types';
import { getDatabase } from '@process/services/database';
import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, ContextJobArtifact } from '../../contextDomain';
import type { ContextEventBus } from '../ContextEventBus';

type QueryResult<T> = {
  success: boolean;
  error?: string;
  data?: T;
};

type MaintenanceRunEvent = {
  kind: 'status' | 'tool' | 'message';
  text: string;
  at: number;
};

type MaintenanceRunMetadata = {
  kind?: string;
  systemManaged?: boolean;
  assistantId?: string;
  systemOwner?: 'context-engine';
  systemRole?: string;
  governanceIdentity?: ContextJob['governanceIdentity'];
  jobType?: string;
  spaceId?: string;
  threadId?: string;
  projectSlug?: string;
  reason?: string;
  source?: string;
  trigger?: ContextJob['trigger'];
  executionBoundary?: ContextJob['executionBoundary'];
  scopeLabel?: string;
  currentTask?: string;
  latestArtifactSummary?: string;
  artifactRelativePath?: string;
  artifactTitle?: string;
  artifactTargets?: string[];
  lastError?: string;
  events?: MaintenanceRunEvent[];
};

const CONTEXT_ENGINE_BACKEND = 'context-engine';

function assertQuerySuccess<T>(result: QueryResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.error || fallback);
  }

  return result.data as T;
}

function parseTimestamp(value: string | undefined, fallback = Date.now()): number {
  if (!value) {
    return fallback;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatJobType(jobType: ContextJob['type']): string {
  return jobType.replace(/_/g, ' ');
}

function buildScopeLabel(job: ContextJob): string {
  if (job.projectSlug) {
    return job.projectSlug;
  }
  if (job.threadId) {
    return job.threadId;
  }
  return job.executionBoundary?.spaceName || job.spaceId;
}

function readMetadata(metadata: IChannelRun['metadata']): MaintenanceRunMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as MaintenanceRunMetadata;
}

function appendEvent(metadata: MaintenanceRunMetadata, event: MaintenanceRunEvent): MaintenanceRunMetadata {
  const existing = Array.isArray(metadata.events) ? metadata.events : [];
  return {
    ...metadata,
    events: [event, ...existing].slice(0, 8),
  };
}

function getArtifactRelativePath(artifact: ContextJobArtifact | undefined): string | undefined {
  if (!artifact || !('relativePath' in artifact) || typeof artifact.relativePath !== 'string') {
    return undefined;
  }

  return artifact.relativePath.trim() || undefined;
}

function getArtifactTitle(artifact: ContextJobArtifact | undefined): string | undefined {
  if (!artifact) {
    return undefined;
  }

  if ('noteTitle' in artifact && typeof artifact.noteTitle === 'string') {
    return artifact.noteTitle.trim() || undefined;
  }

  return undefined;
}

function buildRunArtifactTitle(job: ContextJob): string {
  return `Context Run · ${formatJobType(job.type)}`;
}

function buildCurrentTask(
  job: ContextJob,
  artifact: ContextJobArtifact | undefined,
  existingMetadata: MaintenanceRunMetadata
): string {
  if (
    artifact &&
    'currentTask' in artifact &&
    typeof artifact.currentTask === 'string' &&
    artifact.currentTask.trim()
  ) {
    return artifact.currentTask;
  }

  if (artifact?.summary) {
    return artifact.summary;
  }

  if (existingMetadata.currentTask?.trim()) {
    return existingMetadata.currentTask;
  }

  return job.reason;
}

function buildEventText(
  phase: 'queued' | 'started' | 'completed' | 'failed',
  job: ContextJob,
  artifact?: ContextJobArtifact,
  error?: string
): string {
  const base = formatJobType(job.type);

  if (phase === 'queued') {
    return `Queued ${base}`;
  }
  if (phase === 'started') {
    return `Running ${base}`;
  }
  if (phase === 'failed') {
    return error ? `Failed ${base}: ${error}` : `Failed ${base}`;
  }

  return artifact?.summary ? `Completed ${base}: ${artifact.summary}` : `Completed ${base}`;
}

async function upsertRun(input: {
  job: ContextJob;
  status: IChannelRun['status'];
  startedAt: number;
  endedAt?: number;
  phase: 'queued' | 'started' | 'completed' | 'failed';
  artifact?: ContextJobArtifact;
  error?: string;
}): Promise<void> {
  const db = await getDatabase();
  const existing = assertQuerySuccess(db.getChannelRun(input.job.id), `Failed to load maintenance run ${input.job.id}`);
  const resolvedRuntime = resolveContextEngineAssistantRuntime(input.job);
  assertQuerySuccess(
    db.upsertAgentProfile(resolvedRuntime.profile),
    `Failed to upsert maintenance profile ${resolvedRuntime.profile.id}`
  );

  const existingMetadata = readMetadata(existing?.metadata);
  const nextMetadata = appendEvent(
    {
      ...existingMetadata,
      kind: 'context-maintenance',
      systemManaged: true,
      assistantId: resolvedRuntime.assistant?.id ?? existingMetadata.assistantId,
      systemOwner: resolvedRuntime.assistant?.owner ?? existingMetadata.systemOwner,
      systemRole: resolvedRuntime.assistant?.systemRole ?? existingMetadata.systemRole,
      governanceIdentity: input.job.governanceIdentity,
      jobType: input.job.type,
      spaceId: input.job.spaceId,
      threadId: input.job.threadId,
      projectSlug: input.job.projectSlug,
      reason: input.job.reason,
      source: input.job.source,
      trigger: input.job.trigger,
      executionBoundary: input.job.executionBoundary,
      scopeLabel: buildScopeLabel(input.job),
      currentTask: buildCurrentTask(input.job, input.artifact, existingMetadata),
      latestArtifactSummary: input.artifact?.summary ?? existingMetadata.latestArtifactSummary,
      artifactRelativePath: getArtifactRelativePath(input.artifact) ?? existingMetadata.artifactRelativePath,
      artifactTitle: getArtifactTitle(input.artifact) ?? existingMetadata.artifactTitle,
      artifactTargets: Array.isArray(input.job.payload.artifactTargets)
        ? input.job.payload.artifactTargets.filter((target): target is string => typeof target === 'string')
        : existingMetadata.artifactTargets,
      lastError: input.error,
    },
    {
      kind: 'status',
      text: buildEventText(input.phase, input.job, input.artifact, input.error),
      at: input.endedAt ?? input.startedAt,
    }
  );

  const run: IChannelRun = {
    id: input.job.id,
    rootRunId: input.job.id,
    agentProfileId: resolvedRuntime.profile.id,
    backend: CONTEXT_ENGINE_BACKEND,
    conversationId: input.job.threadId,
    workspaceRef: input.job.executionBoundary?.vaultRoot || input.job.projectSlug,
    status: input.status,
    metadata: nextMetadata,
    startedAt: existing?.startedAt ?? input.startedAt,
    endedAt: input.endedAt ?? existing?.endedAt,
  };

  assertQuerySuccess(db.upsertChannelRun(run), `Failed to upsert maintenance run ${run.id}`);
}

export function registerContextJobRunProjector(
  bus: ContextEventBus,
  vaultSyncService: Pick<SpaceVaultContextSyncService, 'writeContextRunArtifact'> = new SpaceVaultContextSyncService()
): void {
  bus.on('context.job.queued', async (event) => {
    await upsertRun({
      job: event.payload.job,
      status: 'pending',
      startedAt: parseTimestamp(event.payload.job.queuedAt),
      phase: 'queued',
    });
  });

  bus.on('context.job.started', async (event) => {
    await upsertRun({
      job: event.payload.job,
      status: 'running',
      startedAt: parseTimestamp(event.payload.startedAt),
      phase: 'started',
    });
  });

  bus.on('context.job.completed', async (event) => {
    const completedAt = parseTimestamp(event.payload.completedAt);
    await upsertRun({
      job: event.payload.job,
      status: event.payload.status === 'completed' ? 'finished' : 'error',
      startedAt: parseTimestamp(event.payload.job.startedAt ?? event.payload.job.queuedAt),
      endedAt: completedAt,
      phase: event.payload.status === 'completed' ? 'completed' : 'failed',
      artifact: event.payload.artifact,
      error: event.payload.error,
    });
  });

  bus.on('context.job.completed', async (event) => {
    if (event.payload.status !== 'completed') {
      return;
    }

    const completedAt = parseTimestamp(event.payload.completedAt);

    const artifact = event.payload.artifact;
    if (artifact && getArtifactRelativePath(artifact)) {
      return;
    }

    const detail =
      artifact && 'detail' in artifact && typeof artifact.detail === 'string' ? artifact.detail : event.payload.error;
    const persistedArtifact = await vaultSyncService.writeContextRunArtifact({
      spaceId: event.payload.job.spaceId,
      runId: event.payload.job.id,
      title: getArtifactTitle(artifact) ?? buildRunArtifactTitle(event.payload.job),
      summary: artifact?.summary ?? event.payload.job.reason,
      detail,
      timestamp: event.payload.completedAt,
    });

    if (!persistedArtifact) {
      return;
    }

    await upsertRun({
      job: event.payload.job,
      status: 'finished',
      startedAt: parseTimestamp(event.payload.job.startedAt ?? event.payload.job.queuedAt),
      endedAt: completedAt,
      phase: 'completed',
      artifact: {
        summary: persistedArtifact.summary,
        noteTitle: persistedArtifact.title,
        relativePath: persistedArtifact.relativePath,
      } as ContextJobArtifact,
      error: event.payload.error,
    });
  });
}
