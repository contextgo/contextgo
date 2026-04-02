/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsSubModal } from '@/renderer/components/settings';
import { Button, Spin } from '@arco-design/web-react';
import { IconFile, IconFolder, IconUp } from '@arco-design/web-react/icon';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile?: boolean;
}

interface DirectoryData {
  items: DirectoryItem[];
  canGoUp: boolean;
  parentPath?: string;
}

interface DirectorySelectionModalProps {
  visible: boolean;
  isFileMode?: boolean;
  onConfirm: (paths: string[] | undefined) => void;
  onCancel: () => void;
}

const DirectorySelectionModal: React.FC<DirectorySelectionModalProps> = ({
  visible,
  isFileMode = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [directoryData, setDirectoryData] = useState<DirectoryData>({ items: [], canGoUp: false });
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (dirPath = '') => {
      setLoading(true);
      setError(null);
      try {
        const showFiles = isFileMode ? 'true' : 'false';
        const response = await fetch(
          `/api/directory/browse?path=${encodeURIComponent(dirPath)}&showFiles=${showFiles}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(errorData.error || `HTTP ${response.status}`);
          return;
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.items)) {
          setError('Invalid response from server');
          return;
        }
        setDirectoryData(data);
        setCurrentPath(dirPath);
      } catch (err) {
        console.error('Failed to load directory:', err);
        setError(err instanceof Error ? err.message : 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    },
    [isFileMode]
  );

  useEffect(() => {
    if (visible) {
      setSelectedPath('');
      loadDirectory('').catch((error) => console.error('Failed to load initial directory:', error));
    }
  }, [visible, loadDirectory]);

  const handleItemClick = (item: DirectoryItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path).catch((error) => console.error('Failed to load directory:', error));
    }
  };

  // Double-click behavior removed - single click now handles directory navigation
  // 移除双击行为 - 单击现在处理目录导航
  const handleItemDoubleClick = (_item: DirectoryItem) => {
    // No-op: single click already handles navigation
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleGoUp = () => {
    if (directoryData.parentPath !== undefined) {
      // Handle '__ROOT__' as empty path to show drive list on Windows
      // 处理 '__ROOT__' 为空路径，在 Windows 上显示驱动器列表
      const targetPath = directoryData.parentPath === '__ROOT__' ? '' : directoryData.parentPath;
      loadDirectory(targetPath).catch((error) => console.error('Failed to load parent directory:', error));
    }
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onConfirm([selectedPath]);
    }
  };

  const canSelect = (item: DirectoryItem) => {
    return isFileMode ? item.isFile : item.isDirectory;
  };

  return (
    <SettingsSubModal
      visible={visible}
      onCancel={onCancel}
      title={isFileMode ? '📄 ' + t('fileSelection.selectFile') : '📁 ' + t('fileSelection.selectDirectory')}
      className='directory-selection-modal'
      style={{ width: 'min(640px, calc(100vw - 32px))' }}
      wrapStyle={{ zIndex: 3000 }}
      maskStyle={{ zIndex: 2990 }}
      footer={
        <div className='flex w-full items-center justify-between gap-12px px-24px pb-20px pt-4px'>
          <div
            className='text-t-secondary text-14px overflow-hidden text-ellipsis whitespace-nowrap max-w-[70vw]'
            title={selectedPath || currentPath}
          >
            {selectedPath ||
              currentPath ||
              (isFileMode ? t('fileSelection.pleaseSelectFile') : t('fileSelection.pleaseSelectDirectory'))}
          </div>
          <div className='flex gap-10px'>
            <Button onClick={onCancel}>{t('common.cancel')}</Button>
            <Button type='primary' onClick={handleConfirm} disabled={!selectedPath}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      }
      contentStyle={{ padding: '12px 24px 0' }}
    >
      <Spin loading={loading} className='w-full'>
        <div className='settings-sub-modal__surface w-full' style={{ height: 'min(420px, 60vh)' }}>
          <div className='h-full overflow-y-auto'>
            {directoryData.canGoUp && (
              <div
                className='flex cursor-pointer items-center border-b border-b-light px-14px py-12px transition hover:bg-fill-1'
                onClick={handleGoUp}
              >
                <IconUp className='mr-10px text-t-secondary' />
                <span>..</span>
              </div>
            )}
            {error && (
              <div className='p-16px text-center text-danger text-13px'>
                <div>{error}</div>
                <Button size='mini' className='mt-8px' onClick={() => loadDirectory(currentPath).catch(() => {})}>
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Button>
              </div>
            )}
            {directoryData.items.map((item, index) => (
              <div
                key={index}
                className='flex items-center justify-between border-b border-b-light px-14px py-12px transition hover:bg-fill-1'
                style={selectedPath === item.path ? { background: 'var(--brand-light)' } : {}}
                onClick={() => handleItemClick(item)}
                onDoubleClick={() => handleItemDoubleClick(item)}
              >
                <div className='flex items-center flex-1 min-w-0'>
                  {item.isDirectory ? (
                    <IconFolder className='mr-10px text-warning shrink-0' />
                  ) : (
                    <IconFile className='mr-10px text-primary shrink-0' />
                  )}
                  <span className='overflow-hidden text-ellipsis whitespace-nowrap'>{item.name}</span>
                </div>
                {canSelect(item) && (
                  <Button
                    type='primary'
                    size='mini'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(item.path);
                    }}
                  >
                    {t('common.select')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Spin>
    </SettingsSubModal>
  );
};

export default DirectorySelectionModal;
