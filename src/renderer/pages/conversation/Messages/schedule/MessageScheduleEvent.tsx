/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import type { IMessageScheduleEvent } from '@/common/chat/chatLib';
import {
  formatNextRun,
  formatSchedule,
  getJobStatusFlags,
  getSchedulePrimaryText,
} from '@/renderer/pages/schedule/scheduleUtils';
import { Tag } from '@arco-design/web-react';
import { AlarmClock } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type MessageScheduleEventProps = {
  message: IMessageScheduleEvent;
};

type ScheduleStatusTone = 'green' | 'orange' | 'red';

type ScheduleStatusView = {
  color: ScheduleStatusTone;
  label: string;
};

type ScheduleEventHeader = {
  title: string;
  description: string;
  countLabel?: string;
};

const getScheduleStatusView = (
  schedule: IContextSchedule,
  t: ReturnType<typeof useTranslation>['t']
): ScheduleStatusView => {
  const { hasError, isPaused } = getJobStatusFlags(schedule);
  if (hasError) {
    return {
      color: 'red',
      label: t('schedule.status.error'),
    };
  }

  if (isPaused) {
    return {
      color: 'orange',
      label: t('schedule.status.paused'),
    };
  }

  return {
    color: 'green',
    label: t('schedule.status.active'),
  };
};

const getEventHeader = (
  message: IMessageScheduleEvent,
  t: ReturnType<typeof useTranslation>['t']
): ScheduleEventHeader => {
  switch (message.content.action) {
    case 'create':
      return {
        title: t('schedule.chat.createTitle'),
        description: t('schedule.chat.createDescription'),
      };
    case 'list': {
      const count = message.content.schedules?.length ?? 0;
      return {
        title: t('schedule.chat.listTitle'),
        description: t('schedule.chat.listDescription', { count }),
        countLabel: String(count),
      };
    }
    case 'delete':
      return {
        title: t('schedule.chat.deleteTitle'),
        description: t('schedule.chat.deleteDescription'),
      };
    case 'error':
    default:
      return {
        title: t('schedule.chat.errorTitle'),
        description: t('schedule.chat.errorDescription'),
      };
  }
};

const ScheduleField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className='min-w-0 rounded-10px bg-[var(--color-fill-2)] px-10px py-8px'>
      <div className='text-11px font-medium uppercase tracking-[0.04em] text-t-tertiary'>{label}</div>
      <div className='mt-4px break-words text-13px leading-6 text-t-primary'>{value}</div>
    </div>
  );
};

const ScheduleSummaryCard: React.FC<{ schedule: IContextSchedule }> = ({ schedule }) => {
  const { t } = useTranslation();
  const status = getScheduleStatusView(schedule, t);

  return (
    <div className='rounded-14px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] px-12px py-12px'>
      <div className='flex flex-wrap items-center justify-between gap-8px'>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-14px font-semibold text-t-primary'>{schedule.name}</div>
          <div className='mt-2px text-12px text-t-secondary'>{formatSchedule(schedule)}</div>
        </div>
        <Tag color={status.color}>{status.label}</Tag>
      </div>
      <div className='mt-10px grid gap-8px md:grid-cols-2'>
        <ScheduleField label={t('schedule.message')} value={getSchedulePrimaryText(schedule)} />
        <ScheduleField label={t('schedule.nextRun')} value={formatNextRun(schedule.state.nextRunAtMs)} />
      </div>
      <div className='mt-10px flex flex-wrap items-center gap-8px text-12px text-t-tertiary'>
        <span>{t('schedule.chat.taskId')}</span>
        <span className='rounded-full bg-[var(--color-fill-2)] px-8px py-2px font-mono text-[12px] text-t-secondary'>
          {schedule.id}
        </span>
      </div>
    </div>
  );
};

const MessageScheduleEvent: React.FC<MessageScheduleEventProps> = ({ message }) => {
  const { t } = useTranslation();
  const header = getEventHeader(message, t);
  const schedules = message.content.schedules ?? (message.content.schedule ? [message.content.schedule] : []);

  return (
    <div className='w-full min-w-0'>
      <div className='w-full max-w-720px rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] px-14px py-12px shadow-[0_8px_24px_rgba(15,23,42,0.04)]'>
        <div className='flex items-start justify-between gap-12px'>
          <div className='min-w-0 flex items-start gap-10px'>
            <div className='mt-1px inline-flex h-30px w-30px shrink-0 items-center justify-center rounded-full bg-[var(--color-fill-2)] text-[var(--color-text-2)]'>
              <AlarmClock theme='outline' size={16} />
            </div>
            <div className='min-w-0'>
              <div className='text-14px font-semibold text-t-primary'>{header.title}</div>
              <div className='mt-2px text-12px leading-5 text-t-secondary'>{header.description}</div>
            </div>
          </div>
          {header.countLabel ? <Tag color='arcoblue'>{header.countLabel}</Tag> : null}
        </div>

        {message.content.action === 'delete' && message.content.scheduleId ? (
          <div className='mt-12px rounded-12px bg-[var(--color-fill-2)] px-12px py-10px text-13px text-t-primary'>
            <span className='text-t-secondary'>{t('schedule.chat.deletedId')}</span>
            <span className='ml-8px font-mono'>{message.content.scheduleId}</span>
          </div>
        ) : null}

        {message.content.action === 'error' ? (
          <div className='mt-12px rounded-12px border border-solid border-[var(--color-danger-light)] bg-[var(--color-danger-light)]/30 px-12px py-10px text-13px text-[var(--color-danger)]'>
            {message.content.error || t('common.unknownError')}
          </div>
        ) : null}

        {message.content.action === 'list' && schedules.length === 0 ? (
          <div className='mt-12px rounded-12px bg-[var(--color-fill-2)] px-12px py-10px text-13px text-t-secondary'>
            {t('schedule.chat.empty')}
          </div>
        ) : null}

        {schedules.length > 0 ? (
          <div className='mt-12px flex flex-col gap-10px'>
            {schedules.map((schedule) => (
              <ScheduleSummaryCard key={schedule.id} schedule={schedule} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageScheduleEvent;
