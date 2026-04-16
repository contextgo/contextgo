/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import { useMessageList } from '@/renderer/pages/conversation/Messages/hooks';
import { Tag, Typography } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type GroupOverviewCardProps = {
  conversation: Extract<TChatConversation, { type: 'group' }>;
  running: boolean;
};

const STATUS_COLOR_BY_VALUE = {
  idle: 'gray',
  running: 'arcoblue',
  finished: 'green',
} as const;

const extractDiscussionSummaryMessage = (
  messages: TMessage[],
  summaryKind: 'round' | 'final'
): Extract<TMessage, { type: 'text' }> | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'text' || message.position !== 'left') {
      continue;
    }

    const summaryMeta = message.content.groupMeta;
    if (summaryMeta?.kind !== 'discussion' || summaryMeta.summaryKind !== summaryKind) {
      continue;
    }

    return message;
  }

  return null;
};

const extractLatestParticipantMessage = (messages: TMessage[]): Extract<TMessage, { type: 'text' }> | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'text' || message.position !== 'left') {
      continue;
    }

    const groupMeta = message.content.groupMeta;
    if (!groupMeta || groupMeta.kind === 'workflow' || groupMeta.summaryKind) {
      continue;
    }

    return message;
  }

  return null;
};

const GroupOverviewCard: React.FC<GroupOverviewCardProps> = ({ conversation, running }) => {
  const { t } = useTranslation();
  const messages = useMessageList();
  const participants = conversation.extra.participants;

  const { latestRoundSummary, finalSynthesis, latestParticipantMessage } = useMemo(
    () => ({
      latestRoundSummary: extractDiscussionSummaryMessage(messages, 'round'),
      finalSynthesis: extractDiscussionSummaryMessage(messages, 'final'),
      latestParticipantMessage: extractLatestParticipantMessage(messages),
    }),
    [messages]
  );

  const status = running ? 'running' : conversation.status === 'finished' ? 'finished' : 'idle';

  return (
    <div className='mx-auto mb-12px w-full max-w-980px rounded-18px border border-border-2 bg-[var(--color-bg-1)] px-16px py-14px'>
      <div className='flex flex-wrap items-start justify-between gap-12px'>
        <div className='min-w-0'>
          <Typography.Text className='block text-13px font-semibold text-t-primary'>
            {t('conversation.group.overview.title')}
          </Typography.Text>
          <Typography.Text className='text-12px text-t-secondary'>
            {t('conversation.group.fixedFlowHint')}
          </Typography.Text>
        </div>
        <Tag color={STATUS_COLOR_BY_VALUE[status]}>{t(`conversation.group.overview.status.${status}`)}</Tag>
      </div>

      <div className='mt-12px flex flex-wrap gap-6px'>
        {participants.map((participant) => (
          <Tag key={participant.id} bordered>
            {participant.name}
          </Tag>
        ))}
      </div>

      <div className='mt-12px grid gap-12px md:grid-cols-2'>
        <div className='rounded-14px bg-[var(--color-fill-1)] px-12px py-12px'>
          <Typography.Text className='block text-12px font-medium text-t-secondary'>
            {t('conversation.group.overview.latestSpeaker')}
          </Typography.Text>
          <Typography.Text className='mt-6px block text-13px text-t-primary'>
            {latestParticipantMessage?.content.groupMeta?.participantName || t('conversation.group.overview.pending')}
          </Typography.Text>
        </div>

        <div className='rounded-14px bg-[var(--color-fill-1)] px-12px py-12px'>
          <Typography.Text className='block text-12px font-medium text-t-secondary'>
            {t('conversation.group.overview.latestRoundSummary')}
          </Typography.Text>
          <Typography.Paragraph
            className='!mb-0 mt-6px text-13px text-t-primary'
            ellipsis={{ rows: 5, expandable: false }}
          >
            {latestRoundSummary?.content.content || t('conversation.group.overview.pending')}
          </Typography.Paragraph>
        </div>
      </div>

      <div className='mt-12px rounded-14px bg-[var(--color-fill-1)] px-12px py-12px'>
        <Typography.Text className='block text-12px font-medium text-t-secondary'>
          {t('conversation.group.overview.finalSynthesis')}
        </Typography.Text>
        <Typography.Paragraph
          className='!mb-0 mt-6px text-13px text-t-primary'
          ellipsis={{ rows: 8, expandable: false }}
        >
          {finalSynthesis?.content.content || t('conversation.group.overview.pending')}
        </Typography.Paragraph>
      </div>
    </div>
  );
};

export default GroupOverviewCard;
