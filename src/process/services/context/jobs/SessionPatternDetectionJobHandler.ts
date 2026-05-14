/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, ContextRunArtifact } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'writeContextRunArtifact'>;

function buildSignalList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function buildDetail(job: ContextJob): string | undefined {
  const detail = typeof job.payload.detail === 'string' ? job.payload.detail.trim() : '';
  const signalKinds = buildSignalList(job.payload.signalKinds);
  const patternBullets = buildSignalList(job.payload.patternBullets);
  const lines = [
    job.threadId ? `- Thread ID: \`${job.threadId}\`` : undefined,
    signalKinds.length > 0 ? `- Signal kinds: ${signalKinds.join(', ')}` : undefined,
    ...patternBullets.map((item) => `- ${item}`),
  ].filter((value): value is string => Boolean(value));

  if (!detail && lines.length === 0) {
    return undefined;
  }

  return [detail || undefined, lines.length > 0 ? ['## Signals', '', ...lines].join('\n') : undefined]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
}

export class SessionPatternDetectionJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<ContextRunArtifact | undefined> {
    if (job.type !== 'session_pattern_detection') {
      return undefined;
    }

    const summary = typeof job.payload.summary === 'string' ? job.payload.summary : job.reason;
    return this.vaultSyncService.writeContextRunArtifact({
      spaceId: job.spaceId,
      runId: job.id,
      title: 'Session Pattern Detection',
      summary,
      detail: buildDetail(job),
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
