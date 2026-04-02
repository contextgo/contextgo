import type {
  PendingConversationMessage,
  PendingConversationMessageMode,
} from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';
import { Button, Tag } from '@arco-design/web-react';
import { ArrowUp, DeleteFive, EditTwo } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PendingMessageBarProps {
  messages: PendingConversationMessage[];
  onRemove: (messageId: string) => void;
  onEdit: (messageId: string) => void;
  onSetMode: (messageId: string, mode: PendingConversationMessageMode) => void;
}

const summarizeMessage = (content: string): string => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
};

const PendingMessageBar: React.FC<PendingMessageBarProps> = ({ messages, onRemove, onEdit, onSetMode }) => {
  const { t } = useTranslation();

  const sortedMessages = useMemo(
    () => [...messages].toSorted((left, right) => left.createdAt - right.createdAt),
    [messages]
  );

  if (sortedMessages.length === 0) {
    return null;
  }

  return (
    <div className='mb-8px flex flex-col gap-8px'>
      <div className='flex items-center justify-between gap-8px'>
        <div className='text-12px text-t-secondary'>
          {t('conversation.pendingMessages.title', { count: sortedMessages.length })}
        </div>
        <div className='text-11px text-t-tertiary'>{t('conversation.pendingMessages.shortcuts')}</div>
      </div>

      <div className='flex flex-col gap-6px'>
        {sortedMessages.map((message) => {
          const nextMode: PendingConversationMessageMode = message.mode === 'queue' ? 'steer' : 'queue';

          return (
            <div key={message.id} className='rounded-10px border border-border-2 bg-fill-1 px-10px py-8px'>
              <div className='flex items-start justify-between gap-8px'>
                <div className='min-w-0 flex-1'>
                  <div className='mb-4px flex flex-wrap items-center gap-6px'>
                    <Tag color={message.mode === 'steer' ? 'blue' : 'gray'}>
                      {t(`conversation.pendingMessages.mode.${message.mode}`)}
                    </Tag>
                    {message.attachments.length > 0 && (
                      <span className='text-11px text-t-tertiary'>
                        {t('conversation.pendingMessages.attachments', { count: message.attachments.length })}
                      </span>
                    )}
                  </div>
                  <div className='break-words text-13px text-t-primary'>{summarizeMessage(message.content)}</div>
                </div>

                <div className='flex shrink-0 items-center gap-4px'>
                  <Button
                    size='mini'
                    type='text'
                    icon={<EditTwo theme='outline' size={12} />}
                    onClick={() => onEdit(message.id)}
                  >
                    {t('conversation.pendingMessages.edit')}
                  </Button>
                  <Button
                    size='mini'
                    type='text'
                    icon={<ArrowUp theme='outline' size={12} />}
                    onClick={() => onSetMode(message.id, nextMode)}
                  >
                    {t(`conversation.pendingMessages.actions.${nextMode}`)}
                  </Button>
                  <Button
                    size='mini'
                    type='text'
                    status='danger'
                    icon={<DeleteFive theme='outline' size={12} />}
                    onClick={() => onRemove(message.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PendingMessageBar;
