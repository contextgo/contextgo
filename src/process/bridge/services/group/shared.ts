/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IConversationTurnCompletedEvent } from '@/common/adapter/ipcBridge';
import type { IMessageText } from '@/common/chat/chatLib';
import type { TChatConversation, WorkflowGroupRunState } from '@/common/config/storage';
import { getDatabase } from '@process/services/database';
import type { IConversationService } from '@process/services/IConversationService';

export type GroupConversation = Extract<TChatConversation, { type: 'group' }>;

export const isGroupConversation = (conversation: TChatConversation | undefined): conversation is GroupConversation => {
  return conversation?.type === 'group';
};

export const persistGroupUserMessage = async (
  conversationService: IConversationService,
  conversation: GroupConversation,
  message: IMessageText
): Promise<void> => {
  const db = await getDatabase();
  db.insertMessage(message);
  await conversationService.updateConversation(conversation.id, {});
};

export const persistGroupProjectedMessage = async (
  conversationService: IConversationService,
  conversation: GroupConversation,
  message: IMessageText,
  skipCompletionRefresh: boolean
): Promise<void> => {
  const db = await getDatabase();
  db.insertMessage(message);
  if (!skipCompletionRefresh) {
    await conversationService.updateConversation(conversation.id, {
      status: 'running',
    });
  }

  ipcBridge.conversation.responseStream.emit({
    type: 'content',
    conversation_id: conversation.id,
    msg_id: message.msg_id || message.id,
    data: message.content,
  });
};

export const emitGroupTurnState = (
  conversation: GroupConversation,
  status: IConversationTurnCompletedEvent['status'],
  state: IConversationTurnCompletedEvent['state'],
  detail: string
): void => {
  const event: IConversationTurnCompletedEvent = {
    sessionId: conversation.id,
    status,
    state,
    detail,
    canSendMessage: state !== 'ai_generating',
    runtime: {
      hasTask: false,
      isProcessing: state === 'ai_generating',
      pendingConfirmations: 0,
      dbStatus: status,
    },
    workspace: conversation.extra.workspace || '',
    model: {
      platform: conversation.model.platform,
      name: conversation.model.name,
      useModel: conversation.model.useModel,
    },
  };

  ipcBridge.conversation.turnCompleted.emit(event);
};

export const updateGroupRunState = async (
  conversationService: IConversationService,
  conversation: GroupConversation,
  runState: WorkflowGroupRunState,
  status?: GroupConversation['status']
): Promise<GroupConversation> => {
  await conversationService.updateConversation(
    conversation.id,
    {
      ...(status ? { status } : {}),
      extra: {
        runState,
      },
    } as Partial<TChatConversation>,
    true
  );

  return {
    ...conversation,
    ...(status ? { status } : {}),
    extra: {
      ...conversation.extra,
      runState,
    },
  };
};

export const collectTextMessageContent = (messages: IMessageText[]): string => {
  return messages
    .filter((message) => message.position === 'left')
    .map((message) => message.content.content.trim())
    .filter(Boolean)
    .join('\n\n');
};
