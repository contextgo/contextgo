/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationMessageStateProvider } from '@renderer/pages/conversation/Messages/hooks';
import React from 'react';
import GroupOverviewCard from './GroupOverviewCard';
import GroupSendBox from './GroupSendBox';
import { useGroupConversation } from './useGroupConversation';

const GroupChat: React.FC<{
  conversation: Extract<TChatConversation, { type: 'group' }>;
}> = ({ conversation }) => {
  const conversationId = conversation.id;
  const workspace = conversation.extra?.workspace;
  const { running, setRunning } = useGroupConversation(conversationId);

  return (
    <ConversationMessageStateProvider conversationId={conversationId}>
      <ConversationProvider value={{ conversationId, workspace, type: 'group' }}>
        <div className='flex-1 flex flex-col px-12px md:px-20px min-h-0'>
          <GroupOverviewCard conversation={conversation} running={running} />
          <FlexFullContainer>
            <MessageList className='flex-1' />
          </FlexFullContainer>
          <GroupSendBox conversationId={conversationId} running={running} setRunning={setRunning} />
        </div>
      </ConversationProvider>
    </ConversationMessageStateProvider>
  );
};

export default GroupChat;
