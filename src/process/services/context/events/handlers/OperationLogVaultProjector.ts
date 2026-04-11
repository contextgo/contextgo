/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextJob, ContextJobStatus, SessionSignal } from '../../contextDomain';
import type { ContextEventBus } from '../ContextEventBus';
import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import i18n, { i18nReady } from '@process/services/i18n';

type OperationLogEntryContent = {
  title: string;
  bullets: string[];
  body?: string;
};

const SIGNAL_TITLE_FALLBACKS: Record<SessionSignal['kind'], string> = {
  user_interrupt: 'Run stopped before completion',
  repeated_request: 'Task was repeated',
  strategy_shift: 'Approach changed during the session',
  tool_failure_cluster: 'Tool failures started clustering',
  memory_candidate_created: 'Captured a takeaway for review',
  memory_candidate_promoted: 'Saved a stable takeaway',
  context_window_prepared: 'Prepared context for this turn',
};

const JOB_TITLE_FALLBACKS: Record<
  ContextJob['type'],
  {
    queued: string;
    completed: string;
    failed: string;
  }
> = {
  session_compaction: {
    queued: 'Session context update queued',
    completed: 'Session context updated',
    failed: 'Session context update failed',
  },
  session_pattern_detection: {
    queued: 'Session pattern scan queued',
    completed: 'Session pattern scan completed',
    failed: 'Session pattern scan failed',
  },
  project_promotion: {
    queued: 'Project knowledge update queued',
    completed: 'Project knowledge updated',
    failed: 'Project knowledge update failed',
  },
  space_memory_distillation: {
    queued: 'Space memory distillation queued',
    completed: 'Space memory distillation completed',
    failed: 'Space memory distillation failed',
  },
  connector_digest: {
    queued: 'Connector digest queued',
    completed: 'Connector digest completed',
    failed: 'Connector digest failed',
  },
};

function trimLine(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function formatSignalEntry(signal: SessionSignal): OperationLogEntryContent {
  const title = i18n.t(`agent.contextEngine.operationLog.signal.${signal.kind}.title`, {
    defaultValue: SIGNAL_TITLE_FALLBACKS[signal.kind],
  });

  return {
    title,
    bullets: [trimLine(signal.summary)].filter((value): value is string => Boolean(value)),
    body: trimLine(signal.detail),
  };
}

function formatJobTitle(jobType: ContextJob['type'], status: 'queued' | 'completed' | 'failed'): string {
  return i18n.t(`agent.contextEngine.operationLog.job.${jobType}.${status}`, {
    defaultValue: JOB_TITLE_FALLBACKS[jobType][status],
  });
}

function formatJobQueuedEntry(job: ContextJob): OperationLogEntryContent {
  return {
    title: formatJobTitle(job.type, 'queued'),
    bullets: [trimLine(job.reason)].filter((value): value is string => Boolean(value)),
  };
}

function formatCompletedJobEntry(input: {
  job: ContextJob;
  status: Extract<ContextJobStatus, 'completed' | 'failed'>;
  artifactSummary?: string;
  error?: string;
}): OperationLogEntryContent {
  const bullets = [trimLine(input.artifactSummary)].filter((value): value is string => Boolean(value));
  const body = input.error ? `${i18n.t('common.error', { defaultValue: 'Error' })}: ${input.error}` : undefined;

  return {
    title: formatJobTitle(input.job.type, input.status),
    bullets,
    body,
  };
}

export function registerOperationLogVaultProjector(
  bus: ContextEventBus,
  vaultSyncService: Pick<SpaceVaultContextSyncService, 'appendOperationLogEntry'> = new SpaceVaultContextSyncService()
): void {
  bus.on('session.signal.detected', async (event) => {
    await i18nReady;
    const entry = formatSignalEntry(event.payload.signal);
    await vaultSyncService.appendOperationLogEntry({
      spaceId: event.payload.spaceId,
      timestamp: event.payload.signal.occurredAt,
      title: entry.title,
      bullets: entry.bullets,
      body: entry.body,
    });
  });

  bus.on('context.job.queued', async (event) => {
    await i18nReady;
    const entry = formatJobQueuedEntry(event.payload.job);
    await vaultSyncService.appendOperationLogEntry({
      spaceId: event.payload.job.spaceId,
      timestamp: event.payload.job.queuedAt,
      title: entry.title,
      bullets: entry.bullets,
      body: entry.body,
    });
  });

  bus.on('context.job.completed', async (event) => {
    await i18nReady;
    const entry = formatCompletedJobEntry({
      job: event.payload.job,
      status: event.payload.status,
      artifactSummary: event.payload.artifact?.summary,
      error: event.payload.error,
    });

    await vaultSyncService.appendOperationLogEntry({
      spaceId: event.payload.job.spaceId,
      timestamp: event.payload.completedAt,
      title: entry.title,
      bullets: entry.bullets,
      body: entry.body,
    });
  });
}
