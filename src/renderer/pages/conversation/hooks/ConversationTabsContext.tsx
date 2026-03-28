/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { STORAGE_KEYS } from '@/common/config/storageKeys';
import { addEventListener } from '@/renderer/utils/emitter';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** 会话 Tab 数据结构 / Conversation Tab data structure */
export interface ConversationTab {
  /** 会话 ID / Conversation ID */
  id: string;
  /** 会话名称 / Conversation name */
  name: string;
  /** 工作空间路径 / Workspace path */
  workspace: string;
  /** 会话类型 / Conversation type */
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'nanobot' | 'group';
  /** Persist minimal conversation extra for tab icon rendering */
  extra?: TChatConversation['extra'];
  /** Discussion group family id when this tab belongs to a discussion group */
  discussionGroupId?: string;
  /** 是否有未保存的修改 / Whether there are unsaved changes */
  isDirty?: boolean;
}

export interface ConversationTabsContextValue {
  // 所有打开的 tabs / All open tabs
  openTabs: ConversationTab[];
  // 当前活动的 tab ID / Currently active tab ID
  activeTabId: string | null;

  // 获取当前激活的 tab / Get active tab
  activeTab: ConversationTab | null;

  // 打开一个会话 tab / Open a conversation tab
  openTab: (conversation: TChatConversation) => void;
  // 批量打开会话 tabs，并指定当前激活项 / Open multiple conversation tabs with an active target
  openTabsForConversations: (conversations: TChatConversation[], activeConversationId?: string) => void;
  // 关闭一个 tab / Close a tab
  closeTab: (conversationId: string) => void;
  // 切换到指定 tab / Switch to a tab
  switchTab: (conversationId: string) => void;
  // 关闭所有 tabs / Close all tabs
  closeAllTabs: () => void;
  // 关闭指定tab左侧的所有tabs / Close all tabs to the left of specified tab
  closeTabsToLeft: (conversationId: string) => void;
  // 关闭指定tab右侧的所有tabs / Close all tabs to the right of specified tab
  closeTabsToRight: (conversationId: string) => void;
  // 关闭除指定tab外的所有tabs / Close all tabs except the specified one
  closeOtherTabs: (conversationId: string) => void;
  // 更新 tab 的名称 / Update tab name
  updateTabName: (conversationId: string, newName: string) => void;
}

const ConversationTabsContext = createContext<ConversationTabsContextValue | null>(null);

const getDiscussionGroupId = (conversation: TChatConversation): string | undefined => {
  if (conversation.type === 'group') {
    return conversation.id;
  }

  const extra = conversation.extra as { groupMeta?: { parentGroupId?: string } } | undefined;
  return typeof extra?.groupMeta?.parentGroupId === 'string' && extra.groupMeta.parentGroupId.length > 0
    ? extra.groupMeta.parentGroupId
    : undefined;
};

const toConversationTab = (conversation: TChatConversation): ConversationTab => ({
  id: conversation.id,
  name: conversation.name,
  workspace: conversation.extra?.workspace || '',
  type: conversation.type,
  extra: conversation.extra,
  discussionGroupId: getDiscussionGroupId(conversation),
});

// 从 localStorage 恢复状态 / Restore state from localStorage
const loadPersistedState = (): { openTabs: ConversationTab[]; activeTabId: string | null } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATION_TABS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 验证数据结构 / Validate data structure
      if (Array.isArray(parsed.openTabs)) {
        return {
          openTabs: parsed.openTabs,
          activeTabId: parsed.activeTabId || null,
        };
      }
    }
  } catch {
    // 忽略解析错误 / Ignore parsing errors
  }
  return { openTabs: [], activeTabId: null };
};

export const ConversationTabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 从 localStorage 恢复初始状态 / Restore initial state from localStorage
  const persistedState = loadPersistedState();
  const [openTabs, setOpenTabs] = useState<ConversationTab[]>(persistedState.openTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(persistedState.activeTabId);

  // 持久化状态到 localStorage / Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CONVERSATION_TABS,
        JSON.stringify({
          openTabs,
          activeTabId,
        })
      );
    } catch {
      // 忽略存储错误（如存储空间不足）/ Ignore storage errors (e.g., quota exceeded)
    }
  }, [openTabs, activeTabId]);

  // 获取当前激活的 tab / Get active tab
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || null;

  const openTabsForConversations = useCallback((conversations: TChatConversation[], activeConversationId?: string) => {
    if (conversations.length === 0) {
      return;
    }

    const targetConversationId = activeConversationId || conversations[conversations.length - 1]?.id || null;

    setOpenTabs((prev) => {
      const batchTabs = conversations.map(toConversationTab);
      const batchTabById = new Map(batchTabs.map((tab) => [tab.id, tab]));
      const existingTabIds = new Set(prev.map((tab) => tab.id));

      const nextTabs = prev.map((tab) => batchTabById.get(tab.id) ?? tab);

      batchTabs.forEach((tab) => {
        if (!existingTabIds.has(tab.id)) {
          nextTabs.push(tab);
        }
      });

      return nextTabs;
    });
    setActiveTabId(targetConversationId);
  }, []);

  const openTab = useCallback(
    (conversation: TChatConversation) => {
      openTabsForConversations([conversation], conversation.id);
    },
    [openTabsForConversations]
  );

  const closeTab = useCallback(
    (conversationId: string) => {
      setOpenTabs((prev) => {
        const targetTab = prev.find((tab) => tab.id === conversationId);
        if (!targetTab) {
          return prev;
        }

        const shouldCloseDiscussionFamily = targetTab.type === 'group' && Boolean(targetTab.discussionGroupId);
        const closedIds = new Set(
          shouldCloseDiscussionFamily
            ? prev.filter((tab) => tab.discussionGroupId === targetTab.discussionGroupId).map((tab) => tab.id)
            : [conversationId]
        );
        const filtered = prev.filter((tab) => !closedIds.has(tab.id));

        // 如果关闭的是当前活动的 tab / If closing the active tab
        if (activeTabId && closedIds.has(activeTabId)) {
          if (filtered.length > 0) {
            // 切换到最后一个 tab / Switch to the last tab
            setActiveTabId(filtered[filtered.length - 1].id);
          } else {
            // 没有 tab 了 / No more tabs
            setActiveTabId(null);
          }
        }

        return filtered;
      });
    },
    [activeTabId]
  );

  const switchTab = useCallback((conversationId: string) => {
    setActiveTabId(conversationId);
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(null);
  }, []);

  const closeTabsToLeft = useCallback(
    (conversationId: string) => {
      setOpenTabs((prev) => {
        const targetIndex = prev.findIndex((tab) => tab.id === conversationId);
        if (targetIndex <= 0) return prev; // 没有左侧tab或找不到目标tab

        // 保留目标tab及其右侧的所有tabs
        const newTabs = prev.slice(targetIndex);

        // 如果当前活动tab被关闭了，切换到目标tab
        const closedIds = prev.slice(0, targetIndex).map((tab) => tab.id);
        if (activeTabId && closedIds.includes(activeTabId)) {
          setActiveTabId(conversationId);
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

  const closeTabsToRight = useCallback(
    (conversationId: string) => {
      setOpenTabs((prev) => {
        const targetIndex = prev.findIndex((tab) => tab.id === conversationId);
        if (targetIndex === -1 || targetIndex === prev.length - 1) return prev; // 没有右侧tab或找不到目标tab

        // 保留目标tab及其左侧的所有tabs
        const newTabs = prev.slice(0, targetIndex + 1);

        // 如果当前活动tab被关闭了，切换到目标tab
        const closedIds = prev.slice(targetIndex + 1).map((tab) => tab.id);
        if (activeTabId && closedIds.includes(activeTabId)) {
          setActiveTabId(conversationId);
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

  const closeOtherTabs = useCallback((conversationId: string) => {
    setOpenTabs((prev) => {
      const targetTab = prev.find((tab) => tab.id === conversationId);
      if (!targetTab) return prev;

      // 只保留目标tab
      setActiveTabId(conversationId);
      return [targetTab];
    });
  }, []);

  const updateTabName = useCallback((conversationId: string, newName: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === conversationId) {
          return { ...tab, name: newName };
        }
        return tab;
      })
    );
  }, []);

  // 监听会话删除事件，自动关闭对应 tab / Listen to conversation deletion event, auto-close corresponding tab
  useEffect(() => {
    return addEventListener('conversation.deleted', (conversationId) => {
      closeTab(conversationId);
    });
  }, [closeTab]);

  return (
    <ConversationTabsContext.Provider
      value={{
        openTabs,
        activeTabId,
        activeTab,
        openTab,
        openTabsForConversations,
        closeTab,
        switchTab,
        closeAllTabs,
        closeTabsToLeft,
        closeTabsToRight,
        closeOtherTabs,
        updateTabName,
      }}
    >
      {children}
    </ConversationTabsContext.Provider>
  );
};

export const useConversationTabs = () => {
  const context = useContext(ConversationTabsContext);
  if (!context) {
    throw new Error('useConversationTabs must be used within ConversationTabsProvider');
  }
  return context;
};

export const useOptionalConversationTabs = () => useContext(ConversationTabsContext);
