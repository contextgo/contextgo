/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextGoModal } from '@/renderer/components/base';
import { Alert, Button, Tag } from '@arco-design/web-react';
import { DeleteOne } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { DeleteConversationModalState } from './types';

type DeleteConversationModalProps = {
  visible: boolean;
  state: DeleteConversationModalState;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const DeleteConversationModal: React.FC<DeleteConversationModalProps> = ({
  visible,
  state,
  deleting,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const isBatchDelete = state?.kind === 'batch';
  const conversation = state?.kind === 'single' ? state.conversation : null;
  const isGroupConversation = conversation?.type === 'group';
  const childConversationCount = isGroupConversation ? conversation.extra.participants.length : 0;
  const conversationName = conversation?.name?.trim() || t('conversation.welcome.newConversation');
  const batchCount = state?.kind === 'batch' ? state.count : 0;

  return (
    <ContextGoModal
      visible={visible}
      onCancel={onCancel}
      className='conversation-delete-modal'
      header={{
        title: isBatchDelete ? t('conversation.history.batchDelete') : t('conversation.history.deleteTitle'),
        showClose: true,
        className: 'px-24px pt-20px',
      }}
      footer={{
        className: 'px-24px pb-20px',
        render: () => (
          <div className='flex justify-center gap-12px pt-8px'>
            <Button
              onClick={onCancel}
              className='min-w-112px border border-solid border-b-base bg-fill-1 px-20px'
              style={{
                borderRadius: '999px',
                boxShadow: '0 14px 30px color-mix(in srgb, var(--color-text-1) 10%, transparent)',
              }}
            >
              {t('conversation.history.cancelDelete')}
            </Button>
            <Button
              status='danger'
              type='primary'
              loading={deleting}
              onClick={onConfirm}
              className='min-w-120px border-none px-20px'
              style={{
                borderRadius: '999px',
                boxShadow: '0 16px 34px rgba(var(--danger-6), 0.28)',
              }}
            >
              {t('conversation.history.confirmDelete')}
            </Button>
          </div>
        ),
      }}
      style={{ width: 'min(480px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px' }}
    >
      <div className='mx-auto flex w-full max-w-380px flex-col items-center gap-16px text-center'>
        <div className='flex w-full flex-col items-center gap-12px rounded-20px border border-[rgba(var(--danger-6),0.16)] bg-[rgba(var(--danger-6),0.08)] px-18px py-18px'>
          <span className='inline-flex h-36px w-36px flex-shrink-0 items-center justify-center rounded-full bg-[rgba(var(--danger-6),0.14)] text-[rgb(var(--danger-6))] shadow-[0_10px_24px_rgba(var(--danger-6),0.16)]'>
            <DeleteOne theme='outline' size='16' />
          </span>
          <div className='min-w-0 flex-1'>
            <div className='text-14px font-600 leading-6 text-t-primary'>
              {isBatchDelete
                ? t('conversation.history.deleteModalBatchHeadline')
                : t('conversation.history.deleteModalHeadline')}
            </div>
            <div className='mt-2px text-13px leading-6 text-t-secondary'>
              {isBatchDelete
                ? t('conversation.history.deleteModalBatchDescription')
                : t('conversation.history.deleteModalDescription')}
            </div>
          </div>
        </div>

        <div className='w-full rounded-20px border border-b-base bg-fill-1 px-18px py-16px shadow-[0_14px_32px_color-mix(in_srgb,var(--color-text-1)_6%,transparent)]'>
          <div className='flex items-center justify-center gap-8px'>
            <div className='text-13px font-500 leading-5 text-t-secondary'>
              {isBatchDelete
                ? t('conversation.history.deleteBatchTargetLabel')
                : t('conversation.history.deleteTargetLabel')}
            </div>
            {isGroupConversation ? <Tag color='orangered'>{t('conversation.history.groupConversationTag')}</Tag> : null}
          </div>
          <div className='mt-8px break-all text-15px font-600 leading-6 text-t-primary'>
            {isBatchDelete ? t('conversation.history.deleteBatchCount', { count: batchCount }) : conversationName}
          </div>
        </div>

        {isGroupConversation ? (
          <div className='w-full'>
            <Alert
              type='warning'
              content={
                <div className='text-center'>
                  {t('conversation.history.deleteGroupImpact', { count: childConversationCount })}
                </div>
              }
            />
          </div>
        ) : null}
      </div>
    </ContextGoModal>
  );
};

export default DeleteConversationModal;
