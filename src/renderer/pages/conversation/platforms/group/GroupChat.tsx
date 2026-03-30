/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/pages/conversation/Messages/hooks';
import HOC from '@renderer/utils/ui/HOC';
import React from 'react';
import GroupSendBox from './GroupSendBox';
import HarnessRunSummaryCard from './HarnessRunSummaryCard';
import { useGroupConversation } from './useGroupConversation';

const GroupChat: React.FC<{
  conversation: Extract<TChatConversation, { type: 'group' }>;
}> = ({ conversation }) => {
  const conversationId = conversation.id;
  const workspace = conversation.extra?.workspace;
  useMessageLstCache(conversationId);
  const { running, setRunning } = useGroupConversation(conversationId);

  return (
    <ConversationProvider value={{ conversationId, workspace, type: 'group' }}>
      <div className='flex-1 flex flex-col px-20px min-h-0'>
        <HarnessRunSummaryCard
          conversationId={conversationId}
          workspace={workspace}
          running={running}
          collaboration={conversation.extra.collaboration}
          orchestration={conversation.extra.orchestration}
        />
        <FlexFullContainer>
          <MessageList className='flex-1' />
        </FlexFullContainer>
        <GroupSendBox conversationId={conversationId} running={running} setRunning={setRunning} />
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(GroupChat);
