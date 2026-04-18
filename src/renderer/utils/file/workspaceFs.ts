/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import type { FileOrFolderItem } from './fileTypes';

interface IBridgeResponse<D = unknown> {
  success: boolean;
  data?: D;
  msg?: string;
}

/**
 * Remove a file or directory from the workspace using the main-process bridge.
 * 调用主进程桥接接口从工作空间中移除文件或文件夹。
 */
export const removeWorkspaceEntry = (path: string) => {
  return ipcBridge.fs.removeEntry.invoke({ path }) as Promise<IBridgeResponse>;
};

/**
 * Rename a file or directory inside the workspace.
 * 调用主进程桥接接口重命名工作空间中的文件或文件夹。
 */
export const renameWorkspaceEntry = (path: string, newName: string) => {
  return ipcBridge.fs.renameEntry.invoke({ path, newName }) as Promise<IBridgeResponse<{ newPath: string }>>;
};

const flattenWorkspaceTree = (entries: IDirOrFile[]): FileOrFolderItem[] => {
  const files: FileOrFolderItem[] = [];

  const visit = (entry: IDirOrFile) => {
    if (entry.isFile) {
      files.push({
        path: entry.fullPath,
        name: entry.name,
        isFile: true,
        relativePath: entry.relativePath || undefined,
      });
      return;
    }

    entry.children?.forEach(visit);
  };

  entries.forEach(visit);

  return files.toSorted((left, right) => {
    const leftPath = left.relativePath || left.name;
    const rightPath = right.relativePath || right.name;
    return leftPath.localeCompare(rightPath);
  });
};

/**
 * List all workspace files as flattened mention-ready items.
 * 拉平工作区树，返回适合 `@workspace` 联想的文件列表。
 */
export const listWorkspaceFileItems = async (workspacePath: string): Promise<FileOrFolderItem[]> => {
  const tree = await ipcBridge.fs.getFilesByDir.invoke({ dir: workspacePath, root: workspacePath });
  return flattenWorkspaceTree(tree);
};
