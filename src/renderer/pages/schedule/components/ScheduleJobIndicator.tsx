/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconColors } from '@/renderer/styles/colors';
import { Tooltip } from '@arco-design/web-react';
import { AlarmClock, Attention, PauseOne } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type ScheduleJobStatus = 'none' | 'active' | 'paused' | 'error' | 'unread' | 'unconfigured';

interface ScheduleJobIndicatorProps {
  status: ScheduleJobStatus;
  size?: number;
  className?: string;
}

/**
 * Simple indicator icon for conversations with cron jobs
 * Used in ChatHistory to distinguish conversations with scheduled tasks
 */
const ScheduleJobIndicator: React.FC<ScheduleJobIndicatorProps> = ({ status, size = 14, className = '' }) => {
  const { t } = useTranslation();

  if (status === 'none') {
    return null;
  }

  const getIcon = () => {
    const iconProps = {
      theme: 'outline' as const,
      size,
      strokeWidth: 3,
      fill: iconColors.secondary,
      className: 'flex items-center',
    };

    switch (status) {
      case 'unread':
        // Show alarm clock with red dot overlay for unread executions
        return (
          <span className='relative inline-flex'>
            <AlarmClock {...iconProps} />
            <span
              className='absolute rounded-full bg-red-500'
              style={{
                width: Math.max(6, size * 0.4),
                height: Math.max(6, size * 0.4),
                top: -1,
                right: -1,
              }}
            />
          </span>
        );
      case 'active':
        return <AlarmClock {...iconProps} />;
      case 'paused':
        return <PauseOne {...iconProps} />;
      case 'error':
        return <Attention {...iconProps} />;
      case 'unconfigured':
        return <AlarmClock {...iconProps} />;
      default:
        return null;
    }
  };

  const getTooltip = () => {
    switch (status) {
      case 'unread':
        return t('schedule.status.unread');
      case 'active':
        return t('schedule.status.active');
      case 'paused':
        return t('schedule.status.paused');
      case 'error':
        return t('schedule.status.error');
      case 'unconfigured':
        return t('schedule.status.unconfigured');
      default:
        return '';
    }
  };

  return (
    <Tooltip content={getTooltip()} mini>
      <span className={`inline-flex items-center justify-center ${className}`}>{getIcon()}</span>
    </Tooltip>
  );
};

export default ScheduleJobIndicator;
