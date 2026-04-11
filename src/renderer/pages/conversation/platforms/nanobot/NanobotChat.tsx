/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationMessageStateProvider } from '@renderer/pages/conversation/Messages/hooks';
import React, { useEffect } from 'react';
import LocalImageView from '@renderer/components/media/LocalImageView';
import ConversationChatConfirm from '../../components/ConversationChatConfirm';
import NanobotSendBox from './NanobotSendBox';

const NanobotChat: React.FC<{
  conversation_id: string;
  workspace: string;
}> = ({ conversation_id, workspace }) => {
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace, updateLocalImage]);
  return (
    <ConversationMessageStateProvider conversationId={conversation_id}>
      <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'nanobot' }}>
        <div className='flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList className='flex-1'></MessageList>
          </FlexFullContainer>
          <ConversationChatConfirm conversation_id={conversation_id}>
            <NanobotSendBox conversation_id={conversation_id} />
          </ConversationChatConfirm>
        </div>
      </ConversationProvider>
    </ConversationMessageStateProvider>
  );
};

export default NanobotChat;
