/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
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
import { uuid } from '@/common/utils';
import { SettingsSubModal } from '@/renderer/components/settings';
import { Button, Empty, Input, Message, Switch, Tag, Typography } from '@arco-design/web-react';
import { Command, Delete, Edit, Plus, Refresh } from '@icon-park/react';
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
  type: 'custom',
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
    [i18n.language, library, resolveText]
  );

  const resolvedDefaultCommands = useMemo(
    () => resolveManagedSlashCommands(createDefaultManagedSlashCommandLibrary(), resolveText),
    [i18n.language, resolveText]
  );

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
          setLibrary(loadedLibrary);
        }
      } catch (error) {
        console.error('[ManagedCommandLibraryEditor] Failed to load command library:', error);
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

    void loadCurrentLibrary();

    return () => {
      isDisposed = true;
    };
  }, [i18n.language, loadLibrary]);

  const builtinCommands = resolvedCommands.filter((command) => command.type === 'builtin');
  const customCommands = resolvedCommands.filter((command) => command.type === 'custom');

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

    const { name, description: nextDescription, template } = normalized;

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
            descriptionOverride: nextDescription === defaultBuiltin.description ? undefined : nextDescription,
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
        description: nextDescription,
        template,
      };

      const nextLibrary =
        editorState.id && editorState.type === 'custom'
          ? library.map((record) => (record.id === editorState.id ? nextRecord : record))
          : [...library, nextRecord];

      await persistLibrary(nextLibrary, editorState.id ? 'common.saveSuccess' : 'common.createSuccess');
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
      await persistLibrary(createDefaultManagedSlashCommandLibrary(), 'settings.commands.restoreSuccess');
    } catch (error) {
      console.error('[ManagedCommandLibraryEditor] Failed to restore defaults:', error);
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
            {!isBuiltin ? (
              <Button status='danger' icon={<Delete />} onClick={() => setDeleteTarget(command)}>
                {t('common.delete')}
              </Button>
            ) : null}
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

  const heroSurfaceClassName =
    variant === 'embedded'
      ? 'rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'
      : 'rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px';

  const sectionSurfaceClassName =
    variant === 'embedded'
      ? 'rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'
      : 'rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px';

  return (
    <>
      {contextHolder}
      <div className='flex flex-col gap-16px'>
        <div className={heroSurfaceClassName}>
          <div className='flex flex-wrap items-start justify-between gap-16px'>
            <div className='max-w-720px'>
              <div className='flex items-center gap-8px'>
                <Command theme='outline' size='20' className='text-t-primary' />
                <Typography.Title heading={5} className='!mb-0'>
                  {title}
                </Typography.Title>
              </div>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{description}</Typography.Paragraph>
              {usageHint ? (
                <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{usageHint}</Typography.Paragraph>
              ) : null}
              {headerMeta ? <div className='mt-12px'>{headerMeta}</div> : null}
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

        <div className={sectionSurfaceClassName}>
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

        <div className={sectionSurfaceClassName}>
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

          {editorState.type === 'builtin' && editorState.builtinId ? (
            <Typography.Paragraph className='mb-0 text-t-secondary'>
              {t('settings.commands.builtinOverrideHint', {
                name: `/${getBuiltinManagedSlashCommandDefinition(editorState.builtinId).name}`,
              })}
            </Typography.Paragraph>
          ) : null}
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
