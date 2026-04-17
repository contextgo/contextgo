import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { Spin } from '@arco-design/web-react';
import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import ChatConversation from './components/ChatConversation';
import { usePreviewActions } from '@/renderer/pages/conversation/Preview';
import { useConversationTabs } from './hooks/ConversationTabsContext';

const REMOUNT_DIAG_TAG = '[RemountDiag]';

const logRemountDiag = (scope: string, phase: string, payload: Record<string, unknown>) => {
  console.log(`${REMOUNT_DIAG_TAG}[${scope}] ${phase} ${JSON.stringify(payload)}`);
};

const ChatConversationIndex: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { closePreview } = usePreviewActions();
  const { closeTab, openTabsForConversations } = useConversationTabs();
  const previousConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    logRemountDiag('ChatConversationIndex', 'mount', {
      routeConversationId: id ?? null,
    });

    return () => {
      logRemountDiag('ChatConversationIndex', 'unmount', {
        routeConversationId: id ?? null,
      });
    };
  }, []);

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

  useEffect(() => {
    logRemountDiag('ChatConversationIndex', 'data-state', {
      routeConversationId: id ?? null,
      isLoading,
      loadedConversationId: data?.id ?? null,
      loadedConversationType: data?.type ?? null,
    });
  }, [data?.id, data?.type, id, isLoading]);

  // 当会话数据加载完成后，自动打开 tab
  // Automatically open tab when conversation data is loaded
  useEffect(() => {
    if (!data) {
      return;
    }
    openTabsForConversations([data], data.id);
  }, [data, openTabsForConversations]);

  useEffect(() => {
    if (!id || isLoading || data) {
      return;
    }

    closeTab(id);
    void navigate('/guid', { replace: true });
  }, [closeTab, data, id, isLoading, navigate]);

  if (!id) return null;
  if (isLoading) return <Spin loading></Spin>;
  if (!data) return null;
  return <ChatConversation conversation={data}></ChatConversation>;
};

export default ChatConversationIndex;
