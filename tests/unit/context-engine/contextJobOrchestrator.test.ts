import { describe, expect, it } from 'vitest';
import {
  ContextJobOrchestrator,
  buildPromotionCandidateFromSummary,
  collectSessionSignalKinds,
  createPlannedContextJob,
} from '../../../src/process/services/context/ContextJobOrchestrator';

function makeSignal(kind: Parameters<typeof collectSessionSignalKinds>[0][number]['kind'], summary: string) {
  return {
    kind,
    summary,
    score: 0.9,
    occurredAt: '2026-04-08T00:00:00.000Z',
  } as const;
}

describe('ContextJobOrchestrator', () => {
  const orchestrator = new ContextJobOrchestrator();

  it('queues a high-priority session compaction job when interruptions and repeated requests accumulate', () => {
    const job = orchestrator.createSessionCompactionJob({
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'repo-1',
      source: 'runtime-hook',
      lifecycleSummary: 'Session compaction handoff after repeated interruptions.',
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 1,
        lastUserGoal: 'Fix the release pipeline.',
        lastAssistantOutcome: 'Switched to a smaller patch plan.',
        recentSignals: [
          makeSignal('user_interrupt', 'User stopped the run after a long build.'),
          makeSignal('repeated_request', 'User repeated the same release ask.'),
          makeSignal('repeated_request', 'User asked again for a minimal patch.'),
        ],
      },
    });

    expect(job).toBeDefined();
    expect(job?.type).toBe('session_compaction');
    expect(job?.priority).toBe('high');
    expect(job?.projectSlug).toBe('repo-1');
    expect(job?.governanceIdentity).toBe('session_steward');
    expect(job?.payload).toEqual(
      expect.objectContaining({
        artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
        lifecycleSummary: 'Session compaction handoff after repeated interruptions.',
      })
    );
  });

  it('does not queue compaction when the session is still too small and quiet', () => {
    const job = orchestrator.createSessionCompactionJob({
      spaceId: 'space-1',
      threadId: 'thread-1',
      source: 'runtime-hook',
      snapshot: {
        userTurns: 1,
        assistantReplies: 0,
        interruptions: 0,
        recentSignals: [],
      },
    });

    expect(job).toBeUndefined();
  });

  it('queues project promotion only for stable candidates', () => {
    const weakJob = orchestrator.createProjectPromotionJob({
      spaceId: 'space-1',
      threadId: 'thread-1',
      source: 'runtime-hook',
      candidate: buildPromotionCandidateFromSummary({
        projectSlug: 'repo-1',
        summary: 'Prefer minimal diffs.',
        sourceThreadIds: ['thread-1'],
        confidence: 0.6,
      }),
    });

    const strongJob = orchestrator.createProjectPromotionJob({
      spaceId: 'space-1',
      threadId: 'thread-1',
      source: 'runtime-hook',
      candidate: buildPromotionCandidateFromSummary({
        projectSlug: 'repo-1',
        summary: 'Prefer minimal diffs and explicit validation steps.',
        detail: 'Observed across repeated session corrections.',
        sourceThreadIds: ['thread-1', 'thread-2'],
        confidence: 0.88,
      }),
    });

    expect(weakJob).toBeUndefined();
    expect(strongJob?.type).toBe('project_promotion');
    expect(strongJob?.priority).toBe('high');
    expect(strongJob?.governanceIdentity).toBe('project_curator');
    expect(strongJob?.payload).toEqual(
      expect.objectContaining({
        artifactTargets: ['project_doc'],
      })
    );
  });

  it('creates project capability curation jobs as Project Curator work with rule and skill targets', () => {
    const job = createPlannedContextJob({
      type: 'project_capability_curation',
      priority: 'medium',
      spaceId: 'space-1',
      projectSlug: 'repo-1',
      source: 'timer',
      triggerEvent: 'timer.project_capability_curation',
      reason: 'Refresh project capability mirror.',
      payload: {
        summary: 'Refresh project capability mirror.',
      },
    });

    expect(job.governanceIdentity).toBe('project_curator');
    expect(job.payload).toEqual(
      expect.objectContaining({
        artifactTargets: ['project_doc', 'project_rules', 'project_skill'],
      })
    );
  });

  it('creates space memory distillation jobs as Space Curator work with digest and profile targets', () => {
    const job = createPlannedContextJob({
      type: 'space_memory_distillation',
      priority: 'high',
      spaceId: 'space-1',
      source: 'timer',
      triggerEvent: 'timer.space_memory_distillation',
      reason: 'Distill shared space memory from recent project activity.',
      payload: {
        summary: 'Distill shared space memory from recent project activity.',
      },
    });

    expect(job.governanceIdentity).toBe('space_curator');
    expect(job.payload).toEqual(
      expect.objectContaining({
        artifactTargets: ['space_digest', 'profile_memory'],
      })
    );
  });

  it('creates connector digest jobs as Space Curator work with digest targets', () => {
    const job = createPlannedContextJob({
      type: 'connector_digest',
      priority: 'medium',
      spaceId: 'space-1',
      source: 'connector',
      triggerEvent: 'connector.source.ingested',
      reason: 'Digest newly ingested connector content into reusable context.',
      payload: {
        summary: 'Digest newly ingested connector content into reusable context.',
      },
    });

    expect(job.governanceIdentity).toBe('space_curator');
    expect(job.payload).toEqual(
      expect.objectContaining({
        artifactTargets: ['space_digest'],
      })
    );
  });

  it('collects unique signal kinds for downstream hooks', () => {
    const result = collectSessionSignalKinds([
      makeSignal('user_interrupt', 'A'),
      makeSignal('repeated_request', 'B'),
      makeSignal('user_interrupt', 'C'),
    ]);

    expect(result).toEqual(['repeated_request', 'user_interrupt']);
  });
});
