/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { emitter } from '@/renderer/utils/emitter';
import { useScheduleJobs } from '@/renderer/pages/schedule/useScheduleJobs';
import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import type { MessageApi } from '../types';
import { collectFilePaths } from '../utils/treeHelpers';
import { isGroupFamilyConversation, syncGroupFamilyWorkspace } from '../../utils/groupWorkspace';

type UseWorkspaceMigrationParams = {
  conversation_id: string;
  workspace: string;
  messageApi: MessageApi;
  t: TFunction;
  isTemporaryWorkspace: boolean;
};

/**
 * Manages all workspace migration logic: modal state, directory selection,
 * cron migration prompt, and the migration execution flow.
 */
export function useWorkspaceMigration({
  conversation_id,
  workspace,
  messageApi,
  t,
  isTemporaryWorkspace,
}: UseWorkspaceMigrationParams) {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();

  // Migration modal state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showDirectorySelector, setShowDirectorySelector] = useState(false);
  const [selectedTargetPath, setSelectedTargetPath] = useState('');
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [showScheduleMigrationPrompt, setShowScheduleMigrationPrompt] = useState(false);

  // Cron jobs hook
  const { jobs, loading: scheduleLoading } = useScheduleJobs(conversation_id);

  const handleOpenMigrationModal = useCallback(() => {
    setShowMigrationModal(true);
  }, []);

  const handleOpenWorkspaceRoot = useCallback(async () => {
    try {
      await ipcBridge.shell.showItemInFolder.invoke(workspace);
    } catch (_error) {
      messageApi.error(t('conversation.workspace.contextMenu.revealFailed'));
    }
  }, [messageApi, t, workspace]);

  // Handle directory selection from DirectorySelectionModal (webui)
  const handleSelectDirectoryFromModal = useCallback((paths: string[] | undefined) => {
    setShowDirectorySelector(false);
    if (paths && paths.length > 0) {
      setSelectedTargetPath(paths[0]);
    }
  }, []);

  // Handle folder selection - use native dialog on Electron, modal on webui
  const handleSelectFolder = useCallback(async () => {
    if (isElectronDesktop()) {
      // Electron: use native file dialog
      try {
        const openFiles = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
        if (openFiles && openFiles.length > 0) {
          setSelectedTargetPath(openFiles[0]);
        }
      } catch (_error) {
        console.error('Failed to open directory dialog:', _error);
        messageApi.error(t('conversation.workspace.migration.selectFolderError'));
      }
    } else {
      // WebUI: show directory selection modal
      setShowDirectorySelector(true);
    }
  }, [messageApi, t]);

  const executeMigration = useCallback(
    async (migrateSchedule: boolean) => {
      const targetWorkspace = selectedTargetPath.trim();
      setMigrationLoading(true);

      try {
        // Get current conversation data
        const conversations = await ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 10000 });
        const currentConversation = conversations?.find((conv) => conv.id === conversation_id);

        if (!currentConversation) {
          throw new Error('Current conversation not found');
        }

        // Get all files from the workspace
        const workspaceFiles = await ipcBridge.conversation.getWorkspace.invoke({
          conversation_id,
          workspace,
          path: workspace,
        });

        // Recursively collect all file paths
        const filePaths = collectFilePaths(workspaceFiles);

        // Copy all files to the target workspace
        if (filePaths.length > 0) {
          const copyResult = await ipcBridge.fs.copyFilesToWorkspace.invoke({
            filePaths,
            workspace: targetWorkspace,
            sourceRoot: workspace,
          });
          if (!copyResult?.success) {
            throw new Error(copyResult?.msg || 'Failed to copy workspace files');
          }
        }

        if (isGroupFamilyConversation(currentConversation)) {
          const updatedConversations = await syncGroupFamilyWorkspace(currentConversation, targetWorkspace);
          const updatedCurrentConversation = updatedConversations.find(
            (conversation) => conversation.id === conversation_id
          ) ?? {
            ...currentConversation,
            extra: {
              ...currentConversation.extra,
              workspace: targetWorkspace,
              customWorkspace: true,
            },
          };

          setShowMigrationModal(false);
          setShowScheduleMigrationPrompt(false);
          setSelectedTargetPath('');
          setMigrationLoading(false);

          await mutate(`conversation/${conversation_id}`, updatedCurrentConversation, false);
          emitter.emit('chat.history.refresh');
          messageApi.success(t('conversation.workspace.migration.success'));
          return;
        }

        // Create new conversation with the new workspace
        const newId = uuid();
        const newConversation = {
          ...currentConversation,
          id: newId,
          name: currentConversation.name,
          createTime: Date.now(),
          modifyTime: Date.now(),
          extra: {
            ...currentConversation.extra,
            workspace: targetWorkspace,
            customWorkspace: true,
          },
        } as typeof currentConversation;

        await ipcBridge.conversation.createWithConversation.invoke({
          conversation: newConversation,
          sourceConversationId: conversation_id,
          migrateSchedule,
          sourceWorkspace: workspace,
        });

        // Close modal and reset state
        setShowMigrationModal(false);
        setShowScheduleMigrationPrompt(false);
        setSelectedTargetPath('');
        setMigrationLoading(false);

        // Navigate to new conversation
        void navigate(`/conversation/${newId}`);
        emitter.emit('chat.history.refresh');
        messageApi.success(t('conversation.workspace.migration.success'));
      } catch (error) {
        console.error('Failed to migrate workspace:', error);
        messageApi.error(t('conversation.workspace.migration.error'));
        setMigrationLoading(false);
      }
    },
    [selectedTargetPath, conversation_id, workspace, t, messageApi, navigate, mutate]
  );

  const handleMigrationConfirm = useCallback(async () => {
    if (!isTemporaryWorkspace) {
      messageApi.error(t('conversation.workspace.migration.error'));
      return;
    }

    const targetWorkspace = selectedTargetPath.trim();
    if (!targetWorkspace) {
      messageApi.error(t('conversation.workspace.migration.noTargetPath'));
      return;
    }

    if (targetWorkspace === workspace) {
      messageApi.warning(t('conversation.workspace.migration.selectFolderError'));
      return;
    }

    // Check if jobs are still loading
    if (scheduleLoading) {
      messageApi.info(t('common.loading'));
      return;
    }

    // Check for cron jobs before migrating
    if (jobs.length > 0) {
      setShowScheduleMigrationPrompt(true);
      return;
    }

    await executeMigration(false);
  }, [jobs, scheduleLoading, isTemporaryWorkspace, selectedTargetPath, workspace, t, messageApi, executeMigration]);

  const handleCloseMigrationModal = useCallback(() => {
    if (!migrationLoading) {
      setShowMigrationModal(false);
      setShowScheduleMigrationPrompt(false);
      setSelectedTargetPath('');
    }
  }, [migrationLoading]);

  return {
    // State
    showMigrationModal,
    showDirectorySelector,
    selectedTargetPath,
    migrationLoading,
    showScheduleMigrationPrompt,

    // Handlers
    handleOpenMigrationModal,
    handleOpenWorkspaceRoot,
    handleSelectDirectoryFromModal,
    handleSelectFolder,
    executeMigration,
    handleMigrationConfirm,
    handleCloseMigrationModal,

    // Directory selector close handler (for onCancel)
    closeDirectorySelector: useCallback(() => setShowDirectorySelector(false), []),
  };
}
