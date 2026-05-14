/**
 * DeleteAssistantModal — Confirmation modal for deleting an assistant.
 */
import type { AssistantListItem } from './types';
import AssistantAvatar from './AssistantAvatar';
import { SettingsSubModal } from '@/renderer/components/settings';
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
    <SettingsSubModal
      visible={visible}
      onCancel={onCancel}
      className='delete-assistant-modal'
      title={t('settings.deleteAssistantTitle', { defaultValue: 'Delete Assistant' })}
      onOk={onConfirm}
      okText={t('common.delete', { defaultValue: 'Delete' })}
      okButtonProps={{ status: 'danger' }}
      style={{ width: 'min(440px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px' }}
      wrapStyle={{ zIndex: 10000 }}
      maskStyle={{ zIndex: 9999 }}
    >
      <div className='settings-sub-modal__stack'>
        <p className='settings-sub-modal__lead'>
          {t('settings.deleteAssistantConfirm', {
            defaultValue: 'Are you sure you want to delete this assistant? This action cannot be undone.',
          })}
        </p>
        {activeAssistant && (
          <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
            <AssistantAvatar assistant={activeAssistant} size={32} avatarImageMap={avatarImageMap} />
            <div className='settings-sub-modal__meta'>
              <div className='settings-sub-modal__meta-title'>{activeAssistant.name}</div>
              {activeAssistant.description ? (
                <div className='settings-sub-modal__meta-description'>{activeAssistant.description}</div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </SettingsSubModal>
  );
};

export default DeleteAssistantModal;
