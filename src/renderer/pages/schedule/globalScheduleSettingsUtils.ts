/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import {
  getScheduleAgentType,
  getScheduleConversationId,
  getScheduleConversationTitle,
  getSchedulePrimaryText,
  getScheduleWorkspacePath,
} from './scheduleUtils';

export type GlobalScheduleJobStatus = 'active' | 'paused' | 'error';

export function getGlobalScheduleJobStatus(job: IContextSchedule): GlobalScheduleJobStatus {
  if (!job.enabled) {
    return 'paused';
  }

  if (job.state.lastStatus === 'error') {
    return 'error';
  }

  return 'active';
}

export function filterGlobalScheduleJobs(
  jobs: IContextSchedule[],
  query: string,
  status: GlobalScheduleJobStatus | 'all'
): IContextSchedule[] {
  const normalizedQuery = query.trim().toLowerCase();

  return jobs.filter((job) => {
    if (status !== 'all' && getGlobalScheduleJobStatus(job) !== status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystacks = [
      job.name,
      getSchedulePrimaryText(job),
      job.schedule.description,
      getScheduleConversationTitle(job),
      getScheduleConversationId(job),
      getScheduleWorkspacePath(job),
      getScheduleAgentType(job),
      job.target.kind,
      job.scope.kind,
      job.state.lastError,
    ];

    return haystacks.some((value) => value?.toLowerCase().includes(normalizedQuery));
  });
}

export function summarizeGlobalScheduleJobs(jobs: IContextSchedule[]) {
  return jobs.reduce(
    (summary, job) => {
      const status = getGlobalScheduleJobStatus(job);

      summary.total += 1;
      if (status === 'active') {
        summary.active += 1;
      } else if (status === 'paused') {
        summary.paused += 1;
      } else {
        summary.error += 1;
      }

      return summary;
    },
    {
      total: 0,
      active: 0,
      paused: 0,
      error: 0,
    }
  );
}
