import { describe, expect, it, vi } from 'vitest';
import { ConnectorDigestJobHandler } from '../../../../../../src/process/services/context/jobs/ConnectorDigestJobHandler';

describe('ConnectorDigestJobHandler', () => {
  it('writes provenance-rich digest detail for incremental connector ingestion', async () => {
    const writeConnectorDigest = vi.fn(async (input: { spaceId: string; summary: string; detail?: string }) => ({
      spaceId: input.spaceId,
      title: 'Connector Digest',
      relativePath: 'System/Context Engine/connector-digest.md',
      summary: input.summary,
    }));

    const handler = new ConnectorDigestJobHandler({
      writeConnectorDigest,
    } as never);

    await handler.run({
      id: 'job-connector-1',
      type: 'connector_digest',
      status: 'completed',
      priority: 'medium',
      governanceIdentity: 'space_curator',
      spaceId: 'space-1',
      source: 'connector',
      reason: 'Digest newly ingested connector content into reusable context.',
      payload: {
        connectorId: 'contextgo-browser-extension',
        sourceRecordId: 'source-1',
        sourceKind: 'web-resource',
        title: 'Release checklist page',
        canonicalUri: 'https://example.com/release-checklist',
        summary: 'Captured browser activity from example.com: Release checklist page',
        ingestMode: 'incremental',
        replayFromCursor: 'cursor-42',
        provenanceSummary: 'Merged 3 newly ingested browser records.',
      },
      queuedAt: '2026-04-17T04:00:00.000Z',
      completedAt: '2026-04-17T04:02:00.000Z',
    });

    expect(writeConnectorDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-1',
        summary: 'Captured browser activity from example.com: Release checklist page',
        detail: expect.stringContaining('Ingest mode: incremental'),
      })
    );
    expect(writeConnectorDigest.mock.calls[0]?.[0]?.detail).toContain('Replay cursor: cursor-42');
    expect(writeConnectorDigest.mock.calls[0]?.[0]?.detail).toContain('Source record: source-1');
    expect(writeConnectorDigest.mock.calls[0]?.[0]?.detail).toContain('Merged 3 newly ingested browser records.');
  });
});
