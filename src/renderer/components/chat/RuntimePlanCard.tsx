/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Progress, Tag } from '@arco-design/web-react';
import { Down, Up } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RuntimePlanEntry } from './runtimePlanTypes';

type RuntimePlanCardProps = {
  entries: RuntimePlanEntry[];
  running?: boolean;
  defaultExpanded?: boolean;
  title?: string;
};

const STATUS_TONE: Record<RuntimePlanEntry['status'], 'gray' | 'arcoblue' | 'green'> = {
  pending: 'gray',
  in_progress: 'arcoblue',
  completed: 'green',
};

const STATUS_DOT_CLASSNAME: Record<RuntimePlanEntry['status'], string> = {
  pending: 'bg-fill-4',
  in_progress: 'bg-[rgb(var(--primary-6))] shadow-[0_0_0_4px_color-mix(in_srgb,_rgb(var(--primary-6))_12%,_transparent)]',
  completed: 'bg-[rgb(var(--success-6))]',
};

const PLAN_SETTLE_MS = 900;
const PLAN_FADE_MS = 240;

const RuntimePlanCard: React.FC<RuntimePlanCardProps> = ({
  entries,
  running = false,
  defaultExpanded = false,
  title,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [displayEntries, setDisplayEntries] = useState(entries);
  const [isFading, setIsFading] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };

    clearTimers();

    if (entries.length > 0) {
      setDisplayEntries(entries);
      setIsFading(false);
      return clearTimers;
    }

    if (running || displayEntries.length === 0) {
      return clearTimers;
    }

    settleTimerRef.current = setTimeout(() => {
      setIsFading(true);
      fadeTimerRef.current = setTimeout(() => {
        setDisplayEntries([]);
        setIsFading(false);
      }, PLAN_FADE_MS);
    }, PLAN_SETTLE_MS);

    return clearTimers;
  }, [displayEntries.length, entries, running]);

  const completedCount = displayEntries.filter((entry) => entry.status === 'completed').length;
  const inProgressEntry = displayEntries.find((entry) => entry.status === 'in_progress') ?? null;
  const pendingCount = displayEntries.filter((entry) => entry.status === 'pending').length;
  const percent = displayEntries.length > 0 ? Math.round((completedCount / displayEntries.length) * 100) : 0;

  const summaryText = useMemo(() => {
    if (inProgressEntry) {
      return inProgressEntry.content;
    }

    if (pendingCount > 0) {
      return t('conversation.runStatus.runtimePlan.pendingSummary', {
        count: pendingCount,
        defaultValue: '{{count}} steps pending',
      });
    }

    return t('conversation.runStatus.runtimePlan.completedSummary', {
      count: completedCount,
      defaultValue: '{{count}} steps completed',
    });
  }, [completedCount, inProgressEntry, pendingCount, t]);

  if (displayEntries.length === 0) {
    return null;
  }

  return (
    <div
      className='mb-8px overflow-hidden rounded-16px border border-[color:var(--color-border-2)] bg-[color:var(--color-bg-1)]/94 px-12px py-8px shadow-[0_6px_18px_rgba(15,23,42,0.04)] backdrop-blur-[12px]'
      style={{
        opacity: isFading ? 0 : 1,
        transform: `translateY(${isFading ? 6 : 0}px)`,
        transition: `opacity ${PLAN_FADE_MS}ms ease, transform ${PLAN_FADE_MS}ms ease`,
      }}
    >
      <div className='flex items-center gap-10px'>
        <div className='min-w-0 flex flex-1 items-center gap-8px overflow-hidden'>
          <div className='flex shrink-0 items-center gap-6px'>
            <Tag color={running ? 'arcoblue' : 'green'} size='small'>
              {title || t('conversation.runStatus.runtimePlan.title', { defaultValue: 'Plan' })}
            </Tag>
            <span className='shrink-0 text-11px font-600 text-t-tertiary'>
              {completedCount}/{displayEntries.length}
            </span>
          </div>
          <div className='min-w-0 flex-1 truncate text-12px leading-18px text-t-secondary' title={summaryText}>
            {summaryText}
          </div>
          <span className='shrink-0 text-11px font-600 text-t-secondary'>{percent}%</span>
        </div>

        <Button
          size='mini'
          type='text'
          className='!h-28px !min-w-28px !rounded-full !px-0 !text-t-secondary hover:!bg-fill-2 hover:!text-t-primary'
          aria-label={
            expanded
              ? t('conversation.runStatus.runtimePlan.collapse', { defaultValue: 'Collapse' })
              : t('conversation.runStatus.runtimePlan.expand', { defaultValue: 'Expand' })
          }
          icon={expanded ? <Up theme='outline' size={12} /> : <Down theme='outline' size={12} />}
          onClick={() => setExpanded((current) => !current)}
        />
      </div>

      {expanded ? (
        <div className='mt-10px flex flex-col gap-8px border-t border-[color:var(--color-border-2)] pt-10px'>
          <div>
            <div className='flex items-center gap-8px'>
              <div className='min-w-0 flex-1 truncate text-12px font-500 leading-18px text-t-primary' title={summaryText}>
                {summaryText}
              </div>
              <span className='shrink-0 text-11px font-600 text-t-secondary'>{percent}%</span>
            </div>
            <div className='mt-6px'>
              <Progress percent={percent} showText={false} size='small' />
            </div>
          </div>

          {displayEntries.map((entry, index) => (
            <div
              key={`${index}-${entry.content}`}
              className={`flex items-start gap-8px rounded-12px border px-10px py-8px transition-[border-color,box-shadow,background-color] duration-180 ${
                entry.status === 'in_progress'
                  ? 'border-[color:color-mix(in_srgb,rgb(var(--primary-6))_28%,var(--color-fill-3)_72%)] bg-[color:color-mix(in_srgb,rgb(var(--primary-6))_8%,var(--color-fill-1)_92%)] shadow-[0_10px_24px_color-mix(in_srgb,rgb(var(--primary-6))_10%,transparent)]'
                  : 'border-[color:var(--color-fill-3)] bg-[color:var(--color-fill-1)]'
              }`}
            >
              <span className={`mt-4px h-7px w-7px shrink-0 rounded-full ${STATUS_DOT_CLASSNAME[entry.status]}`} />
              <div className='min-w-0 flex-1'>
                <div className={`text-12px leading-18px ${entry.status === 'in_progress' ? 'font-600 text-t-primary' : 'text-t-primary'}`}>
                  {entry.content}
                </div>
              </div>
              <Tag size='small' color={STATUS_TONE[entry.status]}>
                {t(`conversation.runStatus.runtimePlan.status.${entry.status}`, {
                  defaultValue:
                    entry.status === 'completed'
                      ? 'Completed'
                      : entry.status === 'in_progress'
                        ? 'In progress'
                        : 'Pending',
                })}
              </Tag>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default RuntimePlanCard;
