/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Popover } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { TokenUsageData } from '@/common/config/storage';
import { DEFAULT_CONTEXT_LIMIT } from '@/renderer/utils/model/modelContextLimits';

interface ContextUsageIndicatorProps {
  tokenUsage: TokenUsageData | null;
  contextLimit?: number;
  className?: string;
  size?: number;
}

const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({
  tokenUsage,
  contextLimit = DEFAULT_CONTEXT_LIMIT,
  className = '',
  size = 24,
}) => {
  const { t } = useTranslation();

  const { percentage, percentageLabel, displayTotal, displayLimit, displayRemaining, isWarning, isDanger } =
    useMemo(() => {
      if (!tokenUsage) {
        return {
          percentage: 0,
          percentageLabel: '0.0%',
          displayTotal: '0',
          displayLimit: formatTokenCount(contextLimit, true),
          displayRemaining: formatTokenCount(contextLimit, true),
          isWarning: false,
          isDanger: false,
        };
      }

      const total = Math.max(tokenUsage.totalTokens, 0);
      const safeLimit = Math.max(contextLimit, 1);
      const rawPercentage = (total / safeLimit) * 100;
      const boundedPercentage = Math.min(rawPercentage, 100);
      const remaining = Math.max(safeLimit - total, 0);

      return {
        percentage: boundedPercentage,
        percentageLabel: `${rawPercentage.toFixed(1)}%`,
        displayTotal: formatTokenCount(total),
        displayLimit: formatTokenCount(safeLimit, true),
        displayRemaining: formatTokenCount(remaining, true),
        isWarning: rawPercentage > 70,
        isDanger: rawPercentage > 90,
      };
    }, [tokenUsage, contextLimit]);

  if (!tokenUsage) {
    return null;
  }

  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getStrokeColor = () => {
    if (isDanger) return 'rgb(var(--danger-6))';
    if (isWarning) return 'rgb(var(--warning-6))';
    return 'rgb(var(--primary-6))';
  };

  const getTrackColor = () => {
    return 'var(--color-fill-3)';
  };

  const popoverContent = (
    <div className='min-w-220px rounded-14px border border-[var(--color-border-2)] bg-[color-mix(in_srgb,var(--color-bg-1)_94%,var(--color-fill-1)_6%)] p-12px shadow-[0_14px_34px_rgba(15,23,42,0.14)] backdrop-blur-[14px]'>
      <div className='text-14px font-medium text-t-primary'>
        {t('conversation.contextUsage.title', { percentage: percentageLabel })}
      </div>
      <div className='mt-8px grid grid-cols-[auto_1fr] gap-x-12px gap-y-4px text-13px leading-20px'>
        <span className='text-t-secondary'>{t('conversation.contextUsage.used')}</span>
        <span className='text-right text-t-primary'>{displayTotal}</span>
        <span className='text-t-secondary'>{t('conversation.contextUsage.remaining')}</span>
        <span className='text-right text-t-primary'>{displayRemaining}</span>
        <span className='text-t-secondary'>{t('conversation.contextUsage.limit')}</span>
        <span className='text-right text-t-primary'>{displayLimit}</span>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      position='top'
      trigger='hover'
      className='context-usage-popover'
      triggerProps={{ popupStyle: { padding: 0, background: 'transparent', boxShadow: 'none', borderRadius: 16 } }}
    >
      <div
        className={`context-usage-indicator cursor-pointer flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-label={t('conversation.contextUsage.title', { percentage: percentageLabel })}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={getTrackColor()}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
      </div>
    </Popover>
  );
};

/**
 * 格式化 token 数量显示
 * @param count token 数量
 * @param hideZeroDecimals 是否隐藏小数点为0的情况（如 1.0M 显示为 1M），默认为 false
 * @returns 格式化后的字符串，如 "37.0K" 或 "1.2M"，当 hideZeroDecimals 为 true 时 "1.0M" 显示为 "1M"
 */
export function formatTokenCount(count: number, hideZeroDecimals = false): string {
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    const formatted = value.toFixed(1);
    return hideZeroDecimals && formatted.endsWith('.0') ? `${Math.floor(value)}M` : `${formatted}M`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    const formatted = value.toFixed(1);
    return hideZeroDecimals && formatted.endsWith('.0') ? `${Math.floor(value)}K` : `${formatted}K`;
  }
  return count.toString();
}

export default ContextUsageIndicator;
