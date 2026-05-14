import { fs, shell } from '@/common/adapter/ipcBridge';
import type { ManagedRuntimeConfigEntry, ManagedRuntimeConfigEntryKind } from '@/common/types/acpTypes';
import TextEditor from '@/renderer/pages/conversation/Preview/components/editors/TextEditor';
import { Alert, Button, Message, Space, Tabs, Tag, Typography } from '@arco-design/web-react';
import { Close, Refresh, Save } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSideDock from './SettingsSideDock';

type RuntimeConfigDockProps = {
  runtimeName: string;
  entries: ManagedRuntimeConfigEntry[];
  onClose: () => void;
};

type RuntimeConfigDraft = ManagedRuntimeConfigEntry & {
  content: string;
  originalContent: string;
  fileName: string;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
};

const createInitialDrafts = (entries: ManagedRuntimeConfigEntry[]): RuntimeConfigDraft[] =>
  entries.map((entry) => ({
    ...entry,
    content: '',
    originalContent: '',
    fileName: getFileName(entry.path),
    status: entry.exists ? 'loading' : 'ready',
  }));

const getFileName = (filePath: string): string => {
  const normalized = filePath.trim().replace(/[\\/]+$/, '');
  if (!normalized) {
    return filePath;
  }

  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || normalized;
};

const getKindLabelKey = (kind: ManagedRuntimeConfigEntryKind): string => {
  switch (kind) {
    case 'config':
      return 'settings.runtimeManager.configDock.kind.config';
    case 'auth':
      return 'settings.runtimeManager.configDock.kind.auth';
    default:
      return 'settings.runtimeManager.configDock.kind.other';
  }
};

const looksLikeJson = (content: string): boolean => {
  const trimmed = content.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

const getEditorLanguage = (draft: RuntimeConfigDraft): string | undefined => {
  const fileName = draft.fileName.trim().toLowerCase();
  if (fileName.endsWith('.json')) {
    return 'json';
  }

  return looksLikeJson(draft.content) ? 'json' : undefined;
};

const RuntimeConfigDock: React.FC<RuntimeConfigDockProps> = ({ runtimeName, entries, onClose }) => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage({ maxCount: 4 });
  const [drafts, setDrafts] = useState<RuntimeConfigDraft[]>(() => createInitialDrafts(entries));
  const [activePath, setActivePath] = useState<string>(entries[0]?.path ?? '');
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const loadEntryContent = useCallback(
    async (entry: ManagedRuntimeConfigEntry): Promise<RuntimeConfigDraft> => {
      const baseDraft: RuntimeConfigDraft = {
        ...entry,
        content: '',
        originalContent: '',
        fileName: getFileName(entry.path),
        status: 'ready',
      };

      if (!entry.exists) {
        return baseDraft;
      }

      try {
        const content = await fs.readFile.invoke({ path: entry.path });
        return {
          ...baseDraft,
          content,
          originalContent: content,
        };
      } catch (error) {
        return {
          ...baseDraft,
          status: 'error',
          errorMessage:
            error instanceof Error
              ? error.message
              : t('settings.runtimeManager.configDock.loadFailed', {
                  defaultValue: 'Failed to load this config file.',
                }),
        };
      }
    },
    [t]
  );

  useEffect(() => {
    let cancelled = false;

    setActivePath(entries[0]?.path ?? '');
    setDrafts(createInitialDrafts(entries));

    void Promise.all(entries.map((entry) => loadEntryContent(entry))).then((nextDrafts) => {
      if (cancelled) {
        return;
      }
      setDrafts(nextDrafts);
    });

    return () => {
      cancelled = true;
    };
  }, [entries, loadEntryContent]);

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.path === activePath) ?? drafts[0] ?? null,
    [activePath, drafts]
  );

  const isDirty = Boolean(activeDraft && activeDraft.content !== activeDraft.originalContent);

  const updateActiveContent = useCallback(
    (value: string) => {
      setDrafts((current) =>
        current.map((draft) => (draft.path === activePath ? { ...draft, content: value, status: 'ready' } : draft))
      );
    },
    [activePath]
  );

  const handleSave = useCallback(async () => {
    if (!activeDraft) {
      return;
    }

    setSaving(true);
    try {
      await fs.writeFile.invoke({
        path: activeDraft.path,
        data: activeDraft.content,
      });

      setDrafts((current) =>
        current.map((draft) =>
          draft.path === activeDraft.path
            ? {
                ...draft,
                exists: true,
                content: activeDraft.content,
                originalContent: activeDraft.content,
                status: 'ready',
                errorMessage: undefined,
              }
            : draft
        )
      );
      message.success(
        t('settings.runtimeManager.configDock.saveSuccess', {
          defaultValue: 'Config saved.',
        })
      );
    } catch (error) {
      console.error('[RuntimeConfigDock] Failed to save config:', error);
      message.error(
        error instanceof Error
          ? error.message
          : t('settings.runtimeManager.configDock.saveFailed', {
              defaultValue: 'Failed to save this config file.',
            })
      );
    } finally {
      setSaving(false);
    }
  }, [activeDraft, message, t]);

  const handleReload = useCallback(async () => {
    if (!activeDraft) {
      return;
    }

    setReloading(true);
    try {
      const nextDraft = await loadEntryContent(activeDraft);
      setDrafts((current) => current.map((draft) => (draft.path === activeDraft.path ? nextDraft : draft)));
    } catch (error) {
      console.error('[RuntimeConfigDock] Failed to reload config:', error);
      message.error(
        error instanceof Error
          ? error.message
          : t('settings.runtimeManager.configDock.reloadFailed', {
              defaultValue: 'Failed to reload this config file.',
            })
      );
    } finally {
      setReloading(false);
    }
  }, [activeDraft, loadEntryContent, message, t]);

  const handleReveal = useCallback(async () => {
    if (!activeDraft) {
      return;
    }

    setRevealing(true);
    try {
      await shell.revealPath.invoke(activeDraft.path);
    } catch (error) {
      console.error('[RuntimeConfigDock] Failed to reveal config path:', error);
      message.error(
        error instanceof Error
          ? error.message
          : t('settings.runtimeManager.revealPathFailed', {
              defaultValue: 'Failed to open the path in the system file manager.',
            })
      );
    } finally {
      setRevealing(false);
    }
  }, [activeDraft, message, t]);

  return (
    <>
      {messageContext}
      <SettingsSideDock
        variant='runtime-config'
        dataTestId='runtime-config-dock'
        ariaLabel={t('settings.runtimeManager.configDock.ariaLabel', {
          defaultValue: 'Runtime config editor',
        })}
      >
        <div className='settings-runtime-config-dock'>
          <div className='settings-runtime-config-dock__header'>
            <div className='settings-runtime-config-dock__title-block'>
              <div className='settings-runtime-config-dock__title'>{runtimeName}</div>
              <Typography.Paragraph className='settings-runtime-config-dock__subtitle'>
                {t('settings.runtimeManager.configDock.subtitle', {
                  defaultValue: 'Edit runtime config files inside ContextGo.',
                })}
              </Typography.Paragraph>
            </div>

            <div className='settings-runtime-config-dock__actions' data-testid='runtime-config-dock-actions'>
              <Space wrap>
                <Button
                  type='outline'
                  shape='round'
                  icon={<Refresh />}
                  loading={reloading}
                  onClick={() => void handleReload()}
                >
                  {t('settings.runtimeManager.configDock.reload', {
                    defaultValue: 'Reload',
                  })}
                </Button>
                <Button type='outline' shape='round' loading={revealing} onClick={() => void handleReveal()}>
                  {t('settings.runtimeManager.revealPath', {
                    defaultValue: 'Reveal',
                  })}
                </Button>
                <Button type='primary' shape='round' icon={<Save />} loading={saving} onClick={() => void handleSave()}>
                  {t('settings.runtimeManager.configDock.save', {
                    defaultValue: 'Save config',
                  })}
                </Button>
                <Button type='outline' shape='round' icon={<Close />} onClick={onClose}>
                  {t('common.close', {
                    defaultValue: 'Close',
                  })}
                </Button>
              </Space>
            </div>
          </div>

          {activeDraft ? (
            <Tabs activeTab={activeDraft.path} onChange={setActivePath}>
              {drafts.map((draft) => (
                <Tabs.TabPane key={draft.path} title={draft.fileName}>
                  <div className='settings-runtime-config-dock__body'>
                    <div className='settings-runtime-config-dock__meta'>
                      <div className='settings-runtime-config-dock__meta-row'>
                        <Tag color={draft.kind === 'auth' ? 'arcoblue' : draft.kind === 'config' ? 'green' : 'gray'}>
                          {t(getKindLabelKey(draft.kind), {
                            defaultValue: draft.kind,
                          })}
                        </Tag>
                        {draft.content !== draft.originalContent ? (
                          <Tag color='orange'>
                            {t('settings.runtimeManager.configDock.unsaved', {
                              defaultValue: 'Unsaved changes',
                            })}
                          </Tag>
                        ) : null}
                      </div>

                      <Typography.Text className='settings-runtime-config-dock__path'>{draft.path}</Typography.Text>

                      {!draft.exists ? (
                        <Alert
                          type='info'
                          content={t('settings.runtimeManager.configDock.missingHint', {
                            defaultValue: 'This file does not exist yet. Save to create it.',
                          })}
                        />
                      ) : null}

                      {draft.errorMessage ? <Alert type='error' content={draft.errorMessage} /> : null}
                    </div>

                    <div className='settings-runtime-config-dock__editor'>
                      <TextEditor
                        value={draft.content}
                        language={getEditorLanguage(draft)}
                        onChange={updateActiveContent}
                      />
                    </div>
                  </div>
                </Tabs.TabPane>
              ))}
            </Tabs>
          ) : null}

          {activeDraft && isDirty ? (
            <div className='settings-runtime-config-dock__footer'>
              <Typography.Text className='settings-runtime-config-dock__footer-text'>
                {t('settings.runtimeManager.configDock.footerHint', {
                  defaultValue: 'Save applies to the active config file only.',
                })}
              </Typography.Text>
            </div>
          ) : null}
        </div>
      </SettingsSideDock>
    </>
  );
};

export default RuntimeConfigDock;
