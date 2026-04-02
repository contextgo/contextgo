/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { emitter } from '@/renderer/utils/emitter';
import { blockMobileInputFocus, blurActiveElement } from '@/renderer/utils/ui/focus';
import { Message } from '@arco-design/web-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useConversationTabs } from '../../hooks/ConversationTabsContext';
import type { DeleteConversationModalState } from '../types';
import { isConversationPinned } from '../utils/groupingHelpers';

type UseConversationActionsParams = {
  batchMode: boolean;
  onSessionClick?: () => void;
  onBatchModeChange?: (value: boolean) => void;
  selectedConversationIds: Set<string>;
  setSelectedConversationIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelectedConversation: (conversation: TChatConversation) => void;
  markAsRead: (conversationId: string) => void;
};

export const useConversationActions = ({
  batchMode,
  onSessionClick,
  onBatchModeChange,
  selectedConversationIds,
  setSelectedConversationIds,
  toggleSelectedConversation,
  markAsRead,
}: UseConversationActionsParams) => {
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameModalName, setRenameModalName] = useState<string>('');
  const [renameModalId, setRenameModalId] = useState<string | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);
  const [dropdownVisibleId, setDropdownVisibleId] = useState<string | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<DeleteConversationModalState>(null);
  const [deleteModalDeleting, setDeleteModalDeleting] = useState(false);
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTab, updateTabName } = useConversationTabs();

  useEffect(() => {
    if (batchMode) {
      setDropdownVisibleId(null);
    }
  }, [batchMode]);

  const handleConversationClick = useCallback(
    (conversation: TChatConversation) => {
      setDropdownVisibleId(null);
      if (batchMode) {
        toggleSelectedConversation(conversation);
        return;
      }
      blockMobileInputFocus();
      blurActiveElement();

      markAsRead(conversation.id);

      openTab(conversation);
      void navigate(`/conversation/${conversation.id}`);
      if (onSessionClick) {
        onSessionClick();
      }
    },
    [batchMode, toggleSelectedConversation, markAsRead, navigate, onSessionClick, openTab]
  );

  const removeConversation = useCallback(
    async (conversationId: string) => {
      const conversation = await ipcBridge.conversation.get.invoke({ id: conversationId });
      const deletedConversationIds =
        conversation?.type === 'group'
          ? [conversation.id, ...conversation.extra.participants.map((participant) => participant.childConversationId)]
          : [conversationId];

      const success = await ipcBridge.conversation.remove.invoke({ id: conversationId });
      if (!success) {
        return false;
      }

      deletedConversationIds.forEach((deletedId) => {
        emitter.emit('conversation.deleted', deletedId);
      });
      if (id && deletedConversationIds.includes(id)) {
        void navigate('/');
      }
      return true;
    },
    [id, navigate]
  );

  const handleDeleteClick = useCallback(
    (conversationId: string) => {
      setDropdownVisibleId(null);
      void (async () => {
        try {
          const conversation = await ipcBridge.conversation.get.invoke({ id: conversationId });
          if (!conversation) {
            Message.error(t('conversation.history.deleteFailed'));
            return;
          }
          setDeleteModalState({ kind: 'single', conversation });
        } catch (error) {
          console.error('Failed to prepare delete conversation modal:', error);
          Message.error(t('conversation.history.deleteFailed'));
        }
      })();
    },
    [t]
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedConversationIds.size === 0) {
      Message.warning(t('conversation.history.batchNoSelection'));
      return;
    }

    setDropdownVisibleId(null);
    setDeleteModalState({ kind: 'batch', count: selectedConversationIds.size });
  }, [selectedConversationIds, t]);

  const handleDeleteModalCancel = useCallback(() => {
    if (deleteModalDeleting) {
      return;
    }
    setDeleteModalState(null);
  }, [deleteModalDeleting]);

  const handleDeleteModalConfirm = useCallback(async () => {
    if (!deleteModalState) {
      return;
    }

    setDeleteModalDeleting(true);

    try {
      if (deleteModalState.kind === 'batch') {
        const selectedIds = Array.from(selectedConversationIds);
        if (selectedIds.length === 0) {
          Message.warning(t('conversation.history.batchNoSelection'));
          return;
        }

        const results = await Promise.all(selectedIds.map((conversationId) => removeConversation(conversationId)));
        const successCount = results.filter(Boolean).length;
        emitter.emit('chat.history.refresh');

        if (successCount > 0) {
          Message.success(t('conversation.history.batchDeleteSuccess', { count: successCount }));
        } else {
          Message.error(t('conversation.history.deleteFailed'));
        }

        setSelectedConversationIds(new Set());
        onBatchModeChange?.(false);
        return;
      }

      const success = await removeConversation(deleteModalState.conversation.id);
      if (success) {
        emitter.emit('chat.history.refresh');
        Message.success(t('conversation.history.deleteSuccess'));
      } else {
        Message.error(t('conversation.history.deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to remove conversation:', error);
      Message.error(t('conversation.history.deleteFailed'));
    } finally {
      setDeleteModalDeleting(false);
      setDeleteModalState(null);
    }
  }, [deleteModalState, onBatchModeChange, removeConversation, selectedConversationIds, setSelectedConversationIds, t]);

  const handleEditStart = useCallback((conversation: TChatConversation) => {
    setRenameModalId(conversation.id);
    setRenameModalName(conversation.name);
    setRenameModalVisible(true);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameModalId || !renameModalName.trim()) return;

    setRenameLoading(true);
    try {
      const success = await ipcBridge.conversation.update.invoke({
        id: renameModalId,
        updates: { name: renameModalName.trim() },
      });

      if (success) {
        updateTabName(renameModalId, renameModalName.trim());
        emitter.emit('chat.history.refresh');
        setRenameModalVisible(false);
        setRenameModalId(null);
        setRenameModalName('');
        Message.success(t('conversation.history.renameSuccess'));
      } else {
        Message.error(t('conversation.history.renameFailed'));
      }
    } catch (error) {
      console.error('Failed to update conversation name:', error);
      Message.error(t('conversation.history.renameFailed'));
    } finally {
      setRenameLoading(false);
    }
  }, [renameModalId, renameModalName, updateTabName, t]);

  const handleRenameCancel = useCallback(() => {
    setRenameModalVisible(false);
    setRenameModalId(null);
    setRenameModalName('');
  }, []);

  const handleTogglePin = useCallback(
    async (conversation: TChatConversation) => {
      const pinned = isConversationPinned(conversation);

      try {
        const success = await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: {
            extra: {
              pinned: !pinned,
              pinnedAt: pinned ? undefined : Date.now(),
            } as Partial<TChatConversation['extra']>,
          } as Partial<TChatConversation>,
          mergeExtra: true,
        });

        if (success) {
          emitter.emit('chat.history.refresh');
        } else {
          Message.error(t('conversation.history.pinFailed'));
        }
      } catch (error) {
        console.error('Failed to toggle pin conversation:', error);
        Message.error(t('conversation.history.pinFailed'));
      }
    },
    [t]
  );

  const handleArchiveConversation = useCallback(
    async (conversation: TChatConversation) => {
      try {
        const success = await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: {
            extra: {
              archived: true,
              archivedAt: Date.now(),
            } as Partial<TChatConversation['extra']>,
          } as Partial<TChatConversation>,
          mergeExtra: true,
        });

        if (success) {
          emitter.emit('chat.history.refresh');
          Message.success(t('conversation.history.archiveSuccess'));
        } else {
          Message.error(t('conversation.history.archiveFailed'));
        }
      } catch (error) {
        console.error('Failed to archive conversation:', error);
        Message.error(t('conversation.history.archiveFailed'));
      }
    },
    [t]
  );

  const handleMenuVisibleChange = useCallback((conversationId: string, visible: boolean) => {
    setDropdownVisibleId(visible ? conversationId : null);
  }, []);

  const handleOpenMenu = useCallback((conversation: TChatConversation) => {
    setDropdownVisibleId(conversation.id);
  }, []);

  return {
    renameModalVisible,
    renameModalName,
    setRenameModalName,
    renameLoading,
    dropdownVisibleId,
    deleteModalState,
    deleteModalDeleting,
    handleConversationClick,
    handleDeleteClick,
    handleBatchDelete,
    handleDeleteModalCancel,
    handleDeleteModalConfirm,
    handleEditStart,
    handleRenameConfirm,
    handleRenameCancel,
    handleTogglePin,
    handleArchiveConversation,
    handleMenuVisibleChange,
    handleOpenMenu,
  };
};
