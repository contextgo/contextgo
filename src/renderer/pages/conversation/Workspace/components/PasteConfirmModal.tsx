/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextGoModal } from '@/renderer/components/base';
import { Button, Checkbox } from '@arco-design/web-react';
import { FileText, FolderOpen } from '@icon-park/react';
import React from 'react';
import type { TFunction } from 'i18next';
import type { PasteConfirmState, TargetFolderPath } from '../types';

type PasteConfirmModalProps = {
  pasteConfirm: PasteConfirmState;
  setPasteConfirm: React.Dispatch<React.SetStateAction<PasteConfirmState>>;
  closePasteConfirm: () => void;
  handlePasteConfirm: () => Promise<void>;
  targetFolderPath: TargetFolderPath;
  t: TFunction;
};

/** Modal for confirming file paste operations with file list and target folder display. */
const PasteConfirmModal: React.FC<PasteConfirmModalProps> = ({
  pasteConfirm,
  setPasteConfirm,
  closePasteConfirm,
  handlePasteConfirm,
  targetFolderPath,
  t,
}) => {
  return (
    <ContextGoModal
      visible={pasteConfirm.visible}
      onCancel={() => {
        closePasteConfirm();
      }}
      className='paste-confirm-modal'
      header={{ showClose: false }}
      footer={null}
      style={{ width: 'min(520px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '0' }}
    >
      <div className='px-24px py-20px'>
        {/* Title area */}
        <div className='flex items-center gap-12px mb-20px'>
          <div className='flex h-48px w-48px items-center justify-center rounded-full bg-primary-light-1'>
            <span className='app-icon-slot app-icon-slot--xl'>
              <FileText theme='outline' size='24' fill='rgb(var(--primary-6))' className='app-icon' />
            </span>
          </div>
          <div>
            <div className='text-16px font-semibold mb-4px'>{t('conversation.workspace.pasteConfirm_title')}</div>
            <div className='text-13px text-t-secondary'>
              {pasteConfirm.filesToPaste.length > 1
                ? t('conversation.workspace.pasteConfirm_multipleFiles', {
                    count: pasteConfirm.filesToPaste.length,
                  })
                : t('conversation.workspace.pasteConfirm_title')}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className='mb-20px rounded-18px border border-b-base bg-fill-1 px-14px py-16px shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
          <div className='flex items-start gap-12px mb-12px'>
            <span className='app-icon-slot app-icon-slot--lg mt-1px'>
              <FileText theme='outline' size='18' fill='var(--color-text-2)' className='app-icon' />
            </span>
            <div className='flex-1'>
              <div className='mb-4px text-13px text-t-secondary'>
                {t('conversation.workspace.pasteConfirm_fileName')}
              </div>
              <div className='text-14px font-medium break-all text-t-primary'>{pasteConfirm.fileName}</div>
            </div>
          </div>
          <div className='flex items-start gap-12px'>
            <span className='app-icon-slot app-icon-slot--lg mt-1px'>
              <FolderOpen theme='outline' size='18' fill='var(--color-text-2)' className='app-icon' />
            </span>
            <div className='flex-1'>
              <div className='mb-4px text-13px text-t-secondary'>
                {t('conversation.workspace.pasteConfirm_targetFolder')}
              </div>
              <div className='break-all font-mono text-14px font-medium text-primary-6'>
                {targetFolderPath.fullPath}
              </div>
            </div>
          </div>
        </div>

        {/* Checkbox area */}
        <div className='mb-20px'>
          <Checkbox
            checked={pasteConfirm.doNotAsk}
            onChange={(v) => setPasteConfirm((prev) => ({ ...prev, doNotAsk: v }))}
          >
            <span className='text-13px text-t-secondary'>{t('conversation.workspace.pasteConfirm_noAsk')}</span>
          </Checkbox>
        </div>

        {/* Button area */}
        <div className='flex gap-12px justify-end'>
          <Button
            onClick={() => {
              closePasteConfirm();
            }}
            className='min-w-88px px-18px'
          >
            {t('conversation.workspace.pasteConfirm_cancel')}
          </Button>
          <Button
            type='primary'
            onClick={async () => {
              await handlePasteConfirm();
            }}
            className='min-w-96px px-18px'
          >
            {t('conversation.workspace.pasteConfirm_paste')}
          </Button>
        </div>
      </div>
    </ContextGoModal>
  );
};

export default PasteConfirmModal;
