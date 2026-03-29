/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import {
  DISCUSSION_GROUP_EXPANSION_STORAGE_KEY,
  dispatchDiscussionGroupExpansionChange,
  dispatchWorkspaceExpansionChange,
  readExpandedDiscussionGroups,
  readExpandedWorkspaces,
  WORKSPACE_EXPANSION_STORAGE_KEY,
} from './useWorkspaceExpansionState';

export const useConversations = () => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>(() => readExpandedWorkspaces());
  const [expandedDiscussionGroups, setExpandedDiscussionGroups] = useState<string[]>(() =>
    readExpandedDiscussionGroups()
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
  const hasAutoExpandedDiscussionGroupsRef = useRef(false);

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
      localStorage.setItem(DISCUSSION_GROUP_EXPANSION_STORAGE_KEY, JSON.stringify(expandedDiscussionGroups));
    } catch {
      // ignore
    }

    dispatchDiscussionGroupExpansionChange(expandedDiscussionGroups);
  }, [expandedDiscussionGroups]);

  const { pinnedConversations, timelineSections, discussionChildConversationsByParentId } = groupedHistory;

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
    const currentDiscussionGroupIds = new Set(Object.keys(discussionChildConversationsByParentId));
    setExpandedDiscussionGroups((prev) => {
      const filtered = prev.filter((groupId) => currentDiscussionGroupIds.has(groupId));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [discussionChildConversationsByParentId]);

  useEffect(() => {
    if (hasAutoExpandedDiscussionGroupsRef.current) return;
    if (expandedDiscussionGroups.length > 0) {
      hasAutoExpandedDiscussionGroupsRef.current = true;
      return;
    }

    const allDiscussionGroupIds = Object.keys(discussionChildConversationsByParentId).filter(
      (groupId) => (discussionChildConversationsByParentId[groupId] ?? []).length > 0
    );

    if (allDiscussionGroupIds.length > 0) {
      setExpandedDiscussionGroups(allDiscussionGroupIds);
      hasAutoExpandedDiscussionGroupsRef.current = true;
    }
  }, [discussionChildConversationsByParentId, expandedDiscussionGroups]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const parentGroupId = Object.entries(discussionChildConversationsByParentId).find(([, childConversations]) =>
      childConversations.some((conversation) => conversation.id === id)
    )?.[0];

    if (!parentGroupId) {
      return;
    }

    setExpandedDiscussionGroups((prev) => {
      if (prev.includes(parentGroupId)) {
        return prev;
      }
      return [...prev, parentGroupId];
    });
  }, [discussionChildConversationsByParentId, id]);

  const handleToggleWorkspace = useCallback((workspace: string) => {
    setExpandedWorkspaces((prev) => {
      if (prev.includes(workspace)) {
        return prev.filter((item) => item !== workspace);
      }
      return [...prev, workspace];
    });
  }, []);

  const handleToggleDiscussionGroup = useCallback((groupId: string) => {
    setExpandedDiscussionGroups((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((item) => item !== groupId);
      }
      return [...prev, groupId];
    });
  }, []);

  const ensureDiscussionGroupExpanded = useCallback((groupId: string) => {
    setExpandedDiscussionGroups((prev) => {
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
    expandedDiscussionGroups,
    pinnedConversations,
    timelineSections,
    discussionChildConversationsByParentId,
    handleToggleWorkspace,
    handleToggleDiscussionGroup,
    ensureDiscussionGroupExpanded,
  };
};
