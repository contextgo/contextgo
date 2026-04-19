import { ipcBridge } from '@/common';
import type { PreviewContentType } from '@/common/types/preview';
import type { IWorkspaceGitChange, IWorkspaceRecentFile } from '@/common/adapter/ipcBridge';
import {
  LARGE_TEXT_PREVIEW_MAX_LENGTH,
  LARGE_TEXT_PREVIEW_THRESHOLD,
} from '@/renderer/pages/conversation/Preview/constants';
import { getFileTypeInfo } from '@/renderer/utils/file/fileType';
import { useCallback, useEffect, useState } from 'react';

type UseWorkspaceChangesOptions = {
  workspace: string;
  openPreview: (content: string, type: PreviewContentType, metadata?: Record<string, unknown>) => void;
};

export const useWorkspaceChanges = ({ workspace, openPreview }: UseWorkspaceChangesOptions) => {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<IWorkspaceGitChange[]>([]);
  const [recentFiles, setRecentFiles] = useState<IWorkspaceRecentFile[]>([]);
  const [isRepository, setIsRepository] = useState(false);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    const response = await ipcBridge.fs.getWorkspaceGitChanges.invoke({ path: workspace });
    if (!response.success || !response.data) {
      setChanges([]);
      setRecentFiles([]);
      setIsRepository(false);
      setLoading(false);
      return;
    }

    setChanges(response.data.changes);
    const repository = Boolean(response.data.repository?.isRepository);
    setIsRepository(repository);

    if (repository) {
      setRecentFiles([]);
      setLoading(false);
      return;
    }

    const recentFilesResponse = await ipcBridge.fs.getWorkspaceRecentFiles.invoke({ path: workspace });
    setRecentFiles(recentFilesResponse.success && recentFilesResponse.data ? recentFilesResponse.data.files : []);
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    void loadChanges();
  }, [loadChanges]);

  const openChangePreview = useCallback(
    async (change: IWorkspaceGitChange) => {
      const response = await ipcBridge.fs.getWorkspaceGitDiff.invoke({
        workspacePath: workspace,
        filePath: change.absolutePath,
      });
      if (!response.success || !response.data) {
        return;
      }

      openPreview(response.data.content, 'diff', {
        title: change.path,
        fileName: change.path,
        filePath: change.absolutePath,
        workspace,
      });
    },
    [openPreview, workspace]
  );

  const openRecentFilePreview = useCallback(
    async (recentFile: IWorkspaceRecentFile) => {
      const fileName = recentFile.path.split('/').at(-1) ?? recentFile.path;
      const fileTypeInfo = getFileTypeInfo(fileName);
      const metadata: Record<string, unknown> = {
        title: recentFile.path,
        fileName,
        filePath: recentFile.absolutePath,
        workspace,
        language: fileTypeInfo.language,
      };
      const editable =
        fileTypeInfo.contentType === 'markdown' || fileTypeInfo.contentType === 'image' ? false : fileTypeInfo.editable;

      if (fileTypeInfo.contentType === 'image') {
        const content = await ipcBridge.fs.getImageBase64.invoke({ path: recentFile.absolutePath });
        openPreview(content, fileTypeInfo.contentType, {
          ...metadata,
          editable,
        });
        return;
      }

      if (['pdf', 'ppt', 'word', 'excel'].includes(fileTypeInfo.contentType)) {
        openPreview('', fileTypeInfo.contentType, {
          ...metadata,
          editable,
        });
        return;
      }

      const response = await ipcBridge.fs.readFile.invoke({ path: recentFile.absolutePath });
      const content = response ?? '';
      const shouldTruncate =
        ['code', 'markdown', 'html'].includes(fileTypeInfo.contentType) &&
        content.length > LARGE_TEXT_PREVIEW_THRESHOLD;

      openPreview(
        shouldTruncate ? content.slice(0, LARGE_TEXT_PREVIEW_MAX_LENGTH) : content,
        fileTypeInfo.contentType,
        {
          ...metadata,
          editable: shouldTruncate ? false : editable,
        }
      );
    },
    [openPreview, workspace]
  );

  return {
    loading,
    changes,
    recentFiles,
    isRepository,
    reload: loadChanges,
    openChangePreview,
    openRecentFilePreview,
  };
};
