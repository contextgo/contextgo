/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createDefaultManagedSlashCommandLibrary,
  getBuiltinManagedSlashCommandDefinition,
  normalizeManagedSlashCommandLibrary,
  normalizeSlashCommandName,
  resolveManagedSlashCommands,
  type BuiltinManagedSlashCommandRecord,
  type ManagedSlashCommandRecord,
  type ResolvedManagedSlashCommand,
} from '@/common/chat/slash/library';
import { ConfigStorage } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { emitter } from '@/renderer/utils/emitter';
import { Button, Empty, Input, Message, Modal, Switch, Tag, Typography } from '@arco-design/web-react';
import { Command, Edit, Plus, Refresh, Delete } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type CommandEditorState = {
  id?: string;
  type: 'builtin' | 'custom';
  builtinId?: BuiltinManagedSlashCommandRecord['id'];
  name: string;
  description: string;
  template: string;
};

const EMPTY_EDITOR_STATE: CommandEditorState = {
  type: 'custom',
  name: '',
  description: '',
  template: '',
};

const CommandSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [message, contextHolder] = Message.useMessage();
  const [library, setLibrary] = useState<ManagedSlashCommandRecord[]>(createDefaultManagedSlashCommandLibrary());
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResolvedManagedSlashCommand | null>(null);
  const [editorState, setEditorState] = useState<CommandEditorState>(EMPTY_EDITOR_STATE);

  const resolveText = useCallback((key: string, defaultValue: string) => t(key, { defaultValue }), [t]);

  const resolvedCommands = useMemo(
    () => resolveManagedSlashCommands(library, resolveText),
    [library, resolveText, i18n.language]
  );

  const resolvedDefaultCommands = useMemo(
    () => resolveManagedSlashCommands(createDefaultManagedSlashCommandLibrary(), resolveText),
    [resolveText, i18n.language]
  );

  const persistLibrary = useCallback(
    async (nextLibrary: ManagedSlashCommandRecord[], successKey?: string) => {
      await ConfigStorage.set('command.library', nextLibrary);
      setLibrary(nextLibrary);
      emitter.emit('commands.library.updated');
      if (successKey) {
        message.success(t(successKey));
      }
    },
    [message, t]
  );

  useEffect(() => {
    let isDisposed = false;

    const loadLibrary = async () => {
      setLoading(true);
      try {
        const storedLibrary = await ConfigStorage.get('command.library');
        const normalizedLibrary = normalizeManagedSlashCommandLibrary(storedLibrary);
        if (JSON.stringify(storedLibrary) !== JSON.stringify(normalizedLibrary)) {
          await ConfigStorage.set('command.library', normalizedLibrary);
        }
        if (!isDisposed) {
          setLibrary(normalizedLibrary);
        }
      } catch (error) {
        console.error('[CommandSettings] Failed to load command library:', error);
        if (!isDisposed) {
          message.error(t('settings.commands.loadFailed'));
          setLibrary(createDefaultManagedSlashCommandLibrary());
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void loadLibrary();

    return () => {
      isDisposed = true;
    };
  }, [i18n.language]);

  const builtinCommands = resolvedCommands.filter((command) => command.type === 'builtin');
  const customCommands = resolvedCommands.filter((command) => command.type === 'custom');

  const updateEnabledState = useCallback(
    async (targetId: string, enabled: boolean) => {
      const nextLibrary = library.map((record) => (record.id === targetId ? { ...record, enabled } : record));
      try {
        await persistLibrary(nextLibrary);
      } catch (error) {
        console.error('[CommandSettings] Failed to update command state:', error);
        message.error(t('settings.commands.saveFailed'));
      }
    },
    [library, message, persistLibrary, t]
  );

  const openCreateEditor = () => {
    setEditorState(EMPTY_EDITOR_STATE);
    setEditorVisible(true);
  };

  const openEditEditor = (command: ResolvedManagedSlashCommand) => {
    setEditorState({
      id: command.id,
      type: command.type,
      builtinId: command.builtinId,
      name: command.name,
      description: command.description,
      template: command.template,
    });
    setEditorVisible(true);
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditorState(EMPTY_EDITOR_STATE);
  };

  const validateEditorState = (): { name: string; description: string; template: string } | null => {
    const name = normalizeSlashCommandName(editorState.name);
    const description = editorState.description.trim();
    const template = editorState.template.trim();

    if (!name) {
      message.error(t('settings.commands.validation.invalidName'));
      return null;
    }

    const conflictingCommand = resolvedCommands.find(
      (command) => command.id !== editorState.id && command.name.toLowerCase() === name.toLowerCase()
    );
    if (conflictingCommand) {
      message.error(t('settings.commands.validation.duplicateName', { name }));
      return null;
    }

    if (!description) {
      message.error(t('settings.commands.validation.descriptionRequired'));
      return null;
    }

    if (!template) {
      message.error(t('settings.commands.validation.templateRequired'));
      return null;
    }

    return { name, description, template };
  };

  const saveEditor = async () => {
    const normalized = validateEditorState();
    if (!normalized) {
      return;
    }

    const { name, description, template } = normalized;

    try {
      if (editorState.type === 'builtin' && editorState.builtinId) {
        const defaultBuiltin = resolvedDefaultCommands.find((command) => command.builtinId === editorState.builtinId);
        if (!defaultBuiltin) {
          message.error(t('settings.commands.saveFailed'));
          return;
        }

        const nextLibrary = library.map((record) => {
          if (record.type !== 'builtin' || record.id !== editorState.builtinId) {
            return record;
          }

          return {
            ...record,
            nameOverride: name === defaultBuiltin.name ? undefined : name,
            descriptionOverride: description === defaultBuiltin.description ? undefined : description,
            templateOverride: template === defaultBuiltin.template ? undefined : template,
          };
        });

        await persistLibrary(nextLibrary, 'common.saveSuccess');
        closeEditor();
        return;
      }

      const nextRecord: ManagedSlashCommandRecord = {
        type: 'custom',
        id: editorState.id ?? uuid(),
        enabled: true,
        name,
        description,
        template,
      };

      const nextLibrary =
        editorState.id && editorState.type === 'custom'
          ? library.map((record) => (record.id === editorState.id ? nextRecord : record))
          : [...library, nextRecord];

      await persistLibrary(nextLibrary, editorState.id ? 'common.saveSuccess' : 'common.createSuccess');
      closeEditor();
    } catch (error) {
      console.error('[CommandSettings] Failed to save command:', error);
      message.error(t('settings.commands.saveFailed'));
    }
  };

  const deleteCommand = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const nextLibrary = library.filter((record) => record.id !== deleteTarget.id);
      await persistLibrary(nextLibrary, 'common.deleteSuccess');
      setDeleteTarget(null);
    } catch (error) {
      console.error('[CommandSettings] Failed to delete command:', error);
      message.error(t('settings.commands.deleteFailed'));
    }
  };

  const restoreDefaults = async () => {
    try {
      await persistLibrary(createDefaultManagedSlashCommandLibrary(), 'settings.commands.restoreSuccess');
    } catch (error) {
      console.error('[CommandSettings] Failed to restore defaults:', error);
      message.error(t('settings.commands.restoreFailed'));
    }
  };

  const renderCommandCard = (command: ResolvedManagedSlashCommand) => {
    const isBuiltin = command.type === 'builtin';

    return (
      <div
        key={command.id}
        className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'
      >
        <div className='flex flex-wrap items-center justify-between gap-12px'>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-8px'>
              <Typography.Text bold>{`/${command.name}`}</Typography.Text>
              <Tag color={isBuiltin ? 'arcoblue' : 'green'}>
                {isBuiltin ? t('settings.commands.builtinTag') : t('settings.commands.customTag')}
              </Tag>
            </div>
            <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{command.description}</Typography.Paragraph>
          </div>
          <div className='flex items-center gap-8px'>
            <Switch checked={command.enabled} onChange={(enabled) => void updateEnabledState(command.id, enabled)} />
            <Button type='secondary' icon={<Edit />} onClick={() => openEditEditor(command)}>
              {t('common.edit')}
            </Button>
            {!isBuiltin && (
              <Button status='danger' icon={<Delete />} onClick={() => setDeleteTarget(command)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
        <div className='mt-12px rounded-12px bg-[var(--color-bg-1)] p-12px'>
          <Typography.Text type='secondary'>{t('settings.commands.templateLabel')}</Typography.Text>
          <Typography.Paragraph className='mb-0 mt-6px whitespace-pre-wrap break-words'>
            {command.template}
          </Typography.Paragraph>
        </div>
      </div>
    );
  };

  return (
    <SettingsPageWrapper contentClassName='max-w-1080px'>
      {contextHolder}
      <div className='flex flex-col gap-16px'>
        <div className='rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px'>
          <div className='flex flex-wrap items-start justify-between gap-16px'>
            <div className='max-w-720px'>
              <div className='flex items-center gap-8px'>
                <Command theme='outline' size='20' className='text-t-primary' />
                <Typography.Title heading={5} className='!mb-0'>
                  {t('settings.commands.title')}
                </Typography.Title>
              </div>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('settings.commands.description')}
              </Typography.Paragraph>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('settings.commands.usageHint')}
              </Typography.Paragraph>
            </div>
            <div className='flex flex-wrap gap-8px'>
              <Button type='secondary' icon={<Refresh />} onClick={() => void restoreDefaults()}>
                {t('settings.commands.restoreDefaults')}
              </Button>
              <Button type='primary' icon={<Plus />} onClick={openCreateEditor}>
                {t('settings.commands.add')}
              </Button>
            </div>
          </div>
        </div>

        <div className='rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px'>
          <div className='mb-16px flex items-center justify-between gap-12px'>
            <div>
              <Typography.Title heading={6} className='!mb-0'>
                {t('settings.commands.recommendedTitle')}
              </Typography.Title>
              <Typography.Paragraph className='mb-0 mt-6px text-t-secondary'>
                {t('settings.commands.recommendedDescription')}
              </Typography.Paragraph>
            </div>
          </div>
          <div className='flex flex-col gap-12px'>{builtinCommands.map((command) => renderCommandCard(command))}</div>
        </div>

        <div className='rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px'>
          <div className='mb-16px flex items-center justify-between gap-12px'>
            <div>
              <Typography.Title heading={6} className='!mb-0'>
                {t('settings.commands.customTitle')}
              </Typography.Title>
              <Typography.Paragraph className='mb-0 mt-6px text-t-secondary'>
                {t('settings.commands.customDescription')}
              </Typography.Paragraph>
            </div>
            <Button type='secondary' icon={<Plus />} onClick={openCreateEditor}>
              {t('settings.commands.add')}
            </Button>
          </div>
          {loading ? (
            <Typography.Text type='secondary'>{t('common.loading')}</Typography.Text>
          ) : customCommands.length === 0 ? (
            <Empty description={t('settings.commands.emptyCustom')} />
          ) : (
            <div className='flex flex-col gap-12px'>{customCommands.map((command) => renderCommandCard(command))}</div>
          )}
        </div>
      </div>

      <Modal
        title={
          editorState.id
            ? t('settings.commands.editTitle', { name: `/${editorState.name || editorState.id}` })
            : t('settings.commands.createTitle')
        }
        visible={editorVisible}
        onOk={() => {
          void saveEditor();
        }}
        onCancel={closeEditor}
        style={{ width: 760 }}
      >
        <div className='flex flex-col gap-16px'>
          <div>
            <Typography.Text bold>{t('settings.commands.nameLabel')}</Typography.Text>
            <Input
              className='mt-8px'
              value={editorState.name}
              placeholder={t('settings.commands.namePlaceholder')}
              onChange={(value) => setEditorState((prev) => ({ ...prev, name: value }))}
            />
          </div>

          <div>
            <Typography.Text bold>{t('settings.commands.descriptionLabel')}</Typography.Text>
            <Input
              className='mt-8px'
              value={editorState.description}
              placeholder={t('settings.commands.descriptionPlaceholder')}
              onChange={(value) => setEditorState((prev) => ({ ...prev, description: value }))}
            />
          </div>

          <div>
            <Typography.Text bold>{t('settings.commands.templateLabel')}</Typography.Text>
            <Input.TextArea
              className='mt-8px'
              value={editorState.template}
              placeholder={t('settings.commands.templatePlaceholder')}
              autoSize={{ minRows: 6, maxRows: 14 }}
              onChange={(value) => setEditorState((prev) => ({ ...prev, template: value }))}
            />
          </div>

          {editorState.type === 'builtin' && editorState.builtinId && (
            <Typography.Paragraph className='mb-0 text-t-secondary'>
              {t('settings.commands.builtinOverrideHint', {
                name: `/${getBuiltinManagedSlashCommandDefinition(editorState.builtinId).name}`,
              })}
            </Typography.Paragraph>
          )}
        </div>
      </Modal>

      <Modal
        title={t('common.confirmDelete')}
        visible={Boolean(deleteTarget)}
        onOk={() => {
          void deleteCommand();
        }}
        onCancel={() => setDeleteTarget(null)}
        okButtonProps={{ status: 'danger' }}
      >
        <Typography.Paragraph>{t('settings.commands.deleteConfirm')}</Typography.Paragraph>
        <Typography.Text bold>{deleteTarget ? `/${deleteTarget.name}` : ''}</Typography.Text>
      </Modal>
    </SettingsPageWrapper>
  );
};

export default CommandSettings;
