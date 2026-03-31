import { describe, expect, it } from 'vitest';
import { TextChunkingService } from '../../../src/process/services/context/TextChunkingService';

describe('TextChunkingService', () => {
  it('splits long text into overlapping chunks with stable ordering', () => {
    const service = new TextChunkingService();
    const content = [
      'Paragraph one explains the release checklist and why production validation matters.',
      'Paragraph two captures the rollback strategy, deployment guardrails, and the approval sequence.',
      'Paragraph three records the follow-up actions and ownership mapping for the next release.',
    ].join('\n\n');

    const chunks = service.buildChunks({
      spaceId: 'space-1',
      documentId: 'doc-1',
      content,
      tier: 'source',
      config: {
        targetTokens: 18,
        overlapTokens: 6,
      },
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.sequence).toBe(0);
    expect(chunks[1]?.sequence).toBe(1);
    expect(chunks.every((chunk) => chunk.tier === 'source')).toBe(true);
    expect(chunks[0]?.contentHash).not.toBe(chunks[1]?.contentHash);
  });
});
