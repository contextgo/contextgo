/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spin, Tag } from '@arco-design/web-react';
import { Down, Up } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentRunPhase, AgentRunTrace } from './types';

interface AgentRunStatusProps {
  trace: AgentRunTrace | null;
  running?: boolean;
}

const PHASE_TAG_COLOR: Record<AgentRunPhase, 'gray' | 'arcoblue' | 'orangered' | 'green'> = {
  preparing: 'gray',
  reasoning: 'arcoblue',
  tool_running: 'arcoblue',
  waiting_permission: 'orangered',
  composing: 'arcoblue',
  completed: 'green',
  error: 'orangered',
};

const PHASE_I18N_KEY: Record<AgentRunPhase, string> = {
  preparing: 'conversation.runStatus.phase.preparing',
  reasoning: 'conversation.runStatus.phase.reasoning',
  tool_running: 'conversation.runStatus.phase.toolRunning',
  waiting_permission: 'conversation.runStatus.phase.waitingPermission',
  composing: 'conversation.runStatus.phase.composing',
  completed: 'conversation.runStatus.phase.completed',
  error: 'conversation.runStatus.phase.error',
};

const formatElapsedTime = (startTime?: number, endTime?: number): string => {
  if (!startTime) {
    return '0s';
  }

  const seconds = Math.max(0, Math.floor(((endTime ?? Date.now()) - startTime) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatStartedAt = (timestamp?: number): string => {
  if (!timestamp) {
    return '--';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
};

const summarizeThought = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
};

const getFriendlyErrorSummary = (errorMessage: string, t: (key: string) => string): string => {
  const normalized = errorMessage.trim();

  if (/^ACP process exited unexpectedly \(code: .* signal: .*\)$/i.test(normalized)) {
    return t('conversation.runStatus.runtimeDisconnected');
  }

  if (/^Codex process exited unexpectedly \(code: .* signal: .*\)$/i.test(normalized)) {
    return t('conversation.runStatus.runtimeDisconnected');
  }

  return errorMessage;
};

const AgentRunStatus: React.FC<AgentRunStatusProps> = ({ trace, running = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState('0s');

  useEffect(() => {
    if (!trace?.startedAt) {
      setElapsed('0s');
      return;
    }

    const updateElapsed = () => {
      setElapsed(formatElapsedTime(trace.startedAt, trace.endedAt));
    };

    updateElapsed();

    if (trace.endedAt) {
      return;
    }

    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [trace?.endedAt, trace?.startedAt]);

  const summaryText = useMemo(() => {
    if (!trace) {
      return '';
    }

    const thoughtSummary = summarizeThought(trace.liveThoughtText);
    if (thoughtSummary) {
      return thoughtSummary;
    }

    if (trace.activeToolCount > 0) {
      return t('conversation.runStatus.activeTools', { count: trace.activeToolCount });
    }

    if (trace.errorMessage) {
      return getFriendlyErrorSummary(trace.errorMessage, t);
    }
    return '';
  }, [t, trace]);

  if (!trace) {
    return null;
  }

  const runtimeStats = [
    { label: t('conversation.runStatus.backend'), value: trace.backend || t('conversation.runStatus.unknown') },
    { label: t('conversation.runStatus.model'), value: trace.modelId || t('conversation.runStatus.unknown') },
    { label: t('conversation.runStatus.mode'), value: trace.sessionMode || t('conversation.runStatus.unknown') },
    { label: t('conversation.runStatus.startedAt'), value: formatStartedAt(trace.startedAt) },
    { label: t('conversation.runStatus.elapsed'), value: elapsed },
  ];

  const showSpinner = running && trace.phase !== 'completed' && trace.phase !== 'error';

  return (
    <div className='mb-8px rounded-16px border border-border-2 bg-fill-1 px-12px py-10px shadow-sm'>
      <div className='flex items-start gap-10px'>
        <div className='mt-2px flex h-18px w-18px items-center justify-center'>
          {showSpinner ? (
            <Spin size={14} />
          ) : (
            <span
              className={`h-8px w-8px rounded-full ${
                trace.phase === 'error'
                  ? 'bg-[rgb(var(--danger-6))]'
                  : trace.phase === 'completed'
                    ? 'bg-[rgb(var(--success-6))]'
                    : 'bg-[rgb(var(--primary-6))]'
              }`}
            />
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-6px'>
            <Tag color={PHASE_TAG_COLOR[trace.phase]} size='small'>
              {t(PHASE_I18N_KEY[trace.phase])}
            </Tag>
            {trace.backend ? (
              <Tag bordered color='gray' size='small'>
                {trace.backend}
              </Tag>
            ) : null}
            {trace.activeToolCount > 0 ? (
              <span className='text-11px text-t-secondary'>
                {t('conversation.runStatus.activeTools', { count: trace.activeToolCount })}
              </span>
            ) : null}
            <span className='ml-auto text-12px whitespace-nowrap text-t-tertiary'>{elapsed}</span>
            <Button
              size='mini'
              type='text'
              icon={expanded ? <Up theme='outline' size={12} /> : <Down theme='outline' size={12} />}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? t('conversation.runStatus.hideDetails') : t('conversation.runStatus.showDetails')}
            </Button>
          </div>

          {summaryText ? <div className='mt-6px break-words text-13px text-t-primary'>{summaryText}</div> : null}
        </div>
      </div>

      {expanded ? (
        <div className='mt-10px flex flex-col gap-10px border-t border-border-2 pt-10px'>
          <div className='flex flex-col gap-6px'>
            <div className='text-11px font-500 uppercase tracking-[0.08em] text-t-tertiary'>
              {t('conversation.runStatus.rawTask')}
            </div>
            <div className='max-h-180px overflow-auto rounded-12px bg-fill-2 px-10px py-8px text-12px text-t-primary whitespace-pre-wrap break-words'>
              {trace.rawTask || '--'}
            </div>
          </div>

          <div className='flex flex-col gap-6px'>
            <div className='text-11px font-500 uppercase tracking-[0.08em] text-t-tertiary'>
              {t('conversation.runStatus.liveThought')}
            </div>
            <div className='max-h-220px overflow-auto rounded-12px bg-fill-2 px-10px py-8px text-12px text-t-primary whitespace-pre-wrap break-words'>
              {trace.liveThoughtText || t('conversation.runStatus.noThoughtYet')}
            </div>
          </div>

          <div className='flex flex-col gap-6px'>
            <div className='text-11px font-500 uppercase tracking-[0.08em] text-t-tertiary'>
              {t('conversation.runStatus.runtimeStats')}
            </div>
            <div className='grid gap-8px rounded-12px bg-fill-2 px-10px py-8px sm:grid-cols-2'>
              {runtimeStats.map((item) => (
                <div key={item.label} className='min-w-0'>
                  <div className='text-11px text-t-tertiary'>{item.label}</div>
                  <div className='truncate text-12px text-t-primary'>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {trace.errorMessage ? (
            <div className='flex flex-col gap-6px'>
              <div className='text-11px font-500 uppercase tracking-[0.08em] text-t-tertiary'>{t('common.error')}</div>
              <div className='rounded-12px bg-fill-2 px-10px py-8px text-12px text-[rgb(var(--danger-6))] whitespace-pre-wrap break-words'>
                {trace.errorMessage}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AgentRunStatus;
