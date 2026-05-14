import type { GroupedHistoryResult } from '../types';

type VisibleConversationOrderInput = GroupedHistoryResult & {
  expandedWorkspaces: string[];
  expandedGroupConversations: string[];
  siderCollapsed: boolean;
};

export const buildVisibleConversationIds = ({
  pinnedConversations,
  timelineSections,
  groupChildConversationsByParentId,
  expandedWorkspaces,
  expandedGroupConversations,
  siderCollapsed,
}: VisibleConversationOrderInput): string[] => {
  const expandedWorkspaceSet = new Set(expandedWorkspaces);
  const expandedGroupConversationSet = new Set(expandedGroupConversations);
  const visibleConversationIds: string[] = [];
  const appendGroupChildren = (conversationId: string) => {
    if (!siderCollapsed && !expandedGroupConversationSet.has(conversationId)) {
      return;
    }

    const childConversations = groupChildConversationsByParentId[conversationId] ?? [];
    childConversations.forEach((conversation) => {
      visibleConversationIds.push(conversation.id);
    });
  };

  pinnedConversations.forEach((conversation) => {
    visibleConversationIds.push(conversation.id);
    appendGroupChildren(conversation.id);
  });

  timelineSections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type === 'conversation' && item.conversation) {
        visibleConversationIds.push(item.conversation.id);
        appendGroupChildren(item.conversation.id);
        return;
      }

      if (item.type === 'workspace' && item.workspaceGroup) {
        if (!siderCollapsed && !expandedWorkspaceSet.has(item.workspaceGroup.workspace)) {
          return;
        }

        item.workspaceGroup.conversations.forEach((conversation) => {
          visibleConversationIds.push(conversation.id);
          appendGroupChildren(conversation.id);
        });
      }
    });
  });

  return visibleConversationIds;
};
