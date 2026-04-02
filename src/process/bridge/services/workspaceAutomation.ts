/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { copyDirectoryRecursively } from '@process/utils';

export const resolveWorkspacePath = (workspace?: string): string | undefined => {
  if (!workspace || !workspace.trim()) {
    return undefined;
  }

  return path.resolve(workspace);
};

export const WORKSPACE_AUTOMATION_DIR = '.contextgo';
export const WORKSPACE_HOOKS_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'hooks');

export const getWorkspaceHooksDir = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_HOOKS_DIR);
};

export const getWorkspaceHookDir = (workspace: string | undefined, hookName: string): string | null => {
  const hooksDir = getWorkspaceHooksDir(workspace);
  if (!hooksDir) {
    return null;
  }

  return path.join(hooksDir, hookName);
};

export const copyHooksIntoWorkspace = async (
  workspace: string | undefined,
  hookDirs: Array<{ name: string; dir: string }>
): Promise<void> => {
  const hooksDir = getWorkspaceHooksDir(workspace);
  if (!hooksDir || hookDirs.length === 0) {
    return;
  }

  await fs.mkdir(hooksDir, { recursive: true });

  for (const hook of hookDirs) {
    const targetDir = path.join(hooksDir, hook.name);
    await copyDirectoryRecursively(hook.dir, targetDir, {
      overwrite: true,
      removeStale: true,
    });
  }
};

export const copyWorkspaceAutomationHooks = async (
  sourceWorkspace: string | undefined,
  targetWorkspace: string | undefined
): Promise<void> => {
  const sourceHooksDir = getWorkspaceHooksDir(sourceWorkspace);
  const targetHooksDir = getWorkspaceHooksDir(targetWorkspace);

  if (!sourceHooksDir || !targetHooksDir || sourceHooksDir === targetHooksDir) {
    return;
  }

  try {
    await fs.access(sourceHooksDir);
  } catch {
    return;
  }

  await fs.mkdir(targetHooksDir, { recursive: true });
  await copyDirectoryRecursively(sourceHooksDir, targetHooksDir, {
    overwrite: true,
    removeStale: true,
  });
};
