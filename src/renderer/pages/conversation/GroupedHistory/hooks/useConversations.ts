/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import {
  GROUP_CONVERSATION_EXPANSION_STORAGE_KEY,
  dispatchGroupConversationExpansionChange,
  dispatchWorkspaceExpansionChange,
  readExpandedGroupConversations,
  readExpandedWorkspaces,
  WORKSPACE_EXPANSION_STORAGE_KEY,
} from './useWorkspaceExpansionState';

export const useConversations = () => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>(() => readExpandedWorkspaces());
  const [expandedGroupConversations, setExpandedGroupConversations] = useState<string[]>(() =>
    readExpandedGroupConversations()
  );
  const { id } = useParams();
  const {
    conversations,
    isConversationGenerating,
    hasCompletionUnread,
    clearCompletionUnread,
    setActiveConversation,
    groupedHistory,
  } = useConversationHistoryContext();

  // Track whether auto-expand has already been performed to avoid
  // re-expanding workspaces after a user manually collapses them (#1156)
  const hasAutoExpandedRef = useRef(false);
  const hasAutoExpandedGroupConversationsRef = useRef(false);

  // Scroll active conversation into view
  useEffect(() => {
    if (!id) {
      setActiveConversation(null);
      return;
    }

    setActiveConversation(id);
    clearCompletionUnread(id);
    const rafId = requestAnimationFrame(() => {
      const element = document.getElementById('c-' + id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [clearCompletionUnread, id, setActiveConversation]);

  // Persist expansion state
  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_EXPANSION_STORAGE_KEY, JSON.stringify(expandedWorkspaces));
    } catch {
      // ignore
    }

    dispatchWorkspaceExpansionChange(expandedWorkspaces);
  }, [expandedWorkspaces]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_CONVERSATION_EXPANSION_STORAGE_KEY, JSON.stringify(expandedGroupConversations));
    } catch {
      // ignore
    }

    dispatchGroupConversationExpansionChange(expandedGroupConversations);
  }, [expandedGroupConversations]);

  const { pinnedConversations, timelineSections, groupChildConversationsByParentId } = groupedHistory;

  // Auto-expand all workspaces on first load only (#1156)
  useEffect(() => {
    if (hasAutoExpandedRef.current) return;
    if (expandedWorkspaces.length > 0) {
      hasAutoExpandedRef.current = true;
      return;
    }
    const allWorkspaces: string[] = [];
    timelineSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.type === 'workspace' && item.workspaceGroup) {
          allWorkspaces.push(item.workspaceGroup.workspace);
        }
      });
    });
    if (allWorkspaces.length > 0) {
      setExpandedWorkspaces(allWorkspaces);
      hasAutoExpandedRef.current = true;
    }
  }, [timelineSections]);

  // Remove stale workspace entries that no longer exist in the data
  useEffect(() => {
    const currentWorkspaces = new Set<string>();
    timelineSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.type === 'workspace' && item.workspaceGroup) {
          currentWorkspaces.add(item.workspaceGroup.workspace);
        }
      });
    });
    if (currentWorkspaces.size === 0) return;
    setExpandedWorkspaces((prev) => {
      const filtered = prev.filter((ws) => currentWorkspaces.has(ws));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [timelineSections]);

  useEffect(() => {
    const currentGroupConversationIds = new Set(Object.keys(groupChildConversationsByParentId));
    setExpandedGroupConversations((prev) => {
      const filtered = prev.filter((groupId) => currentGroupConversationIds.has(groupId));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [groupChildConversationsByParentId]);

  useEffect(() => {
    if (hasAutoExpandedGroupConversationsRef.current) return;
    if (expandedGroupConversations.length > 0) {
      hasAutoExpandedGroupConversationsRef.current = true;
      return;
    }

    const allGroupConversationIds = Object.keys(groupChildConversationsByParentId).filter(
      (groupId) => (groupChildConversationsByParentId[groupId] ?? []).length > 0
    );

    if (allGroupConversationIds.length > 0) {
      setExpandedGroupConversations(allGroupConversationIds);
      hasAutoExpandedGroupConversationsRef.current = true;
    }
  }, [groupChildConversationsByParentId, expandedGroupConversations]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const parentGroupId = Object.entries(groupChildConversationsByParentId).find(([, childConversations]) =>
      childConversations.some((conversation) => conversation.id === id)
    )?.[0];

    if (!parentGroupId) {
      return;
    }

    setExpandedGroupConversations((prev) => {
      if (prev.includes(parentGroupId)) {
        return prev;
      }
      return [...prev, parentGroupId];
    });
  }, [groupChildConversationsByParentId, id]);

  const handleToggleWorkspace = useCallback((workspace: string) => {
    setExpandedWorkspaces((prev) => {
      if (prev.includes(workspace)) {
        return prev.filter((item) => item !== workspace);
      }
      return [...prev, workspace];
    });
  }, []);

  const handleToggleGroupConversation = useCallback((groupId: string) => {
    setExpandedGroupConversations((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((item) => item !== groupId);
      }
      return [...prev, groupId];
    });
  }, []);

  const ensureGroupConversationExpanded = useCallback((groupId: string) => {
    setExpandedGroupConversations((prev) => {
      if (prev.includes(groupId)) {
        return prev;
      }
      return [...prev, groupId];
    });
  }, []);

  return {
    conversations,
    isConversationGenerating,
    hasCompletionUnread,
    expandedWorkspaces,
    expandedGroupConversations,
    pinnedConversations,
    timelineSections,
    groupChildConversationsByParentId,
    handleToggleWorkspace,
    handleToggleGroupConversation,
    ensureGroupConversationExpanded,
  };
};
