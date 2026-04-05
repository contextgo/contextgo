/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextGoModal } from '@/renderer/components/base';
import DirectorySelectionModal from '@/renderer/components/settings/DirectorySelectionModal';
import { getLastDirectoryName } from '@/renderer/utils/workspace/workspace';
import { Button } from '@arco-design/web-react';
import { AlarmClock, FolderOpen } from '@icon-park/react';
import React from 'react';
import type { TFunction } from 'i18next';

type MigrationModalProps = {
  workspace: string;
  t: TFunction;
  // Migration modal
  showMigrationModal: boolean;
  handleCloseMigrationModal: () => void;
  handleSelectFolder: () => void;
  selectedTargetPath: string;
  migrationLoading: boolean;
  handleMigrationConfirm: () => void;
  // Cron migration modal
  showCronMigrationPrompt: boolean;
  executeMigration: (withCron: boolean) => void;
  // Directory selection modal (WebUI)
  showDirectorySelector: boolean;
  handleSelectDirectoryFromModal: (paths: string[]) => void;
  closeDirectorySelector: () => void;
  // Host file selector (WebUI)
  showHostFileSelector: boolean;
  handleHostFileSelected: (
    paths: string[] | undefined,
    handler: (files: Array<{ name: string; path: string }>) => Promise<void>
  ) => void;
  setShowHostFileSelector: (v: boolean) => void;
  handleFilesToAdd: (files: Array<{ name: string; path: string }>) => Promise<void>;
};

/** Combined migration modals: workspace migration, cron migration prompt, and directory selection. */
const MigrationModal: React.FC<MigrationModalProps> = ({
  workspace,
  t,
  showMigrationModal,
  handleCloseMigrationModal,
  handleSelectFolder,
  selectedTargetPath,
  migrationLoading,
  handleMigrationConfirm,
  showCronMigrationPrompt,
  executeMigration,
  showDirectorySelector,
  handleSelectDirectoryFromModal,
  closeDirectorySelector,
  showHostFileSelector,
  handleHostFileSelected,
  setShowHostFileSelector,
  handleFilesToAdd,
}) => {
  return (
    <>
      {/* Workspace Migration Modal */}
      <ContextGoModal
        visible={showMigrationModal}
        onCancel={handleCloseMigrationModal}
        className='workspace-migration-modal'
        header={{
          title: t('conversation.workspace.migration.title'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={null}
        style={{ width: 'min(560px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='w-full py-8px'>
          {/* Current workspace info */}
          <div className='mb-16px text-14px text-t-secondary'>
            {t('conversation.workspace.migration.currentWorkspaceLabel')}
            <span className='font-mono'>/{getLastDirectoryName(workspace)}</span>
          </div>

          {/* Target folder selection card */}
          <div className='mb-16px rounded-18px border border-b-base bg-fill-1 p-16px shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
            <div className='mb-8px text-14px text-t-primary'>
              {t('conversation.workspace.migration.moveToNewFolder')}
            </div>
            <div
              className='flex cursor-pointer items-center justify-between rounded-14px border border-b-base bg-base px-14px py-12px transition-colors hover:bg-fill-1'
              onClick={handleSelectFolder}
            >
              <span className={`text-14px ${selectedTargetPath ? 'text-t-primary' : 'text-t-secondary'}`}>
                {selectedTargetPath || t('conversation.workspace.migration.selectFolder')}
              </span>
              <FolderOpen theme='outline' size='18' fill='currentColor' className='text-t-secondary' />
            </div>
          </div>

          {/* Hint */}
          <div className='mb-20px flex items-center gap-8px text-14px text-t-secondary'>
            <span>💡</span>
            <span>{t('conversation.workspace.migration.hint')}</span>
          </div>

          {/* Button area */}
          <div className='flex gap-12px justify-end'>
            <Button onClick={handleCloseMigrationModal} disabled={migrationLoading} className='min-w-88px px-18px'>
              {t('common.cancel')}
            </Button>
            <Button
              type='primary'
              loading={migrationLoading}
              onClick={handleMigrationConfirm}
              disabled={!selectedTargetPath}
              className='min-w-104px px-18px'
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </ContextGoModal>

      {/* Cron Migration Modal */}
      <ContextGoModal
        visible={showCronMigrationPrompt}
        onCancel={handleCloseMigrationModal}
        className='cron-migration-modal'
        header={{
          title: t('conversation.workspace.migration.cronMigrationTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={null}
        style={{ width: 'min(520px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='w-full py-8px'>
          <div className='mb-16px flex items-center gap-12px rounded-18px border border-b-base bg-fill-1 p-16px shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
            <div className='flex h-40px w-40px items-center justify-center rounded-full bg-primary-light-1'>
              <AlarmClock theme='outline' size='22' fill='rgb(var(--primary-6))' />
            </div>
            <div className='flex-1'>
              <div className='mb-4px text-15px font-medium text-t-primary'>
                {t('conversation.workspace.migration.cronMigrationTitle')}
              </div>
              <div className='text-13px text-t-secondary'>
                {t('conversation.workspace.migration.cronMigrationHint')}
              </div>
            </div>
          </div>

          <div className='flex gap-12px justify-end'>
            <Button onClick={() => executeMigration(false)} disabled={migrationLoading} className='min-w-96px px-18px'>
              {t('conversation.workspace.migration.cronMigrationSkip')}
            </Button>
            <Button
              type='primary'
              loading={migrationLoading}
              onClick={() => executeMigration(true)}
              className='min-w-108px px-18px'
            >
              {t('conversation.workspace.migration.cronMigrationConfirm')}
            </Button>
          </div>
        </div>
      </ContextGoModal>

      {/* Directory Selection Modal (for WebUI only) */}
      <DirectorySelectionModal
        visible={showDirectorySelector}
        onConfirm={handleSelectDirectoryFromModal}
        onCancel={closeDirectorySelector}
      />

      {/* Host File Selection Modal (for WebUI workspace + button) */}
      <DirectorySelectionModal
        visible={showHostFileSelector}
        isFileMode
        onConfirm={(paths) => handleHostFileSelected(paths, handleFilesToAdd)}
        onCancel={() => setShowHostFileSelector(false)}
      />
    </>
  );
};

export default MigrationModal;
