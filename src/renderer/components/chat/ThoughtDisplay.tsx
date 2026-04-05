/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tag, Spin } from '@arco-design/web-react';
import MarkdownView from '@/renderer/components/Markdown';
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';
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

// 背景渐变常量 Background gradient constants
const GRADIENT_DARK = 'linear-gradient(135deg, #464767 0%, #323232 100%)';
const GRADIENT_LIGHT = 'linear-gradient(90deg, #F0F3FF 0%, #F2F2F2 100%)';

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
  onStop: _onStop,
}) => {
  const summarizedDescription = useMemo(() => {
    const normalized = thought.description.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
  }, [thought.description]);

  const { theme } = useThemeContext();
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

  // 根据主题和样式计算最终样式 Calculate final style based on theme and style prop
  const containerStyle = useMemo(() => {
    const background = theme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

    if (style === 'compact') {
      return {
        background,
        marginBottom: '8px',
      };
    }

    return {
      background,
      transform: 'translateY(36px)',
    };
  }, [theme, style]);

  const containerClassName =
    style === 'compact'
      ? 'px-10px py-10px rd-20px text-14px lh-20px text-t-primary'
      : 'px-10px py-10px rd-20px text-14px pb-40px lh-20px text-t-primary';

  if (!running) {
    return null;
  }

  // 运行中但没有 thought 时显示默认处理状态
  if (!thought?.subject) {
    return (
      <div className={`${containerClassName} flex items-center gap-8px`} style={containerStyle}>
        <Spin size={14} />
        <span className='text-t-secondary'>
          {t('conversation.chat.processing')}
          <span className='ml-8px opacity-60'>({formatElapsedTime(elapsedTime)})</span>
        </span>
      </div>
    );
  }

  const showDescription = thought.description && thought.description !== thought.subject;

  return (
    <div className={containerClassName} style={containerStyle}>
      <div className='flex items-start gap-8px'>
        <div className='mt-2px shrink-0'>
          <Spin size={14} />
        </div>
        <Tag color='arcoblue' size='small' className='mt-1px shrink-0'>
          {thought.subject}
        </Tag>
        {showDescription ? (
          <div className='min-w-0 flex-1 overflow-hidden'>
            <MarkdownView className='text-13px text-t-primary [&_.markdown-shadow-body_p]:m-0 [&_.markdown-shadow-body_strong]:font-600'>
              {summarizedDescription}
            </MarkdownView>
          </div>
        ) : null}
        <span className='shrink-0 text-t-tertiary text-12px whitespace-nowrap'>({formatElapsedTime(elapsedTime)})</span>
      </div>
    </div>
  );
};

export default ThoughtDisplay;
