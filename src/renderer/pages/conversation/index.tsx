import { ipcBridge } from '@/common';
import { Spin } from '@arco-design/web-react';
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import ChatConversation from './components/ChatConversation';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { useConversationTabs } from './hooks/ConversationTabsContext';
import type { TChatConversation } from '@/common/config/storage';

const loadDiscussionFamilyConversations = async (conversation: TChatConversation): Promise<TChatConversation[]> => {
  const conversationExtra = conversation.extra as { groupMeta?: { parentGroupId?: string } } | undefined;
  const parentGroupId = conversation.type === 'group' ? conversation.id : conversationExtra?.groupMeta?.parentGroupId;

  if (!parentGroupId) {
    return [conversation];
  }

  const groupConversation =
    conversation.type === 'group' ? conversation : await ipcBridge.conversation.get.invoke({ id: parentGroupId });

  if (!groupConversation || groupConversation.type !== 'group') {
    return [conversation];
  }

  const childConversations = await Promise.all(
    groupConversation.extra.participants.map(async (participant) => {
      try {
        return await ipcBridge.conversation.get.invoke({ id: participant.childConversationId });
      } catch {
        return null;
      }
    })
  );

  const currentConversationIncluded =
    conversation.id === groupConversation.id || childConversations.some((item) => item?.id === conversation.id);

  return [
    groupConversation,
    ...childConversations.filter((item): item is TChatConversation => item !== null),
    ...(currentConversationIncluded ? [] : [conversation]),
  ];
};

const ChatConversationIndex: React.FC = () => {
  const { id } = useParams();
  const { closePreview } = usePreviewContext();
  const { openTabsForConversations } = useConversationTabs();
  const previousConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;

    // 切换会话时自动关闭预览面板，避免跨会话残留
    // Close preview on every conversation change, including initial mount
    // (component may remount via React Router, resetting the ref to undefined)
    if (previousConversationIdRef.current !== id) {
      closePreview();
    }

    previousConversationIdRef.current = id;
  }, [id, closePreview]);

  const { data, isLoading } = useSWR(`conversation/${id}`, () => {
    return ipcBridge.conversation.get.invoke({ id });
  });

  // 当会话数据加载完成后，自动打开 tab
  // Automatically open tab when conversation data is loaded
  useEffect(() => {
    if (!data) {
      return;
    }

    let cancelled = false;

    const syncTabs = async () => {
      const conversations = await loadDiscussionFamilyConversations(data);
      if (cancelled) {
        return;
      }
      openTabsForConversations(conversations, data.id);
    };

    void syncTabs();

    return () => {
      cancelled = true;
    };
  }, [data, openTabsForConversations]);

  if (isLoading) return <Spin loading></Spin>;
  return <ChatConversation conversation={data}></ChatConversation>;
};

export default ChatConversationIndex;
