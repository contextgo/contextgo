/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import type { ScheduleEventPayload } from '@/common/types/schedule/events';
import { addMessage } from '@process/utils/message';

export function emitScheduleEventMessage(params: {
  conversationId: string;
  msgId: string;
  event: ScheduleEventPayload;
  emit: (message: IResponseMessage) => void;
}): void {
  const message: TMessage = {
    id: params.msgId,
    msg_id: params.msgId,
    type: 'schedule_event',
    position: 'left',
    conversation_id: params.conversationId,
    content: params.event,
    createdAt: Date.now(),
    status: 'finish',
  };

  addMessage(params.conversationId, message);
  params.emit({
    type: 'schedule_event',
    conversation_id: params.conversationId,
    msg_id: params.msgId,
    data: params.event,
  });
}
