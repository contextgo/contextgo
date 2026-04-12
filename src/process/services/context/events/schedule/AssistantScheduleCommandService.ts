/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendAll } from '@/common/types/acpTypes';
import type { ScheduleEventPayload } from '@/common/types/schedule/events';
import { scheduleService } from '@process/services/context/scheduleServiceSingleton';
import type { IContextSchedule } from '@/common/adapter/ipcBridge';

const SCHEDULE_LIST_PATTERN = /\[SCHEDULE_LIST\]/gi;
const SCHEDULE_DELETE_PATTERN = /\[SCHEDULE_DELETE:\s*([^\]]+?)\s*\]/gi;
const SCHEDULE_CREATE_BLOCK_PATTERN = /\[SCHEDULE_CREATE\]([\s\S]*?)\[\/SCHEDULE_CREATE\]/gi;
const SKILLMARKET_SEARCH_BLOCK_PATTERN = /\[SKILLMARKET_SEARCH\]([\s\S]*?)\[\/SKILLMARKET_SEARCH\]/gi;
const SKILLMARKET_INSTALL_BLOCK_PATTERN = /\[SKILLMARKET_INSTALL\]([\s\S]*?)\[\/SKILLMARKET_INSTALL\]/gi;
const LOAD_SKILL_PATTERN = /\[LOAD_SKILL:\s*[^\]]+\]/gi;
const SCHEDULE_CREATE_OPEN_TAG = '[SCHEDULE_CREATE]';
const SCHEDULE_CREATE_CLOSE_TAG = '[/SCHEDULE_CREATE]';
const SKILLMARKET_SEARCH_OPEN_TAG = '[SKILLMARKET_SEARCH]';
const SKILLMARKET_SEARCH_CLOSE_TAG = '[/SKILLMARKET_SEARCH]';
const SKILLMARKET_INSTALL_OPEN_TAG = '[SKILLMARKET_INSTALL]';
const SKILLMARKET_INSTALL_CLOSE_TAG = '[/SKILLMARKET_INSTALL]';
const SCHEDULE_LIST_TAG = '[SCHEDULE_LIST]';
const SCHEDULE_DELETE_PREFIX = '[SCHEDULE_DELETE:';
const LOAD_SKILL_PREFIX = '[LOAD_SKILL:';

const isCompleteScheduleDeleteTag = (value: string): boolean => /^\[SCHEDULE_DELETE:\s*[^\]]+?\s*\]$/i.test(value);

const isCompleteLoadSkillTag = (value: string): boolean => /^\[LOAD_SKILL:\s*[^\]]+\]$/i.test(value);

type ScheduleCommand =
  | {
      index: number;
      type: 'list';
    }
  | {
      index: number;
      type: 'delete';
      scheduleId: string;
    }
  | {
      index: number;
      type: 'create';
      name: string;
      scheduleExpr: string;
      scheduleDescription: string;
      message: string;
    };

export type AssistantScheduleCommandResult = {
  cleanedContent: string;
  hasCommands: boolean;
  systemResponses: string[];
  events: ScheduleEventPayload[];
};

export class AssistantControlCommandStreamFilter {
  private pending = '';
  private insideScheduleCreateBlock = false;
  private insideSkillMarketSearchBlock = false;
  private insideSkillMarketInstallBlock = false;

  push(chunk: string): string {
    if (!chunk) {
      return '';
    }

    this.pending += chunk;
    let output = '';

    while (this.pending.length > 0) {
      if (this.insideSkillMarketSearchBlock) {
        const closeIndex = this.pending.indexOf(SKILLMARKET_SEARCH_CLOSE_TAG);
        if (closeIndex === -1) {
          this.pending = '';
          break;
        }

        this.pending = this.pending.slice(closeIndex + SKILLMARKET_SEARCH_CLOSE_TAG.length);
        this.insideSkillMarketSearchBlock = false;
        continue;
      }

      if (this.insideSkillMarketInstallBlock) {
        const closeIndex = this.pending.indexOf(SKILLMARKET_INSTALL_CLOSE_TAG);
        if (closeIndex === -1) {
          this.pending = '';
          break;
        }

        this.pending = this.pending.slice(closeIndex + SKILLMARKET_INSTALL_CLOSE_TAG.length);
        this.insideSkillMarketInstallBlock = false;
        continue;
      }

      if (this.insideScheduleCreateBlock) {
        const closeIndex = this.pending.indexOf(SCHEDULE_CREATE_CLOSE_TAG);
        if (closeIndex === -1) {
          this.pending = '';
          break;
        }

        this.pending = this.pending.slice(closeIndex + SCHEDULE_CREATE_CLOSE_TAG.length);
        this.insideScheduleCreateBlock = false;
        continue;
      }

      const markerIndex = this.pending.indexOf('[');
      if (markerIndex === -1) {
        output += this.pending;
        this.pending = '';
        break;
      }

      if (markerIndex > 0) {
        output += this.pending.slice(0, markerIndex);
        this.pending = this.pending.slice(markerIndex);
      }

      if (!this.pending) {
        break;
      }

      if (this.pending.startsWith(SCHEDULE_CREATE_OPEN_TAG)) {
        this.pending = this.pending.slice(SCHEDULE_CREATE_OPEN_TAG.length);
        this.insideScheduleCreateBlock = true;
        continue;
      }

      if (SCHEDULE_CREATE_OPEN_TAG.startsWith(this.pending)) {
        break;
      }

      if (this.pending.startsWith(SKILLMARKET_SEARCH_OPEN_TAG)) {
        this.pending = this.pending.slice(SKILLMARKET_SEARCH_OPEN_TAG.length);
        this.insideSkillMarketSearchBlock = true;
        continue;
      }

      if (SKILLMARKET_SEARCH_OPEN_TAG.startsWith(this.pending)) {
        break;
      }

      if (this.pending.startsWith(SKILLMARKET_INSTALL_OPEN_TAG)) {
        this.pending = this.pending.slice(SKILLMARKET_INSTALL_OPEN_TAG.length);
        this.insideSkillMarketInstallBlock = true;
        continue;
      }

      if (SKILLMARKET_INSTALL_OPEN_TAG.startsWith(this.pending)) {
        break;
      }

      if (this.pending.startsWith(SCHEDULE_LIST_TAG)) {
        this.pending = this.pending.slice(SCHEDULE_LIST_TAG.length);
        continue;
      }

      if (SCHEDULE_LIST_TAG.startsWith(this.pending)) {
        break;
      }

      if (this.pending.startsWith(SCHEDULE_DELETE_PREFIX)) {
        const endIndex = this.pending.indexOf(']');
        if (endIndex === -1) {
          break;
        }

        const candidate = this.pending.slice(0, endIndex + 1);
        if (isCompleteScheduleDeleteTag(candidate)) {
          this.pending = this.pending.slice(endIndex + 1);
          continue;
        }
      }

      if (SCHEDULE_DELETE_PREFIX.startsWith(this.pending)) {
        break;
      }

      if (this.pending.startsWith(LOAD_SKILL_PREFIX)) {
        const endIndex = this.pending.indexOf(']');
        if (endIndex === -1) {
          break;
        }

        const candidate = this.pending.slice(0, endIndex + 1);
        if (isCompleteLoadSkillTag(candidate)) {
          this.pending = this.pending.slice(endIndex + 1);
          continue;
        }
      }

      if (LOAD_SKILL_PREFIX.startsWith(this.pending)) {
        break;
      }

      output += this.pending[0];
      this.pending = this.pending.slice(1);
    }

    return output;
  }

  flush(): string {
    if (this.insideSkillMarketSearchBlock) {
      this.pending = '';
      this.insideSkillMarketSearchBlock = false;
      return '';
    }

    if (this.insideSkillMarketInstallBlock) {
      this.pending = '';
      this.insideSkillMarketInstallBlock = false;
      return '';
    }

    if (this.insideScheduleCreateBlock) {
      this.pending = '';
      this.insideScheduleCreateBlock = false;
      return '';
    }

    const output = this.pending;
    this.pending = '';
    return output;
  }

  reset(): void {
    this.pending = '';
    this.insideScheduleCreateBlock = false;
    this.insideSkillMarketSearchBlock = false;
    this.insideSkillMarketInstallBlock = false;
  }
}

function normalizeCommandSpacing(content: string): string {
  return content.replace(/\n{3,}/g, '\n\n').trim();
}

function readBlockField(block: string, fieldName: string): string {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldPattern = new RegExp(`^${escapedFieldName}:\\s*([\\s\\S]*?)(?=^\\w[\\w_]*:\\s|$)`, 'im');
  const match = fieldPattern.exec(block);
  return match?.[1]?.trim() ?? '';
}

function collectScheduleCommands(content: string): ScheduleCommand[] {
  const commands: ScheduleCommand[] = [];

  for (const match of content.matchAll(SCHEDULE_LIST_PATTERN)) {
    commands.push({
      index: match.index ?? 0,
      type: 'list',
    });
  }

  for (const match of content.matchAll(SCHEDULE_DELETE_PATTERN)) {
    commands.push({
      index: match.index ?? 0,
      type: 'delete',
      scheduleId: match[1]?.trim() ?? '',
    });
  }

  for (const match of content.matchAll(SCHEDULE_CREATE_BLOCK_PATTERN)) {
    const block = match[1] ?? '';
    commands.push({
      index: match.index ?? 0,
      type: 'create',
      name: readBlockField(block, 'name'),
      scheduleExpr: readBlockField(block, 'schedule'),
      scheduleDescription: readBlockField(block, 'schedule_description'),
      message: readBlockField(block, 'message'),
    });
  }

  return commands.toSorted((left, right) => left.index - right.index);
}

function formatScheduleListResult(schedules: IContextSchedule[]): string {
  if (schedules.length === 0) {
    return '[Schedule Result]\nNo scheduled tasks exist for this conversation.';
  }

  const lines = schedules.flatMap((schedule, index) => {
    const targetMessage = schedule.target.kind === 'send_query' ? schedule.target.message : schedule.target.reason;
    const scheduleValue =
      schedule.schedule.kind === 'cron'
        ? schedule.schedule.expr
        : schedule.schedule.kind === 'every'
          ? `${schedule.schedule.everyMs}ms`
          : new Date(schedule.schedule.atMs).toISOString();

    return [
      `${index + 1}. id=${schedule.id}`,
      `   name=${schedule.name}`,
      `   enabled=${schedule.enabled ? 'true' : 'false'}`,
      `   schedule=${scheduleValue}`,
      `   schedule_description=${schedule.schedule.description}`,
      `   message=${targetMessage}`,
    ];
  });

  return `[Schedule Result]\nFound ${schedules.length} scheduled task(s):\n${lines.join('\n')}`;
}

function formatScheduleCreateResult(schedule: IContextSchedule): string {
  const primaryMessage = schedule.target.kind === 'send_query' ? schedule.target.message : schedule.target.reason;
  const scheduleValue =
    schedule.schedule.kind === 'cron'
      ? schedule.schedule.expr
      : schedule.schedule.kind === 'every'
        ? `${schedule.schedule.everyMs}ms`
        : new Date(schedule.schedule.atMs).toISOString();

  return [
    '[Schedule Result]',
    `Created scheduled task ${schedule.id}.`,
    `name=${schedule.name}`,
    `enabled=${schedule.enabled ? 'true' : 'false'}`,
    `schedule=${scheduleValue}`,
    `schedule_description=${schedule.schedule.description}`,
    `message=${primaryMessage}`,
  ].join('\n');
}

function formatScheduleDeleteResult(scheduleId: string): string {
  return `[Schedule Result]\nDeleted scheduled task ${scheduleId}.`;
}

function formatScheduleCommandError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[Schedule Result]\nError: ${message}`;
}

async function executeScheduleCommand(
  command: ScheduleCommand,
  conversationId: string,
  agentType: AcpBackendAll
): Promise<{ systemResponse: string; event: ScheduleEventPayload }> {
  switch (command.type) {
    case 'list': {
      const schedules = await scheduleService.listConversationSchedules(conversationId);
      return {
        systemResponse: formatScheduleListResult(schedules),
        event: {
          source: 'assistant-skill',
          action: 'list',
          schedules,
        },
      };
    }
    case 'delete': {
      const schedule = await scheduleService.getSchedule(command.scheduleId);
      if (!schedule) {
        throw new Error(`Scheduled task not found: ${command.scheduleId}`);
      }

      const scheduleConversationId =
        schedule.scope.conversationId ??
        (schedule.target.kind === 'send_query' ? schedule.target.conversationId : undefined);

      if (scheduleConversationId !== conversationId) {
        throw new Error(`Scheduled task ${command.scheduleId} does not belong to this conversation`);
      }

      await scheduleService.removeSchedule(command.scheduleId);
      return {
        systemResponse: formatScheduleDeleteResult(command.scheduleId),
        event: {
          source: 'assistant-skill',
          action: 'delete',
          scheduleId: command.scheduleId,
        },
      };
    }
    case 'create': {
      if (!command.name || !command.scheduleExpr || !command.scheduleDescription || !command.message) {
        throw new Error('SCHEDULE_CREATE requires name, schedule, schedule_description, and message');
      }

      const schedule = await scheduleService.createConversationSchedule({
        name: command.name,
        schedule: {
          kind: 'cron',
          expr: command.scheduleExpr,
          description: command.scheduleDescription,
        },
        message: command.message,
        conversationId,
        agentType,
        createdBy: 'agent',
      });

      return {
        systemResponse: formatScheduleCreateResult(schedule),
        event: {
          source: 'assistant-skill',
          action: 'create',
          schedule,
          scheduleId: schedule.id,
        },
      };
    }
  }
}

export function stripAssistantControlCommands(content: string): string {
  if (!content.trim()) {
    return '';
  }

  const cleaned = content
    .replace(LOAD_SKILL_PATTERN, '')
    .replace(SCHEDULE_CREATE_BLOCK_PATTERN, '')
    .replace(SKILLMARKET_SEARCH_BLOCK_PATTERN, '')
    .replace(SKILLMARKET_INSTALL_BLOCK_PATTERN, '')
    .replace(SCHEDULE_DELETE_PATTERN, '')
    .replace(SCHEDULE_LIST_PATTERN, '');

  return normalizeCommandSpacing(cleaned);
}

export async function executeAssistantScheduleCommands(params: {
  content: string;
  conversationId: string;
  agentType: AcpBackendAll;
}): Promise<AssistantScheduleCommandResult> {
  const { content, conversationId, agentType } = params;
  const commands = collectScheduleCommands(content);

  if (commands.length === 0) {
    return {
      cleanedContent: stripAssistantControlCommands(content),
      hasCommands: false,
      systemResponses: [],
      events: [],
    };
  }

  const systemResponses: string[] = [];
  const events: ScheduleEventPayload[] = [];

  for (const command of commands) {
    try {
      // Commands are executed in appearance order to preserve the assistant's intended workflow.
      // eslint-disable-next-line no-await-in-loop
      const result = await executeScheduleCommand(command, conversationId, agentType);
      systemResponses.push(result.systemResponse);
      events.push(result.event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      systemResponses.push(formatScheduleCommandError(error));
      events.push({
        source: 'assistant-skill',
        action: 'error',
        scheduleId: command.type === 'delete' ? command.scheduleId : undefined,
        error: message,
      });
    }
  }

  return {
    cleanedContent: stripAssistantControlCommands(content),
    hasCommands: true,
    systemResponses,
    events,
  };
}
