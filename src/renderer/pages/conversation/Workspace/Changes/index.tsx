/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { PreviewContentType } from '@/common/types/preview';
import { Button, Empty, Message, Modal, Spin, Typography } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceChangesProps, WorkspaceChangesState } from './types';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tif', 'tiff', 'avif']);
const WORD_EXTENSIONS = new Set(['doc', 'docx', 'odt']);
const EXCEL_EXTENSIONS = new Set(['xls', 'xlsx', 'ods', 'csv']);
const PPT_EXTENSIONS = new Set(['ppt', 'pptx', 'odp']);

const initialState: WorkspaceChangesState = {
  loading: true,
  mode: 'git',
  repository: null,
  changes: [],
  files: [],
};

const getFileName = (targetPath: string): string => {
  const segments = targetPath.split(/[\\/]/);
  return segments[segments.length - 1] || targetPath;
};

const getFileExtension = (targetPath: string): string => {
  const fileName = getFileName(targetPath).toLowerCase();
  const extensionIndex = fileName.lastIndexOf('.');
  return extensionIndex >= 0 ? fileName.slice(extensionIndex + 1) : '';
};

const formatLastModified = (timestamp: number): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
};

const getStatusToneClassName = (status: string): string => {
  if (status.includes('??') || status.includes('A')) {
    return 'workspace-changes-badge--added';
  }
  if (status.includes('D')) {
    return 'workspace-changes-badge--deleted';
  }
  if (status.includes('R')) {
    return 'workspace-changes-badge--renamed';
  }
  return 'workspace-changes-badge--modified';
};

const resolvePreviewContentType = (targetPath: string): PreviewContentType => {
  const extension = getFileExtension(targetPath);

  if (extension === 'md' || extension === 'markdown') {
    return 'markdown';
  }
  if (extension === 'diff' || extension === 'patch') {
    return 'diff';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (WORD_EXTENSIONS.has(extension)) {
    return 'word';
  }
  if (EXCEL_EXTENSIONS.has(extension)) {
    return 'excel';
  }
  if (PPT_EXTENSIONS.has(extension)) {
    return 'ppt';
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (extension === 'html' || extension === 'htm') {
    return 'html';
  }

  return 'code';
};

const readPreviewContent = async (targetPath: string, contentType: PreviewContentType): Promise<string> => {
  if (contentType === 'image') {
    return ipcBridge.fs.getImageBase64.invoke({ path: targetPath });
  }

  if (contentType === 'pdf' || contentType === 'word' || contentType === 'excel' || contentType === 'ppt') {
    return '';
  }

  const content = await ipcBridge.fs.readFile.invoke({ path: targetPath });
  return typeof content === 'string' ? content : '';
};

const WorkspaceChanges: React.FC<WorkspaceChangesProps> = ({ workspace, reloadToken, openPreview }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<WorkspaceChangesState>(initialState);
  const [gitInitLoading, setGitInitLoading] = useState(false);
  const [messageApi, messageContext] = Message.useMessage();
  const [modal, modalContext] = Modal.useModal();
  const requestSequenceRef = useRef(0);

  const loadChanges = useCallback(async () => {
    if (!workspace) {
      setState({
        loading: false,
        mode: 'git',
        repository: null,
        changes: [],
        files: [],
      });
      return;
    }

    const requestId = ++requestSequenceRef.current;
    setState((current) => ({
      ...current,
      loading: true,
    }));

    const gitChangesResponse = await ipcBridge.fs.getWorkspaceGitChanges
      .invoke({
        workspacePath: workspace,
      })
      .catch((): null => null);

    if (requestId !== requestSequenceRef.current) {
      return;
    }

    if (gitChangesResponse?.success && gitChangesResponse.data?.repository) {
      setState({
        loading: false,
        mode: 'git',
        repository: gitChangesResponse.data.repository,
        changes: gitChangesResponse.data.changes,
        files: [],
      });
      return;
    }

    const recentFilesResponse = await ipcBridge.fs.getWorkspaceRecentFiles
      .invoke({
        path: workspace,
      })
      .catch((): null => null);

    if (requestId !== requestSequenceRef.current) {
      return;
    }

    setState({
      loading: false,
      mode: 'recent',
      repository: null,
      changes: [],
      files: recentFilesResponse?.success ? recentFilesResponse.data?.files || [] : [],
    });
  }, [workspace]);

  useEffect(() => {
    void loadChanges();
  }, [loadChanges, reloadToken]);

  const openGitDiff = useCallback(
    async (absolutePath: string, relativePath: string) => {
      const response = await ipcBridge.fs.getWorkspaceGitDiff.invoke({
        workspacePath: workspace,
        filePath: absolutePath,
      });

      if (!response.success) {
        return;
      }

      openPreview(response.data?.content || '', 'diff', {
        title: relativePath,
        fileName: relativePath,
        filePath: absolutePath,
        workspace,
        editable: false,
        language: 'diff',
      });
    },
    [openPreview, workspace]
  );

  const openRecentFilePreview = useCallback(
    async (absolutePath: string, relativePath: string) => {
      const contentType = resolvePreviewContentType(absolutePath);
      const content = await readPreviewContent(absolutePath, contentType);
      const fileName = getFileName(absolutePath);
      const extension = getFileExtension(absolutePath);

      openPreview(content, contentType, {
        title: relativePath,
        fileName,
        filePath: absolutePath,
        workspace,
        editable: false,
        language: extension || undefined,
      });
    },
    [openPreview, workspace]
  );

  const isGitMode = state.mode === 'git';
  const isEmpty = isGitMode ? state.changes.length === 0 : state.files.length === 0;
  const itemCount = isGitMode ? state.changes.length : state.files.length;
  const sectionLabel = isGitMode ? t('conversation.workspace.changesTitle') : t('conversation.workspace.viewChanges');
  const sectionDescription = isGitMode
    ? t('conversation.workspace.changesGitDescription', {
        defaultValue: 'Tracked file edits in the current workspace.',
      })
    : t('conversation.workspace.changesRecentFallback');
  const emptyDescription = isGitMode
    ? t('conversation.workspace.changesEmpty', {
        defaultValue: 'No workspace changes yet.',
      })
    : t('conversation.workspace.changesRecentEmpty', {
        defaultValue: 'No recent workspace files.',
      });

  const handleInitializeGitRepository = useCallback(async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: t('conversation.workspace.initializeGitConfirmTitle', {
          defaultValue: 'Initialize Git for this workspace?',
        }),
        content: t('conversation.workspace.initializeGitConfirmDescription', {
          defaultValue: 'ContextGo will create a .git directory in the current workspace root.',
        }),
        okText: t('conversation.workspace.initializeGitAction', {
          defaultValue: 'Initialize Git',
        }),
        cancelText: t('common.cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    setGitInitLoading(true);
    try {
      const response = await ipcBridge.fs.initializeWorkspaceGitRepository.invoke({
        workspacePath: workspace,
      });

      if (!response.success || !response.data?.isRepository) {
        throw new Error(
          response.msg ||
            t('conversation.workspace.initializeGitError', {
              defaultValue: 'Failed to initialize Git for this workspace.',
            })
        );
      }

      messageApi.success(
        t('conversation.workspace.initializeGitSuccess', {
          defaultValue: 'Git tracking is enabled for this workspace.',
        })
      );
      await loadChanges();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setGitInitLoading(false);
    }
  }, [loadChanges, messageApi, modal, t, workspace]);

  return (
    <div className='workspace-changes-page'>
      {messageContext}
      {modalContext}

      <div className='workspace-changes-hero'>
        <div className='workspace-changes-hero__header'>
          <div className='min-w-0'>
            <Typography.Text className='workspace-changes-hero__eyebrow'>{sectionLabel}</Typography.Text>
            <Typography.Title heading={6} className='!mb-4px !mt-0'>
              {isGitMode
                ? t('conversation.workspace.changesTitle', {
                    defaultValue: 'Changes',
                  })
                : t('conversation.workspace.changesRecentTitle', {
                    defaultValue: 'Recent Workspace Files',
                  })}
            </Typography.Title>
            <Typography.Paragraph className='workspace-changes-hero__description !mb-0'>
              {sectionDescription}
            </Typography.Paragraph>
          </div>
          <div className='workspace-changes-hero__meta'>
            <span className='workspace-changes-pill'>
              {itemCount}
              {' · '}
              {isGitMode
                ? t('conversation.workspace.viewChanges', {
                    defaultValue: 'Changes',
                  })
                : t('conversation.workspace.viewFiles', {
                    defaultValue: 'Files',
                  })}
            </span>
            {isGitMode && state.repository?.branch ? (
              <span className='workspace-changes-pill workspace-changes-pill--branch'>{state.repository.branch}</span>
            ) : null}
          </div>
        </div>
        {!isGitMode ? (
          <div className='workspace-changes-callout'>
            <Typography.Text className='workspace-changes-callout__title'>
              {t('conversation.workspace.initializeGit', {
                defaultValue: 'Enable Git change tracking',
              })}
            </Typography.Text>
            <Typography.Text className='workspace-changes-callout__description'>
              {t('conversation.workspace.initializeGitDescription', {
                defaultValue:
                  'Create a .git directory in this workspace root to switch from recent files to real diffs.',
              })}
            </Typography.Text>
            <div className='workspace-changes-callout__actions'>
              <Button
                loading={gitInitLoading}
                type='primary'
                size='small'
                onClick={() => void handleInitializeGitRepository()}
              >
                {t('conversation.workspace.initializeGitAction', {
                  defaultValue: 'Initialize Git',
                })}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Spin loading={state.loading}>
        {isEmpty ? (
          <div className='workspace-changes-empty'>
            <Empty
              description={<Typography.Text className='text-12px text-t-secondary'>{emptyDescription}</Typography.Text>}
            />
          </div>
        ) : (
          <div className='workspace-changes-list'>
            {isGitMode
              ? state.changes.map((change) => (
                  <Button
                    key={`${change.status}:${change.absolutePath}`}
                    type='text'
                    className='workspace-changes-item'
                    onClick={() => {
                      void openGitDiff(change.absolutePath, change.path);
                    }}
                  >
                    <span className={`workspace-changes-badge ${getStatusToneClassName(change.status)}`}>
                      {change.status}
                    </span>
                    <span className='workspace-changes-item__content'>
                      <span className='workspace-changes-item__title'>{change.path}</span>
                      {change.previousPath ? (
                        <span className='workspace-changes-item__meta'>
                          {change.previousPath}
                          {' -> '}
                          {change.path}
                        </span>
                      ) : (
                        <span className='workspace-changes-item__meta'>{change.absolutePath}</span>
                      )}
                    </span>
                  </Button>
                ))
              : state.files.map((file) => (
                  <Button
                    key={file.absolutePath}
                    type='text'
                    className='workspace-changes-item'
                    onClick={() => {
                      void openRecentFilePreview(file.absolutePath, file.path);
                    }}
                  >
                    <span className='workspace-changes-badge workspace-changes-badge--recent'>
                      {getFileExtension(file.absolutePath).toUpperCase() || 'FILE'}
                    </span>
                    <span className='workspace-changes-item__content'>
                      <span className='workspace-changes-item__title'>{file.path}</span>
                      <span className='workspace-changes-item__meta'>
                        {formatLastModified(file.lastModified)}
                        {file.size > 0 ? ` · ${Math.max(1, Math.round(file.size / 1024))} KB` : ''}
                      </span>
                    </span>
                  </Button>
                ))}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default WorkspaceChanges;
