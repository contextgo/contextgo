/**
 * SkillConfirmModals — Two small confirmation modals:
 * 1. Delete pending skill confirmation
 * 2. Remove custom skill from assistant confirmation
 */
import { ContextGoModal } from '@/renderer/components/base';
import type { Message } from '@arco-design/web-react';
import type { PendingSkill } from './types';
import { Button } from '@arco-design/web-react';
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
      <ContextGoModal
        visible={deletePendingSkillName !== null}
        onCancel={() => setDeletePendingSkillName(null)}
        header={{
          title: t('settings.deletePendingSkillTitle', { defaultValue: 'Delete Pending Skill' }),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={() => setDeletePendingSkillName(null)} className='min-w-88px px-18px'>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type='primary'
                status='danger'
                onClick={() => {
                  if (deletePendingSkillName) {
                    setPendingSkills(pendingSkills.filter((s) => s.name !== deletePendingSkillName));
                    setCustomSkills(customSkills.filter((s) => s !== deletePendingSkillName));
                    setSelectedSkills(selectedSkills.filter((s) => s !== deletePendingSkillName));
                    setDeletePendingSkillName(null);
                    message.success(t('settings.skillDeleted', { defaultValue: 'Skill removed from pending list' }));
                  }
                }}
                className='min-w-104px px-18px'
              >
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
          {t('settings.deletePendingSkillConfirm', {
            defaultValue: `Are you sure you want to remove "${deletePendingSkillName}"? This skill has not been imported yet.`,
          })}
        </p>
        <div className='mt-14px rounded-16px border border-b-base bg-fill-1 p-12px text-12px leading-5 text-t-secondary shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
          {t('settings.deletePendingSkillNote', {
            defaultValue:
              'This will only remove the skill from the pending list. If you want to add it again later, you can use "Add Skills".',
          })}
        </div>
      </ContextGoModal>

      {/* Remove Custom Skill from Assistant Modal */}
      <ContextGoModal
        visible={deleteCustomSkillName !== null}
        onCancel={() => setDeleteCustomSkillName(null)}
        header={{
          title: t('settings.removeCustomSkillTitle', { defaultValue: 'Remove Skill from Assistant' }),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={() => setDeleteCustomSkillName(null)} className='min-w-88px px-18px'>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type='primary'
                status='danger'
                onClick={() => {
                  if (deleteCustomSkillName) {
                    setCustomSkills(customSkills.filter((s) => s !== deleteCustomSkillName));
                    setSelectedSkills(selectedSkills.filter((s) => s !== deleteCustomSkillName));
                    setDeleteCustomSkillName(null);
                    message.success(
                      t('settings.skillRemovedFromAssistant', { defaultValue: 'Skill removed from this assistant' })
                    );
                  }
                }}
                className='min-w-104px px-18px'
              >
                {t('common.remove', { defaultValue: 'Remove' })}
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
          {t('settings.removeCustomSkillConfirm', {
            defaultValue: `Are you sure you want to remove "${deleteCustomSkillName}" from this assistant?`,
          })}
        </p>
        <div className='mt-14px rounded-16px border border-b-base bg-fill-1 p-12px text-12px leading-5 text-t-secondary shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
          {t('settings.removeCustomSkillNote', {
            defaultValue:
              'This will only remove the skill from this assistant. The skill will remain in Builtin Skills and can be re-added later.',
          })}
        </div>
      </ContextGoModal>
    </>
  );
};

export default SkillConfirmModals;
