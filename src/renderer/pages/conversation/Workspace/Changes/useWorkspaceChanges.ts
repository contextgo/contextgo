import { ipcBridge } from '@/common';
import type { PreviewContentType } from '@/common/types/preview';
import type { IWorkspaceGitChange } from '@/common/adapter/ipcBridge';
import { useCallback, useEffect, useState } from 'react';

type UseWorkspaceChangesOptions = {
  workspace: string;
  openPreview: (content: string, type: PreviewContentType, metadata?: Record<string, unknown>) => void;
};

export const useWorkspaceChanges = ({ workspace, openPreview }: UseWorkspaceChangesOptions) => {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<IWorkspaceGitChange[]>([]);
  const [isRepository, setIsRepository] = useState(false);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    const response = await ipcBridge.fs.getWorkspaceGitChanges.invoke({ path: workspace });
    if (!response.success || !response.data) {
      setChanges([]);
      setIsRepository(false);
      setLoading(false);
      return;
    }

    setChanges(response.data.changes);
    setIsRepository(Boolean(response.data.repository?.isRepository));
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

  return {
    loading,
    changes,
    isRepository,
    reload: loadChanges,
    openChangePreview,
  };
};
