import { useMemo } from 'react';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { buildVisibleConversationIds } from '../utils/visibleConversationOrder';
import { useDiscussionGroupExpansionState, useWorkspaceExpansionState } from './useWorkspaceExpansionState';

export const useVisibleConversationIds = (): string[] => {
  const layout = useLayoutContext();
  const siderCollapsed = layout?.siderCollapsed ?? false;
  const { groupedHistory } = useConversationHistoryContext();
  const expandedWorkspaces = useWorkspaceExpansionState();
  const expandedDiscussionGroups = useDiscussionGroupExpansionState();

  return useMemo(() => {
    return buildVisibleConversationIds({
      ...groupedHistory,
      expandedWorkspaces,
      expandedDiscussionGroups,
      siderCollapsed,
    });
  }, [groupedHistory, expandedDiscussionGroups, expandedWorkspaces, siderCollapsed]);
};
