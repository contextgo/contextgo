/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ProcessChat } from '@process/utils/initStorage';
import type { TChatConversation } from '@/common/config/storage';
import { migrateConversationToDatabase } from './migrationUtils';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';

type DiscussionGroupParticipantLike = {
  id: string;
  name: string;
  avatar?: string;
  childConversationId: string;
};

const getConversationWorkingDirectory = (conversation: TChatConversation): string | undefined =>
  conversation.extra?.workingDirectory || conversation.extra?.workspace;

const isVisibleConversation = (conversation: TChatConversation): boolean => {
  const extra = conversation.extra as
    | {
        isHealthCheck?: boolean;
        groupMeta?: { hiddenFromHistory?: boolean; parentGroupId?: string };
      }
    | undefined;

  if (extra?.isHealthCheck === true) {
    return false;
  }

  // Discussion children are hidden from top-level history rendering, but still need
  // to reach the renderer so the sidebar can nest them under the parent discussion group.
  if (extra?.groupMeta?.hiddenFromHistory === true && !extra.groupMeta.parentGroupId) {
    return false;
  }

  return true;
};

const normalizeDiscussionFamilyConversations = async (
  conversations: TChatConversation[],
  repo: IConversationRepository
): Promise<TChatConversation[]> => {
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation] as const));
  const repairedConversationById = new Map<string, TChatConversation>();
  const repairTasks: Array<Promise<void>> = [];

  conversations.forEach((conversation) => {
    if (conversation.type !== 'group') {
      return;
    }

    const participants = (
      (conversation.extra as { participants?: DiscussionGroupParticipantLike[] } | undefined)?.participants ?? []
    ).filter((participant): participant is DiscussionGroupParticipantLike => Boolean(participant?.childConversationId));

    participants.forEach((participant) => {
      const childConversation = conversationById.get(participant.childConversationId);
      if (!childConversation) {
        return;
      }

      const childExtra = childConversation.extra as
        | {
            spaceId?: string;
            mountId?: string;
            workingDirectory?: string;
            workspace?: string;
            customWorkspace?: boolean;
            groupMeta?: {
              parentGroupId?: string;
              participantId?: string;
              participantName?: string;
              participantAvatar?: string;
              hiddenFromHistory?: boolean;
            };
          }
        | undefined;

      const expectedSpaceId = conversation.extra.spaceId;
      const expectedMountId = conversation.extra.mountId;
      const expectedWorkingDirectory = getConversationWorkingDirectory(conversation);
      const expectedWorkspace = conversation.extra.workspace;
      const expectedCustomWorkspace = conversation.extra.customWorkspace;
      const expectedParentGroupId = conversation.id;
      const expectedParticipantId = participant.id;
      const expectedParticipantName = participant.name;
      const expectedParticipantAvatar = participant.avatar;

      const needsRepair =
        childExtra?.spaceId !== expectedSpaceId ||
        childExtra?.mountId !== expectedMountId ||
        childExtra?.workingDirectory !== expectedWorkingDirectory ||
        childExtra?.workspace !== expectedWorkspace ||
        childExtra?.customWorkspace !== expectedCustomWorkspace ||
        childExtra?.groupMeta?.parentGroupId !== expectedParentGroupId ||
        childExtra?.groupMeta?.participantId !== expectedParticipantId ||
        childExtra?.groupMeta?.participantName !== expectedParticipantName ||
        childExtra?.groupMeta?.participantAvatar !== expectedParticipantAvatar ||
        childExtra?.groupMeta?.hiddenFromHistory !== true;

      if (!needsRepair) {
        return;
      }

      const repairedConversation = {
        ...childConversation,
        extra: {
          ...childConversation.extra,
          spaceId: expectedSpaceId,
          mountId: expectedMountId,
          workingDirectory: expectedWorkingDirectory,
          workspace: expectedWorkspace,
          customWorkspace: expectedCustomWorkspace,
          groupMeta: {
            ...childExtra?.groupMeta,
            parentGroupId: expectedParentGroupId,
            participantId: expectedParticipantId,
            participantName: expectedParticipantName,
            participantAvatar: expectedParticipantAvatar,
            hiddenFromHistory: true,
          },
        },
      } as TChatConversation;

      repairedConversationById.set(repairedConversation.id, repairedConversation);
      repairTasks.push(
        repo.updateConversation(repairedConversation.id, {
          extra: repairedConversation.extra,
        })
      );
    });
  });

  if (repairTasks.length > 0) {
    await Promise.allSettled(repairTasks);
  }

  if (repairedConversationById.size === 0) {
    return conversations;
  }

  return conversations.map((conversation) => repairedConversationById.get(conversation.id) ?? conversation);
};

export function initDatabaseBridge(repo: IConversationRepository): void {
  // Get conversation messages from database
  ipcBridge.database.getConversationMessages.provider(async ({ conversation_id, page = 0, pageSize = 10000 }) => {
    try {
      const result = await repo.getMessages(conversation_id, page, pageSize);
      return result.data;
    } catch (error) {
      console.error('[DatabaseBridge] Error getting conversation messages:', error);
      return [];
    }
  });

  // Get user conversations from database with lazy migration from file storage
  ipcBridge.database.getUserConversations.provider(async ({ page = 0, pageSize = 10000 }) => {
    try {
      const result = await repo.getUserConversations(undefined, page * pageSize, pageSize);
      const dbConversations = result.data;

      // Try to get conversations from file storage
      let fileConversations: TChatConversation[] = [];
      try {
        fileConversations = (await ProcessChat.get('chat.history')) || [];
      } catch (error) {
        console.warn('[DatabaseBridge] No file-based conversations found:', error);
      }

      // Use database conversations as the primary source while backfilling missing ones from file storage
      // 以数据库结果为主，只补充文件中尚未迁移的会话，避免删除后出现"只剩更早记录"的问题
      // Build a map for fast lookup to avoid duplicates when merging
      const dbConversationMap = new Map(dbConversations.map((conv) => [conv.id, conv] as const));

      // Filter out conversations that already exist in database
      // 只保留文件里数据库没有的会话，确保不会重复
      const fileOnlyConversations = fileConversations.filter((conv) => !dbConversationMap.has(conv.id));

      // If there are conversations that only exist in file storage, migrate them in background
      // 对剩余会话做懒迁移，保证后续刷新直接使用数据库
      if (fileOnlyConversations.length > 0) {
        void Promise.all(fileOnlyConversations.map((conv) => migrateConversationToDatabase(conv)));
      }

      // Combine database conversations (source of truth) with any remaining file-only conversations
      // 返回数据库结果 + 未迁移会话，这样"今天"与"更早"记录都能稳定展示
      const mergedConversations = [...dbConversations, ...fileOnlyConversations];
      const normalizedConversations = await normalizeDiscussionFamilyConversations(mergedConversations, repo);
      const allConversations = normalizedConversations.filter(isVisibleConversation);
      // Re-sort by modifyTime (or createTime as fallback) to maintain correct order
      allConversations.sort((a, b) => (b.modifyTime || b.createTime || 0) - (a.modifyTime || a.createTime || 0));
      return allConversations;
    } catch (error) {
      console.error('[DatabaseBridge] Error getting user conversations:', error);
      return [];
    }
  });

  ipcBridge.database.searchConversationMessages.provider(async ({ keyword, page = 0, pageSize = 20 }) => {
    try {
      const result = await repo.searchMessages(keyword, page, pageSize);
      return result;
    } catch (error) {
      console.error('[DatabaseBridge] Error searching conversation messages:', error);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  });
}
