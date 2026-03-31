import { describe, expect, it, vi } from 'vitest';
import { createInMemoryContextEngineDependencies } from '../../../packages/context-engine/src/inMemoryStores';
import type { MemoryCandidateEntry } from '../../../packages/context-engine/src/domain';

vi.mock('../../../src/process/services/database/context/SqliteContextStores', () => ({
  createSqliteContextEngineDependencies: vi.fn(() => {
    throw new Error('default sqlite dependencies should not be used in this test');
  }),
}));

const { ContextServiceImpl } = await import('../../../src/process/services/context/ContextServiceImpl');

const now = '2026-03-30T00:00:00.000Z';

describe('ContextServiceImpl promotion flow', () => {
  it('approves a pending candidate and promotes it to a durable memory', async () => {
    const deps = createInMemoryContextEngineDependencies({
      candidates: [
        {
          id: 'candidate-1',
          spaceId: 'space-1',
          threadId: 'thread-1',
          kind: 'workflow',
          tier: 'experiential',
          summary: 'Use the release checklist before shipping.',
          sourceIds: ['source-1'],
          chunkIds: [],
          confidence: 0.78,
          priority: 'high',
          evidenceCount: 2,
          repeatedAcrossSources: 1,
          recentReferenceCount: 1,
          userConfirmed: false,
          manuallyPinned: false,
          executionBacked: true,
          contradictionDetected: false,
          promotionScore: 42,
          promotionRationale: ['keep-as-candidate'],
          destination: 'memory',
          state: 'pending_review',
          reviewStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        } satisfies MemoryCandidateEntry,
      ],
    });
    const service = new ContextServiceImpl(deps);

    const promoted = await service.approveMemoryCandidate('candidate-1', 'tester');
    const memories = await deps.memories.listBySpace('space-1');

    expect(promoted?.state).toBe('promoted');
    expect(promoted?.reviewStatus).toBe('approved');
    expect(promoted?.reviewedBy).toBe('tester');
    expect(memories).toHaveLength(1);
    expect(memories[0]?.summary).toBe('Use the release checklist before shipping.');
    expect(memories[0]?.tier).toBe('experiential');
  });

  it('marks a pending candidate as approved when promoting to document', async () => {
    const deps = createInMemoryContextEngineDependencies({
      candidates: [
        {
          id: 'candidate-2',
          spaceId: 'space-1',
          threadId: 'thread-1',
          kind: 'decision',
          tier: 'factual',
          summary: 'Write the rollout decision into a document.',
          sourceIds: ['source-1'],
          chunkIds: [],
          confidence: 0.71,
          priority: 'medium',
          evidenceCount: 1,
          repeatedAcrossSources: 0,
          recentReferenceCount: 1,
          userConfirmed: false,
          manuallyPinned: false,
          executionBacked: true,
          contradictionDetected: false,
          promotionScore: 38,
          promotionRationale: ['keep-as-candidate'],
          destination: 'memory',
          state: 'pending_review',
          reviewStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        } satisfies MemoryCandidateEntry,
      ],
    });
    const service = new ContextServiceImpl(deps);

    const promoted = await service.promoteMemoryCandidateToDestination('candidate-2', 'document', 'tester');
    const memories = await deps.memories.listBySpace('space-1');

    expect(promoted?.destination).toBe('document');
    expect(promoted?.state).toBe('approved');
    expect(promoted?.reviewStatus).toBe('approved');
    expect(memories).toHaveLength(0);
  });
});
