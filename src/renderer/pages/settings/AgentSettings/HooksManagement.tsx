/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import type { HookInfo } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import { Button, Collapse, Empty, Input, Message, Modal, Tag, Typography } from '@arco-design/web-react';
import { Delete, FolderOpen, Plus, Search } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HookRoutingConfigModal from './HookRoutingConfigModal';
import {
  HOOK_OUTPUT_TARGET_PRESENTATION,
  buildHookOutputRoutingConfig,
  canConfigureHookOutputRouting,
  createHookOutputRoutingDraft,
  filterHooksByQuery,
  summarizeHookLibrary,
  type HookOutputRoutingDraft,
} from './hookLibraryUtils';
import styles from './AgentSettingsPage.module.css';

const HOOK_CATEGORY_COLORS: Record<string, 'arcoblue' | 'green' | 'red' | 'purple' | 'gray'> = {
  clarity: 'arcoblue',
  quality: 'green',
  safety: 'red',
  continuity: 'purple',
  operations: 'gray',
};

const HooksManagement: React.FC = () => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const [availableHooks, setAvailableHooks] = useState<HookInfo[]>([]);
  const [hooksDir, setHooksDir] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteHookName, setDeleteHookName] = useState<string | null>(null);
  const [installingHookName, setInstallingHookName] = useState<string | null>(null);
  const [configuringHook, setConfiguringHook] = useState<HookInfo | null>(null);
  const [routingDraft, setRoutingDraft] = useState<HookOutputRoutingDraft | null>(null);
  const [savingHookRouting, setSavingHookRouting] = useState(false);

  const loadHooks = useCallback(async () => {
    try {
      const [hooks, paths] = await Promise.all([
        ipcBridge.fs.listAvailableHooks.invoke(),
        ipcBridge.fs.getHookPaths.invoke(),
      ]);
      setAvailableHooks(hooks);
      setHooksDir(paths.userHooksDir);
      return hooks;
    } catch (error) {
      console.error('Failed to load hooks:', error);
      messageApi.error(t('conversation.workspace.sessionHooksLoadFailed', { defaultValue: 'Failed to load hooks' }));
      setAvailableHooks([]);
      return [];
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadHooks();
  }, [loadHooks]);

  const handleImportHook = useCallback(async () => {
    try {
      const result = await ipcBridge.dialog.showOpen.invoke({
        properties: ['openDirectory'],
      });
      if (!result || result.length === 0) {
        return;
      }

      const importResult = await ipcBridge.fs.importHookWithSymlink.invoke({
        hookPath: result[0],
      });
      if (!importResult.success) {
        messageApi.error(importResult.msg || t('settings.hookImportFailed', { defaultValue: 'Failed to import hook' }));
        return;
      }

      messageApi.success(
        importResult.msg || t('settings.hookImported', { defaultValue: 'Hook imported successfully' })
      );
      await loadHooks();
    } catch (error) {
      console.error('Failed to import hook:', error);
      messageApi.error(t('settings.hookImportFailed', { defaultValue: 'Failed to import hook' }));
    }
  }, [loadHooks, messageApi, t]);

  const handleOpenHooksDir = useCallback(async () => {
    try {
      const nextHooksDir =
        hooksDir ||
        (await ipcBridge.fs.getHookPaths.invoke().then((paths) => {
          setHooksDir(paths.userHooksDir);
          return paths.userHooksDir;
        }));

      if (!nextHooksDir) {
        throw new Error('Hook directory not found');
      }

      await ipcBridge.shell.openFile.invoke(nextHooksDir);
    } catch (error) {
      console.error('Failed to open hooks directory:', error);
      messageApi.error(t('settings.hookOpenFolderFailed', { defaultValue: 'Failed to open hook folder' }));
    }
  }, [hooksDir, messageApi, t]);

  const handleInstallBuiltinHook = useCallback(
    async (hookName: string) => {
      setInstallingHookName(hookName);
      try {
        const result = await ipcBridge.fs.installBuiltinHook.invoke({ hookName });
        if (!result.success) {
          messageApi.error(result.msg || t('settings.hookInstallFailed', { defaultValue: 'Failed to install hook' }));
          return;
        }

        messageApi.success(result.msg || t('settings.installed', { defaultValue: 'Installed' }));
        await loadHooks();
      } catch (error) {
        console.error('Failed to install builtin hook:', error);
        messageApi.error(t('settings.hookInstallFailed', { defaultValue: 'Failed to install hook' }));
      } finally {
        setInstallingHookName((current) => (current === hookName ? null : current));
      }
    },
    [loadHooks, messageApi, t]
  );

  const handleDeleteHookConfirm = useCallback(async () => {
    if (!deleteHookName) {
      return;
    }

    try {
      const result = await ipcBridge.fs.deleteHook.invoke({ hookName: deleteHookName });
      if (!result.success) {
        messageApi.error(result.msg || t('settings.hookDeleteFailed', { defaultValue: 'Failed to delete hook' }));
        return;
      }

      messageApi.success(result.msg || t('settings.hookDeleted', { defaultValue: 'Hook deleted successfully' }));
      setDeleteHookName(null);
      await loadHooks();
    } catch (error) {
      console.error('Failed to delete hook:', error);
      messageApi.error(t('settings.hookDeleteFailed', { defaultValue: 'Failed to delete hook' }));
    }
  }, [deleteHookName, loadHooks, messageApi, t]);

  const handleOpenHookRouting = useCallback((hook: HookInfo) => {
    setConfiguringHook(hook);
    setRoutingDraft(createHookOutputRoutingDraft(hook));
  }, []);

  const handleCloseHookRouting = useCallback(() => {
    if (savingHookRouting) {
      return;
    }

    setConfiguringHook(null);
    setRoutingDraft(null);
  }, [savingHookRouting]);

  const handleSaveHookRouting = useCallback(async () => {
    if (!configuringHook || !routingDraft) {
      return;
    }

    if (routingDraft.outputTargets.length === 0) {
      messageApi.error(
        t('settings.hookRoutingTargetsRequired', { defaultValue: 'Select at least one output target.' })
      );
      return;
    }

    setSavingHookRouting(true);
    try {
      const result = await ipcBridge.fs.updateHookManifest.invoke({
        hookName: configuringHook.name,
        config: buildHookOutputRoutingConfig(routingDraft),
      });

      if (!result.success) {
        messageApi.error(
          result.msg || t('settings.hookRoutingSaveFailed', { defaultValue: 'Failed to save hook routing.' })
        );
        return;
      }

      messageApi.success(result.msg || t('settings.hookRoutingSaved', { defaultValue: 'Hook routing saved.' }));
      setConfiguringHook(null);
      setRoutingDraft(null);
      await loadHooks();
    } catch (error) {
      console.error('Failed to update hook routing:', error);
      messageApi.error(t('settings.hookRoutingSaveFailed', { defaultValue: 'Failed to save hook routing.' }));
    } finally {
      setSavingHookRouting(false);
    }
  }, [configuringHook, loadHooks, messageApi, routingDraft, t]);

  const filteredHooks = useMemo(() => filterHooksByQuery(availableHooks, searchQuery), [availableHooks, searchQuery]);
  const stats = useMemo(() => summarizeHookLibrary(availableHooks), [availableHooks]);
  const customHooks = useMemo(() => filteredHooks.filter((hook) => hook.isCustom), [filteredHooks]);
  const builtinHooks = useMemo(() => filteredHooks.filter((hook) => !hook.isCustom), [filteredHooks]);
  const defaultActiveKeys = useMemo(() => {
    if (customHooks.length > 0 && builtinHooks.length > 0) {
      return ['custom-hooks', 'builtin-hooks'];
    }
    return ['all-hooks'];
  }, [builtinHooks.length, customHooks.length]);

  const renderHookCard = (hook: HookInfo, canDelete: boolean) => (
    <div key={hook.name} className={styles.libraryCard}>
      <div className={styles.libraryCardMain}>
        <div className='flex items-center gap-6px flex-wrap'>
          <div className='text-13px font-medium text-t-primary'>{hook.name}</div>
          {hook.isCustom && (
            <Tag size='small' color='orange'>
              {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
            </Tag>
          )}
          {hook.isBuiltinInstalled && (
            <Tag size='small' color='green'>
              {t('settings.installed', { defaultValue: 'Installed' })}
            </Tag>
          )}
          {hook.executionType && (
            <Tag size='small' color='arcoblue'>
              {hook.executionType}
            </Tag>
          )}
          {hook.category && (
            <Tag size='small' color={HOOK_CATEGORY_COLORS[hook.category] || 'gray'}>
              {t(`settings.hookCategories.${hook.category}`, { defaultValue: hook.category })}
            </Tag>
          )}
          {(hook.runnableEvents || []).length > 0 ? (
            <Tag size='small' color='green'>
              {t('settings.hookReadyNow', { defaultValue: 'Ready Now' })}
            </Tag>
          ) : (
            <Tag size='small' color='gray'>
              {t('settings.hookStoredOnly', { defaultValue: 'Stored Only' })}
            </Tag>
          )}
          {hook.version && (
            <Tag size='small' color='gray'>
              v{hook.version}
            </Tag>
          )}
        </div>
        {hook.description && <div className='mt-4px text-12px text-t-secondary'>{hook.description}</div>}
        <div className='mt-6px text-11px text-t-tertiary break-all'>
          {t('settings.hookLocation', { defaultValue: 'Location' })}: {hook.location}
        </div>
        {hook.tags && hook.tags.length > 0 && (
          <div className='mt-6px flex flex-wrap gap-4px'>
            <span className='text-11px text-t-tertiary'>{t('settings.hookTags', { defaultValue: 'Tags' })}:</span>
            {hook.tags.map((tag) => (
              <Tag key={`${hook.name}-tag-${tag}`} size='small' color='gray'>
                {tag}
              </Tag>
            ))}
          </div>
        )}
        {hook.supportedBackends && hook.supportedBackends.length > 0 && (
          <div className='mt-6px flex flex-wrap gap-4px'>
            <span className='text-11px text-t-tertiary'>
              {t('settings.hookSupportedBackends', { defaultValue: 'Supported backends' })}:
            </span>
            {hook.supportedBackends.map((backend) => (
              <Tag key={`${hook.name}-${backend}`} size='small' color='purple'>
                {backend}
              </Tag>
            ))}
          </div>
        )}
        {hook.outputTargets && hook.outputTargets.length > 0 && (
          <div className='mt-6px flex flex-wrap gap-4px'>
            <span className='text-11px text-t-tertiary'>
              {t('settings.hookRoutesTo', { defaultValue: 'Routes To' })}:
            </span>
            {hook.outputTargets.map((target) => {
              const presentation = HOOK_OUTPUT_TARGET_PRESENTATION[target];
              return (
                <Tag key={`${hook.name}-output-${target}`} size='small' color={presentation.color}>
                  {t(presentation.i18nKey, { defaultValue: presentation.defaultLabel })}
                </Tag>
              );
            })}
          </div>
        )}
        {hook.events && hook.events.length > 0 && (
          <div className='mt-6px flex flex-wrap gap-4px'>
            {hook.events.map((eventName) => (
              <Tag key={`${hook.name}-${eventName}`} size='small' color='green'>
                {eventName}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <div className={styles.libraryActions}>
        {canConfigureHookOutputRouting(hook) && (
          <Button
            type='outline'
            size='mini'
            className={styles.hookActionButton}
            onClick={() => handleOpenHookRouting(hook)}
          >
            {t('settings.hookConfigure', { defaultValue: 'Configure' })}
          </Button>
        )}
        {!hook.isCustom && (
          <Button
            type='outline'
            size='mini'
            className={styles.hookActionButton}
            loading={installingHookName === hook.name}
            onClick={() => void handleInstallBuiltinHook(hook.name)}
          >
            {t('settings.installHook', { defaultValue: 'Install' })}
          </Button>
        )}
        {canDelete && (
          <Button
            type='text'
            size='mini'
            className={styles.ghostIconButton}
            icon={<Delete size={16} fill='var(--color-text-3)' />}
            onClick={() => setDeleteHookName(hook.name)}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {messageContext}
      <SettingsPageWrapper contentClassName='max-w-1200px'>
        <div className={styles.pageStack}>
          <div className={styles.heroSurface}>
            <div className={styles.heroRow}>
              <div className={styles.heroMeta}>
                <div className={styles.titleRow}>
                  <h1 className={styles.pageTitle}>{t('settings.hooksPage', { defaultValue: 'Hooks' })}</h1>
                  <span className={styles.countBadge}>{stats.total}</span>
                </div>
                <p className={styles.pageDescription}>
                  {t('settings.hooksPageDescription', {
                    defaultValue:
                      'Manage system-provided and imported hooks here. The builtin library organizes reusable patterns for prompt clarity, safety, quality gates, session continuity, and operator-friendly delivery. Hooks currently run through prompt transformation before the user prompt is sent.',
                  })}
                </p>
              </div>
              <div className={styles.actions}>
                <Button
                  type='outline'
                  className={styles.secondaryPillButton}
                  icon={<Plus size={14} />}
                  onClick={() => void handleImportHook()}
                >
                  {t('settings.importHook', { defaultValue: 'Import Hook' })}
                </Button>
                <Button
                  type='outline'
                  className={styles.secondaryPillButton}
                  icon={<FolderOpen size={14} />}
                  onClick={() => void handleOpenHooksDir()}
                >
                  {t('settings.openHookFolder', { defaultValue: 'Open Folder' })}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('settings.hooksPageTotal', { defaultValue: 'Total Hooks' })}</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('settings.hooksPageReadyNow', { defaultValue: 'Ready Now' })}</div>
              <div className={styles.statValue}>{stats.readyNow}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('settings.hooksPageCustom', { defaultValue: 'Custom Hooks' })}</div>
              <div className={styles.statValue}>{stats.custom}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>
                {t('settings.hooksPageBuiltin', { defaultValue: 'Builtin Hooks' })}
              </div>
              <div className={styles.statValue}>{stats.builtin}</div>
            </div>
          </div>

          <div className={styles.surface}>
            <Input
              value={searchQuery}
              allowClear
              prefix={<Search theme='outline' size={14} />}
              placeholder={t('settings.hooksPageSearchPlaceholder', {
                defaultValue: 'Search hooks by name, description, location, or tag',
              })}
              onChange={setSearchQuery}
              className={styles.searchInput}
            />
            <div className={styles.softNote + ' mt-12px'}>
              <div className={styles.softNoteLabel}>
                {t('settings.hookStoragePath', { defaultValue: 'Hook storage path' })}
              </div>
              <div className={styles.softNoteValue}>{hooksDir || '-'}</div>
            </div>
          </div>

          <div className={styles.surface}>
            {filteredHooks.length > 0 ? (
              <Collapse defaultActiveKey={defaultActiveKeys} className={styles.libraryCollapse}>
                {customHooks.length > 0 && (
                  <Collapse.Item
                    header={
                      <span className='text-13px font-medium'>
                        {t('settings.hooksPageCustom', { defaultValue: 'Custom Hooks' })}
                      </span>
                    }
                    name={builtinHooks.length > 0 ? 'custom-hooks' : 'all-hooks'}
                    extra={<span className='text-12px text-t-secondary'>{customHooks.length}</span>}
                  >
                    <div className={styles.libraryList}>{customHooks.map((hook) => renderHookCard(hook, true))}</div>
                  </Collapse.Item>
                )}
                {builtinHooks.length > 0 && (
                  <Collapse.Item
                    header={
                      <span className='text-13px font-medium'>
                        {t('settings.hooksPageBuiltin', { defaultValue: 'Builtin Hooks' })}
                      </span>
                    }
                    name='builtin-hooks'
                    extra={<span className='text-12px text-t-secondary'>{builtinHooks.length}</span>}
                  >
                    <div className={styles.libraryList}>{builtinHooks.map((hook) => renderHookCard(hook, false))}</div>
                  </Collapse.Item>
                )}
              </Collapse>
            ) : (
              <div className={styles.emptyState}>
                <Empty
                  className='py-24px'
                  description={
                    searchQuery
                      ? t('settings.hooksPageEmptySearch', { defaultValue: 'No hooks match the current search.' })
                      : t('settings.noAvailableHooks', { defaultValue: 'No hooks found in the hook directory' })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </SettingsPageWrapper>

      <Modal
        visible={deleteHookName !== null}
        title={t('settings.deleteHookTitle', { defaultValue: 'Delete Hook' })}
        onCancel={() => setDeleteHookName(null)}
        onOk={() => void handleDeleteHookConfirm()}
      >
        <Typography.Text>
          {t('settings.deleteHookConfirm', {
            name: deleteHookName || '',
            defaultValue: 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
          })}
        </Typography.Text>
      </Modal>

      <HookRoutingConfigModal
        visible={configuringHook !== null && routingDraft !== null}
        hook={configuringHook}
        draft={routingDraft}
        saving={savingHookRouting}
        onCancel={handleCloseHookRouting}
        onSave={() => void handleSaveHookRouting()}
        onDraftChange={setRoutingDraft}
      />
    </>
  );
};

export default HooksManagement;
