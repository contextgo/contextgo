import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextJob } from '../../../src/process/services/context/contextDomain';
import { ContextJobQueue } from '../../../src/process/services/context/ContextJobQueue';
import { ContextJobRunner } from '../../../src/process/services/context/jobs/ContextJobRunner';
import { registerContextJobProjector } from '../../../src/process/services/context/events/handlers/ContextJobProjector';
import { registerContextJobRunProjector } from '../../../src/process/services/context/events/handlers/ContextJobRunProjector';
import { SessionCompactionJobHandler } from '../../../src/process/services/context/jobs/SessionCompactionJobHandler';
import { ContextEventBus } from '../../../src/process/services/context/events/ContextEventBus';
import { registerOperationLogProjector } from '../../../src/process/services/context/events/handlers/OperationLogProjector';
import { registerOperationLogVaultProjector } from '../../../src/process/services/context/events/handlers/OperationLogVaultProjector';
import { registerSessionSignalProjector } from '../../../src/process/services/context/events/handlers/SessionSignalProjector';
import { ContextTriggerRouter } from '../../../src/process/services/context/events/ContextTriggerRouter';

const mockDb = {
  getConversation: vi.fn(),
  getChannelRun: vi.fn(() => ({ success: true, data: null })),
  upsertAgentProfile: vi.fn(() => ({ success: true, data: true })),
  upsertChannelRun: vi.fn(() => ({ success: true, data: true })),
};

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));
vi.mock('@process/services/i18n', () => ({
  default: {
    t: vi.fn((key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'agent.contextEngine.operationLog.signal.user_interrupt.title': 'Run stopped before completion',
        'agent.contextEngine.operationLog.signal.user_interrupt.summary': 'The current run was stopped manually.',
        'agent.contextEngine.operationLog.signal.context_window_prepared.title': 'Prepared context for this turn',
        'agent.contextEngine.operationLog.signal.context_window_prepared.summary':
          'Prepared the context needed to continue this turn.',
        'agent.contextEngine.operationLog.job.session_compaction.queued': 'Session context update queued',
        'agent.contextEngine.operationLog.job.session_compaction.completed': 'Session context updated',
        'agent.contextEngine.operationLog.job.project_capability_curation.queued': 'Project capability curation queued',
        'agent.contextEngine.operationLog.job.project_capability_curation.completed':
          'Project capability curation completed',
        'common.error': 'Error',
      };

      if (key === 'agent.contextEngine.operationLog.signal.context_window_prepared.recentSignals') {
        return 'Included ' + String(options?.count ?? '0') + ' recent context records.';
      }

      return translations[key] ?? String(options?.defaultValue ?? key);
    }),
  },
  i18nReady: Promise.resolve(),
}));

function makeJob(overrides: Partial<ContextJob> = {}): ContextJob {
  return {
    id: 'job-1',
    type: 'session_compaction',
    status: 'queued',
    priority: 'high',
    spaceId: 'space-1',
    threadId: 'thread-1',
    projectSlug: 'workspace-abcd1234',
    source: 'runtime-hook',
    reason: 'Repeated user interruption',
    payload: {
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 1,
        lastUserGoal: 'Ship the release safely.',
        lastAssistantOutcome: 'Switched to a smaller rollout plan.',
        recentSignals: [
          {
            kind: 'user_interrupt',
            summary: 'User stopped the previous run.',
            score: 0.8,
            occurredAt: '2026-04-08T00:00:00.000Z',
          },
          {
            kind: 'repeated_request',
            summary: 'User repeated the release ask.',
            score: 0.8,
            occurredAt: '2026-04-08T00:01:00.000Z',
          },
        ],
      },
    },
    queuedAt: '2026-04-08T00:02:00.000Z',
    ...overrides,
  };
}

describe('context engine event flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getConversation.mockReturnValue({
      success: true,
      data: {
        id: 'thread-1',
        name: 'Release Session',
        type: 'codex',
        extra: {
          spaceId: 'space-1',
          workspace: '/tmp/workspace',
          workingDirectory: '/tmp/workspace',
        },
      },
    });
  });

  it('formats context window signals into readable summaries', async () => {
    const bus = new ContextEventBus();
    const seenSignals: import('../../../src/process/services/context/contextDomain').SessionSignal[] = [];

    registerSessionSignalProjector(bus);
    bus.on('session.signal.detected', async (event) => {
      seenSignals.push(event.payload.signal);
    });

    await bus.emit('context.window.prepared', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      preparedAt: Date.parse('2026-04-08T00:00:00.000Z'),
      snapshot: {
        userTurns: 1,
        assistantReplies: 0,
        interruptions: 0,
        recentSignals: [
          {
            kind: 'user_interrupt',
            summary: 'The current run was stopped manually.',
            score: 0.8,
            occurredAt: '2026-04-07T23:59:00.000Z',
          },
        ],
      },
    });

    expect(seenSignals).toEqual([
      expect.objectContaining({
        kind: 'context_window_prepared',
        summary: 'Prepared the context needed to continue this turn.',
        detail: 'Included 1 recent context records.',
      }),
    ]);
  });

  it('formats interruption signals into readable summaries', async () => {
    const bus = new ContextEventBus();
    const seenSignals: import('../../../src/process/services/context/contextDomain').SessionSignal[] = [];

    registerSessionSignalProjector(bus);
    bus.on('session.signal.detected', async (event) => {
      seenSignals.push(event.payload.signal);
    });

    await bus.emit('session.interrupted', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      interruptedAt: Date.parse('2026-04-08T00:00:00.000Z'),
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 1,
        recentSignals: [
          {
            kind: 'user_interrupt',
            summary: 'User stopped the previous run.',
            score: 0.8,
            occurredAt: '2026-04-08T00:00:00.000Z',
          },
          {
            kind: 'repeated_request',
            summary: 'User repeated the release ask.',
            score: 0.8,
            occurredAt: '2026-04-08T00:01:00.000Z',
          },
        ],
      },
    });

    expect(seenSignals).toEqual([
      expect.objectContaining({
        kind: 'user_interrupt',
        summary: 'The current run was stopped manually.',
      }),
    ]);
  });
  it('writes operation logs for signals, queued jobs, and completed jobs', async () => {
    const bus = new ContextEventBus();
    const contextService = {
      appendSystemOperation: vi.fn(async () => undefined),
    };
    const vaultSyncService = {
      appendOperationLogEntry: vi.fn(async () => undefined),
    };

    registerOperationLogProjector(bus, contextService as never);
    registerOperationLogVaultProjector(bus, vaultSyncService as never);

    await bus.emit('session.signal.detected', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      signal: {
        kind: 'user_interrupt',
        summary: 'User interrupted the run.',
        score: 0.8,
        occurredAt: '2026-04-08T00:00:00.000Z',
      },
    });
    await bus.emit('context.job.queued', {
      job: makeJob(),
    });
    await bus.emit('context.job.completed', {
      job: {
        ...makeJob(),
        status: 'completed',
        completedAt: '2026-04-08T00:03:00.000Z',
      },
      status: 'completed',
      completedAt: '2026-04-08T00:03:00.000Z',
      artifact: {
        threadId: 'thread-1',
        profileId: 'profile-1',
        profileKey: 'session.compaction.thread-1',
        summary: 'Compacted release session context.',
        stableStrategies: ['Keep the patch minimal.'],
        failureModes: ['Long runs are interrupted.'],
        pendingConstraints: ['Need rollout approval before widening scope.'],
        signalKinds: ['user_interrupt'],
        candidateCount: 2,
        pendingReviewCount: 1,
        promotedCount: 1,
        pressure: 57,
      },
    });

    expect(contextService.appendSystemOperation).toHaveBeenCalledTimes(3);
    expect(contextService.appendSystemOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'session.signal_detected',
        threadId: 'thread-1',
      })
    );
    expect(contextService.appendSystemOperation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'context.job_queued',
        entityId: 'job-1',
      })
    );
    expect(contextService.appendSystemOperation).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'context.job_completed',
        entityId: 'job-1',
      })
    );
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenCalledTimes(3);
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: 'Run stopped before completion',
        bullets: ['User interrupted the run.'],
      })
    );
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: 'Session context update queued',
        bullets: ['Repeated user interruption'],
      })
    );
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        title: 'Session context updated',
        bullets: ['Compacted release session context.'],
      })
    );
  });

  it('projects maintenance jobs onto system-managed assistant runs', async () => {
    const bus = new ContextEventBus();
    const vaultSyncService = {
      writeContextRunArtifact: vi.fn(async () => ({
        title: 'Context Run · session compaction',
        relativePath: 'System/Context Engine/Runs/job-1.md',
        summary: 'Compacted release session context.',
      })),
    };

    registerContextJobRunProjector(bus, vaultSyncService as never);

    await bus.emit('context.job.queued', {
      job: makeJob(),
    });

    await bus.emit('context.job.completed', {
      job: {
        ...makeJob(),
        status: 'completed',
        startedAt: '2026-04-08T00:02:10.000Z',
        completedAt: '2026-04-08T00:03:00.000Z',
      },
      status: 'completed',
      completedAt: '2026-04-08T00:03:00.000Z',
      artifact: {
        threadId: 'thread-1',
        profileId: 'profile-1',
        profileKey: 'session.compaction.thread-1',
        summary: 'Compacted release session context.',
        currentTask: 'Ship the release safely.',
        stableStrategies: ['Use the staged release checklist.'],
        failureModes: ['Long runs are interrupted.'],
        pendingConstraints: ['Need rollout approval before widening scope.'],
        signalKinds: ['user_interrupt'],
        candidateCount: 2,
        pendingReviewCount: 1,
        promotedCount: 1,
        pressure: 57,
      },
    });

    expect(mockDb.upsertAgentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent_profile_context_engine_session_compactor',
        promptProfile: expect.objectContaining({
          role: 'system-maintenance',
          jobType: 'session_compaction',
          systemManaged: true,
          systemOwner: 'context-engine',
          systemRole: 'context-engine-session-compactor',
        }),
      })
    );

    const queuedRun = mockDb.upsertChannelRun.mock.calls[0]?.[0];
    const completedRun = mockDb.upsertChannelRun.mock.calls[1]?.[0];

    expect(queuedRun).toEqual(
      expect.objectContaining({
        backend: 'context-engine',
        status: 'pending',
        agentProfileId: 'agent_profile_context_engine_session_compactor',
        metadata: expect.objectContaining({
          assistantId: 'system-context-engine-session-compactor',
          systemOwner: 'context-engine',
          systemRole: 'context-engine-session-compactor',
          jobType: 'session_compaction',
          scopeLabel: 'workspace-abcd1234',
        }),
      })
    );
    expect(completedRun).toEqual(
      expect.objectContaining({
        status: 'finished',
        metadata: expect.objectContaining({
          assistantId: 'system-context-engine-session-compactor',
          systemOwner: 'context-engine',
          systemRole: 'context-engine-session-compactor',
          currentTask: 'Ship the release safely.',
          latestArtifactSummary: 'Compacted release session context.',
        }),
      })
    );
    expect(completedRun.metadata.events[0]?.text).toContain('Completed session compaction');
  });

  it('builds a compaction profile and appends a session checkpoint', async () => {
    const contextService = {
      evaluateCompaction: vi.fn(async () => ({
        pressure: 58,
        shouldCompact: true,
        strategy: 'summarize-workflow',
        rationale: ['memory-count-ready', 'compact-now'],
      })),
      listMemoryCandidates: vi.fn(async () => [
        {
          id: 'candidate-1',
          spaceId: 'space-1',
          threadId: 'thread-1',
          kind: 'workflow',
          tier: 'experiential',
          summary: 'Use the staged release checklist.',
          sourceIds: ['source-1'],
          chunkIds: [],
          confidence: 0.8,
          priority: 'high',
          evidenceCount: 2,
          repeatedAcrossSources: 1,
          recentReferenceCount: 1,
          userConfirmed: false,
          manuallyPinned: false,
          executionBacked: true,
          contradictionDetected: false,
          promotionScore: 80,
          promotionRationale: ['promote'],
          destination: 'memory',
          state: 'promoted',
          reviewStatus: 'auto_approved',
          promotedMemoryId: 'memory-1',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
        },
        {
          id: 'candidate-2',
          spaceId: 'space-1',
          threadId: 'thread-1',
          kind: 'constraint',
          tier: 'factual',
          summary: 'Do not widen the rollout without review.',
          sourceIds: ['source-2'],
          chunkIds: [],
          confidence: 0.76,
          priority: 'high',
          evidenceCount: 1,
          repeatedAcrossSources: 0,
          recentReferenceCount: 1,
          userConfirmed: true,
          manuallyPinned: false,
          executionBacked: false,
          contradictionDetected: false,
          promotionScore: 42,
          promotionRationale: ['keep-as-candidate'],
          destination: 'memory',
          state: 'pending_review',
          reviewStatus: 'pending',
          createdAt: '2026-04-08T00:01:00.000Z',
          updatedAt: '2026-04-08T00:01:00.000Z',
        },
      ]),
      listProfiles: vi.fn(async () => []),
      saveProfile: vi.fn(async () => undefined),
    };
    const vaultSyncService = {
      appendContextCheckpoint: vi.fn(async () => undefined),
      appendSessionCheckpoint: vi.fn(async () => ({
        relativePath:
          'Projects/workspace/_context/sessions/thread-1/checkpoints/2026-04-08T00-03-00Z-session-compaction.md',
        title: 'Session checkpoint',
        summary: 'Current task: Ship the release safely.',
      })),
      writeSessionWorkingContext: vi.fn(async () => ({
        relativePath: 'Projects/workspace/_context/sessions/thread-1/working-context.md',
        title: 'Release Session Working Context',
      })),
    };
    const summarizer = {
      summarize: vi.fn(async () => ({
        currentTask: 'Ship the release safely.',
        stableStrategies: ['Use the staged release checklist.'],
        failureModes: ['Long runs are being interrupted by the user.'],
        pendingConstraints: ['Do not widen the rollout without review.'],
      })),
    };
    const handler = new SessionCompactionJobHandler(
      contextService as never,
      vaultSyncService as never,
      summarizer as never
    );

    const artifact = await handler.run(makeJob());

    expect(artifact).toEqual(
      expect.objectContaining({
        threadId: 'thread-1',
        profileKey: 'session.compaction.thread-1',
        currentTask: 'Ship the release safely.',
        stableStrategies: ['Use the staged release checklist.'],
        failureModes: ['Long runs are being interrupted by the user.'],
        pendingConstraints: ['Do not widen the rollout without review.'],
        noteTitle: 'Session checkpoint',
        relativePath:
          'Projects/workspace/_context/sessions/thread-1/checkpoints/2026-04-08T00-03-00Z-session-compaction.md',
        workingSetTitle: 'Release Session Working Context',
        workingSetRelativePath: 'Projects/workspace/_context/sessions/thread-1/working-context.md',
        pressure: 58,
        promotedCount: 1,
        pendingReviewCount: 1,
        promotionCandidate: expect.objectContaining({
          projectSlug: 'workspace-abcd1234',
          sourceThreadIds: ['thread-1'],
        }),
      })
    );
    expect(contextService.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'session.compaction.thread-1',
        summary: expect.stringContaining('Current task: Ship the release safely.'),
      }),
      expect.objectContaining({
        operationType: 'profile.compacted',
        threadId: 'thread-1',
      })
    );
    expect(vaultSyncService.writeSessionWorkingContext).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProfileKey: 'session.compaction.thread-1',
        currentTask: 'Ship the release safely.',
      })
    );
    expect(vaultSyncService.appendSessionCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Session checkpoint',
        kind: 'session-compaction',
      })
    );
  });

  it('queues connector digest jobs when connector sources are ingested', async () => {
    const bus = new ContextEventBus();
    const emittedJobs: ContextJob[] = [];
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();
    bus.on('context.job.queued', async (event) => {
      emittedJobs.push(event.payload.job);
    });

    await bus.emit('connector.source.ingested', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      connectorId: 'contextgo-browser-extension',
      source: {
        connectorId: 'contextgo-browser-extension',
        kind: 'web-resource',
        canonicalUri: 'https://example.com/articles/contextgo',
        title: 'ContextGo Browser Activity',
        spaceId: 'space-1',
        threadId: 'thread-1',
        updatedAt: '2026-04-10T08:00:00.000Z',
        tags: ['connector:browser-extension'],
      },
      sourceRecordId: 'source-1',
      title: 'ContextGo Browser Activity',
      canonicalUri: 'https://example.com/articles/contextgo',
      ingestedAt: '2026-04-10T08:00:00.000Z',
      summary: 'Captured browser activity from example.com: ContextGo Browser Activity',
    });

    expect(emittedJobs).toHaveLength(1);
    expect(emittedJobs[0]).toEqual(
      expect.objectContaining({
        type: 'connector_digest',
        spaceId: 'space-1',
        threadId: 'thread-1',
        source: 'connector',
        reason: 'Captured browser activity from example.com: ContextGo Browser Activity',
        payload: expect.objectContaining({
          connectorId: 'contextgo-browser-extension',
          sourceRecordId: 'source-1',
          canonicalUri: 'https://example.com/articles/contextgo',
          title: 'ContextGo Browser Activity',
          sourceKind: 'web-resource',
          summary: 'Captured browser activity from example.com: ContextGo Browser Activity',
        }),
        trigger: expect.objectContaining({
          event: 'connector.source.ingested',
          label: 'contextgo-browser-extension: ContextGo Browser Activity',
        }),
      })
    );
  });

  it('queues project promotion after a successful session compaction artifact', async () => {
    const bus = new ContextEventBus();
    const emittedJobs: ContextJob[] = [];
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();
    registerContextJobProjector(bus);
    bus.on('context.job.queued', async (event) => {
      emittedJobs.push(event.payload.job);
    });

    await bus.emit('context.job.completed', {
      job: {
        ...makeJob(),
        status: 'completed',
        completedAt: '2026-04-08T00:03:00.000Z',
      },
      status: 'completed',
      completedAt: '2026-04-08T00:03:00.000Z',
      artifact: {
        threadId: 'thread-1',
        profileId: 'profile-1',
        profileKey: 'session.compaction.thread-1',
        summary: 'Compacted release session context.',
        currentTask: 'Ship the release safely.',
        stableStrategies: ['Use the staged release checklist.'],
        failureModes: ['Long runs are being interrupted by the user.'],
        pendingConstraints: ['Do not widen the rollout without review.'],
        signalKinds: ['user_interrupt'],
        candidateCount: 2,
        pendingReviewCount: 1,
        promotedCount: 1,
        pressure: 57,
        promotionCandidate: {
          projectSlug: 'workspace-abcd1234',
          summary: 'Use the staged release checklist.',
          detail: 'Observed across repeated corrections.',
          sourceThreadIds: ['thread-1'],
          confidence: 0.9,
        },
      },
    });

    expect(emittedJobs.some((job) => job.type === 'project_promotion')).toBe(true);
    expect(emittedJobs.find((job) => job.type === 'project_promotion')).toEqual(
      expect.objectContaining({
        projectSlug: 'workspace-abcd1234',
        threadId: 'thread-1',
      })
    );
  });

  it('keeps governance routing on the trigger router after projector reduction', async () => {
    const bus = new ContextEventBus();
    const emittedJobs: ContextJob[] = [];
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();
    registerContextJobProjector(bus);
    bus.on('context.job.queued', async (event) => {
      emittedJobs.push(event.payload.job);
    });

    await (bus as any).emit('delegation.completed', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      occurredAt: '2026-04-17T01:00:00.000Z',
      sourceSummary: 'Planner delegate completed release validation synthesis.',
      delegationSummary: 'Planner delegate completed release validation synthesis.',
      snapshot: {
        userTurns: 1,
        assistantReplies: 2,
        interruptions: 0,
        recentSignals: [
          {
            kind: 'strategy_shift',
            summary: 'Planner delegate converged on a narrower rollout path.',
            score: 0.8,
            occurredAt: '2026-04-08T00:00:00.000Z',
          },
        ],
      },
    });

    expect(emittedJobs).toHaveLength(1);
    expect(emittedJobs[0]?.source).toBe('lifecycle');
  });

  it('routes delegation.completed through the lifecycle trigger contract', async () => {
    const bus = new ContextEventBus();
    const emittedJobs: ContextJob[] = [];
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();
    bus.on('context.job.queued', async (event) => {
      emittedJobs.push(event.payload.job);
    });

    await (bus as any).emit('delegation.completed', {
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      occurredAt: '2026-04-17T01:00:00.000Z',
      sourceSummary: 'Planner delegate completed release validation synthesis.',
      delegationSummary: 'Planner delegate completed release validation synthesis.',
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 0,
        recentSignals: [],
      },
    });

    expect(emittedJobs).toHaveLength(1);
    expect(emittedJobs[0]).toEqual(
      expect.objectContaining({
        type: 'session_compaction',
        source: 'lifecycle',
        governanceIdentity: 'session_steward',
        reason: 'Planner delegate completed release validation synthesis.',
        payload: expect.objectContaining({
          lifecycleSummary: 'Planner delegate completed release validation synthesis.',
        }),
      })
    );
  });

  it('preserves explicit manual compaction reason through the stewardship contract', async () => {
    const bus = new ContextEventBus();
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();

    const queued = await router.queueManualJob({
      triggerId: 'manual.session-compaction',
      spaceId: 'space-1',
      threadId: 'thread-1',
      projectSlug: 'workspace-abcd1234',
      reason: 'Manually compact before handing off the release task.',
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 0,
        recentSignals: [],
      },
      firedAt: '2026-04-17T01:30:00.000Z',
    });

    expect(queued).toEqual(
      expect.objectContaining({
        type: 'session_compaction',
        source: 'manual',
        reason: 'Manually compact before handing off the release task.',
        payload: expect.objectContaining({
          lifecycleSummary: 'Manually compact before handing off the release task.',
        }),
      })
    );
  });

  it('queues and runs project capability curation jobs for project-scoped triggers', async () => {
    const bus = new ContextEventBus();
    const emittedJobs: ContextJob[] = [];
    const router = new ContextTriggerRouter(bus, {
      resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
    } as never);

    router.register();
    bus.on('context.job.queued', async (event) => {
      emittedJobs.push(event.payload.job);
    });

    const queued = await router.queueManualJob({
      triggerId: 'manual.project-capability-curation',
      spaceId: 'space-1',
      projectSlug: 'workspace-abcd1234',
      reason: 'Refresh project capability mirror.',
      payload: {
        summary: 'Refresh project capability mirror.',
      },
      firedAt: '2026-04-08T00:05:00.000Z',
    });

    expect(queued).toEqual(
      expect.objectContaining({
        type: 'project_capability_curation',
        projectSlug: 'workspace-abcd1234',
        source: 'manual',
        reason: 'Refresh project capability mirror.',
      })
    );
    expect(emittedJobs.at(-1)).toEqual(queued);

    const queue = new ContextJobQueue();
    queue.enqueue(queued!);

    const seen: string[] = [];
    bus.on('context.job.started', async (event) => {
      seen.push(`${event.payload.job.type}:started`);
    });
    bus.on('context.job.completed', async (event) => {
      seen.push(`${event.payload.job.type}:${event.payload.status}`);
    });

    const runner = new ContextJobRunner(
      queue,
      bus,
      {
        run: vi.fn(async () => undefined),
      } as never,
      {
        run: vi.fn(async () => undefined),
      } as never,
      undefined,
      undefined,
      undefined,
      {
        run: vi.fn(async () => ({
          projectSlug: 'workspace-abcd1234',
          noteTitle: 'workspace Capabilities',
          relativePath: 'Projects/workspace/_context/Capabilities.md',
          summary: 'Refreshed project capability mirror.',
        })),
      } as never
    );

    await runner.kick();

    expect(seen).toContain('project_capability_curation:started');
    expect(seen).toContain('project_capability_curation:completed');
  });

  it('writes AGENTS and skill proposal artifacts for project capability curation jobs', async () => {
    const { ProjectCapabilityCurationJobHandler } =
      await import('../../../src/process/services/context/jobs/ProjectCapabilityCurationJobHandler');

    const vaultSyncService = {
      curateProjectCapabilities: vi.fn(async () => ({
        projectSlug: 'workspace-abcd1234',
        noteTitle: 'workspace Capabilities',
        relativePath: 'Projects/workspace/_context/Capabilities.md',
        summary: 'Refreshed project capability mirror.',
      })),
      writeProjectCuratorProposal: vi
        .fn()
        .mockResolvedValueOnce({
          title: 'AGENTS append proposal',
          relativePath: 'Projects/workspace/_context/proposals/agents-append-proposal.md',
          summary: 'Add a stable release-validation rule.',
        })
        .mockResolvedValueOnce({
          title: 'Skill append proposal',
          relativePath: 'Projects/workspace/_context/proposals/skill-append-proposal.md',
          summary: 'Update release-validation skill guidance.',
        }),
    };

    const handler = new ProjectCapabilityCurationJobHandler(vaultSyncService as never);
    const artifact = await handler.run(
      makeJob({
        type: 'project_capability_curation',
        governanceIdentity: 'project_curator',
        projectSlug: 'workspace-abcd1234',
        payload: {
          summary: 'Refresh project capability mirror.',
          artifactTargets: ['project_doc', 'project_rules', 'project_skill'],
        },
      })
    );

    expect(vaultSyncService.curateProjectCapabilities).toHaveBeenCalled();
    expect(vaultSyncService.writeProjectCuratorProposal).toHaveBeenCalledTimes(2);
    expect(vaultSyncService.writeProjectCuratorProposal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: 'AGENTS append proposal',
        proposalKind: 'project_rules',
        targetPath: 'AGENTS.md',
      })
    );
    expect(vaultSyncService.writeProjectCuratorProposal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: 'Skill append proposal',
        proposalKind: 'project_skill',
        targetPath: 'skills/release-validation/SKILL.md',
      })
    );
    expect(artifact?.summary).toContain('Refreshed project capability mirror.');
    expect(artifact?.summary).toContain('Add a stable release-validation rule.');
    expect(artifact?.summary).toContain('Update release-validation skill guidance.');
  });

  it('writes operation logs for project capability curation jobs', async () => {
    const bus = new ContextEventBus();
    const vaultSyncService = {
      appendOperationLogEntry: vi.fn(async () => undefined),
    };

    registerOperationLogVaultProjector(bus, vaultSyncService as never);

    await bus.emit('context.job.queued', {
      job: {
        ...makeJob({
          id: 'job-capability-1',
          type: 'project_capability_curation',
          reason: 'Refresh project capability mirror.',
          projectSlug: 'workspace-abcd1234',
          payload: { summary: 'Refresh project capability mirror.' },
        }),
      },
    });
    await bus.emit('context.job.completed', {
      job: {
        ...makeJob({
          id: 'job-capability-1',
          type: 'project_capability_curation',
          status: 'completed',
          reason: 'Refresh project capability mirror.',
          projectSlug: 'workspace-abcd1234',
          payload: { summary: 'Refresh project capability mirror.' },
          completedAt: '2026-04-08T00:06:00.000Z',
        }),
      },
      status: 'completed',
      completedAt: '2026-04-08T00:06:00.000Z',
      artifact: {
        projectSlug: 'workspace-abcd1234',
        noteTitle: 'workspace Capabilities',
        relativePath: 'Projects/workspace/_context/Capabilities.md',
        summary: 'Refreshed project capability mirror.',
      },
    });

    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: 'Project capability curation queued',
        bullets: ['Refresh project capability mirror.'],
      })
    );
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: 'Project capability curation completed',
        bullets: ['Refreshed project capability mirror.'],
      })
    );
  });

  it('writes both space digest and profile-memory artifacts for space memory distillation jobs', async () => {
    const { SpaceMemoryDistillationJobHandler } =
      await import('../../../src/process/services/context/jobs/SpaceMemoryDistillationJobHandler');

    const vaultSyncService = {
      writeSpaceMemoryDistillation: vi.fn(async () => ({
        title: 'Space Memory Distillation',
        relativePath: 'System/Context Engine/Space Memory.md',
        summary: 'Shared release patterns distilled.',
        spaceId: 'space-1',
      })),
      writeProfileMemoryDistillation: vi.fn(async () => ({
        title: 'Profile Memory',
        relativePath: 'System/Context Engine/Profile Memory.md',
        summary: 'Team prefers minimal diffs and explicit validation.',
        spaceId: 'space-1',
      })),
    };

    const handler = new SpaceMemoryDistillationJobHandler(vaultSyncService as never);
    const artifact = await handler.run(
      makeJob({
        type: 'space_memory_distillation',
        governanceIdentity: 'space_curator',
        payload: {
          summary: 'Shared release patterns distilled.',
          profileSummary: 'Team prefers minimal diffs and explicit validation.',
          profileBullets: ['Observed across 3 project summaries.'],
          artifactTargets: ['space_digest', 'profile_memory'],
        },
      })
    );

    expect(vaultSyncService.writeSpaceMemoryDistillation).toHaveBeenCalled();
    expect(vaultSyncService.writeProfileMemoryDistillation).toHaveBeenCalled();
    expect(artifact?.summary).toContain('Shared release patterns distilled.');
    expect(artifact?.summary).toContain('Team prefers minimal diffs and explicit validation.');
  });

  it('writes richer connector digest details from connector payload metadata', async () => {
    const { ConnectorDigestJobHandler } =
      await import('../../../src/process/services/context/jobs/ConnectorDigestJobHandler');

    const vaultSyncService = {
      writeConnectorDigest: vi.fn(async () => ({
        title: 'Connector Digest',
        relativePath: 'System/Context Engine/Connector Digest.md',
        summary: 'Digest newly ingested connector content into reusable context.',
        spaceId: 'space-1',
      })),
    };

    const handler = new ConnectorDigestJobHandler(vaultSyncService as never);
    await handler.run(
      makeJob({
        type: 'connector_digest',
        governanceIdentity: 'space_curator',
        payload: {
          summary: 'Digest newly ingested connector content into reusable context.',
          connectorId: 'browser-activity',
          title: 'Release checklist page',
          canonicalUri: 'https://example.com/release-checklist',
          sourceKind: 'web-resource',
          artifactTargets: ['space_digest'],
        },
      })
    );

    expect(vaultSyncService.writeConnectorDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('browser-activity'),
      })
    );
  });

  it('emits context.job.started before completion', async () => {
    const queue = new ContextJobQueue();
    queue.enqueue(makeJob());

    const bus = new ContextEventBus();
    const seen: string[] = [];
    bus.on('context.job.started', async (event) => {
      seen.push(`${event.type}:${event.payload.job.status}`);
    });
    bus.on('context.job.completed', async (event) => {
      seen.push(`${event.type}:${event.payload.job.status}`);
    });

    const runner = new ContextJobRunner(
      queue,
      bus,
      {
        run: vi.fn(async () => ({
          threadId: 'thread-1',
          profileId: 'profile-1',
          profileKey: 'session.compaction.thread-1',
          summary: 'Compacted release session context.',
          stableStrategies: [],
          failureModes: [],
          pendingConstraints: [],
          signalKinds: [],
          candidateCount: 0,
          pendingReviewCount: 0,
          promotedCount: 0,
          pressure: 22,
        })),
      } as never,
      {
        run: vi.fn(async () => undefined),
      } as never
    );

    await runner.kick();

    expect(seen).toEqual(['context.job.started:running', 'context.job.completed:completed']);
  });

  it('runs queued session compaction jobs and persists completion logs', async () => {
    const queue = new ContextJobQueue();
    queue.enqueue(makeJob());

    const bus = new ContextEventBus();
    const contextService = {
      appendSystemOperation: vi.fn(async () => undefined),
    };
    const vaultSyncService = {
      appendOperationLogEntry: vi.fn(async () => undefined),
    };

    registerOperationLogProjector(bus, contextService as never);
    registerOperationLogVaultProjector(bus, vaultSyncService as never);

    const sessionCompactionHandler = {
      run: vi.fn(async () => ({
        threadId: 'thread-1',
        profileId: 'profile-1',
        profileKey: 'session.compaction.thread-1',
        summary: 'Compacted release session context.',
        currentTask: 'Ship the release safely.',
        stableStrategies: ['Use the staged release checklist.'],
        failureModes: ['Long runs are being interrupted by the user.'],
        pendingConstraints: ['Do not widen the rollout without review.'],
        detail: 'Detailed compaction output.',
        signalKinds: ['user_interrupt'],
        candidateCount: 2,
        pendingReviewCount: 1,
        promotedCount: 1,
        pressure: 57,
      })),
    };
    const projectPromotionHandler = {
      run: vi.fn(async () => undefined),
    };
    const runner = new ContextJobRunner(
      queue,
      bus,
      sessionCompactionHandler as never,
      projectPromotionHandler as never
    );

    await runner.kick();

    expect(sessionCompactionHandler.run).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
    expect(contextService.appendSystemOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'context.job_completed',
        entityId: 'job-1',
        payload: expect.objectContaining({
          profileKey: 'session.compaction.thread-1',
          pressure: 57,
        }),
      })
    );
    expect(vaultSyncService.appendOperationLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Session context updated',
        bullets: ['Compacted release session context.'],
      })
    );
    expect(projectPromotionHandler.run).not.toHaveBeenCalled();
    expect(queue.list()).toHaveLength(0);
  });
});
