/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { getActivityTime, getTimelineLabel } from '@/renderer/utils/chat/timeline';
import { getWorkspaceDisplayName } from '@/renderer/utils/workspace/workspace';
import { getWorkspaceUpdateTime } from '@/renderer/utils/workspace/workspaceHistory';

import type {
  DiscussionChildConversationMap,
  GroupedHistoryResult,
  TimelineItem,
  TimelineSection,
  WorkspaceGroup,
} from '../types';
import { getConversationSortOrder } from './sortOrderHelpers';

export const getConversationTimelineLabel = (conversation: TChatConversation, t: (key: string) => string): string => {
  const time = getActivityTime(conversation);
  return getTimelineLabel(time, Date.now(), t);
};

export const isConversationPinned = (conversation: TChatConversation): boolean => {
  const extra = conversation.extra as { pinned?: boolean } | undefined;
  return Boolean(extra?.pinned);
};

const getDiscussionParentGroupId = (conversation: TChatConversation): string | undefined => {
  const extra = conversation.extra as
    | {
        groupMeta?: { parentGroupId?: string };
      }
    | undefined;
  const parentGroupId = extra?.groupMeta?.parentGroupId;
  return typeof parentGroupId === 'string' && parentGroupId.length > 0 ? parentGroupId : undefined;
};

export const getConversationPinnedAt = (conversation: TChatConversation): number => {
  const extra = conversation.extra as { pinnedAt?: number } | undefined;
  if (typeof extra?.pinnedAt === 'number') {
    return extra.pinnedAt;
  }
  return 0;
};

export const groupConversationsByTimelineAndWorkspace = (
  conversations: TChatConversation[],
  t: (key: string) => string
): TimelineSection[] => {
  const allWorkspaceGroups = new Map<string, TChatConversation[]>();
  const withoutWorkspaceConvs: TChatConversation[] = [];

  conversations.forEach((conv) => {
    const workspace = conv.extra?.workspace;
    const customWorkspace = conv.extra?.customWorkspace;

    if (customWorkspace && workspace) {
      if (!allWorkspaceGroups.has(workspace)) {
        allWorkspaceGroups.set(workspace, []);
      }
      allWorkspaceGroups.get(workspace)!.push(conv);
    } else {
      withoutWorkspaceConvs.push(conv);
    }
  });

  const workspaceGroupsByTimeline = new Map<string, WorkspaceGroup[]>();

  const getWorkspaceGroupDisplayName = (workspace: string, convList: TChatConversation[]) => {
    const openclawConversation = convList.find((conversation) => conversation.type === 'openclaw-gateway');
    const openclawAgentName =
      openclawConversation && typeof openclawConversation.extra?.agentName === 'string'
        ? openclawConversation.extra.agentName.trim()
        : '';

    if (openclawAgentName) {
      return openclawAgentName;
    }

    return getWorkspaceDisplayName(workspace);
  };

  allWorkspaceGroups.forEach((convList, workspace) => {
    const sortedConvs = [...convList].toSorted((a, b) => getActivityTime(b) - getActivityTime(a));
    const latestConv = sortedConvs[0];
    const timeline = getConversationTimelineLabel(latestConv, t);

    if (!workspaceGroupsByTimeline.has(timeline)) {
      workspaceGroupsByTimeline.set(timeline, []);
    }

    workspaceGroupsByTimeline.get(timeline)!.push({
      workspace,
      displayName: getWorkspaceGroupDisplayName(workspace, sortedConvs),
      conversations: sortedConvs,
    });
  });

  const withoutWorkspaceByTimeline = new Map<string, TChatConversation[]>();

  withoutWorkspaceConvs.forEach((conv) => {
    const timeline = getConversationTimelineLabel(conv, t);
    if (!withoutWorkspaceByTimeline.has(timeline)) {
      withoutWorkspaceByTimeline.set(timeline, []);
    }
    withoutWorkspaceByTimeline.get(timeline)!.push(conv);
  });

  const timelineOrder = [
    'conversation.history.today',
    'conversation.history.yesterday',
    'conversation.history.recent7Days',
    'conversation.history.earlier',
  ];
  const sections: TimelineSection[] = [];

  timelineOrder.forEach((timelineKey) => {
    const timeline = t(timelineKey);
    const withWorkspace = workspaceGroupsByTimeline.get(timeline) || [];
    const withoutWorkspace = withoutWorkspaceByTimeline.get(timeline) || [];

    if (withWorkspace.length === 0 && withoutWorkspace.length === 0) return;

    const items: TimelineItem[] = [];

    withWorkspace.forEach((group) => {
      const updateTime = getWorkspaceUpdateTime(group.workspace);
      const time = updateTime > 0 ? updateTime : getActivityTime(group.conversations[0]);
      items.push({
        type: 'workspace',
        time,
        workspaceGroup: group,
      });
    });

    withoutWorkspace.forEach((conv) => {
      items.push({
        type: 'conversation',
        time: getActivityTime(conv),
        conversation: conv,
      });
    });

    items.sort((a, b) => b.time - a.time);

    sections.push({
      timeline,
      items,
    });
  });

  return sections;
};

const buildDiscussionChildConversationMap = (
  conversations: TChatConversation[],
  discussionChildConversationsByParentId: DiscussionChildConversationMap
): DiscussionChildConversationMap => {
  const result: DiscussionChildConversationMap = {};

  conversations.forEach((conversation) => {
    const childConversations = discussionChildConversationsByParentId[conversation.id];
    if (!childConversations || childConversations.length === 0 || conversation.type !== 'group') {
      return;
    }

    const childConversationById = new Map(
      childConversations.map((childConversation) => [childConversation.id, childConversation])
    );
    const orderedChildConversations: TChatConversation[] = [];

    conversation.extra.participants.forEach((participant) => {
      const childConversation = childConversationById.get(participant.childConversationId);
      if (!childConversation) {
        return;
      }

      orderedChildConversations.push(childConversation);
      childConversationById.delete(participant.childConversationId);
    });

    const remainingChildConversations = [...childConversationById.values()].toSorted(
      (a, b) => getActivityTime(b) - getActivityTime(a)
    );

    result[conversation.id] = [...orderedChildConversations, ...remainingChildConversations];
  });

  return result;
};

export const buildGroupedHistory = (
  conversations: TChatConversation[],
  discussionChildConversationsByParentId: DiscussionChildConversationMap,
  t: (key: string) => string
): GroupedHistoryResult => {
  const topLevelConversations = conversations.filter((conversation) => !getDiscussionParentGroupId(conversation));

  const pinnedConversations = topLevelConversations
    .filter((conversation) => isConversationPinned(conversation))
    .toSorted((a, b) => {
      const orderA = getConversationSortOrder(a);
      const orderB = getConversationSortOrder(b);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return getConversationPinnedAt(b) - getConversationPinnedAt(a);
    });

  const normalConversations = topLevelConversations.filter((conversation) => !isConversationPinned(conversation));
  const orderedDiscussionChildConversationsByParentId = buildDiscussionChildConversationMap(
    topLevelConversations,
    discussionChildConversationsByParentId
  );

  return {
    pinnedConversations,
    timelineSections: groupConversationsByTimelineAndWorkspace(normalConversations, t),
    discussionChildConversationsByParentId: orderedDiscussionChildConversationsByParentId,
  };
};
