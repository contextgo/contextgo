/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import { uuid } from '@/common/utils';
import PendingMessageBar from '@/renderer/components/chat/PendingMessageBar';
import SendBox from '@/renderer/components/chat/sendbox';
import { useAutoTitle } from '@/renderer/hooks/chat/useAutoTitle';
import { getSendBoxDraftHook, type FileOrFolderItem } from '@/renderer/hooks/chat/useSendBoxDraft';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import {
  usePendingConversationMessages,
  type PendingConversationMessageMode,
} from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';
import { Message } from '@arco-design/web-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupConversation } from './useGroupConversation';

const useGroupSendBoxDraft = getSendBoxDraftHook('group', {
  _type: 'group',
  atPath: [],
  content: '',
  uploadFile: [],
});

const EMPTY_GROUP_DRAFT = {
  _type: 'group' as const,
  atPath: [] as Array<string | FileOrFolderItem>,
  content: '',
  uploadFile: [] as string[],
};

const GroupSendBox: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { t } = useTranslation();
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const { checkAndUpdateTitle } = useAutoTitle();
  const { running, setRunning } = useGroupConversation(conversationId);
  const { data, mutate } = useGroupSendBoxDraft(conversationId);
  const content = data?.content ?? '';

  const setContent = useCallback(
    (nextContent: string) => {
      mutate((draft) => ({ ...(draft || data || EMPTY_GROUP_DRAFT), content: nextContent }));
    },
    [data, mutate]
  );

  const handleSend = useCallback(
    async (message: string) => {
      const msgId = uuid();
      const userMessage: TMessage = {
        id: msgId,
        msg_id: msgId,
        type: 'text',
        position: 'right',
        conversation_id: conversationId,
        content: {
          content: message,
        },
        createdAt: Date.now(),
      };

      addOrUpdateMessage(userMessage, true);
      setRunning(true);

      try {
        await ipcBridge.conversation.sendMessage.invoke({
          input: message,
          msg_id: msgId,
          conversation_id: conversationId,
        });
        void checkAndUpdateTitle(conversationId, message);
      } catch (error) {
        setRunning(false);
        Message.error(t('conversation.createFailed'));
        throw error;
      }
    },
    [addOrUpdateMessage, checkAndUpdateTitle, conversationId, setRunning, t]
  );

  const {
    pendingMessages,
    enqueuePendingMessage,
    removePendingMessage,
    setPendingMessageMode,
    restorePendingMessage,
    restoreLatestPendingMessage,
  } = usePendingConversationMessages({
    conversationId,
    canSendNow: !running,
    canSteerNow: false,
    onDispatch: async (pendingMessage) => {
      await handleSend(pendingMessage.content);
    },
    onDispatchError: (error: unknown) => {
      console.error('[GroupSendBox] Failed to dispatch pending message:', error);
    },
  });

  const stashPendingMessage = useCallback(
    (mode: PendingConversationMessageMode, message: string) => {
      enqueuePendingMessage(mode, message, []);
    },
    [enqueuePendingMessage]
  );

  const restoreMessageToComposer = useCallback(
    (messageId: string) => {
      const pendingMessage = restorePendingMessage(messageId);
      if (!pendingMessage) {
        return;
      }
      setContent(pendingMessage.content);
    },
    [restorePendingMessage, setContent]
  );

  const restoreLatestMessageToComposer = useCallback(() => {
    const pendingMessage = restoreLatestPendingMessage();
    if (!pendingMessage) {
      return;
    }
    setContent(pendingMessage.content);
  }, [restoreLatestPendingMessage, setContent]);

  return (
    <div className='max-w-800px w-full mx-auto mt-auto mb-16px'>
      <SendBox
        value={content}
        onChange={setContent}
        onSend={handleSend}
        loading={running}
        disabled={false}
        defaultMultiLine={true}
        lockMultiLine={true}
        placeholder={t('conversation.group.sendPlaceholder')}
        prefix={
          <PendingMessageBar
            messages={pendingMessages}
            onRemove={removePendingMessage}
            onEdit={restoreMessageToComposer}
            onSetMode={setPendingMessageMode}
          />
        }
        onQueue={(message) => stashPendingMessage('queue', message)}
        onSteer={(message) => stashPendingMessage('steer', message)}
        onEditLatestPending={restoreLatestMessageToComposer}
      />
    </div>
  );
};

export default GroupSendBox;
