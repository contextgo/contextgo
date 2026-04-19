/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { PreviewContentType } from '@/common/types/preview';
import { Button, Empty, Spin, Typography } from '@arco-design/web-react';
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
  const sectionLabel = isGitMode
    ? t('conversation.workspace.changesTitle', {
        defaultValue: 'Changes',
      })
    : t('conversation.workspace.changesRecentFallback', {
        defaultValue: 'Recent Files',
      });

  return (
    <div className='shrink-0 border-t border-border-2 bg-bg-1/90 px-12px py-10px'>
      <div className='mb-8px flex items-center justify-between gap-8px'>
        <Typography.Text className='text-12px font-semibold uppercase tracking-[0.08em] text-t-secondary'>
          {sectionLabel}
        </Typography.Text>
        {isGitMode && state.repository?.branch ? (
          <Typography.Text className='text-12px text-t-tertiary'>{state.repository.branch}</Typography.Text>
        ) : null}
      </div>

      <Spin loading={state.loading}>
        {isEmpty ? (
          <Empty
            description={
              <Typography.Text className='text-12px text-t-secondary'>
                {t('conversation.workspace.changesEmpty', {
                  defaultValue: 'No workspace changes yet.',
                })}
              </Typography.Text>
            }
          />
        ) : (
          <div className='max-h-220px overflow-y-auto pr-4px'>
            <div className='flex flex-col gap-6px'>
              {isGitMode
                ? state.changes.map((change) => (
                    <div key={`${change.status}:${change.absolutePath}`} className='flex items-center gap-8px'>
                      <Typography.Text className='min-w-24px text-11px font-semibold text-t-secondary'>
                        {change.status}
                      </Typography.Text>
                      <Button
                        type='text'
                        long
                        className='!justify-start !px-0'
                        onClick={() => {
                          void openGitDiff(change.absolutePath, change.path);
                        }}
                      >
                        {change.path}
                      </Button>
                    </div>
                  ))
                : state.files.map((file) => (
                    <div key={file.absolutePath} className='flex items-center gap-8px'>
                      <Typography.Text className='min-w-24px text-11px font-semibold text-t-secondary'>
                        {getFileExtension(file.absolutePath).toUpperCase() || 'FILE'}
                      </Typography.Text>
                      <Button
                        type='text'
                        long
                        className='!justify-start !px-0'
                        onClick={() => {
                          void openRecentFilePreview(file.absolutePath, file.path);
                        }}
                      >
                        {file.path}
                      </Button>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </Spin>
    </div>
  );
};

export default WorkspaceChanges;
