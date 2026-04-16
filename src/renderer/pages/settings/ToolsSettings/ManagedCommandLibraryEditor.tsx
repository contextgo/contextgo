/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  normalizeManagedSlashCommandLibrary,
  normalizeSlashCommandName,
  resolveManagedSlashCommands,
  type ManagedSlashCommandRecord,
  type ResolvedManagedSlashCommand,
} from '@/common/chat/slash/library';
import { uuid } from '@/common/utils';
import { AutomationPanel, AutomationSectionCard } from '@/renderer/components/automation';
import { SettingsSubModal } from '@/renderer/components/settings';
import { Button, Empty, Input, Message, Switch, Typography } from '@arco-design/web-react';
import { Command, Delete, Edit, Plus, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type CommandEditorState = {
  id?: string;
  enabled?: boolean;
  name: string;
  description: string;
  template: string;
};

type ManagedCommandLibraryEditorProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  usageHint?: React.ReactNode;
  loadLibrary: () => Promise<ManagedSlashCommandRecord[]>;
  saveLibrary: (nextLibrary: ManagedSlashCommandRecord[]) => Promise<void>;
  onLibraryChanged?: (nextLibrary: ManagedSlashCommandRecord[]) => void;
  headerMeta?: React.ReactNode;
  variant?: 'page' | 'embedded';
};

const EMPTY_EDITOR_STATE: CommandEditorState = {
  name: '',
  description: '',
  template: '',
};

const ManagedCommandLibraryEditor: React.FC<ManagedCommandLibraryEditorProps> = ({
  title,
  description,
  usageHint,
  loadLibrary,
  saveLibrary,
  onLibraryChanged,
  headerMeta,
  variant = 'page',
}) => {
  const { t } = useTranslation();
  const [message, contextHolder] = Message.useMessage();
  const [library, setLibrary] = useState<ManagedSlashCommandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResolvedManagedSlashCommand | null>(null);
  const [editorState, setEditorState] = useState<CommandEditorState>(EMPTY_EDITOR_STATE);
  const initialLibraryRef = useRef<ManagedSlashCommandRecord[]>([]);
  const loadErrorHandlerRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    loadErrorHandlerRef.current = () => {
      message.error(t('settings.commands.loadFailed'));
    };
  }, [message, t]);

  const resolvedCommands = useMemo(() => resolveManagedSlashCommands(library), [library]);

  const persistLibrary = useCallback(
    async (nextLibrary: ManagedSlashCommandRecord[], successKey?: string) => {
      await saveLibrary(nextLibrary);
      setLibrary(nextLibrary);
      onLibraryChanged?.(nextLibrary);
      if (successKey) {
        message.success(t(successKey));
      }
    },
    [message, onLibraryChanged, saveLibrary, t]
  );

  useEffect(() => {
    let isDisposed = false;

    const loadCurrentLibrary = async () => {
      setLoading(true);
      try {
        const loadedLibrary = normalizeManagedSlashCommandLibrary(await loadLibrary());
        if (!isDisposed) {
          initialLibraryRef.current = loadedLibrary;
          setLibrary(loadedLibrary);
        }
      } catch (error) {
        console.error('[ManagedCommandLibraryEditor] Failed to load command library:', error);
        if (!isDisposed) {
          initialLibraryRef.current = [];
          setLibrary([]);
          loadErrorHandlerRef.current();
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void loadCurrentLibrary();

    return () => {
      isDisposed = true;
    };
  }, [loadLibrary]);

  const updateEnabledState = useCallback(
    async (targetId: string, enabled: boolean) => {
      const nextLibrary = library.map((record) => (record.id === targetId ? { ...record, enabled } : record));
      try {
        await persistLibrary(nextLibrary);
      } catch (error) {
        console.error('[ManagedCommandLibraryEditor] Failed to update command state:', error);
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
      enabled: command.enabled,
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
    const nextDescription = editorState.description.trim();
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

    if (!nextDescription) {
      message.error(t('settings.commands.validation.descriptionRequired'));
      return null;
    }

    if (!template) {
      message.error(t('settings.commands.validation.templateRequired'));
      return null;
    }

    return { name, description: nextDescription, template };
  };

  const saveEditor = async () => {
    const normalized = validateEditorState();
    if (!normalized) {
      return;
    }

    const currentRecord = editorState.id ? library.find((record) => record.id === editorState.id) : undefined;
    const nextRecord: ManagedSlashCommandRecord = {
      id: editorState.id ?? uuid(),
      enabled: currentRecord?.enabled ?? editorState.enabled ?? true,
      name: normalized.name,
      description: normalized.description,
      template: normalized.template,
    };

    const nextLibrary = currentRecord
      ? library.map((record) => (record.id === currentRecord.id ? nextRecord : record))
      : [...library, nextRecord];

    try {
      await persistLibrary(nextLibrary, currentRecord ? 'common.saveSuccess' : 'common.createSuccess');
      closeEditor();
    } catch (error) {
      console.error('[ManagedCommandLibraryEditor] Failed to save command:', error);
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
      console.error('[ManagedCommandLibraryEditor] Failed to delete command:', error);
      message.error(t('settings.commands.deleteFailed'));
    }
  };

  const restoreDefaults = async () => {
    try {
      await persistLibrary([...initialLibraryRef.current], 'settings.commands.restoreSuccess');
    } catch (error) {
      console.error('[ManagedCommandLibraryEditor] Failed to restore defaults:', error);
      message.error(t('settings.commands.restoreFailed'));
    }
  };

  const renderCommandCard = (command: ResolvedManagedSlashCommand) => {
    return (
      <div
        key={command.id}
        className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'
      >
        <div className='flex flex-wrap items-center justify-between gap-12px'>
          <div className='min-w-0 flex-1'>
            <Typography.Text bold>{`/${command.name}`}</Typography.Text>
            <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{command.description}</Typography.Paragraph>
          </div>
          <div className='flex items-center gap-8px'>
            <Switch checked={command.enabled} onChange={(enabled) => void updateEnabledState(command.id, enabled)} />
            <Button type='secondary' icon={<Edit />} onClick={() => openEditEditor(command)}>
              {t('common.edit')}
            </Button>
            <Button status='danger' icon={<Delete />} onClick={() => setDeleteTarget(command)}>
              {t('common.delete')}
            </Button>
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
    <>
      {contextHolder}
      <AutomationPanel
        variant={variant}
        title={title}
        description={description}
        icon={<Command theme='outline' size='18' className='app-icon text-t-primary' />}
        meta={
          <>
            {usageHint ? (
              <Typography.Paragraph className='mb-0 text-t-secondary'>{usageHint}</Typography.Paragraph>
            ) : null}
            {headerMeta ? <div className={usageHint ? 'mt-12px' : undefined}>{headerMeta}</div> : null}
          </>
        }
        actions={
          <>
            <Button type='secondary' icon={<Refresh />} onClick={() => void restoreDefaults()}>
              {t('settings.commands.restoreDefaults')}
            </Button>
            <Button type='primary' icon={<Plus />} onClick={openCreateEditor}>
              {t('settings.commands.add')}
            </Button>
          </>
        }
      >
        <AutomationSectionCard variant={variant}>
          {loading ? (
            <Typography.Text type='secondary'>{t('common.loading')}</Typography.Text>
          ) : resolvedCommands.length === 0 ? (
            <Empty description={t('settings.commands.emptyCustom')} />
          ) : (
            <div className='flex flex-col gap-12px'>
              {resolvedCommands.map((command) => renderCommandCard(command))}
            </div>
          )}
        </AutomationSectionCard>
      </AutomationPanel>

      <SettingsSubModal
        visible={editorVisible}
        onCancel={closeEditor}
        title={
          editorState.id
            ? t('settings.commands.editTitle', { name: `/${editorState.name || editorState.id}` })
            : t('settings.commands.createTitle')
        }
        onOk={() => {
          void saveEditor();
        }}
        okText={t('common.save')}
        style={{ width: 'min(760px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(70vh, 720px)', overflow: 'auto' }}
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
        </div>
      </SettingsSubModal>

      <SettingsSubModal
        visible={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        title={t('common.confirmDelete')}
        onOk={() => {
          void deleteCommand();
        }}
        okText={t('common.delete')}
        okButtonProps={{ status: 'danger' }}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='settings-sub-modal__stack'>
          <p className='settings-sub-modal__lead'>{t('settings.commands.deleteConfirm')}</p>
          {deleteTarget ? (
            <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
              <div className='settings-sub-modal__meta'>
                <div className='settings-sub-modal__meta-title'>{`/${deleteTarget.name}`}</div>
                {deleteTarget.description ? (
                  <div className='settings-sub-modal__meta-description'>{deleteTarget.description}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSubModal>
    </>
  );
};

export default ManagedCommandLibraryEditor;
