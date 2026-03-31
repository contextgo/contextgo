/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Message } from '@arco-design/web-react';
import { emitter } from '@/renderer/utils/emitter';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import type { TChatConversation } from '@/common/config/storage';
import { syncGroupFamilyWorkspace } from '@/renderer/pages/conversation/utils/groupWorkspace';

export type WorkspaceEventPrefix = 'gemini' | 'acp' | 'codex';

/**
 * Hook to select a new workspace directory for the current conversation.
 * 选择会话新的工作空间目录的 Hook。
 */
export const useWorkspaceSelector = (conversationId: string, eventPrefix: WorkspaceEventPrefix) => {
  const { mutate } = useSWRConfig();
  const { t } = useTranslation();

  return useCallback(async () => {
    try {
      // 选择新的工作空间目录 / Prompt user to pick a new workspace directory
      const files = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
      const workspacePath = files?.[0];
      if (!workspacePath) {
        return;
      }

      // 获取最新的会话数据 / Fetch latest conversation data
      const conversation = (await ipcBridge.conversation.get.invoke({
        id: conversationId,
      })) as TChatConversation | null;
      if (!conversation) {
        Message.error(t('common.saveFailed'));
        return;
      }

      const updatedConversations = await syncGroupFamilyWorkspace(conversation, workspacePath);
      const currentConversation = updatedConversations.find((item) => item.id === conversationId) ?? {
        ...conversation,
        extra: {
          ...conversation.extra,
          workspace: workspacePath,
          customWorkspace: true,
        },
      };

      // 手动刷新 SWR 缓存以及广播给工作区和会话列表 / Refresh SWR cache and notify workspace/history
      await mutate(`conversation/${conversationId}`, currentConversation, false);
      emitter.emit(`${eventPrefix}.workspace.refresh`);
      emitter.emit('chat.history.refresh');
      Message.success(t('common.saveSuccess'));
    } catch (error) {
      console.error('Failed to select workspace:', error);
      Message.error(t('common.saveFailed'));
    }
  }, [conversationId, eventPrefix, mutate, t]);
};
