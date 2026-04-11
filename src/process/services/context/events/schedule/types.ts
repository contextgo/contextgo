/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendAll } from '@/common/types/acpTypes';
import type { ScheduleSpec } from './jobTypes';
import type { ContextJobPriority, ContextJobType } from '../../contextDomain';

export type ContextScheduleOwner = 'user' | 'context-engine';
export type ContextScheduleCreatedBy = 'user' | 'agent' | 'system';
export type ContextScheduleScopeKind = 'conversation' | 'project' | 'space';
export type ContextScheduleRunStatus = 'ok' | 'error' | 'skipped' | 'missed';

export type ContextSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  owner: ContextScheduleOwner;
  createdBy: ContextScheduleCreatedBy;
  schedule: ScheduleSpec;
  scope: {
    kind: ContextScheduleScopeKind;
    spaceId: string;
    conversationId?: string;
    threadId?: string;
    projectSlug?: string;
    label?: string;
  };
  target:
    | {
        kind: 'send_query';
        conversationId: string;
        message: string;
        agentType: AcpBackendAll;
        conversationTitle?: string;
        workspacePath?: string;
        yoloMode?: boolean;
      }
    | {
        kind: 'context_job';
        triggerId?: string;
        jobType: ContextJobType;
        reason: string;
        priority?: ContextJobPriority;
        payload?: Readonly<Record<string, unknown>>;
        triggerEvent?: string;
        triggerLabel?: string;
      };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: ContextScheduleRunStatus;
    lastError?: string;
    runCount: number;
    retryCount: number;
    maxRetries: number;
  };
  createdAt: number;
  updatedAt: number;
};

export type ContextSchedulePatch = Omit<Partial<ContextSchedule>, 'scope' | 'state'> & {
  scope?: Partial<ContextSchedule['scope']>;
  state?: Partial<ContextSchedule['state']>;
};

export type CreateConversationScheduleInput = {
  name: string;
  schedule: ScheduleSpec;
  message: string;
  conversationId: string;
  conversationTitle?: string;
  workspacePath?: string;
  agentType: AcpBackendAll;
  createdBy: 'user' | 'agent';
  spaceId?: string;
};

export type CreateContextScheduleInput = Omit<ContextSchedule, 'id' | 'createdAt' | 'updatedAt' | 'state'> & {
  state?: Partial<ContextSchedule['state']>;
};

export type ContextScheduleStore = {
  insert(schedule: ContextSchedule): Promise<void>;
  update(scheduleId: string, updates: ContextSchedulePatch): Promise<void>;
  remove(scheduleId: string): Promise<void>;
  getById(scheduleId: string): Promise<ContextSchedule | null>;
  listAll(): Promise<ContextSchedule[]>;
  listEnabled(): Promise<ContextSchedule[]>;
  listByConversation(conversationId: string): Promise<ContextSchedule[]>;
  removeByConversation(conversationId: string): Promise<number>;
};

export function isConversationSchedule(schedule: ContextSchedule): schedule is ContextSchedule & {
  target: Extract<ContextSchedule['target'], { kind: 'send_query' }>;
} {
  return schedule.target.kind === 'send_query';
}
