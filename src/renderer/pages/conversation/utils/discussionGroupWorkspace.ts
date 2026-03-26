/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';

type GroupConversation = Extract<TChatConversation, { type: 'group' }>;

const getDiscussionParentGroupId = (conversation: TChatConversation): string | undefined => {
  const extra = conversation.extra as
    | {
        groupMeta?: { parentGroupId?: string };
      }
    | undefined;

  const parentGroupId = extra?.groupMeta?.parentGroupId;
  return typeof parentGroupId === 'string' && parentGroupId.length > 0 ? parentGroupId : undefined;
};

export const isDiscussionFamilyConversation = (conversation: TChatConversation): boolean => {
  return conversation.type === 'group' || Boolean(getDiscussionParentGroupId(conversation));
};

const buildWorkspaceUpdatedConversation = (conversation: TChatConversation, workspace: string): TChatConversation => {
  return {
    ...conversation,
    extra: {
      ...conversation.extra,
      workspace,
      customWorkspace: true,
    },
  } as TChatConversation;
};

const updateConversationWorkspace = async (conversation: TChatConversation, workspace: string): Promise<TChatConversation> => {
  const success = await ipcBridge.conversation.update.invoke({
    id: conversation.id,
    updates: {
      extra: {
        workspace,
        customWorkspace: true,
      } as Partial<TChatConversation['extra']>,
    } as Partial<TChatConversation>,
    mergeExtra: true,
  });

  if (!success) {
    throw new Error(`Failed to update workspace for conversation ${conversation.id}`);
  }

  return buildWorkspaceUpdatedConversation(conversation, workspace);
};

const loadDiscussionGroupConversation = async (conversation: TChatConversation): Promise<GroupConversation | null> => {
  if (conversation.type === 'group') {
    return conversation;
  }

  const parentGroupId = getDiscussionParentGroupId(conversation);
  if (!parentGroupId) {
    return null;
  }

  const parentConversation = await ipcBridge.conversation.get.invoke({ id: parentGroupId });
  return parentConversation?.type === 'group' ? parentConversation : null;
};

const loadDiscussionFamilyConversations = async (conversation: TChatConversation): Promise<TChatConversation[]> => {
  const groupConversation = await loadDiscussionGroupConversation(conversation);
  if (!groupConversation) {
    return [conversation];
  }

  const childConversations = await Promise.all(
    groupConversation.extra.participants.map(async (participant) => {
      try {
        return await ipcBridge.conversation.get.invoke({ id: participant.childConversationId });
      } catch {
        return null;
      }
    })
  );

  return [groupConversation, ...childConversations.filter((item): item is TChatConversation => item !== null)];
};

export const syncDiscussionFamilyWorkspace = async (
  conversation: TChatConversation,
  workspace: string
): Promise<TChatConversation[]> => {
  const familyConversations = await loadDiscussionFamilyConversations(conversation);
  return Promise.all(familyConversations.map((item) => updateConversationWorkspace(item, workspace)));
};
