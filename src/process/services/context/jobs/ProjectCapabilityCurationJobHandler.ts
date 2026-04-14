/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, ProjectCapabilityCurationArtifact } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'curateProjectCapabilities'>;

export class ProjectCapabilityCurationJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<ProjectCapabilityCurationArtifact | undefined> {
    if (job.type !== 'project_capability_curation' || !job.projectSlug) {
      return undefined;
    }

    return this.vaultSyncService.curateProjectCapabilities({
      spaceId: job.spaceId,
      projectSlug: job.projectSlug,
      summary: typeof job.payload.summary === 'string' ? job.payload.summary : job.reason,
      detail: typeof job.payload.detail === 'string' ? job.payload.detail : undefined,
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
