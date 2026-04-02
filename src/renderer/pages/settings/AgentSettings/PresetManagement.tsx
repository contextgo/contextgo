import { SettingsSubModal } from '@/renderer/components/settings';
import { Button, Collapse, Input, Typography } from '@arco-design/web-react';
import type { Message } from '@arco-design/web-react';
import { EditTwo, Delete, Lightning } from '@icon-park/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { ConfigStorage } from '@/common/config/storage';
import type { AcpBackendConfig } from '@/common/types/acpTypes';
import { acpConversation } from '@/common/adapter/ipcBridge';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';

interface PresetManagementProps {
  message: ReturnType<typeof Message.useMessage>[0];
}

const PresetManagement: React.FC<PresetManagementProps> = ({ message }) => {
  const { t } = useTranslation();
  const { theme } = useThemeContext();
  const [presets, setPresets] = useState<AcpBackendConfig[]>([]);
  const [editingPreset, setEditingAgent] = useState<AcpBackendConfig | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<AcpBackendConfig | null>(null);

  // Form state
  const [editName, setEditName] = useState('');
  const [editContext, setEditContext] = useState('');

  const loadPresets = useCallback(async () => {
    try {
      const agents = await ConfigStorage.get('acp.customAgents');
      if (agents && Array.isArray(agents)) {
        setPresets(agents.filter((a) => a.isPreset));
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }, []);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const refreshAgentDetection = useCallback(async () => {
    try {
      await acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch {
      // ignore
    }
  }, []);

  const handleEdit = (preset: AcpBackendConfig) => {
    setEditingAgent(preset);
    setEditName(preset.name);
    setEditContext(preset.context || '');
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!editingPreset) return;
    try {
      const allAgents = (await ConfigStorage.get('acp.customAgents')) || [];
      const updatedAgents = allAgents.map((a) =>
        a.id === editingPreset.id ? { ...a, name: editName, context: editContext } : a
      );
      await ConfigStorage.set('acp.customAgents', updatedAgents);
      setEditVisible(false);
      message.success(t('common.success', { defaultValue: 'Success' }));
      void loadPresets();
      void refreshAgentDetection();
    } catch (error) {
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  const handleDelete = async () => {
    if (!presetToDelete) return;
    try {
      const allAgents = (await ConfigStorage.get('acp.customAgents')) || [];
      const updatedAgents = allAgents.filter((a) => a.id !== presetToDelete.id);
      await ConfigStorage.set('acp.customAgents', updatedAgents);
      setDeleteVisible(false);
      message.success(t('common.success', { defaultValue: 'Deleted' }));
      void loadPresets();
      void refreshAgentDetection();
    } catch (error) {
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  return (
    <div>
      <Collapse.Item
        header={
          <div className='flex items-center justify-between'>
            {t('settings.preset_agents', { defaultValue: 'Custom Presets (Rules & Skills)' })}
          </div>
        }
        name='preset-management'
      >
        <div className='py-2'>
          {presets.length === 0 ? (
            <div className='text-center py-4 text-t-secondary'>
              {t('settings.no_presets', { defaultValue: 'No custom presets generated yet.' })}
            </div>
          ) : (
            <div className='space-y-2'>
              {presets.map((preset) => (
                <div key={preset.id} className='p-4 bg-fill-2 rounded-lg'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Lightning theme='filled' fill='var(--color-primary-6)' />
                      <div className='font-medium'>{preset.name}</div>
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        type='text'
                        size='small'
                        icon={<EditTwo size={'14'} />}
                        onClick={() => handleEdit(preset)}
                      />
                      <Button
                        type='text'
                        size='small'
                        status='danger'
                        icon={<Delete size={'14'} />}
                        onClick={() => {
                          setPresetToDelete(preset);
                          setDeleteVisible(true);
                        }}
                      />
                    </div>
                  </div>
                  <div className='text-xs text-t-secondary mt-2 truncate max-w-[400px]'>
                    {preset.context?.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Collapse.Item>

      {/* Edit Modal */}
      <SettingsSubModal
        visible={editVisible}
        onCancel={() => setEditVisible(false)}
        title={t('settings.edit_preset', { defaultValue: 'Edit Preset' })}
        onOk={() => void handleSave()}
        okText={t('common.save', { defaultValue: 'Save' })}
        style={{ width: 'min(680px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(76vh, 760px)', overflow: 'auto' }}
      >
        <div className='space-y-4'>
          <div>
            <Typography.Text bold>{t('settings.agent_name', { defaultValue: 'Agent Name' })}</Typography.Text>
            <Input className='mt-2' value={editName} onChange={setEditName} />
          </div>
          <div>
            <Typography.Text bold>
              {t('settings.rule_content', { defaultValue: 'Rule Content / Instructions' })}
            </Typography.Text>
            <div className='mt-2 border rounded overflow-hidden'>
              <CodeMirror
                value={editContext}
                height='300px'
                theme={theme}
                extensions={[markdown()]}
                onChange={setEditContext}
              />
            </div>
          </div>
        </div>
      </SettingsSubModal>

      {/* Delete Confirm */}
      <SettingsSubModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        title={t('common.confirm', { defaultValue: 'Confirm Delete' })}
        onOk={() => void handleDelete()}
        okText={t('common.delete', { defaultValue: 'Delete' })}
        okButtonProps={{ status: 'danger' }}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='settings-sub-modal__stack'>
          <p className='settings-sub-modal__lead'>
            {t('settings.delete_preset_confirm', { defaultValue: 'Are you sure you want to delete this preset?' })}
          </p>
          {presetToDelete ? (
            <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
              <div className='settings-sub-modal__meta'>
                <div className='settings-sub-modal__meta-title'>{presetToDelete.name}</div>
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSubModal>
    </div>
  );
};

export default PresetManagement;
