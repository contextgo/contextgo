/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENGINEERING_DEFAULT_HOOKS } from '../../../../src/common/config/presets/assistantPresets';

const mockState = {
  builtinHooksDir: '',
};

vi.mock('@process/utils/initStorage', () => ({
  getBuiltinHooksCopyDir: () => mockState.builtinHooksDir,
}));

import {
  ensureHarnessWorkspaceAutomationForConversation,
  getWorkspaceCommandsFile,
  getWorkspaceHookDir,
} from '../../../../src/process/bridge/services/workspaceAutomation';

const seedBuiltinHooks = async (rootDir: string): Promise<void> => {
  for (const hookName of ENGINEERING_DEFAULT_HOOKS) {
    const hookDir = path.join(rootDir, hookName);
    const templateFile = hookName === 'continuity-handoff' ? 'after_response.md' : 'before_user_prompt.md';
    const eventName = hookName === 'continuity-handoff' ? 'after_response' : 'before_user_prompt';
    const executionType = hookName === 'continuity-handoff' ? 'native-projection' : 'prompt-transform';

    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, 'manifest.json'),
      `${JSON.stringify(
        {
          name: hookName,
          executionType,
          events: [eventName],
        },
        null,
        2
      )}\n`,
      'utf-8'
    );
    await fs.writeFile(path.join(hookDir, templateFile), `# ${hookName}\n`, 'utf-8');
  }
};

describe('workspaceAutomation harness bootstrap', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-workspace-automation-'));
    mockState.builtinHooksDir = path.join(tempRoot, 'builtin-hooks');
    await seedBuiltinHooks(mockState.builtinHooksDir);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('creates project commands and copies builtin hooks for a harness conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-a');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-superpowers',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = JSON.parse(await fs.readFile(commandsFile!, 'utf-8')) as Array<{
      type: string;
      id: string;
      name?: string;
    }>;
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'builtin', id: 'plan' }),
        expect.objectContaining({ type: 'custom', id: 'harness-brainstorm', name: 'brainstorm' }),
        expect.objectContaining({ type: 'custom', id: 'harness-write-plan', name: 'write-plan' }),
        expect.objectContaining({ type: 'custom', id: 'harness-execute-plan', name: 'execute-plan' }),
        expect.objectContaining({ type: 'custom', id: 'harness-worktree', name: 'worktree' }),
        expect.objectContaining({ type: 'custom', id: 'harness-parallel', name: 'parallelize' }),
        expect.objectContaining({ type: 'custom', id: 'harness-request-review', name: 'request-review' }),
        expect.objectContaining({ type: 'custom', id: 'harness-apply-review', name: 'apply-review' }),
        expect.objectContaining({ type: 'custom', id: 'harness-debug-root-cause', name: 'debug-root-cause' }),
        expect.objectContaining({ type: 'custom', id: 'harness-finish-branch', name: 'finish-branch' }),
      ])
    );

    const qualityGateDir = getWorkspaceHookDir(workspaceDir, 'quality-gate');
    expect(qualityGateDir).not.toBeNull();
    await expect(fs.readFile(path.join(qualityGateDir!, 'before_user_prompt.md'), 'utf-8')).resolves.toContain(
      'quality-gate'
    );
  });

  it('bootstraps group workspaces when a harness assistant appears in the participant set', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-group');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'group',
      extra: {
        workspace: workspaceDir,
        participants: [
          {
            assistantId: 'builtin-everything-in-claude-code',
            conversation: {
              extra: {
                presetAssistantId: 'builtin-everything-in-claude-code',
              },
            },
          },
        ],
      },
    } as any);

    await expect(fs.readFile(getWorkspaceCommandsFile(workspaceDir)!, 'utf-8')).resolves.toContain('harness-brainstorm');
  });

  it('does not overwrite existing project commands or hook copies', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-customized');
    const commandsFile = getWorkspaceCommandsFile(workspaceDir)!;
    const qualityGateDir = getWorkspaceHookDir(workspaceDir, 'quality-gate')!;
    const qualityGatePrompt = path.join(qualityGateDir, 'before_user_prompt.md');

    await fs.mkdir(path.dirname(commandsFile), { recursive: true });
    await fs.writeFile(
      commandsFile,
      `${JSON.stringify(
        [
          {
            type: 'custom',
            id: 'keep-me',
            enabled: true,
            name: 'keep-me',
            description: 'Existing project command',
            template: 'Keep existing command',
          },
        ],
        null,
        2
      )}\n`,
      'utf-8'
    );
    await fs.mkdir(qualityGateDir, { recursive: true });
    await fs.writeFile(qualityGatePrompt, 'workspace-customized\n', 'utf-8');

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-superpowers',
      },
    } as any);

    await expect(fs.readFile(commandsFile, 'utf-8')).resolves.toContain('"keep-me"');
    await expect(fs.readFile(commandsFile, 'utf-8')).resolves.not.toContain('harness-brainstorm');
    await expect(fs.readFile(qualityGatePrompt, 'utf-8')).resolves.toBe('workspace-customized\n');

    const planHookDir = getWorkspaceHookDir(workspaceDir, 'plan-before-coding');
    expect(planHookDir).not.toBeNull();
    await expect(fs.readFile(path.join(planHookDir!, 'before_user_prompt.md'), 'utf-8')).resolves.toContain(
      'plan-before-coding'
    );
  });
});
