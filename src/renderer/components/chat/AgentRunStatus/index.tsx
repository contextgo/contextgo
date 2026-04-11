/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Spin } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentRunPhase, AgentRunTrace } from './types';

interface AgentRunStatusProps {
  trace: AgentRunTrace | null;
  running?: boolean;
}

const LONG_RUNNING_SECONDS = 60;

const PHASE_ACCENT_COLOR: Record<AgentRunPhase, string> = {
  preparing: 'var(--brand)',
  reasoning: 'rgb(var(--primary-6))',
  tool_running: 'rgb(var(--primary-6))',
  waiting_permission: 'rgb(var(--warning-6))',
  composing: 'rgb(var(--primary-6))',
  completed: 'rgb(var(--success-6))',
  error: 'rgb(var(--danger-6))',
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

const getElapsedSeconds = (startTime?: number, endTime?: number): number => {
  if (!startTime) {
    return 0;
  }

  return Math.max(0, Math.floor(((endTime ?? Date.now()) - startTime) / 1000));
};

const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const summarizeText = (value?: string): string => {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return '';
  }

  return normalized.length > 110 ? `${normalized.slice(0, 107)}...` : normalized;
};

const AgentRunStatus: React.FC<AgentRunStatusProps> = ({ trace, running = false }) => {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!trace?.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(getElapsedSeconds(trace.startedAt, trace.endedAt));
    };

    updateElapsed();

    if (trace.endedAt) {
      return;
    }

    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [trace?.endedAt, trace?.startedAt]);

  const phaseAccent = trace ? PHASE_ACCENT_COLOR[trace.phase] : 'rgb(var(--primary-6))';
  const phaseLabel = trace ? t(PHASE_I18N_KEY[trace.phase]) : '';
  const elapsed = formatElapsedTime(elapsedSeconds);
  const isLongRunning = elapsedSeconds >= LONG_RUNNING_SECONDS;
  const compactSummary = useMemo(() => {
    if (!trace) {
      return '';
    }

    const thoughtSummary = summarizeText(trace.liveThoughtText);
    if (thoughtSummary) {
      return thoughtSummary;
    }

    if (trace.phase === 'tool_running' && trace.activeToolCount > 0) {
      return t('conversation.runStatus.activeTools', {
        count: trace.activeToolCount,
        defaultValue: '{{count}} tools running',
      });
    }

    const errorSummary = summarizeText(trace.errorMessage);
    if (errorSummary) {
      return errorSummary;
    }

    const taskSummary = summarizeText(trace.rawTask);
    if (taskSummary) {
      return taskSummary;
    }

    return t('conversation.chat.processing');
  }, [t, trace]);

  const containerStyle = useMemo(
    () => ({
      borderColor: `color-mix(in srgb, ${phaseAccent} 14%, var(--color-border-2) 86%)`,
      background: `linear-gradient(135deg, color-mix(in srgb, ${phaseAccent} 7%, var(--color-bg-1) 93%) 0%, color-mix(in srgb, var(--color-fill-1) 88%, var(--color-bg-1) 12%) 100%)`,
      boxShadow: `0 6px 18px color-mix(in srgb, ${phaseAccent} 6%, transparent)`,
    }),
    [phaseAccent]
  );

  const iconShellStyle = useMemo(
    () => ({
      borderColor: `color-mix(in srgb, ${phaseAccent} 16%, transparent)`,
      background: `color-mix(in srgb, ${phaseAccent} 9%, var(--color-bg-1) 91%)`,
      boxShadow: `inset 0 1px 0 color-mix(in srgb, white 20%, transparent)`,
    }),
    [phaseAccent]
  );

  if (!trace || !running) {
    return null;
  }

  const showSpinner = running && trace.phase !== 'completed' && trace.phase !== 'error';

  return (
    <div
      className='mb-8px overflow-hidden rounded-16px border px-12px py-8px backdrop-blur-[12px]'
      style={containerStyle}
    >
      <div className='flex items-center gap-10px'>
        <div
          className='flex h-30px w-30px shrink-0 items-center justify-center rounded-full border'
          style={iconShellStyle}
        >
          {showSpinner ? (
            <Spin size={14} />
          ) : (
            <span className='h-7px w-7px rounded-full' style={{ backgroundColor: phaseAccent }} />
          )}
        </div>

        <div className='min-w-0 flex flex-1 items-center gap-8px overflow-hidden'>
          <span className='shrink-0 text-13px font-600 leading-18px text-t-primary'>{phaseLabel}</span>
          <span className='h-3px w-3px shrink-0 rounded-full bg-fill-3' />
          <div className='min-w-0 flex-1 truncate text-12px leading-18px text-t-secondary' title={compactSummary}>
            {compactSummary}
          </div>
          <span
            className='shrink-0 text-11px font-700 leading-18px text-t-primary'
            style={isLongRunning ? { color: 'rgb(var(--warning-6))' } : undefined}
          >
            {elapsed}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AgentRunStatus;
