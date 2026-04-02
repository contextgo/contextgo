/**
 * SkillConfirmModals — Two small confirmation modals:
 * 1. Delete pending skill confirmation
 * 2. Remove custom skill from assistant confirmation
 */
import { SettingsSubModal } from '@/renderer/components/settings';
import type { Message } from '@arco-design/web-react';
import type { PendingSkill } from './types';
import React from 'react';
import { useTranslation } from 'react-i18next';

type SkillConfirmModalsProps = {
  // Delete pending skill
  deletePendingSkillName: string | null;
  setDeletePendingSkillName: (v: string | null) => void;
  pendingSkills: PendingSkill[];
  setPendingSkills: (v: PendingSkill[]) => void;

  // Delete custom skill
  deleteCustomSkillName: string | null;
  setDeleteCustomSkillName: (v: string | null) => void;

  // Shared state
  customSkills: string[];
  setCustomSkills: (v: string[]) => void;
  selectedSkills: string[];
  setSelectedSkills: (v: string[]) => void;

  message: ReturnType<typeof Message.useMessage>[0];
};

const SkillConfirmModals: React.FC<SkillConfirmModalsProps> = ({
  deletePendingSkillName,
  setDeletePendingSkillName,
  pendingSkills,
  setPendingSkills,
  deleteCustomSkillName,
  setDeleteCustomSkillName,
  customSkills,
  setCustomSkills,
  selectedSkills,
  setSelectedSkills,
  message,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Delete Pending Skill Confirmation Modal */}
      <SettingsSubModal
        visible={deletePendingSkillName !== null}
        onCancel={() => setDeletePendingSkillName(null)}
        title={t('settings.deletePendingSkillTitle', { defaultValue: 'Delete Pending Skill' })}
        onOk={() => {
          if (deletePendingSkillName) {
            setPendingSkills(pendingSkills.filter((s) => s.name !== deletePendingSkillName));
            setCustomSkills(customSkills.filter((s) => s !== deletePendingSkillName));
            setSelectedSkills(selectedSkills.filter((s) => s !== deletePendingSkillName));
            setDeletePendingSkillName(null);
            message.success(t('settings.skillDeleted', { defaultValue: 'Skill removed from pending list' }));
          }
        }}
        okText={t('common.delete', { defaultValue: 'Delete' })}
        okButtonProps={{ status: 'danger' }}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
        wrapStyle={{ zIndex: 10000 }}
        maskStyle={{ zIndex: 9999 }}
      >
        <div className='settings-sub-modal__stack'>
          <p className='settings-sub-modal__lead'>
            {t('settings.deletePendingSkillConfirm', {
              defaultValue: `Are you sure you want to remove "${deletePendingSkillName}"? This skill has not been imported yet.`,
            })}
          </p>
          {deletePendingSkillName ? (
            <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
              <div className='settings-sub-modal__meta'>
                <div className='settings-sub-modal__meta-title'>{deletePendingSkillName}</div>
              </div>
            </div>
          ) : null}
          <div className='settings-sub-modal__info-panel'>
            {t('settings.deletePendingSkillNote', {
              defaultValue:
                'This will only remove the skill from the pending list. If you want to add it again later, you can use "Add Skills".',
            })}
          </div>
        </div>
      </SettingsSubModal>

      {/* Remove Custom Skill from Assistant Modal */}
      <SettingsSubModal
        visible={deleteCustomSkillName !== null}
        onCancel={() => setDeleteCustomSkillName(null)}
        title={t('settings.removeCustomSkillTitle', { defaultValue: 'Remove Skill from Assistant' })}
        onOk={() => {
          if (deleteCustomSkillName) {
            setCustomSkills(customSkills.filter((s) => s !== deleteCustomSkillName));
            setSelectedSkills(selectedSkills.filter((s) => s !== deleteCustomSkillName));
            setDeleteCustomSkillName(null);
            message.success(
              t('settings.skillRemovedFromAssistant', { defaultValue: 'Skill removed from this assistant' })
            );
          }
        }}
        okText={t('common.remove', { defaultValue: 'Remove' })}
        okButtonProps={{ status: 'danger' }}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
        wrapStyle={{ zIndex: 10000 }}
        maskStyle={{ zIndex: 9999 }}
      >
        <div className='settings-sub-modal__stack'>
          <p className='settings-sub-modal__lead'>
            {t('settings.removeCustomSkillConfirm', {
              defaultValue: `Are you sure you want to remove "${deleteCustomSkillName}" from this assistant?`,
            })}
          </p>
          {deleteCustomSkillName ? (
            <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
              <div className='settings-sub-modal__meta'>
                <div className='settings-sub-modal__meta-title'>{deleteCustomSkillName}</div>
              </div>
            </div>
          ) : null}
          <div className='settings-sub-modal__info-panel'>
            {t('settings.removeCustomSkillNote', {
              defaultValue:
                'This will only remove the skill from this assistant. The skill will remain in Builtin Skills and can be re-added later.',
            })}
          </div>
        </div>
      </SettingsSubModal>
    </>
  );
};

export default SkillConfirmModals;
