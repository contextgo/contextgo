/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextGoModal } from '@/renderer/components/base';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 关闭 Tab 确认状态
 * Close tab confirmation state
 */
export interface CloseTabConfirmState {
  /**
   * 是否显示确认对话框
   * Whether to show confirmation dialog
   */
  show: boolean;

  /**
   * 要关闭的 Tab ID
   * Tab ID to close
   */
  tabId: string | null;
}

/**
 * PreviewConfirmModals 组件属性
 * PreviewConfirmModals component props
 */
interface PreviewConfirmModalsProps {
  /**
   * 是否显示退出编辑确认对话框
   * Whether to show exit edit confirmation dialog
   */
  showExitConfirm: boolean;

  /**
   * 关闭 Tab 确认状态
   * Close tab confirmation state
   */
  closeTabConfirm: CloseTabConfirmState;

  /**
   * 确认退出编辑
   * Confirm exit edit
   */
  onConfirmExit: () => void;

  /**
   * 取消退出编辑
   * Cancel exit edit
   */
  onCancelExit: () => void;

  /**
   * 保存并关闭 Tab
   * Save and close tab
   */
  onSaveAndCloseTab: () => void;

  /**
   * 不保存直接关闭 Tab
   * Close tab without saving
   */
  onCloseWithoutSave: () => void;

  /**
   * 取消关闭 Tab
   * Cancel close tab
   */
  onCancelCloseTab: () => void;
}

/**
 * 预览面板确认对话框组件
 * Preview panel confirmation modals component
 *
 * 包含退出编辑确认和关闭 Tab 确认两个对话框
 * Contains exit edit confirmation and close tab confirmation dialogs
 */
const PreviewConfirmModals: React.FC<PreviewConfirmModalsProps> = ({
  showExitConfirm,
  closeTabConfirm,
  onConfirmExit,
  onCancelExit,
  onSaveAndCloseTab,
  onCloseWithoutSave,
  onCancelCloseTab,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 退出编辑确认对话框 / Exit edit confirmation modal */}
      <ContextGoModal
        visible={showExitConfirm}
        onCancel={onCancelExit}
        className='preview-exit-confirm-modal'
        header={{
          title: t('preview.unsavedChangesTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={onCancelExit} className='min-w-104px px-18px'>
                {t('preview.continueEdit')}
              </Button>
              <Button type='primary' onClick={onConfirmExit} className='min-w-104px px-18px'>
                {t('preview.confirmExit')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(460px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='text-14px text-t-secondary'>{t('preview.unsavedChangesMessage')}</div>
      </ContextGoModal>

      {/* 关闭tab确认对话框 / Close tab confirmation modal */}
      <ContextGoModal
        visible={closeTabConfirm.show}
        onCancel={onCancelCloseTab}
        className='preview-close-tab-modal'
        header={{
          title: t('preview.closeTabTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={onCancelCloseTab} className='min-w-88px px-18px'>
                {t('common.cancel')}
              </Button>
              <Button onClick={onCloseWithoutSave} className='min-w-120px px-18px'>
                {t('preview.closeWithoutSave')}
              </Button>
              <Button type='primary' onClick={onSaveAndCloseTab} className='min-w-120px px-18px'>
                {t('preview.saveAndClose')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(520px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='text-14px text-t-secondary'>{t('preview.closeTabMessage')}</div>
      </ContextGoModal>
    </>
  );
};

export default PreviewConfirmModals;
