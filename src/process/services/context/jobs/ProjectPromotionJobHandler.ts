/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, ProjectPromotionArtifact, ProjectPromotionCandidate } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'writeProjectPromotion'>;

function getCandidate(job: ContextJob): ProjectPromotionCandidate | undefined {
  const candidate = job.payload.candidate;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const typed = candidate as Partial<ProjectPromotionCandidate>;
  if (!typed.projectSlug || !typed.summary || !Array.isArray(typed.sourceThreadIds)) {
    return undefined;
  }

  return {
    projectSlug: typed.projectSlug,
    summary: typed.summary,
    detail: typed.detail,
    sourceThreadIds: typed.sourceThreadIds.filter(
      (threadId): threadId is string => typeof threadId === 'string' && threadId.length > 0
    ),
    confidence: typeof typed.confidence === 'number' ? typed.confidence : 0.8,
  };
}

export class ProjectPromotionJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<ProjectPromotionArtifact | undefined> {
    if (job.type !== 'project_promotion') {
      return undefined;
    }

    const candidate = getCandidate(job);
    if (!candidate) {
      return undefined;
    }

    return this.vaultSyncService.writeProjectPromotion({
      spaceId: job.spaceId,
      projectSlug: candidate.projectSlug,
      summary: candidate.summary,
      detail: candidate.detail,
      sourceThreadIds: candidate.sourceThreadIds,
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
