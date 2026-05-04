/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationContextValue } from '@/renderer/hooks/context/ConversationContext';
import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationMessageStateProvider } from '@renderer/pages/conversation/Messages/hooks';
import HOC from '@renderer/utils/ui/HOC';
import React, { useEffect, useMemo } from 'react';
import LocalImageView from '@renderer/components/media/LocalImageView';
import ConversationChatConfirm from '../../components/ConversationChatConfirm';
import GeminiSendBox from './GeminiSendBox';
import type { GeminiModelSelection } from './useGeminiModelSelection';

// GeminiChat 接收共享的模型选择状态，避免组件内重复管理
// GeminiChat consumes shared model selection state to avoid duplicate logic
const GeminiChat: React.FC<{
  conversation_id: string;
  workspace: string;
  modelSelection: GeminiModelSelection;
}> = ({ conversation_id, workspace, modelSelection }) => {
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);
  const conversationValue = useMemo<ConversationContextValue>(() => {
    return { conversationId: conversation_id, workspace, type: 'gemini' };
  }, [conversation_id, workspace]);

  return (
    <ConversationMessageStateProvider conversationId={conversation_id}>
      <ConversationProvider value={conversationValue}>
        <div className='conversation-mobile-chat-page flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList className='conversation-mobile-message-list flex-1'></MessageList>
          </FlexFullContainer>
          <ConversationChatConfirm conversation_id={conversation_id}>
            <GeminiSendBox conversation_id={conversation_id} modelSelection={modelSelection}></GeminiSendBox>
          </ConversationChatConfirm>
        </div>
      </ConversationProvider>
    </ConversationMessageStateProvider>
  );
};

export default HOC.Wrapper(LocalImageView.Provider)(GeminiChat);
