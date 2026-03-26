import type { GroupedHistoryResult } from '../types';

type VisibleConversationOrderInput = GroupedHistoryResult & {
  expandedWorkspaces: string[];
  expandedDiscussionGroups: string[];
  siderCollapsed: boolean;
};

export const buildVisibleConversationIds = ({
  pinnedConversations,
  timelineSections,
  discussionChildConversationsByParentId,
  expandedWorkspaces,
  expandedDiscussionGroups,
  siderCollapsed,
}: VisibleConversationOrderInput): string[] => {
  const expandedWorkspaceSet = new Set(expandedWorkspaces);
  const expandedDiscussionGroupSet = new Set(expandedDiscussionGroups);
  const visibleConversationIds: string[] = [];
  const appendDiscussionChildren = (conversationId: string) => {
    if (!siderCollapsed && !expandedDiscussionGroupSet.has(conversationId)) {
      return;
    }

    const childConversations = discussionChildConversationsByParentId[conversationId] ?? [];
    childConversations.forEach((conversation) => {
      visibleConversationIds.push(conversation.id);
    });
  };

  pinnedConversations.forEach((conversation) => {
    visibleConversationIds.push(conversation.id);
    appendDiscussionChildren(conversation.id);
  });

  timelineSections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type === 'conversation' && item.conversation) {
        visibleConversationIds.push(item.conversation.id);
        appendDiscussionChildren(item.conversation.id);
        return;
      }

      if (item.type === 'workspace' && item.workspaceGroup) {
        if (!siderCollapsed && !expandedWorkspaceSet.has(item.workspaceGroup.workspace)) {
          return;
        }

        item.workspaceGroup.conversations.forEach((conversation) => {
          visibleConversationIds.push(conversation.id);
          appendDiscussionChildren(conversation.id);
        });
      }
    });
  });

  return visibleConversationIds;
};
