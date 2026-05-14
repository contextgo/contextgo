import { beforeEach, describe, expect, it, vi } from 'vitest';

const listConversationSchedulesMock = vi.fn();
const createConversationScheduleMock = vi.fn();
const getScheduleMock = vi.fn();
const removeScheduleMock = vi.fn();

vi.mock('@process/services/context/scheduleServiceSingleton', () => ({
  scheduleService: {
    listConversationSchedules: (...args: unknown[]) => listConversationSchedulesMock(...args),
    createConversationSchedule: (...args: unknown[]) => createConversationScheduleMock(...args),
    getSchedule: (...args: unknown[]) => getScheduleMock(...args),
    removeSchedule: (...args: unknown[]) => removeScheduleMock(...args),
  },
}));

import {
  AssistantControlCommandStreamFilter,
  executeAssistantScheduleCommands,
  stripAssistantControlCommands,
} from '@/process/services/context/events/schedule/AssistantScheduleCommandService';

describe('AssistantScheduleCommandService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips schedule command markers from assistant-visible content', () => {
    expect(
      stripAssistantControlCommands(
        'Before\n[SCHEDULE_CREATE]\nname: Daily\nschedule: 0 9 * * *\nschedule_description: Every day\nmessage: ping\n[/SCHEDULE_CREATE]\nAfter'
      )
    ).toBe('Before\n\nAfter');
  });

  it('also strips skill market control blocks from assistant-visible content', () => {
    expect(
      stripAssistantControlCommands(
        '先搜索\n[SKILLMARKET_SEARCH]\nquery: browser context\n[/SKILLMARKET_SEARCH]\n再回复'
      )
    ).toBe('先搜索\n\n再回复');
  });

  it('also strips command management control blocks from assistant-visible content', () => {
    expect(
      stripAssistantControlCommands(
        '先维护 command\n[COMMAND_UPSERT]\nscope: project\nname: review\ndescription: desc\ntemplate: body\n[/COMMAND_UPSERT]\n再回复'
      )
    ).toBe('先维护 command\n\n再回复');
    expect(stripAssistantControlCommands('[COMMAND_LIST: scope=project]')).toBe('');
    expect(stripAssistantControlCommands('[COMMAND_DELETE: scope=space; name=review]')).toBe('');
  });

  it('filters streamed schedule create blocks before they reach the UI', () => {
    const filter = new AssistantControlCommandStreamFilter();

    expect(filter.push('先执行这个操作：\n[SCHED')).toBe('先执行这个操作：\n');
    expect(filter.push('ULE_CREATE]\nname: Daily\nschedule: 0 9 * * *\n')).toBe('');
    expect(filter.push('schedule_description: Every day\nmessage: ping\n[/SCHEDULE_CREATE]\n完成。')).toBe('\n完成。');
  });

  it('filters streamed single-line control tags without removing normal bracket text', () => {
    const filter = new AssistantControlCommandStreamFilter();

    expect(filter.push('[LOAD_SKILL: schedule]')).toBe('');
    expect(filter.push('正常文本 [not-a-command] 保留')).toBe('正常文本 [not-a-command] 保留');
    expect(filter.push('[SCHEDULE_DELETE: schedule-1]')).toBe('');
    expect(filter.push('[SCHEDULE_LIST]')).toBe('');
  });

  it('filters streamed skill market blocks before they reach the UI', () => {
    const filter = new AssistantControlCommandStreamFilter();

    expect(filter.push('先找找\n[SKILLMAR')).toBe('先找找\n');
    expect(filter.push('KET_SEARCH]\nquery: browser skill\n')).toBe('');
    expect(filter.push('view: curated\n[/SKILLMARKET_SEARCH]\n给你结果')).toBe('\n给你结果');
    expect(filter.push('[SKILLMARKET_INSTALL]\nskill_id: browser-skill\n[/SKILLMARKET_INSTALL]')).toBe('');
  });

  it('filters streamed command blocks before they reach the UI', () => {
    const filter = new AssistantControlCommandStreamFilter();

    expect(filter.push('先更新 command\n[COMMAND_')).toBe('先更新 command\n');
    expect(filter.push('UPSERT]\nscope: project\nname: review\n')).toBe('');
    expect(filter.push('description: desc\ntemplate: body\n[/COMMAND_UPSERT]\n完成')).toBe('\n完成');
    expect(filter.push('[COMMAND_LIST: scope=project]')).toBe('');
    expect(filter.push('[COMMAND_DELETE: scope=project; name=review]')).toBe('');
  });

  it('lists existing conversation schedules and emits a list event', async () => {
    listConversationSchedulesMock.mockResolvedValue([
      {
        id: 'schedule-1',
        name: 'Daily summary',
        enabled: true,
        schedule: {
          kind: 'cron',
          expr: '0 9 * * *',
          description: 'Every day at 09:00',
        },
        target: {
          kind: 'send_query',
          conversationId: 'conv-1',
          message: 'Summarize today',
        },
      },
    ]);

    const result = await executeAssistantScheduleCommands({
      content: '[SCHEDULE_LIST]',
      conversationId: 'conv-1',
      agentType: 'gemini',
    });

    expect(listConversationSchedulesMock).toHaveBeenCalledWith('conv-1');
    expect(result.systemResponses[0]).toContain('Found 1 scheduled task');
    expect(result.systemResponses[0]).toContain('id=schedule-1');
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'list',
        schedules: [
          expect.objectContaining({
            id: 'schedule-1',
            name: 'Daily summary',
          }),
        ],
      },
    ]);
  });

  it('creates and deletes schedules for the current conversation and emits product events', async () => {
    createConversationScheduleMock.mockResolvedValue({
      id: 'schedule-2',
      name: 'Daily summary',
      enabled: true,
      owner: 'user',
      createdBy: 'agent',
      schedule: {
        kind: 'cron',
        expr: '0 9 * * *',
        description: 'Every day at 09:00',
      },
      scope: {
        kind: 'conversation',
        spaceId: 'space-1',
        conversationId: 'conv-1',
      },
      target: {
        kind: 'send_query',
        conversationId: 'conv-1',
        message: 'Summarize today',
        agentType: 'claude',
      },
      state: {
        runCount: 0,
        retryCount: 0,
        maxRetries: 3,
      },
      createdAt: 1760000000000,
      updatedAt: 1760000000000,
    });
    getScheduleMock.mockResolvedValue({
      id: 'schedule-2',
      scope: {
        conversationId: 'conv-1',
      },
      target: {
        kind: 'send_query',
        conversationId: 'conv-1',
      },
    });

    const createResult = await executeAssistantScheduleCommands({
      content:
        '[SCHEDULE_CREATE]\nname: Daily summary\nschedule: 0 9 * * *\nschedule_description: Every day at 09:00\nmessage: Summarize today\n[/SCHEDULE_CREATE]',
      conversationId: 'conv-1',
      agentType: 'claude',
    });

    expect(createConversationScheduleMock).toHaveBeenCalledWith({
      name: 'Daily summary',
      schedule: {
        kind: 'cron',
        expr: '0 9 * * *',
        description: 'Every day at 09:00',
      },
      message: 'Summarize today',
      conversationId: 'conv-1',
      agentType: 'claude',
      createdBy: 'agent',
    });
    expect(createResult.systemResponses[0]).toContain('Created scheduled task schedule-2');
    expect(createResult.events).toEqual([
      expect.objectContaining({
        source: 'assistant-skill',
        action: 'create',
        scheduleId: 'schedule-2',
      }),
    ]);

    const deleteResult = await executeAssistantScheduleCommands({
      content: '[SCHEDULE_DELETE: schedule-2]',
      conversationId: 'conv-1',
      agentType: 'claude',
    });

    expect(removeScheduleMock).toHaveBeenCalledWith('schedule-2');
    expect(deleteResult.systemResponses[0]).toContain('Deleted scheduled task schedule-2');
    expect(deleteResult.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'delete',
        scheduleId: 'schedule-2',
      },
    ]);
  });

  it('returns an error event when deleting a missing schedule', async () => {
    getScheduleMock.mockResolvedValue(null);

    const result = await executeAssistantScheduleCommands({
      content: '[SCHEDULE_DELETE: missing-schedule]',
      conversationId: 'conv-1',
      agentType: 'codex',
    });

    expect(removeScheduleMock).not.toHaveBeenCalled();
    expect(result.systemResponses).toEqual(['[Schedule Result]\nError: Scheduled task not found: missing-schedule']);
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'error',
        scheduleId: 'missing-schedule',
        error: 'Scheduled task not found: missing-schedule',
      },
    ]);
  });
});
