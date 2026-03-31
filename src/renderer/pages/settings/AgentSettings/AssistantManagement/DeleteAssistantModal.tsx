/**
 * DeleteAssistantModal — Confirmation modal for deleting an assistant.
 */
import type { AssistantListItem } from './types';
import AssistantAvatar from './AssistantAvatar';
import { ContextGoModal } from '@/renderer/components/base';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type DeleteAssistantModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  activeAssistant: AssistantListItem | null;
  avatarImageMap: Record<string, string>;
};

const DeleteAssistantModal: React.FC<DeleteAssistantModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  activeAssistant,
  avatarImageMap,
}) => {
  const { t } = useTranslation();

  return (
    <ContextGoModal
      visible={visible}
      onCancel={onCancel}
      className='delete-assistant-modal'
      header={{
        title: t('settings.deleteAssistantTitle', { defaultValue: 'Delete Assistant' }),
        showClose: true,
        className: 'px-24px pt-20px',
      }}
      footer={{
        className: 'px-24px pb-20px',
        render: () => (
          <div className='flex justify-end gap-10px pt-4px'>
            <Button onClick={onCancel} className='min-w-88px px-18px'>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type='primary' status='danger' onClick={onConfirm} className='min-w-104px px-18px'>
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          </div>
        ),
      }}
      style={{ width: 'min(440px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px' }}
      wrapStyle={{ zIndex: 10000 }}
      maskStyle={{ zIndex: 9999 }}
    >
      <p className='mb-0 text-14px leading-6 text-t-secondary'>
        {t('settings.deleteAssistantConfirm', {
          defaultValue: 'Are you sure you want to delete this assistant? This action cannot be undone.',
        })}
      </p>
      {activeAssistant && (
        <div className='mt-14px flex items-center gap-12px rounded-18px border border-b-base bg-fill-1 p-14px shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
          <AssistantAvatar assistant={activeAssistant} size={32} avatarImageMap={avatarImageMap} />
          <div>
            <div className='font-medium text-t-primary'>{activeAssistant.name}</div>
            <div className='text-12px text-t-secondary'>{activeAssistant.description}</div>
          </div>
        </div>
      )}
    </ContextGoModal>
  );
};

export default DeleteAssistantModal;
