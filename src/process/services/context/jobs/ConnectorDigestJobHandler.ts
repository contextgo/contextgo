/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import type { ConnectorDigestArtifact, ContextJob } from '../contextDomain';

type SupportedVaultSyncService = Pick<SpaceVaultContextSyncService, 'writeConnectorDigest'>;

export class ConnectorDigestJobHandler {
  constructor(private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService()) {}

  async run(job: ContextJob): Promise<ConnectorDigestArtifact | undefined> {
    if (job.type !== 'connector_digest' && job.type !== 'session_pattern_detection') {
      return undefined;
    }

    const summary = typeof job.payload.summary === 'string' ? job.payload.summary : job.reason;
    const bullets = [
      typeof job.payload.connectorId === 'string' ? `Connector: ${job.payload.connectorId}` : undefined,
      typeof job.payload.sourceRecordId === 'string' ? `Source record: ${job.payload.sourceRecordId}` : undefined,
      typeof job.payload.sourceKind === 'string' ? `Source kind: ${job.payload.sourceKind}` : undefined,
      typeof job.payload.title === 'string' ? `Title: ${job.payload.title}` : undefined,
      typeof job.payload.canonicalUri === 'string' ? `URI: ${job.payload.canonicalUri}` : undefined,
      typeof job.payload.ingestMode === 'string' ? `Ingest mode: ${job.payload.ingestMode}` : undefined,
      typeof job.payload.replayFromCursor === 'string' ? `Replay cursor: ${job.payload.replayFromCursor}` : undefined,
    ].filter((value): value is string => Boolean(value));
    const detailParts = [
      typeof job.payload.summary === 'string' ? job.payload.summary : undefined,
      typeof job.payload.provenanceSummary === 'string' ? job.payload.provenanceSummary : undefined,
      ...bullets,
      job.type === 'session_pattern_detection' ? 'Session pattern detection completed.' : undefined,
    ].filter((value): value is string => Boolean(value));

    return this.vaultSyncService.writeConnectorDigest({
      spaceId: job.spaceId,
      summary,
      detail: detailParts.join('\n') || undefined,
      timestamp: job.completedAt || new Date().toISOString(),
    });
  }
}
