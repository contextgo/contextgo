/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ContextJob, ProjectCapabilityCurationArtifact } from '../contextDomain';

type SupportedVaultSyncService = Pick<
  SpaceVaultContextSyncService,
  'curateProjectCapabilities' | 'writeProjectCuratorProposal'
>;

export class ProjectCapabilityCurationJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<ProjectCapabilityCurationArtifact | undefined> {
    if (job.type !== 'project_capability_curation' || !job.projectSlug) {
      return undefined;
    }

    const summary = typeof job.payload.summary === 'string' ? job.payload.summary : job.reason;
    const detail = typeof job.payload.detail === 'string' ? job.payload.detail : undefined;
    const timestamp = job.completedAt || new Date().toISOString();
    const capabilityArtifact = await this.vaultSyncService.curateProjectCapabilities({
      spaceId: job.spaceId,
      projectSlug: job.projectSlug,
      summary,
      detail,
      timestamp,
    });

    const rulesProposal = await this.vaultSyncService.writeProjectCuratorProposal({
      spaceId: job.spaceId,
      projectSlug: job.projectSlug,
      title: 'AGENTS append proposal',
      proposalKind: 'project_rules',
      summary: 'Add a stable release-validation rule.',
      targetPath: 'AGENTS.md',
      additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
      evidence: [summary],
      timestamp,
    });

    const skillProposal = await this.vaultSyncService.writeProjectCuratorProposal({
      spaceId: job.spaceId,
      projectSlug: job.projectSlug,
      title: 'Skill append proposal',
      proposalKind: 'project_skill',
      summary: 'Update release-validation skill guidance.',
      targetPath: 'skills/release-validation/SKILL.md',
      additions: ['Add a short note describing when to run focused release verification.'],
      evidence: [summary],
      timestamp,
    });

    if (!capabilityArtifact) {
      return undefined;
    }

    return {
      ...capabilityArtifact,
      summary: [capabilityArtifact.summary, rulesProposal?.summary, skillProposal?.summary].filter(Boolean).join(' | '),
    };
  }
}
