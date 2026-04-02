import { HOOK_OUTPUT_BASE_DIRS, HOOK_OUTPUT_TARGETS, type HookInfo } from '@/common/types/hookTypes';
import { SettingsSubModal } from '@/renderer/components/settings';
import { Button, Checkbox, Input, Select, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  HOOK_OUTPUT_BASE_DIR_PRESENTATION,
  HOOK_OUTPUT_TARGET_PRESENTATION,
  type HookOutputRoutingDraft,
} from './hookLibraryUtils';

type HookRoutingConfigModalProps = {
  visible: boolean;
  hook: HookInfo | null;
  draft: HookOutputRoutingDraft | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (draft: HookOutputRoutingDraft) => void;
};

const HookRoutingConfigModal: React.FC<HookRoutingConfigModalProps> = ({
  visible,
  hook,
  draft,
  saving,
  onCancel,
  onSave,
  onDraftChange,
}) => {
  const { t } = useTranslation();

  if (!hook || !draft) {
    return null;
  }

  const updateDraft = (updates: Partial<HookOutputRoutingDraft>) => {
    onDraftChange({
      ...draft,
      ...updates,
    });
  };

  const toggleOutputTarget = (target: (typeof HOOK_OUTPUT_TARGETS)[number]) => {
    const outputTargets = draft.outputTargets.includes(target)
      ? draft.outputTargets.filter((item) => item !== target)
      : [...draft.outputTargets, target];

    updateDraft({ outputTargets });
  };

  return (
    <SettingsSubModal
      visible={visible}
      onCancel={onCancel}
      className='hook-routing-config-modal'
      title={t('settings.hookRoutingDialogTitle', {
        defaultValue: 'Configure Hook Delivery',
      })}
      onOk={onSave}
      okText={t('common.save', { defaultValue: 'Save' })}
      confirmLoading={saving}
      style={{ width: 'min(620px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px', overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}
    >
      <div className='flex flex-col gap-16px'>
        <Typography.Paragraph className='!mb-0 text-t-secondary'>
          {t('settings.hookRoutingDialogDescription', {
            defaultValue:
              'Choose where this hook delivers its completion output. Changes are saved into the hook manifest.',
          })}
        </Typography.Paragraph>

        <div className='rounded-12px bg-fill-1 p-12px'>
          <Typography.Text bold>{t('settings.hookRoutesTo', { defaultValue: 'Routes To' })}</Typography.Text>
          <div className='mt-8px flex flex-col gap-8px'>
            {HOOK_OUTPUT_TARGETS.map((target) => {
              const presentation = HOOK_OUTPUT_TARGET_PRESENTATION[target];
              return (
                <Checkbox
                  key={`hook-routing-target-${target}`}
                  checked={draft.outputTargets.includes(target)}
                  onChange={() => toggleOutputTarget(target)}
                >
                  {t(presentation.i18nKey, { defaultValue: presentation.defaultLabel })}
                </Checkbox>
              );
            })}
          </div>
        </div>

        {draft.outputTargets.includes('system-notification') && (
          <div className='rounded-12px bg-fill-1 p-12px'>
            <Typography.Text bold>
              {t('settings.hookNotificationSettings', { defaultValue: 'Notification Settings' })}
            </Typography.Text>
            <Typography.Text type='secondary' className='mt-8px block text-12px'>
              {t('settings.hookNotificationTemplateHint', {
                defaultValue:
                  'Templates support placeholders such as {{conversationName}} and {{finalResponseExcerpt}}.',
              })}
            </Typography.Text>
            <Typography.Text type='secondary' className='mt-12px block text-12px'>
              {t('settings.hookNotificationTitle', { defaultValue: 'Notification title' })}
            </Typography.Text>
            <Input
              className='mt-6px'
              value={draft.notificationTitle}
              placeholder={t('settings.hookNotificationTitlePlaceholder', {
                defaultValue: '{{conversationName}} complete',
              })}
              onChange={(value) => updateDraft({ notificationTitle: value })}
            />
            <Typography.Text type='secondary' className='mt-12px block text-12px'>
              {t('settings.hookNotificationBody', { defaultValue: 'Notification body' })}
            </Typography.Text>
            <Input
              className='mt-6px'
              value={draft.notificationBody}
              placeholder={t('settings.hookNotificationBodyPlaceholder', {
                defaultValue: '{{finalResponseExcerpt}}',
              })}
              onChange={(value) => updateDraft({ notificationBody: value })}
            />
          </div>
        )}

        {draft.outputTargets.includes('sidecar-file') && (
          <div className='rounded-12px bg-fill-1 p-12px'>
            <Typography.Text bold>
              {t('settings.hookOutputFileSettings', { defaultValue: 'Sidecar File Settings' })}
            </Typography.Text>
            <Typography.Text type='secondary' className='mt-8px block text-12px'>
              {t('settings.hookOutputFileHint', {
                defaultValue: 'Use templates like {{conversationId}} or {{hookName}} to organize generated artifacts.',
              })}
            </Typography.Text>
            <Typography.Text type='secondary' className='mt-12px block text-12px'>
              {t('settings.hookOutputBaseDir', { defaultValue: 'Base directory' })}
            </Typography.Text>
            <Select
              className='mt-6px w-full'
              value={draft.outputBaseDir}
              onChange={(value) => updateDraft({ outputBaseDir: value as (typeof HOOK_OUTPUT_BASE_DIRS)[number] })}
            >
              {HOOK_OUTPUT_BASE_DIRS.map((baseDir) => {
                const presentation = HOOK_OUTPUT_BASE_DIR_PRESENTATION[baseDir];
                return (
                  <Select.Option key={baseDir} value={baseDir}>
                    {t(presentation.i18nKey, { defaultValue: presentation.defaultLabel })}
                  </Select.Option>
                );
              })}
            </Select>
            <Typography.Text type='secondary' className='mt-12px block text-12px'>
              {t('settings.hookOutputRelativeDir', { defaultValue: 'Relative directory template' })}
            </Typography.Text>
            <Input
              className='mt-6px'
              value={draft.relativeDir}
              placeholder={t('settings.hookOutputRelativeDirPlaceholder', {
                defaultValue: 'hook-outputs/{{conversationId}}/{{hookName}}',
              })}
              onChange={(value) => updateDraft({ relativeDir: value })}
            />
            <Typography.Text type='secondary' className='mt-12px block text-12px'>
              {t('settings.hookOutputFileBaseName', { defaultValue: 'File base name template' })}
            </Typography.Text>
            <Input
              className='mt-6px'
              value={draft.fileBaseName}
              placeholder={t('settings.hookOutputFileBaseNamePlaceholder', {
                defaultValue: 'latest',
              })}
              onChange={(value) => updateDraft({ fileBaseName: value })}
            />
          </div>
        )}
      </div>
    </SettingsSubModal>
  );
};

export default HookRoutingConfigModal;
