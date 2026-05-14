/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextGoModal } from '@/renderer/components/base';
import { Button, Input } from '@arco-design/web-react';
import React from 'react';
import type { TFunction } from 'i18next';
import type { RenameModalState, DeleteModalState } from '../types';

type WorkspaceDialogsProps = {
  t: TFunction;
  // Rename modal
  renameModal: RenameModalState;
  setRenameModal: React.Dispatch<React.SetStateAction<RenameModalState>>;
  closeRenameModal: () => void;
  handleRenameConfirm: () => void;
  renameLoading: boolean;
  // Delete modal
  deleteModal: DeleteModalState;
  closeDeleteModal: () => void;
  handleDeleteConfirm: () => void;
};

/** Combined rename and delete confirmation modals. */
const WorkspaceDialogs: React.FC<WorkspaceDialogsProps> = ({
  t,
  renameModal,
  setRenameModal,
  closeRenameModal,
  handleRenameConfirm,
  renameLoading,
  deleteModal,
  closeDeleteModal,
  handleDeleteConfirm,
}) => {
  return (
    <>
      {/* Rename Modal */}
      <ContextGoModal
        visible={renameModal.visible}
        onCancel={closeRenameModal}
        className='workspace-rename-modal'
        header={{
          title: t('conversation.workspace.contextMenu.renameTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={closeRenameModal} className='min-w-88px px-18px'>
                {t('common.cancel')}
              </Button>
              <Button
                type='primary'
                loading={renameLoading}
                onClick={() => void handleRenameConfirm()}
                className='min-w-104px px-18px'
              >
                {t('common.confirm')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(520px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <Input
          autoFocus
          value={renameModal.value}
          onChange={(value) => setRenameModal((prev) => ({ ...prev, value }))}
          onPressEnter={handleRenameConfirm}
          placeholder={t('conversation.workspace.contextMenu.renamePlaceholder')}
        />
      </ContextGoModal>

      {/* Delete Modal */}
      <ContextGoModal
        visible={deleteModal.visible}
        onCancel={closeDeleteModal}
        className='workspace-delete-modal'
        header={{
          title: t('conversation.workspace.contextMenu.deleteTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={closeDeleteModal} className='min-w-88px px-18px'>
                {t('common.cancel')}
              </Button>
              <Button
                type='primary'
                status='danger'
                loading={deleteModal.loading}
                onClick={() => void handleDeleteConfirm()}
                className='min-w-104px px-18px'
              >
                {t('common.confirm')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(500px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='text-14px text-t-secondary'>{t('conversation.workspace.contextMenu.deleteConfirm')}</div>
      </ContextGoModal>
    </>
  );
};

export default WorkspaceDialogs;
