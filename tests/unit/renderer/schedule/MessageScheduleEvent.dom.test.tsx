/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageScheduleEvent } from '../../../../src/common/chat/chatLib';
import MessageScheduleEvent from '../../../../src/renderer/pages/conversation/Messages/schedule/MessageScheduleEvent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'schedule.chat.listDescription') {
        return `count:${options?.count ?? 0}`;
      }
      return key;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  AlarmClock: () => <span>clock</span>,
}));

const createScheduleMessage = (content: IMessageScheduleEvent['content']): IMessageScheduleEvent => ({
  id: 'msg-1',
  msg_id: 'msg-1',
  type: 'schedule_event',
  position: 'left',
  conversation_id: 'conv-1',
  content,
});

describe('MessageScheduleEvent', () => {
  it('renders a created schedule as a product card', () => {
    render(
      <MessageScheduleEvent
        message={createScheduleMessage({
          source: 'assistant-skill',
          action: 'create',
          scheduleId: 'schedule-1',
          schedule: {
            id: 'schedule-1',
            name: 'Daily hello',
            enabled: true,
            owner: 'user',
            createdBy: 'agent',
            schedule: {
              kind: 'cron',
              expr: '40 0 * * *',
              description: 'Every day at 00:40',
            },
            scope: {
              kind: 'conversation',
              spaceId: 'space-1',
              conversationId: 'conv-1',
            },
            target: {
              kind: 'send_query',
              conversationId: 'conv-1',
              message: '你好',
              agentType: 'gemini',
            },
            state: {
              nextRunAtMs: 1760000000000,
              runCount: 0,
              retryCount: 0,
              maxRetries: 3,
            },
            createdAt: 1760000000000,
            updatedAt: 1760000000000,
          },
        })}
      />
    );

    expect(screen.getByText('schedule.chat.createTitle')).toBeInTheDocument();
    expect(screen.getByText('Daily hello')).toBeInTheDocument();
    expect(screen.getByText('Every day at 00:40')).toBeInTheDocument();
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getAllByText('schedule.chat.taskId').length).toBeGreaterThan(0);
    expect(screen.getByText('schedule.status.active')).toBeInTheDocument();
  });

  it('renders an empty list state without technical markdown', () => {
    render(
      <MessageScheduleEvent
        message={createScheduleMessage({
          source: 'assistant-skill',
          action: 'list',
          schedules: [],
        })}
      />
    );

    expect(screen.getByText('schedule.chat.listTitle')).toBeInTheDocument();
    expect(screen.getByText('count:0')).toBeInTheDocument();
    expect(screen.getByText('schedule.chat.empty')).toBeInTheDocument();
  });

  it('renders scheduling failures as an error card', () => {
    render(
      <MessageScheduleEvent
        message={createScheduleMessage({
          source: 'assistant-skill',
          action: 'error',
          error: 'Scheduled task not found',
        })}
      />
    );

    expect(screen.getByText('schedule.chat.errorTitle')).toBeInTheDocument();
    expect(screen.getByText('Scheduled task not found')).toBeInTheDocument();
  });
});
