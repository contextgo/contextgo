/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { addEventListener } from '@/renderer/utils/emitter';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { GroupChildConversationMap } from '../types';

const shouldIgnoreStreamMessage = (type: string): boolean => {
  return (
    type === 'user_content' ||
    type === 'request_trace' ||
    type === 'finished' ||
    type === 'acp_model_info' ||
    type === 'codex_model_info' ||
    type === 'acp_context_usage'
  );
};

const getAgentStatusData = (data: unknown): { backend?: string; status?: string } | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  return data as { backend?: string; status?: string };
};

const isBootstrapAgentStatus = (data: unknown): boolean => {
  const agentStatus = getAgentStatusData(data);
  return (
    typeof agentStatus?.backend === 'string' &&
    (agentStatus.status === 'connecting' ||
      agentStatus.status === 'connected' ||
      agentStatus.status === 'authenticated' ||
      agentStatus.status === 'session_active')
  );
};

const shouldClearGeneratingForAgentStatus = (_data: unknown): boolean => false;

const isTerminalAgentStatus = (data: unknown): boolean => {
  const agentStatus = getAgentStatusData(data);
  return agentStatus?.status === 'error' || agentStatus?.status === 'disconnected';
};

const isTerminalStreamMessage = (message: { type: string; data: unknown }): boolean => {
  return (
    message.type === 'finish' ||
    message.type === 'interrupted' ||
    message.type === 'error' ||
    (message.type === 'agent_status' && isTerminalAgentStatus(message.data))
  );
};

const isTerminalTurnState = (state: string): boolean => {
  return state === 'ai_waiting_input' || state === 'error' || state === 'stopped';
};

type ConversationListSyncSnapshot = {
  conversations: TChatConversation[];
  groupChildConversationsByParentId: GroupChildConversationMap;
  generatingConversationIds: Set<string>;
  completionUnreadConversationIds: Set<string>;
};

const getGroupParentConversationId = (conversation: TChatConversation): string | undefined => {
  const extra = conversation.extra as
    | {
        groupMeta?: { parentGroupId?: string };
      }
    | undefined;

  const parentGroupId = extra?.groupMeta?.parentGroupId;
  return typeof parentGroupId === 'string' && parentGroupId.length > 0 ? parentGroupId : undefined;
};

export const splitGroupChildConversations = (conversations: TChatConversation[]) => {
  const nextTopLevelConversations: TChatConversation[] = [];
  const nextGroupChildConversations = new Map<string, TChatConversation[]>();
  const participantParentGroupByConversationId = new Map<string, string>();

  conversations.forEach((conversation) => {
    if (conversation.type !== 'group') {
      return;
    }

    conversation.extra.participants.forEach((participant) => {
      participantParentGroupByConversationId.set(participant.childConversationId, conversation.id);
    });
  });

  conversations.forEach((conversation) => {
    const parentGroupId =
      getGroupParentConversationId(conversation) || participantParentGroupByConversationId.get(conversation.id);

    if (parentGroupId) {
      const childConversations = nextGroupChildConversations.get(parentGroupId) ?? [];
      childConversations.push(conversation);
      nextGroupChildConversations.set(parentGroupId, childConversations);
      return;
    }

    nextTopLevelConversations.push(conversation);
  });

  return {
    topLevelConversations: nextTopLevelConversations,
    groupChildConversationsByParentId: Object.fromEntries(nextGroupChildConversations) as GroupChildConversationMap,
  };
};

const listeners = new Set<() => void>();

let isStoreInitialized = false;
let conversationsState: TChatConversation[] = [];
let groupChildConversationsByParentIdState: GroupChildConversationMap = {};
let generatingConversationIdsState = new Set<string>();
let completionUnreadConversationIdsState = new Set<string>();
let conversationIdsState = new Set<string>();
let activeConversationIdState: string | null = null;
let snapshotState: ConversationListSyncSnapshot = {
  conversations: conversationsState,
  groupChildConversationsByParentId: groupChildConversationsByParentIdState,
  generatingConversationIds: generatingConversationIdsState,
  completionUnreadConversationIds: completionUnreadConversationIdsState,
};

const emitStoreChange = () => {
  snapshotState = {
    conversations: conversationsState,
    groupChildConversationsByParentId: groupChildConversationsByParentIdState,
    generatingConversationIds: generatingConversationIdsState,
    completionUnreadConversationIds: completionUnreadConversationIdsState,
  };
  listeners.forEach((listener) => listener());
};

const subscribeConversationListSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getConversationListSyncSnapshot = (): ConversationListSyncSnapshot => snapshotState;

const refreshConversations = () => {
  void ipcBridge.database.getUserConversations
    .invoke({ page: 0, pageSize: 10000 })
    .then((data) => {
      if (data && Array.isArray(data)) {
        const filteredData = data.filter((conv) => {
          const extra = conv.extra as
            | {
                isHealthCheck?: boolean;
                archived?: boolean;
                groupMeta?: { hiddenFromHistory?: boolean; parentGroupId?: string };
              }
            | undefined;
          return extra?.isHealthCheck !== true && extra?.archived !== true;
        });

        const {
          topLevelConversations: nextTopLevelConversations,
          groupChildConversationsByParentId: nextGroupChildConversations,
        } = splitGroupChildConversations(filteredData);

        conversationsState = nextTopLevelConversations;
        groupChildConversationsByParentIdState = nextGroupChildConversations;
        conversationIdsState = new Set(filteredData.map((conversation) => conversation.id));
        emitStoreChange();
        return;
      }

      conversationsState = [];
      groupChildConversationsByParentIdState = {};
      conversationIdsState = new Set();
      emitStoreChange();
    })
    .catch((error) => {
      console.error('[WorkspaceGroupedHistory] Failed to load conversations:', error);
      conversationsState = [];
      groupChildConversationsByParentIdState = {};
      conversationIdsState = new Set();
      emitStoreChange();
    });
};

const markGenerating = (conversationId: string) => {
  if (generatingConversationIdsState.has(conversationId)) {
    return;
  }

  generatingConversationIdsState = new Set(generatingConversationIdsState).add(conversationId);
  emitStoreChange();
};

const clearGenerating = (conversationId: string) => {
  if (!generatingConversationIdsState.has(conversationId)) {
    return;
  }

  const next = new Set(generatingConversationIdsState);
  next.delete(conversationId);
  generatingConversationIdsState = next;
  emitStoreChange();
};

const markCompletionUnread = (conversationId: string) => {
  if (completionUnreadConversationIdsState.has(conversationId)) {
    return;
  }

  completionUnreadConversationIdsState = new Set(completionUnreadConversationIdsState).add(conversationId);
  emitStoreChange();
};

const clearCompletionUnreadState = (conversationId: string) => {
  if (!completionUnreadConversationIdsState.has(conversationId)) {
    return;
  }

  const next = new Set(completionUnreadConversationIdsState);
  next.delete(conversationId);
  completionUnreadConversationIdsState = next;
  emitStoreChange();
};

const setActiveConversationState = (conversationId: string | null) => {
  activeConversationIdState = conversationId;
};

const initializeConversationListSyncStore = () => {
  if (isStoreInitialized) {
    return;
  }

  isStoreInitialized = true;
  refreshConversations();

  addEventListener('chat.history.refresh', refreshConversations);
  ipcBridge.conversation.listChanged.on((event) => {
    if (event.action === 'deleted') {
      clearGenerating(event.conversationId);
      clearCompletionUnreadState(event.conversationId);
    }
    refreshConversations();
  });
  ipcBridge.conversation.responseStream.on((message) => {
    const conversationId = message.conversation_id;
    if (!conversationId) {
      return;
    }

    if (!conversationIdsState.has(conversationId)) {
      refreshConversations();
    }

    if (isTerminalStreamMessage(message)) {
      const wasGenerating = generatingConversationIdsState.has(conversationId);
      if (wasGenerating && activeConversationIdState !== conversationId) {
        markCompletionUnread(conversationId);
      }
      clearGenerating(conversationId);
      return;
    }

    if (message.type === 'agent_status' && shouldClearGeneratingForAgentStatus(message.data)) {
      clearGenerating(conversationId);
      return;
    }

    if (shouldIgnoreStreamMessage(message.type)) {
      return;
    }

    if (message.type === 'agent_status' && isBootstrapAgentStatus(message.data)) {
      return;
    }

    markGenerating(conversationId);
  });
  ipcBridge.conversation.turnCompleted.on((event) => {
    if (isTerminalTurnState(event.state) && activeConversationIdState !== event.sessionId) {
      markCompletionUnread(event.sessionId);
    }
    clearGenerating(event.sessionId);
    refreshConversations();
  });
};

export const useConversationListSync = () => {
  useEffect(() => {
    initializeConversationListSyncStore();
  }, []);

  const {
    conversations,
    groupChildConversationsByParentId,
    generatingConversationIds,
    completionUnreadConversationIds,
  } = useSyncExternalStore(
    subscribeConversationListSync,
    getConversationListSyncSnapshot,
    getConversationListSyncSnapshot
  );

  const clearCompletionUnread = useCallback((conversationId: string) => {
    clearCompletionUnreadState(conversationId);
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationState(conversationId);
  }, []);

  const isConversationGenerating = useCallback(
    (conversationId: string) => {
      return generatingConversationIds.has(conversationId);
    },
    [generatingConversationIds]
  );

  const hasCompletionUnread = useCallback(
    (conversationId: string) => {
      return completionUnreadConversationIds.has(conversationId);
    },
    [completionUnreadConversationIds]
  );

  return {
    conversations,
    groupChildConversationsByParentId,
    isConversationGenerating,
    hasCompletionUnread,
    clearCompletionUnread,
    setActiveConversation,
  };
};
