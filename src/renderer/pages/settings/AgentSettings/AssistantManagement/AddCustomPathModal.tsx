/**
 * AddCustomPathModal — Modal for adding a custom external skill directory path.
 */
import { ipcBridge } from '@/common';
import { ContextGoModal } from '@/renderer/components/base';
import { Button, Input } from '@arco-design/web-react';
import { FolderOpen } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type AddCustomPathModalProps = {
  visible: boolean;
  onCancel: () => void;
  onOk: () => void;
  customPathName: string;
  setCustomPathName: (v: string) => void;
  customPathValue: string;
  setCustomPathValue: (v: string) => void;
};

const AddCustomPathModal: React.FC<AddCustomPathModalProps> = ({
  visible,
  onCancel,
  onOk,
  customPathName,
  setCustomPathName,
  customPathValue,
  setCustomPathValue,
}) => {
  const { t } = useTranslation();

  return (
    <ContextGoModal
      visible={visible}
      onCancel={onCancel}
      header={{
        title: t('settings.skillsHub.addCustomPath', { defaultValue: 'Add Custom Skill Path' }),
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
            <Button
              type='primary'
              onClick={onOk}
              disabled={!customPathName.trim() || !customPathValue.trim()}
              className='min-w-104px px-18px'
            >
              {t('common.confirm', { defaultValue: 'Confirm' })}
            </Button>
          </div>
        ),
      }}
      style={{ width: 'min(560px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px' }}
      autoFocus={false}
      focusLock
      wrapStyle={{ zIndex: 10000 }}
      maskStyle={{ zIndex: 9999 }}
    >
      <div className='flex flex-col gap-16px'>
        <div>
          <div className='text-13px font-medium text-t-primary mb-8px'>
            {t('common.name', { defaultValue: 'Name' })}
          </div>
          <Input
            placeholder={t('settings.skillsHub.customPathNamePlaceholder', { defaultValue: 'e.g. My Custom Skills' })}
            value={customPathName}
            onChange={(v) => setCustomPathName(v)}
            className='rd-6px'
          />
        </div>
        <div>
          <div className='text-13px font-medium text-t-primary mb-8px'>
            {t('settings.skillsHub.customPathLabel', { defaultValue: 'Skill Directory Path' })}
          </div>
          <div className='flex gap-8px'>
            <Input
              placeholder={t('settings.skillsHub.customPathPlaceholder', {
                defaultValue: 'e.g. C:\\Users\\me\\.mytools\\skills',
              })}
              value={customPathValue}
              onChange={(v) => setCustomPathValue(v)}
              className='flex-1 rd-6px'
            />
            <Button
              className='rd-6px'
              onClick={async () => {
                try {
                  const result = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
                  if (result && result.length > 0) {
                    setCustomPathValue(result[0]);
                  }
                } catch (e) {
                  console.error('Failed to select directory', e);
                }
              }}
            >
              <FolderOpen size={16} />
            </Button>
          </div>
        </div>
      </div>
    </ContextGoModal>
  );
};

export default AddCustomPathModal;
