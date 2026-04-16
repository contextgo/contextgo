/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { normalizeManagedSlashCommandLibrary, type ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import type { AgentPackageWorkspaceAutomationProfile } from '@/common/config/presets/agentPackageManifest';
import type { TChatConversation } from '@/common/config/storage';
import { findBuiltinAssistantPreset } from '@/common/config/presets/builtinAssistantDefaults';
import {
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageWorkspaceAutomationProfile,
} from '@/common/config/presets/bundledAgentPackageRegistry';
import {
  getWorkspaceAutomationProfileDefinition,
  materializeWorkspaceCommandLibrary,
  type WorkspaceAutomationScheduleSeed,
} from '@/common/config/presets/workspaceAutomationProfiles';
import i18n from '@process/services/i18n';
import { copyDirectoryRecursively } from '@process/utils';
import { getBuiltinHooksCopyDir } from '@process/utils/initStorage';

export const resolveWorkspacePath = (workspace?: string): string | undefined => {
  if (!workspace || !workspace.trim()) {
    return undefined;
  }

  return path.resolve(workspace);
};

export const WORKSPACE_AUTOMATION_DIR = '.contextgo';
export const WORKSPACE_HOOKS_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'hooks');
export const WORKSPACE_HOOKS_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'hooks.json');
export const WORKSPACE_COMMANDS_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'commands.json');
export const WORKSPACE_SCHEDULES_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'schedules.json');
export const WORKSPACE_RUNTIME_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'runtime');
export const WORKSPACE_SCHEDULE_RUNTIME_DIR = path.join(WORKSPACE_RUNTIME_DIR, 'schedules');

const resolveBuiltinText = (key: string, defaultValue: string): string => i18n.t(key, { defaultValue });
type WorkspaceAutomationProfileConfig = {
  commands?: ManagedSlashCommandRecord[];
  hookNames?: string[];
  schedules?: WorkspaceAutomationScheduleSeed;
};

const normalizeWorkspaceHookNames = (content: unknown): string[] => {
  const enabledHooks = Array.isArray(content)
    ? content
    : content && typeof content === 'object' && 'enabledHooks' in content
      ? (content as { enabledHooks?: unknown }).enabledHooks
      : undefined;

  if (!Array.isArray(enabledHooks)) {
    return [];
  }

  return [
    ...new Set(
      enabledHooks
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
};

const resolveWorkspaceAutomationProfileConfig = (assistantId: string): WorkspaceAutomationProfileConfig | null => {
  const workspaceAutomationProfile = getBundledAgentPackageWorkspaceAutomationProfile(assistantId);
  const definition = getWorkspaceAutomationProfileDefinition(
    workspaceAutomationProfile as AgentPackageWorkspaceAutomationProfile | undefined
  );
  if (!definition) {
    return null;
  }

  return {
    commands: materializeWorkspaceCommandLibrary(definition.commandSeeds, resolveBuiltinText),
    hookNames: getBundledAgentPackageDefaultEnabledHookNames(assistantId) ?? [],
    schedules: {
      conversationSchedules: [...definition.scheduleSeed.conversationSchedules],
    },
  };
};

const getWorkspaceAutomationProfile = (assistantId: string): WorkspaceAutomationProfileConfig | null => {
  const preset = findBuiltinAssistantPreset(assistantId);
  if (!preset) {
    return null;
  }

  return resolveWorkspaceAutomationProfileConfig(assistantId);
};

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

export const getWorkspaceHooksFile = (workspace?: string): string | null => {
  const resolvedWorkspace = resolveWorkspacePath(workspace);
  if (!resolvedWorkspace) {
    return null;
  }

  return path.join(resolvedWorkspace, WORKSPACE_HOOKS_FILE);
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

const resolveConversationWorkspace = (conversation?: Pick<TChatConversation, 'extra'>): string | undefined => {
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  const workingDirectory = typeof extra?.workingDirectory === 'string' ? extra.workingDirectory : undefined;
  const workspace = typeof extra?.workspace === 'string' ? extra.workspace : undefined;
  return resolveWorkspacePath(workingDirectory || workspace);
};

const collectWorkspaceAutomationAssistantIds = (conversation?: Pick<TChatConversation, 'type' | 'extra'>): string[] => {
  if (!conversation) {
    return [];
  }

  const assistantIds = new Set<string>();
  const extra = conversation.extra as
    | {
        presetAssistantId?: string;
        participants?: Array<{
          assistantId?: string;
          conversation?: {
            extra?: {
              presetAssistantId?: string;
            };
          };
        }>;
      }
    | undefined;

  const pushAssistantId = (assistantId: unknown) => {
    if (typeof assistantId !== 'string') {
      return;
    }

    if (getWorkspaceAutomationProfile(assistantId)) {
      assistantIds.add(assistantId);
    }
  };

  pushAssistantId(extra?.presetAssistantId);

  if (!Array.isArray(extra?.participants)) {
    return [...assistantIds];
  }

  for (const participant of extra.participants) {
    pushAssistantId(participant?.assistantId);
    pushAssistantId(participant?.conversation?.extra?.presetAssistantId);
  }

  return [...assistantIds];
};

const resolveContextgoHarnessHookDirs = async (hookNames: string[]): Promise<Array<{ name: string; dir: string }>> => {
  if (hookNames.length === 0) {
    return [];
  }

  const builtinHooksDir = getBuiltinHooksCopyDir();
  const hookDirs: Array<{ name: string; dir: string }> = [];

  for (const hookName of hookNames) {
    const hookDir = path.join(builtinHooksDir, hookName);
    try {
      await fs.access(hookDir);
      hookDirs.push({ name: hookName, dir: hookDir });
    } catch {
      console.warn('[workspaceAutomation] Missing builtin hook for workspace bootstrap:', hookName);
    }
  }

  return hookDirs;
};

const ensureHooksIntoWorkspace = async (
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
    try {
      await fs.access(targetDir);
      continue;
    } catch {
      await copyDirectoryRecursively(hook.dir, targetDir, {
        overwrite: false,
        removeStale: false,
      });
    }
  }
};

const ensureWorkspaceHookSelection = async (workspace: string | undefined, hookNames: string[]): Promise<void> => {
  const hooksFile = getWorkspaceHooksFile(workspace);
  const normalizedHookNames = normalizeWorkspaceHookNames(hookNames);
  if (!hooksFile || normalizedHookNames.length === 0) {
    return;
  }

  try {
    await fs.access(hooksFile);
    return;
  } catch {
    await fs.mkdir(path.dirname(hooksFile), { recursive: true });
    await fs.writeFile(
      hooksFile,
      JSON.stringify(
        {
          enabledHooks: normalizedHookNames,
        },
        null,
        2
      ) + '\n',
      'utf-8'
    );
  }
};

const ensureWorkspaceCommandLibrary = async (
  workspace: string | undefined,
  library: ManagedSlashCommandRecord[]
): Promise<void> => {
  const commandsFile = getWorkspaceCommandsFile(workspace);
  if (!commandsFile) {
    return;
  }

  try {
    await fs.access(commandsFile);
    return;
  } catch {
    await fs.mkdir(path.dirname(commandsFile), { recursive: true });
    await fs.writeFile(commandsFile, JSON.stringify(library, null, 2) + '\n', 'utf-8');
  }
};

const ensureWorkspaceSchedulesSeed = async (
  workspace: string | undefined,
  schedules: WorkspaceAutomationScheduleSeed
): Promise<void> => {
  const schedulesFile = getWorkspaceSchedulesFile(workspace);
  if (!schedulesFile) {
    return;
  }

  try {
    await fs.access(schedulesFile);
    return;
  } catch {
    await fs.mkdir(path.dirname(schedulesFile), { recursive: true });
    await fs.writeFile(schedulesFile, JSON.stringify(schedules, null, 2) + '\n', 'utf-8');
  }
};

const ensureWorkspaceAutomationProfile = async (workspace: string | undefined, assistantId: string): Promise<void> => {
  const profile = getWorkspaceAutomationProfile(assistantId);
  if (!profile || !workspace) {
    return;
  }

  if (profile.commands) {
    await ensureWorkspaceCommandLibrary(workspace, profile.commands);
  }

  if (profile.hookNames) {
    await ensureHooksIntoWorkspace(workspace, await resolveContextgoHarnessHookDirs(profile.hookNames));
    await ensureWorkspaceHookSelection(workspace, profile.hookNames);
  }

  if (profile.schedules) {
    await ensureWorkspaceSchedulesSeed(workspace, profile.schedules);
  }
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
  const sourceHooksFile = getWorkspaceHooksFile(sourceWorkspace);
  const targetHooksFile = getWorkspaceHooksFile(targetWorkspace);

  const shouldCopyHookDir =
    typeof sourceHooksDir === 'string' && typeof targetHooksDir === 'string' && sourceHooksDir !== targetHooksDir;
  const shouldCopyHookConfig =
    typeof sourceHooksFile === 'string' && typeof targetHooksFile === 'string' && sourceHooksFile !== targetHooksFile;

  if (!shouldCopyHookDir && !shouldCopyHookConfig) {
    return;
  }

  if (shouldCopyHookDir) {
    try {
      await fs.access(sourceHooksDir);
      await fs.mkdir(targetHooksDir, { recursive: true });
      await copyDirectoryRecursively(sourceHooksDir, targetHooksDir, {
        overwrite: true,
        removeStale: true,
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (shouldCopyHookConfig) {
    try {
      await fs.access(sourceHooksFile);
      await fs.mkdir(path.dirname(targetHooksFile), { recursive: true });
      await fs.copyFile(sourceHooksFile, targetHooksFile);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }
};

export const copyWorkspaceAutomationCommands = async (
  sourceWorkspace: string | undefined,
  targetWorkspace: string | undefined
): Promise<void> => {
  const sourceCommandsFile = getWorkspaceCommandsFile(sourceWorkspace);
  const targetCommandsFile = getWorkspaceCommandsFile(targetWorkspace);

  if (!sourceCommandsFile || !targetCommandsFile || sourceCommandsFile === targetCommandsFile) {
    return;
  }

  try {
    await fs.access(sourceCommandsFile);
  } catch {
    return;
  }

  await fs.mkdir(path.dirname(targetCommandsFile), { recursive: true });
  await fs.copyFile(sourceCommandsFile, targetCommandsFile);
};

export const ensureHarnessWorkspaceAutomationForConversation = async (
  conversation?: Pick<TChatConversation, 'type' | 'extra'>
): Promise<void> => {
  const assistantIds = collectWorkspaceAutomationAssistantIds(conversation);
  if (assistantIds.length === 0) {
    return;
  }

  const workspace = resolveConversationWorkspace(conversation);
  if (!workspace) {
    return;
  }

  for (const assistantId of assistantIds) {
    await ensureWorkspaceAutomationProfile(workspace, assistantId);
  }
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

export const readWorkspaceHookSelection = async (workspace?: string): Promise<string[] | null> => {
  const hooksFile = getWorkspaceHooksFile(workspace);
  if (!hooksFile) {
    return null;
  }

  try {
    const raw = await fs.readFile(hooksFile, 'utf-8');
    return normalizeWorkspaceHookNames(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ENOENT' || /ENOENT|no such file or directory/i.test(message)) {
      return null;
    }

    console.warn('[workspaceAutomation] Failed to read workspace hook selection:', hooksFile, error);
    return [];
  }
};
