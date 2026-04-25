import { describe, expect, it, vi } from 'vitest';
import { SessionPatternDetectionJobHandler } from '../../../../../../src/process/services/context/jobs/SessionPatternDetectionJobHandler';

describe('SessionPatternDetectionJobHandler', () => {
  it('writes a dedicated run artifact for detected session patterns', async () => {
    const writeContextRunArtifact = vi.fn(
      async (input: { spaceId: string; runId: string; title: string; summary: string; detail?: string }) => ({
        spaceId: input.spaceId,
        title: input.title,
        relativePath: `System/Context Engine/Runs/${input.runId}.md`,
        summary: input.summary,
      })
    );

    const handler = new SessionPatternDetectionJobHandler({
      writeContextRunArtifact,
    } as never);

    await handler.run({
      id: 'job-session-pattern-1',
      type: 'session_pattern_detection',
      status: 'completed',
      priority: 'medium',
      governanceIdentity: 'session_steward',
      spaceId: 'space-1',
      threadId: 'thread-1',
      source: 'timer',
      reason: 'Periodically inspect the session for recurring patterns.',
      payload: {
        summary: 'Detected repeated interruption and strategy-shift signals.',
        detail: 'The user interrupted two long-running plans before converging on a smaller patch.',
        signalKinds: ['user_interrupt', 'strategy_shift'],
        patternBullets: ['Repeated user interruption after long tool runs.', 'Strategy converged on a minimal patch.'],
      },
      queuedAt: '2026-04-22T01:00:00.000Z',
      completedAt: '2026-04-22T01:02:00.000Z',
    });

    expect(writeContextRunArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-1',
        runId: 'job-session-pattern-1',
        title: 'Session Pattern Detection',
        summary: 'Detected repeated interruption and strategy-shift signals.',
        detail: expect.stringContaining('Signal kinds: user_interrupt, strategy_shift'),
      })
    );
    expect(writeContextRunArtifact.mock.calls[0]?.[0]?.detail).toContain('Thread ID: `thread-1`');
    expect(writeContextRunArtifact.mock.calls[0]?.[0]?.detail).toContain(
      'Repeated user interruption after long tool runs.'
    );
  });
});
