/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, SpaceMemoryDistillationArtifact } from '../contextDomain';

type SupportedVaultSyncService = Pick<
  SpaceVaultContextSyncService,
  'writeSpaceMemoryDistillation' | 'writeProfileMemoryDistillation'
>;

export class SpaceMemoryDistillationJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<SpaceMemoryDistillationArtifact | undefined> {
    if (job.type !== 'space_memory_distillation') {
      return undefined;
    }

    const summary = typeof job.payload.summary === 'string' ? job.payload.summary : job.reason;
    const detail = typeof job.payload.detail === 'string' ? job.payload.detail : undefined;
    const timestamp = job.completedAt || new Date().toISOString();

    const digestArtifact = await this.vaultSyncService.writeSpaceMemoryDistillation({
      spaceId: job.spaceId,
      summary,
      detail,
      timestamp,
    });

    const profileSummary =
      typeof job.payload.profileSummary === 'string' && job.payload.profileSummary.trim().length > 0
        ? job.payload.profileSummary
        : summary;
    const profileDetail = typeof job.payload.profileDetail === 'string' ? job.payload.profileDetail : detail;
    const profileBullets = Array.isArray(job.payload.profileBullets)
      ? job.payload.profileBullets.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const profileArtifact = await this.vaultSyncService.writeProfileMemoryDistillation({
      spaceId: job.spaceId,
      summary: profileSummary,
      detail: profileDetail,
      bullets: profileBullets,
      timestamp,
    });

    if (!digestArtifact) {
      return undefined;
    }

    return {
      ...digestArtifact,
      summary: [digestArtifact.summary, profileArtifact?.summary].filter(Boolean).join(' | '),
    };
  }
}
