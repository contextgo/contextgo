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
import CodexSendBox from './CodexSendBox';

/**
 * @deprecated Legacy Codex chat component. New Codex conversations use ACP
 * protocol and render via AcpChat. Kept for existing sessions only.
 */
const CodexChat: React.FC<{
  conversation_id: string;
  workspace: string;
}> = ({ conversation_id, workspace }) => {
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);
  return (
    <ConversationMessageStateProvider conversationId={conversation_id}>
      <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'codex' }}>
        <div className='conversation-mobile-chat-page flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList className='conversation-mobile-message-list flex-1'></MessageList>
          </FlexFullContainer>
          <ConversationChatConfirm conversation_id={conversation_id}>
            <CodexSendBox conversation_id={conversation_id} />
          </ConversationChatConfirm>
        </div>
      </ConversationProvider>
    </ConversationMessageStateProvider>
  );
};

export default CodexChat;
