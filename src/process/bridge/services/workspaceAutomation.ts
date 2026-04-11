/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import type { ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import { normalizeManagedSlashCommandLibrary } from '@/common/chat/slash/library';
import { copyDirectoryRecursively } from '@process/utils';

export const resolveWorkspacePath = (workspace?: string): string | undefined => {
  if (!workspace || !workspace.trim()) {
    return undefined;
  }

  return path.resolve(workspace);
};

export const WORKSPACE_AUTOMATION_DIR = '.contextgo';
export const WORKSPACE_HOOKS_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'hooks');
export const WORKSPACE_COMMANDS_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'commands.json');
export const WORKSPACE_SCHEDULES_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'schedules.json');
export const WORKSPACE_RUNTIME_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'runtime');
export const WORKSPACE_SCHEDULE_RUNTIME_DIR = path.join(WORKSPACE_RUNTIME_DIR, 'schedules');

export const getWorkspaceHooksDir = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_HOOKS_DIR);
};

export const getWorkspaceCommandsFile = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_COMMANDS_FILE);
};

export const getWorkspaceSchedulesFile = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_SCHEDULES_FILE);
};

export const getWorkspaceRuntimeDir = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_RUNTIME_DIR);
};

export const getWorkspaceScheduleRuntimeDir = (workspace: string | undefined, scheduleId: string): string | null => {
  const runtimeDir = getWorkspaceRuntimeDir(workspace);
  if (!runtimeDir) {
    return null;
  }

  return path.join(runtimeDir, 'schedules', scheduleId);
};

export const getWorkspaceScheduleRuntimeStateFile = (
  workspace: string | undefined,
  scheduleId: string
): string | null => {
  const scheduleRuntimeDir = getWorkspaceScheduleRuntimeDir(workspace, scheduleId);
  if (!scheduleRuntimeDir) {
    return null;
  }

  return path.join(scheduleRuntimeDir, 'state.json');
};

export const getWorkspaceScheduleRuntimeHistoryFile = (
  workspace: string | undefined,
  scheduleId: string
): string | null => {
  const scheduleRuntimeDir = getWorkspaceScheduleRuntimeDir(workspace, scheduleId);
  if (!scheduleRuntimeDir) {
    return null;
  }

  return path.join(scheduleRuntimeDir, 'history.jsonl');
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

async function readWorkspaceAutomationJson<T>(filePath: string | null): Promise<T | null> {
  if (!filePath) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return null;
    }

    console.warn('[workspaceAutomation] Failed to read workspace automation file:', filePath, error);
    return null;
  }
}

export const readWorkspaceCommandLibrary = async (workspace?: string): Promise<ManagedSlashCommandRecord[] | null> => {
  const content = await readWorkspaceAutomationJson<unknown>(getWorkspaceCommandsFile(workspace));
  if (content === null) {
    return null;
  }

  return normalizeManagedSlashCommandLibrary(content);
};
