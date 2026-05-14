import { useMemo } from 'react';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { buildVisibleConversationIds } from '../utils/visibleConversationOrder';
import { useGroupConversationExpansionState, useWorkspaceExpansionState } from './useWorkspaceExpansionState';

export const useVisibleConversationIds = (): string[] => {
  const layout = useLayoutContext();
  const siderCollapsed = layout?.siderCollapsed ?? false;
  const { groupedHistory } = useConversationHistoryContext();
  const expandedWorkspaces = useWorkspaceExpansionState();
  const expandedGroupConversations = useGroupConversationExpansionState();

  return useMemo(() => {
    return buildVisibleConversationIds({
      ...groupedHistory,
      expandedWorkspaces,
      expandedGroupConversations,
      siderCollapsed,
    });
  }, [groupedHistory, expandedGroupConversations, expandedWorkspaces, siderCollapsed]);
};
