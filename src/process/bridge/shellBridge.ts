/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ipcBridge } from '@/common';

const getPathApi = () => (process.platform === 'win32' ? path.win32 : path.posix);

const resolveUserPath = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  const pathApi = getPathApi();

  if (trimmed.startsWith('~')) {
    return pathApi.resolve(trimmed.replace(/^~(?=$|[\\/])/, os.homedir()));
  }

  return pathApi.resolve(trimmed);
};

const findExistingTarget = (input: string): { resolvedPath: string; existingPath: string | null; exists: boolean } => {
  const pathApi = getPathApi();
  const resolvedPath = resolveUserPath(input);
  let currentPath = resolvedPath;

  while (currentPath && currentPath !== pathApi.dirname(currentPath)) {
    if (fs.existsSync(currentPath)) {
      return { resolvedPath, existingPath: currentPath, exists: currentPath === resolvedPath };
    }
    currentPath = pathApi.dirname(currentPath);
  }

  if (fs.existsSync(currentPath)) {
    return { resolvedPath, existingPath: currentPath, exists: currentPath === resolvedPath };
  }

  return { resolvedPath, existingPath: null, exists: false };
};

async function openResolvedPath(targetPath: string): Promise<void> {
  const resolvedPath = resolveUserPath(targetPath);
  const result = await shell.openPath(resolvedPath);
  if (result) {
    throw new Error(result);
  }
}

async function revealResolvedPath(targetPath: string): Promise<{ resolvedPath: string; exists: boolean }> {
  const { resolvedPath, existingPath, exists } = findExistingTarget(targetPath);

  if (!existingPath) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(existingPath);
  if (stat.isDirectory()) {
    const result = await shell.openPath(existingPath);
    if (result) {
      throw new Error(result);
    }
  } else {
    shell.showItemInFolder(existingPath);
  }

  return { resolvedPath, exists };
}

export function initShellBridge(): void {
  ipcBridge.shell.openFile.provider(async (path) => {
    await openResolvedPath(path);
  });

  ipcBridge.shell.showItemInFolder.provider((targetPath): Promise<void> => {
    return revealResolvedPath(targetPath).then((): void => undefined);
  });

  ipcBridge.shell.openExternal.provider((url): Promise<void> => {
    return shell.openExternal(url);
  });

  ipcBridge.shell.revealPath.provider((targetPath) => revealResolvedPath(targetPath));
}
