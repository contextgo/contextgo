/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import type { AcpBackend } from '@/common/types/acpTypes';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationMessageStateProvider } from '@renderer/pages/conversation/Messages/hooks';
import React from 'react';
import ConversationChatConfirm from '../../components/ConversationChatConfirm';
import AcpSendBox from './AcpSendBox';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: AcpBackend;
  sessionMode?: string;
  agentName?: string;
}> = ({ conversation_id, workspace, backend, sessionMode, agentName }) => {
  return (
    <ConversationMessageStateProvider conversationId={conversation_id}>
      <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'acp' }}>
        <div className='flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList className='flex-1'></MessageList>
          </FlexFullContainer>
          <ConversationChatConfirm conversation_id={conversation_id}>
            <AcpSendBox
              conversation_id={conversation_id}
              backend={backend}
              sessionMode={sessionMode}
              agentName={agentName}
            ></AcpSendBox>
          </ConversationChatConfirm>
        </div>
      </ConversationProvider>
    </ConversationMessageStateProvider>
  );
};

export default AcpChat;
