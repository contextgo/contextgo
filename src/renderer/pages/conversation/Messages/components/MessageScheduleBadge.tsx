/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScheduleMessageMeta } from '@/common/chat/chatLib';
import { iconColors } from '@/renderer/styles/colors';
import { AlarmClock } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type MessageScheduleBadgeProps = {
  meta: ScheduleMessageMeta;
};

const formatTime = (timestamp: number, locale: string): string => {
  return new Date(timestamp).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MessageScheduleBadge: React.FC<MessageScheduleBadgeProps> = ({ meta }) => {
  const { i18n } = useTranslation();

  return (
    <div
      className='inline-flex items-center gap-4px mb-4px px-12px py-2px rounded-full text-2 bg-fill-2'
      style={{ color: 'var(--color-bg-6)' }}
    >
      <AlarmClock strokeWidth={4} theme='outline' size={13} fill={iconColors.secondary} className='flex items-center' />
      <span>{formatTime(meta.triggeredAt, i18n.language)}</span>
    </div>
  );
};

export default MessageScheduleBadge;
