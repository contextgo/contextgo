/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import type { AcpBackend } from '@/common/types/acpTypes';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import LocalImageView from '@renderer/components/media/LocalImageView';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationMessageStateProvider } from '@renderer/pages/conversation/Messages/hooks';
import HOC from '@renderer/utils/ui/HOC';
import React, { useEffect } from 'react';
import ConversationChatConfirm from '../../components/ConversationChatConfirm';
import AcpSendBox from './AcpSendBox';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: AcpBackend;
  sessionMode?: string;
  agentName?: string;
}> = ({ conversation_id, workspace, backend, sessionMode, agentName }) => {
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace ?? '' });
  }, [updateLocalImage, workspace]);

  return (
    <ConversationMessageStateProvider conversationId={conversation_id}>
      <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'acp' }}>
        <div className='conversation-mobile-chat-page flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList className='conversation-mobile-message-list flex-1'></MessageList>
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

export default HOC.Wrapper(LocalImageView.Provider)(AcpChat);
