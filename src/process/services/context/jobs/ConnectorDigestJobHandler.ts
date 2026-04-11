/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ConnectorDigestArtifact, ContextJob } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'writeConnectorDigest'>;

export class ConnectorDigestJobHandler {
  constructor(
    private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()
  ) {}

  async run(job: ContextJob): Promise<ConnectorDigestArtifact | undefined> {
    if (job.type !== 'connector_digest' && job.type !== 'session_pattern_detection') {
      return undefined;
    }

    return this.vaultSyncService.writeConnectorDigest({
      spaceId: job.spaceId,
      summary: job.reason,
      detail:
        typeof job.payload.summary === 'string'
          ? job.payload.summary
          : job.type === 'session_pattern_detection'
            ? 'Session pattern detection completed.'
            : undefined,
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
