/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendAll } from '@/common/types/acpTypes';
import type { ScheduleSpec } from '../events/schedule/jobTypes';
import type { ContextScheduleService } from '../events/schedule/ContextScheduleService';
import type { ContextSchedule } from '../events/schedule/types';

export type ScheduleCapabilityScope = {
  spaceId: string;
  conversationId?: string;
  threadId?: string;
  projectSlug?: string;
};

export type RuntimeScheduleCapability = {
  createConversationSchedule(input: {
    name: string;
    schedule: ScheduleSpec;
    message: string;
    conversationId: string;
    conversationTitle?: string;
    workspacePath?: string;
    agentType: AcpBackendAll;
    createdBy: 'user' | 'agent';
    spaceId?: string;
  }): Promise<ContextSchedule>;
  listConversationSchedules(conversationId: string): Promise<ContextSchedule[]>;
  updateConversationSchedule(scheduleId: string, updates: Partial<ContextSchedule>): Promise<ContextSchedule>;
  removeConversationSchedule(scheduleId: string): Promise<void>;
  createContextSchedule(input: Omit<ContextSchedule, 'id' | 'createdAt' | 'updatedAt' | 'state'> & {
    state?: Partial<ContextSchedule['state']>;
  }): Promise<ContextSchedule>;
  listContextSchedules(scope?: Partial<ScheduleCapabilityScope>): Promise<ContextSchedule[]>;
  updateContextSchedule(scheduleId: string, updates: Partial<ContextSchedule>): Promise<ContextSchedule>;
  removeContextSchedule(scheduleId: string): Promise<void>;
};

export class ContextRuntimeScheduleCapability implements RuntimeScheduleCapability {
  constructor(private readonly scheduleService: ContextScheduleService) {}

  async createConversationSchedule(input: {
    name: string;
    schedule: ScheduleSpec;
    message: string;
    conversationId: string;
    conversationTitle?: string;
    workspacePath?: string;
    agentType: AcpBackendAll;
    createdBy: 'user' | 'agent';
    spaceId?: string;
  }): Promise<ContextSchedule> {
    return this.scheduleService.createConversationSchedule(input);
  }

  async listConversationSchedules(conversationId: string): Promise<ContextSchedule[]> {
    return this.scheduleService.listConversationSchedules(conversationId);
  }

  async updateConversationSchedule(scheduleId: string, updates: Partial<ContextSchedule>): Promise<ContextSchedule> {
    return this.scheduleService.updateSchedule(scheduleId, updates);
  }

  async removeConversationSchedule(scheduleId: string): Promise<void> {
    await this.scheduleService.removeSchedule(scheduleId);
  }

  async createContextSchedule(input: Omit<ContextSchedule, 'id' | 'createdAt' | 'updatedAt' | 'state'> & {
    state?: Partial<ContextSchedule['state']>;
  }): Promise<ContextSchedule> {
    return this.scheduleService.createContextSchedule(input);
  }

  async listContextSchedules(scope?: Partial<ScheduleCapabilityScope>): Promise<ContextSchedule[]> {
    const schedules = await this.scheduleService.listSchedules();
    if (!scope) {
      return schedules;
    }

    return schedules.filter(schedule => {
      if (scope.spaceId && schedule.scope.spaceId !== scope.spaceId) {
        return false;
      }
      if (scope.conversationId && schedule.scope.conversationId !== scope.conversationId) {
        return false;
      }
      if (scope.threadId && schedule.scope.threadId !== scope.threadId) {
        return false;
      }
      if (scope.projectSlug && schedule.scope.projectSlug !== scope.projectSlug) {
        return false;
      }
      return true;
    });
  }

  async updateContextSchedule(scheduleId: string, updates: Partial<ContextSchedule>): Promise<ContextSchedule> {
    return this.scheduleService.updateSchedule(scheduleId, updates);
  }

  async removeContextSchedule(scheduleId: string): Promise<void> {
    await this.scheduleService.removeSchedule(scheduleId);
  }
}
