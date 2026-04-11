/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import type { ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import { createDefaultManagedSlashCommandLibrary, normalizeManagedSlashCommandLibrary } from '@/common/chat/slash/library';
import type { TChatConversation } from '@/common/config/storage';
import { findBuiltinAssistantPreset } from '@/common/config/presets/builtinAssistantDefaults';
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
export const WORKSPACE_COMMANDS_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'commands.json');
export const WORKSPACE_SCHEDULES_FILE = path.join(WORKSPACE_AUTOMATION_DIR, 'schedules.json');
export const WORKSPACE_RUNTIME_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'runtime');
export const WORKSPACE_SCHEDULE_RUNTIME_DIR = path.join(WORKSPACE_RUNTIME_DIR, 'schedules');

const HARNESS_WORKSPACE_ASSISTANT_IDS = new Set(['builtin-superpowers', 'builtin-everything-in-claude-code']);

const HARNESS_WORKSPACE_COMMANDS: ManagedSlashCommandRecord[] = [
  ...createDefaultManagedSlashCommandLibrary(),
  {
    type: 'custom',
    id: 'harness-brainstorm',
    enabled: true,
    name: 'brainstorm',
    description: 'Turn a vague request into an explicit design before implementation.',
    template:
      'Use the `brainstorming` skill for this request. Explore the repository context, clarify the goal and constraints, compare a small number of approaches, then present a concrete design before editing files.',
  },
  {
    type: 'custom',
    id: 'harness-write-plan',
    enabled: true,
    name: 'write-plan',
    description: 'Write an implementation plan with concrete files, steps, and verification.',
    template:
      'Use the `writing-plans` skill for this request. Convert the approved requirements or spec into an implementation plan with explicit files, ordered steps, validation commands, and crisp checkpoints before coding.',
  },
  {
    type: 'custom',
    id: 'harness-execute-plan',
    enabled: true,
    name: 'execute-plan',
    description: 'Execute an implementation plan in a controlled, verifiable sequence.',
    template:
      'Use the `executing-plans` skill for this request. Review the plan critically first, then execute it step by step with visible checkpoints, targeted verification, and no skipped validation. If delegation is both supported and explicitly requested, prefer `subagent-driven-development`.',
  },
  {
    type: 'custom',
    id: 'harness-worktree',
    enabled: true,
    name: 'worktree',
    description: 'Prepare an isolated git worktree before risky or multi-step delivery.',
    template:
      'Use the `using-git-worktrees` skill for this request. Set up an isolated worktree only if this repository and runtime support it, verify the ignore and baseline state, then report the exact worktree path and readiness.',
  },
  {
    type: 'custom',
    id: 'harness-parallel',
    enabled: true,
    name: 'parallelize',
    description: 'Split independent work into parallel streams with clear integration boundaries.',
    template:
      'Use the `dispatching-parallel-agents` skill for this request. Break the work into independent streams, define ownership and verification for each stream, and only delegate when the runtime supports it and the user has asked for that style of execution.',
  },
  {
    type: 'custom',
    id: 'harness-request-review',
    enabled: true,
    name: 'request-review',
    description: 'Request a structured code review before moving forward or merging.',
    template:
      'Use the `requesting-code-review` skill for this request. Gather the relevant scope, diffs, and requirements, then prepare a focused review ask that prioritizes correctness, regressions, and missing tests.',
  },
  {
    type: 'custom',
    id: 'harness-apply-review',
    enabled: true,
    name: 'apply-review',
    description: 'Evaluate review feedback rigorously before implementing it.',
    template:
      'Use the `receiving-code-review` skill for this request. Verify each review item against the codebase, challenge incorrect assumptions with technical evidence, then implement confirmed fixes one item at a time with validation.',
  },
  {
    type: 'custom',
    id: 'harness-debug-root-cause',
    enabled: true,
    name: 'debug-root-cause',
    description: 'Investigate failures methodically before attempting fixes.',
    template:
      'Use the `systematic-debugging` skill for this request. Reproduce the issue, trace the evidence, identify the root cause, and only then propose or implement the smallest meaningful fix with validation.',
  },
  {
    type: 'custom',
    id: 'harness-finish-branch',
    enabled: true,
    name: 'finish-branch',
    description: 'Close out a development branch with verification and explicit integration choice.',
    template:
      'Use the `finishing-a-development-branch` skill for this request. Verify the final state first, then present the next-step options clearly and execute only the workflow the user chooses.',
  },
];

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

const resolveConversationWorkspace = (conversation?: Pick<TChatConversation, 'extra'>): string | undefined => {
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  const workingDirectory = typeof extra?.workingDirectory === 'string' ? extra.workingDirectory : undefined;
  const workspace = typeof extra?.workspace === 'string' ? extra.workspace : undefined;
  return resolveWorkspacePath(workingDirectory || workspace);
};

const collectHarnessAssistantIds = (conversation?: Pick<TChatConversation, 'type' | 'extra'>): string[] => {
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

  if (typeof extra?.presetAssistantId === 'string' && HARNESS_WORKSPACE_ASSISTANT_IDS.has(extra.presetAssistantId)) {
    assistantIds.add(extra.presetAssistantId);
  }

  if (!Array.isArray(extra?.participants)) {
    return [...assistantIds];
  }

  for (const participant of extra.participants) {
    if (typeof participant?.assistantId === 'string' && HARNESS_WORKSPACE_ASSISTANT_IDS.has(participant.assistantId)) {
      assistantIds.add(participant.assistantId);
    }

    const nestedAssistantId = participant?.conversation?.extra?.presetAssistantId;
    if (typeof nestedAssistantId === 'string' && HARNESS_WORKSPACE_ASSISTANT_IDS.has(nestedAssistantId)) {
      assistantIds.add(nestedAssistantId);
    }
  }

  return [...assistantIds];
};

const resolveHarnessHookDirs = async (assistantIds: string[]): Promise<Array<{ name: string; dir: string }>> => {
  if (assistantIds.length === 0) {
    return [];
  }

  const builtinHooksDir = getBuiltinHooksCopyDir();
  const hookNames = new Set<string>();

  for (const assistantId of assistantIds) {
    const preset = findBuiltinAssistantPreset(assistantId);
    preset?.defaultEnabledHooks?.forEach((hookName) => hookNames.add(hookName));
  }

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
    await fs.writeFile(commandsFile, `${JSON.stringify(normalizeManagedSlashCommandLibrary(library), null, 2)}\n`, 'utf-8');
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

export const ensureHarnessWorkspaceAutomationForConversation = async (
  conversation?: Pick<TChatConversation, 'type' | 'extra'>
): Promise<void> => {
  const assistantIds = collectHarnessAssistantIds(conversation);
  if (assistantIds.length === 0) {
    return;
  }

  const workspace = resolveConversationWorkspace(conversation);
  if (!workspace) {
    return;
  }

  await ensureWorkspaceCommandLibrary(workspace, HARNESS_WORKSPACE_COMMANDS);
  await ensureHooksIntoWorkspace(workspace, await resolveHarnessHookDirs(assistantIds));
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
