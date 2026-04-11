/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendAll } from '@/common/types/acpTypes';
import type { ScheduleSpec } from '../events/schedule/jobTypes';
import type { RuntimeScheduleCapability } from './RuntimeScheduleCapability';
import type { ContextSchedule } from '../events/schedule/types';

export type ScheduleSkillCommand =
  | {
      kind: 'conversation.create';
      input: {
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
    }
  | {
      kind: 'conversation.list';
      input: { conversationId: string };
    }
  | {
      kind: 'conversation.update';
      input: { scheduleId: string; updates: Partial<ContextSchedule> };
    }
  | {
      kind: 'conversation.remove';
      input: { scheduleId: string };
    }
  | {
      kind: 'context.create';
      input: Omit<ContextSchedule, 'id' | 'createdAt' | 'updatedAt' | 'state'> & {
        state?: Partial<ContextSchedule['state']>;
      };
    }
  | {
      kind: 'context.list';
      input?: {
        spaceId?: string;
        conversationId?: string;
        threadId?: string;
        projectSlug?: string;
      };
    }
  | {
      kind: 'context.update';
      input: { scheduleId: string; updates: Partial<ContextSchedule> };
    }
  | {
      kind: 'context.remove';
      input: { scheduleId: string };
    };

export class ScheduleSkillAdapter {
  constructor(private readonly capability: RuntimeScheduleCapability) {}

  async execute(command: ScheduleSkillCommand): Promise<unknown> {
    switch (command.kind) {
      case 'conversation.create':
        return this.capability.createConversationSchedule(command.input);
      case 'conversation.list':
        return this.capability.listConversationSchedules(command.input.conversationId);
      case 'conversation.update':
        return this.capability.updateConversationSchedule(command.input.scheduleId, command.input.updates);
      case 'conversation.remove':
        await this.capability.removeConversationSchedule(command.input.scheduleId);
        return { success: true };
      case 'context.create':
        return this.capability.createContextSchedule(command.input);
      case 'context.list':
        return this.capability.listContextSchedules(command.input);
      case 'context.update':
        return this.capability.updateContextSchedule(command.input.scheduleId, command.input.updates);
      case 'context.remove':
        await this.capability.removeContextSchedule(command.input.scheduleId);
        return { success: true };
    }
  }
}
