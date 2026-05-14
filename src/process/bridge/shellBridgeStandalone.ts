/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shell Bridge - Standalone (no-Electron) Mode
 *
 * Implements shell operations using Node.js child_process instead of Electron
 * shell APIs. Works for both local standalone and headless server deployments.
 */

import { ipcBridge } from '@/common';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const getPathApi = () => (process.platform === 'win32' ? path.win32 : path.posix);

function runOpen(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, ...rest] =
      process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', ...args]
        : process.platform === 'darwin'
          ? ['open', ...args]
          : ['xdg-open', ...args];
    execFile(cmd, rest, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

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

export function initShellBridgeStandalone(): void {
  ipcBridge.shell.openFile.provider((filePath) => runOpen([resolveUserPath(filePath)]));

  ipcBridge.shell.showItemInFolder.provider((filePath) => {
    const pathApi = getPathApi();
    const { existingPath, resolvedPath } = findExistingTarget(filePath);
    if (!existingPath) {
      return Promise.reject(new Error(`Path does not exist: ${resolvedPath}`));
    }

    const nextTarget = fs.statSync(existingPath).isDirectory() ? existingPath : pathApi.dirname(existingPath);
    return runOpen([nextTarget]);
  });

  ipcBridge.shell.openExternal.provider((url) => runOpen([url]));

  ipcBridge.shell.revealPath.provider(async (targetPath) => {
    const pathApi = getPathApi();
    const { existingPath, resolvedPath, exists } = findExistingTarget(targetPath);
    if (!existingPath) {
      throw new Error(`Path does not exist: ${resolvedPath}`);
    }

    const nextTarget = fs.statSync(existingPath).isDirectory() ? existingPath : pathApi.dirname(existingPath);
    await runOpen([nextTarget]);
    return { resolvedPath, exists };
  });
}
