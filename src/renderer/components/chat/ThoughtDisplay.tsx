/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Tag, Spin } from '@arco-design/web-react';
import MarkdownView from '@/renderer/components/Markdown';
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface ThoughtData {
  subject: string;
  description: string;
}

interface ThoughtDisplayProps {
  thought: ThoughtData;
  style?: 'default' | 'compact';
  running?: boolean;
  onStop?: () => void;
}

// 格式化时间 Format elapsed time
const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const ThoughtDisplay: React.FC<ThoughtDisplayProps> = ({
  thought,
  style = 'default',
  running = false,
  onStop,
}) => {
  const summarizedDescription = useMemo(() => {
    const normalized = thought.description.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
  }, [thought.description]);

  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  // 计时器 Timer for elapsed time
  useEffect(() => {
    if (!running) {
      setElapsedTime(0);
      return;
    }

    // 开始新的计时
    startTimeRef.current = Date.now();
    setElapsedTime(0);

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [running, thought?.subject]);

  const containerStyle = useMemo(() => {
    const sharedStyle = {
      borderColor: 'color-mix(in srgb, rgb(var(--primary-6)) 12%, var(--color-border-2) 88%)',
      background:
        'linear-gradient(135deg, color-mix(in srgb, rgb(var(--primary-6)) 7%, var(--color-bg-1) 93%) 0%, color-mix(in srgb, var(--color-fill-1) 82%, var(--color-bg-1) 18%) 100%)',
      boxShadow: '0 6px 18px color-mix(in srgb, rgb(var(--primary-6)) 6%, transparent)',
    };

    if (style === 'compact') {
      return {
        ...sharedStyle,
        marginBottom: '8px',
      };
    }

    return sharedStyle;
  }, [style]);

  const containerClassName =
    style === 'compact'
      ? 'mb-8px flex items-center gap-8px overflow-hidden rounded-14px border px-10px py-7px text-t-primary backdrop-blur-[12px]'
      : 'mb-8px flex items-center gap-8px overflow-hidden rounded-16px border px-12px py-8px text-t-primary backdrop-blur-[12px]';

  if (!running) {
    return null;
  }

  // 运行中但没有 thought 时显示默认处理状态
  if (!thought?.subject) {
    return (
      <div className={`${containerClassName} flex items-center gap-8px`} style={containerStyle}>
        <Spin size={14} />
        <span className='text-12px text-t-secondary'>
          {t('conversation.chat.processing')}
          <span className='ml-8px text-11px opacity-60'>({formatElapsedTime(elapsedTime)})</span>
        </span>
      </div>
    );
  }

  const showDescription = thought.description && thought.description !== thought.subject;

  return (
    <div className={containerClassName} style={containerStyle}>
      <div className='shrink-0'>
        <Spin size={14} />
      </div>
      <Tag color='arcoblue' size='small' className='shrink-0'>
        {thought.subject}
      </Tag>
      {showDescription ? (
        <div className='min-w-0 flex-1 overflow-hidden'>
          <MarkdownView className='text-12px leading-18px text-t-primary [&_.markdown-shadow-body]:min-w-0 [&_.markdown-shadow-body_p]:m-0 [&_.markdown-shadow-body_p]:truncate [&_.markdown-shadow-body_p]:whitespace-nowrap [&_.markdown-shadow-body_strong]:font-600'>
            {summarizedDescription}
          </MarkdownView>
        </div>
      ) : (
        <span className='min-w-0 flex-1 truncate text-12px leading-18px text-t-secondary'>
          {t('conversation.chat.processing')}
        </span>
      )}
      <span className='shrink-0 text-11px text-t-tertiary whitespace-nowrap'>({formatElapsedTime(elapsedTime)})</span>
      {onStop ? (
        <Button
          size='mini'
          type='text'
          className='!h-24px !min-w-24px !rounded-full !px-0 !text-[rgb(var(--danger-6))] hover:!bg-[rgba(var(--danger-6),0.12)] hover:!text-[rgb(var(--danger-6))]'
          aria-label={t('conversation.group.workflow.decision.stop')}
          icon={<div className='mx-auto h-8px w-8px rounded-[2px] bg-current' />}
          onClick={onStop}
        />
      ) : null}
    </div>
  );
};

export default ThoughtDisplay;
