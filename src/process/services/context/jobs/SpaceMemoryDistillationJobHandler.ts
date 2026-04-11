/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, SpaceMemoryDistillationArtifact } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'writeSpaceMemoryDistillation'>;

export class SpaceMemoryDistillationJobHandler {
  constructor(
    private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()
  ) {}

  async run(job: ContextJob): Promise<SpaceMemoryDistillationArtifact | undefined> {
    if (job.type !== 'space_memory_distillation') {
      return undefined;
    }

    return this.vaultSyncService.writeSpaceMemoryDistillation({
      spaceId: job.spaceId,
      summary: job.reason,
      detail: typeof job.payload.summary === 'string' ? job.payload.summary : undefined,
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
