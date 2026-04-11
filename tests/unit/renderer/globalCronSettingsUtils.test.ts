import { describe, expect, it } from 'vitest';
import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import {
  filterGlobalScheduleJobs,
  getGlobalScheduleJobStatus,
  summarizeGlobalScheduleJobs,
} from '@/renderer/pages/schedule/globalScheduleSettingsUtils';

const createJob = (overrides: Partial<IContextSchedule> = {}): IContextSchedule =>
  ({
    id: 'job-1',
    name: 'Daily summary',
    enabled: true,
    owner: 'user',
    createdBy: 'user',
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
      description: 'Every day at 09:00',
    },
    scope: {
      kind: 'conversation',
      spaceId: 'space-1',
      conversationId: 'conv-1',
      label: 'Workspace Alpha',
    },
    target: {
      conversationId: 'conv-1',
      conversationTitle: 'Workspace Alpha',
      agentType: 'claude',
      kind: 'send_query',
      message: 'Summarize the latest agent platform updates',
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      ...overrides.state,
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }) as IContextSchedule;

describe('getGlobalScheduleJobStatus', () => {
  it('returns paused when a job is disabled even if the last run failed', () => {
    expect(
      getGlobalScheduleJobStatus(
        createJob({
          enabled: false,
          state: {
            lastStatus: 'error',
            runCount: 1,
            retryCount: 0,
            maxRetries: 3,
          },
        })
      )
    ).toBe('paused');
  });

  it('returns error for enabled jobs with a failed last run', () => {
    expect(
      getGlobalScheduleJobStatus(
        createJob({
          state: {
            lastStatus: 'error',
            runCount: 2,
            retryCount: 1,
            maxRetries: 3,
          },
        })
      )
    ).toBe('error');
  });

  it('returns active for enabled jobs without an error state', () => {
    expect(
      getGlobalScheduleJobStatus(
        createJob({
          state: {
            lastStatus: 'ok',
            runCount: 5,
            retryCount: 0,
            maxRetries: 3,
          },
        })
      )
    ).toBe('active');
  });
});

describe('filterGlobalScheduleJobs', () => {
  const jobs = [
    createJob(),
    createJob({
      id: 'job-2',
      name: 'Paused review',
      enabled: false,
      scope: {
        kind: 'conversation',
        spaceId: 'space-1',
        conversationId: 'conv-2',
        label: 'Ops Project',
      },
      target: {
        kind: 'send_query',
        conversationId: 'conv-2',
        conversationTitle: 'Ops Project',
        agentType: 'codex',
        message: 'Review pending fixes',
      },
    }),
    createJob({
      id: 'job-3',
      name: 'Broken report',
      scope: {
        kind: 'conversation',
        spaceId: 'space-1',
        conversationId: 'conv-3',
        label: 'Gemini Workspace',
      },
      target: {
        kind: 'send_query',
        conversationId: 'conv-3',
        conversationTitle: 'Gemini Workspace',
        agentType: 'gemini',
        message: 'Summarize the latest agent platform updates',
      },
      state: {
        lastStatus: 'error',
        lastError: 'CLI disconnected',
        runCount: 3,
        retryCount: 2,
        maxRetries: 3,
      },
    }),
  ];

  it('returns all jobs when the query is empty and status is all', () => {
    expect(filterGlobalScheduleJobs(jobs, '', 'all')).toEqual(jobs);
  });

  it('filters by derived status', () => {
    expect(filterGlobalScheduleJobs(jobs, '', 'paused').map((job) => job.id)).toEqual(['job-2']);
    expect(filterGlobalScheduleJobs(jobs, '', 'error').map((job) => job.id)).toEqual(['job-3']);
    expect(filterGlobalScheduleJobs(jobs, '', 'active').map((job) => job.id)).toEqual(['job-1']);
  });

  it('matches against name, message, conversation info, agent type, and last error', () => {
    expect(filterGlobalScheduleJobs(jobs, 'review', 'all').map((job) => job.id)).toEqual(['job-2']);
    expect(filterGlobalScheduleJobs(jobs, 'workspace alpha', 'all').map((job) => job.id)).toEqual(['job-1']);
    expect(filterGlobalScheduleJobs(jobs, 'gemini', 'all').map((job) => job.id)).toEqual(['job-3']);
    expect(filterGlobalScheduleJobs(jobs, 'disconnected', 'all').map((job) => job.id)).toEqual(['job-3']);
  });

  it('returns an empty list when no jobs match the current query', () => {
    expect(filterGlobalScheduleJobs(jobs, 'missing', 'all')).toEqual([]);
  });
});

describe('summarizeGlobalScheduleJobs', () => {
  it('counts jobs across active, paused, and error buckets', () => {
    const jobs = [
      createJob(),
      createJob({ id: 'job-2', enabled: false }),
      createJob({
        id: 'job-3',
        state: {
          lastStatus: 'error',
          runCount: 1,
          retryCount: 0,
          maxRetries: 3,
        },
      }),
    ];

    expect(summarizeGlobalScheduleJobs(jobs)).toEqual({
      total: 3,
      active: 1,
      paused: 1,
      error: 1,
    });
  });

  it('returns zero counts for an empty list', () => {
    expect(summarizeGlobalScheduleJobs([])).toEqual({
      total: 0,
      active: 0,
      paused: 0,
      error: 0,
    });
  });
});
