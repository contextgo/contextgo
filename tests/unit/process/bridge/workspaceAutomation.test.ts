/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBundledAgentPackageDefaultEnabledHookNames } from '../../../../src/common/config/presets/bundledAgentPackageRegistry';
import type { TChatConversation } from '../../../../src/common/config/storage';

const ENGINEERING_DEFAULT_HOOKS = getBundledAgentPackageDefaultEnabledHookNames('builtin-superpowers')!;

const mockState = {
  builtinHooksDir: '',
};

vi.mock('@process/utils/initStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@process/utils/initStorage')>();
  return {
    ...actual,
    getBuiltinHooksCopyDir: () => mockState.builtinHooksDir,
  };
});

import {
  copyWorkspaceAutomationHooks,
  copyWorkspaceAutomationCommands,
  ensureHarnessWorkspaceAutomationForConversation,
  getWorkspaceCommandsFile,
  getWorkspaceHookDir,
  getWorkspaceHooksFile,
  getWorkspaceSchedulesFile,
  readWorkspaceHookSelection,
} from '../../../../src/process/bridge/services/workspaceAutomation';

type ProjectCommandRecord = {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
};

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

const readCommandLibrary = async (workspaceDir: string): Promise<ProjectCommandRecord[]> => {
  return JSON.parse(await fs.readFile(getWorkspaceCommandsFile(workspaceDir)!, 'utf-8')) as ProjectCommandRecord[];
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

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plan',
          name: 'plan',
          description: expect.any(String),
          template: expect.any(String),
        }),
        expect.objectContaining({ id: 'harness-brainstorm', name: 'brainstorm' }),
        expect.objectContaining({ id: 'harness-write-plan', name: 'write-plan' }),
        expect.objectContaining({ id: 'harness-execute-plan', name: 'execute-plan' }),
        expect.objectContaining({ id: 'harness-worktree', name: 'worktree' }),
        expect.objectContaining({ id: 'harness-parallel', name: 'parallelize' }),
        expect.objectContaining({ id: 'harness-request-review', name: 'request-review' }),
        expect.objectContaining({ id: 'harness-apply-review', name: 'apply-review' }),
        expect.objectContaining({ id: 'harness-debug-root-cause', name: 'debug-root-cause' }),
        expect.objectContaining({ id: 'harness-finish-branch', name: 'finish-branch' }),
      ])
    );

    const qualityGateDir = getWorkspaceHookDir(workspaceDir, 'quality-gate');
    expect(qualityGateDir).not.toBeNull();
    await expect(fs.readFile(path.join(qualityGateDir!, 'before_user_prompt.md'), 'utf-8')).resolves.toContain(
      'quality-gate'
    );
    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toEqual(ENGINEERING_DEFAULT_HOOKS);
  });

  it('bootstraps ECC workspace automation when the assistant appears in a group participant set', async () => {
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

    await expect(fs.readFile(getWorkspaceCommandsFile(workspaceDir)!, 'utf-8')).resolves.toContain('ecc-quality-gate');
    await expect(fs.readFile(getWorkspaceSchedulesFile(workspaceDir)!, 'utf-8')).resolves.toContain(
      '"conversationSchedules": []'
    );
    await expect(fs.access(path.join(workspaceDir, '.claude'))).rejects.toThrow();
  });

  it('creates PM workspace commands without engineering hooks for a PM workbench conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-pm');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-pm-workbench',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'pm-discover', name: 'discover' }),
        expect.objectContaining({ id: 'pm-strategy', name: 'strategy' }),
        expect.objectContaining({ id: 'pm-write-prd', name: 'write-prd' }),
        expect.objectContaining({ id: 'pm-plan-roadmap', name: 'plan-roadmap' }),
        expect.objectContaining({ id: 'pm-prioritize', name: 'prioritize' }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Startup Strategist workspace commands without engineering hooks for a startup strategist conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-startup');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-startup-strategist',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'startup-stress-idea', name: 'stress-idea' }),
        expect.objectContaining({ id: 'startup-design-canvas', name: 'design-canvas' }),
        expect.objectContaining({ id: 'startup-scan-market', name: 'scan-market' }),
        expect.objectContaining({ id: 'startup-define-icp', name: 'define-icp' }),
        expect.objectContaining({ id: 'startup-shape-value-prop', name: 'shape-value-prop' }),
        expect.objectContaining({ id: 'startup-plan-gtm', name: 'plan-gtm' }),
        expect.objectContaining({ id: 'startup-set-north-star', name: 'set-north-star' }),
        expect.objectContaining({
          id: 'startup-write-founder-brief',
          name: 'write-founder-brief',
        }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Design Director workspace commands without engineering hooks for a design director conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-design');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-design-director',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'design-pick-style', name: 'pick-style' }),
        expect.objectContaining({ id: 'design-draft-system', name: 'draft-design-system' }),
        expect.objectContaining({ id: 'design-art-direct-page', name: 'art-direct-page' }),
        expect.objectContaining({ id: 'design-critique-ui', name: 'critique-ui' }),
        expect.objectContaining({ id: 'design-review-screenshot', name: 'review-screenshot' }),
        expect.objectContaining({
          id: 'design-absorb-figma-reference',
          name: 'absorb-figma-reference',
        }),
        expect.objectContaining({ id: 'design-adapt-system', name: 'adapt-system' }),
        expect.objectContaining({ id: 'design-spec-component', name: 'spec-component' }),
        expect.objectContaining({ id: 'design-write-handoff', name: 'write-handoff' }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Motion Studio workspace commands without engineering hooks for a motion studio conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-motion');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-motion-studio',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'motion-storyboard-video', name: 'storyboard-video' }),
        expect.objectContaining({ id: 'motion-build-poster', name: 'build-motion-poster' }),
        expect.objectContaining({ id: 'motion-render-video', name: 'render-video' }),
        expect.objectContaining({ id: 'motion-render-social-cut', name: 'render-social-cut' }),
        expect.objectContaining({ id: 'motion-qc-pass', name: 'motion-qc' }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates HyperFrames Video Studio workspace commands and disabled schedules without engineering hooks', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-hyperframes');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-hyperframes-video-studio',
      },
    } as Pick<TChatConversation, 'type' | 'extra'>);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'hyperframes-video-init', name: 'video-init' }),
        expect.objectContaining({ id: 'hyperframes-video-preview', name: 'video-preview' }),
        expect.objectContaining({ id: 'hyperframes-video-render', name: 'video-render' }),
        expect.objectContaining({ id: 'hyperframes-url-to-video', name: 'url-to-video' }),
        expect.objectContaining({ id: 'hyperframes-article-to-video', name: 'article-to-video' }),
        expect.objectContaining({ id: 'hyperframes-data-to-video', name: 'data-to-video' }),
        expect.objectContaining({ id: 'hyperframes-caption-video', name: 'caption-video' }),
        expect.objectContaining({ id: 'hyperframes-media-to-video', name: 'media-to-video' }),
        expect.objectContaining({ id: 'hyperframes-video-qc', name: 'video-qc' }),
        expect.objectContaining({ id: 'hyperframes-video-package', name: 'video-package' }),
      ])
    );

    await expect(fs.readFile(getWorkspaceSchedulesFile(workspaceDir)!, 'utf-8')).resolves.toContain(
      'HyperFrames weekly video draft'
    );
    await expect(fs.readFile(getWorkspaceSchedulesFile(workspaceDir)!, 'utf-8')).resolves.toContain(
      'HyperFrames weekly render QC audit'
    );
    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Office Analyst workspace commands without engineering hooks for an office analyst conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-office');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-office-analyst',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'office-analyze-sheet', name: 'analyze-sheet' }),
        expect.objectContaining({ id: 'office-query-files', name: 'query-files' }),
        expect.objectContaining({ id: 'office-join-files', name: 'join-files' }),
        expect.objectContaining({ id: 'office-profile-data', name: 'profile-data' }),
        expect.objectContaining({ id: 'office-summarize-docs', name: 'summarize-docs' }),
        expect.objectContaining({ id: 'office-reconcile-sources', name: 'reconcile-sources' }),
        expect.objectContaining({ id: 'office-drilldown-report', name: 'drilldown-report' }),
        expect.objectContaining({ id: 'office-write-report', name: 'write-report' }),
        expect.objectContaining({ id: 'office-query-pdf-tables', name: 'query-pdf-tables' }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Finance Analyst workspace commands without engineering hooks for a finance analyst conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-finance');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-finance-analyst',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'finance-analyze-financials', name: 'analyze-financials' }),
        expect.objectContaining({ id: 'finance-explain-variance', name: 'explain-variance' }),
        expect.objectContaining({ id: 'finance-build-dcf', name: 'build-dcf' }),
        expect.objectContaining({ id: 'finance-compare-companies', name: 'compare-companies' }),
        expect.objectContaining({ id: 'finance-screen-investment', name: 'screen-investment' }),
        expect.objectContaining({ id: 'finance-forecast-business', name: 'forecast-business' }),
        expect.objectContaining({ id: 'finance-benchmark-saas', name: 'benchmark-saas' }),
        expect.objectContaining({ id: 'finance-stress-test-thesis', name: 'stress-test-thesis' }),
        expect.objectContaining({
          id: 'finance-write-investment-memo',
          name: 'write-investment-memo',
        }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('creates Visual Artifact Runner workspace commands without engineering hooks for a visual artifact conversation workspace', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-visual-artifact');
    await fs.mkdir(workspaceDir, { recursive: true });

    await ensureHarnessWorkspaceAutomationForConversation({
      type: 'acp',
      extra: {
        workspace: workspaceDir,
        presetAssistantId: 'builtin-visual-artifact-runner',
      },
    } as any);

    const commandsFile = getWorkspaceCommandsFile(workspaceDir);
    expect(commandsFile).not.toBeNull();

    const commandLibrary = await readCommandLibrary(workspaceDir);
    expect(commandLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan', name: 'plan' }),
        expect.objectContaining({ id: 'verify', name: 'verify' }),
        expect.objectContaining({ id: 'var-deck-from-brief', name: 'deck-from-brief' }),
        expect.objectContaining({ id: 'var-deck-from-pdf', name: 'deck-from-pdf' }),
        expect.objectContaining({ id: 'var-artifact-infographic', name: 'artifact-infographic' }),
        expect.objectContaining({ id: 'var-artifact-theme', name: 'artifact-theme' }),
        expect.objectContaining({ id: 'var-artifact-qc', name: 'artifact-qc' }),
      ])
    );

    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toBeNull();
  });

  it('does not overwrite existing project commands or hook copies', async () => {
    const workspaceDir = path.join(tempRoot, 'workspace-customized');
    const commandsFile = getWorkspaceCommandsFile(workspaceDir)!;
    const hooksFile = getWorkspaceHooksFile(workspaceDir)!;
    const qualityGateDir = getWorkspaceHookDir(workspaceDir, 'quality-gate')!;
    const qualityGatePrompt = path.join(qualityGateDir, 'before_user_prompt.md');

    await fs.mkdir(path.dirname(commandsFile), { recursive: true });
    await fs.writeFile(
      commandsFile,
      `${JSON.stringify(
        [
          {
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
    await fs.writeFile(
      hooksFile,
      `${JSON.stringify(
        {
          enabledHooks: ['custom-review-hook'],
        },
        null,
        2
      )}\n`,
      'utf-8'
    );

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
    await expect(readWorkspaceHookSelection(workspaceDir)).resolves.toEqual(['custom-review-hook']);

    const planHookDir = getWorkspaceHookDir(workspaceDir, 'plan-before-coding');
    expect(planHookDir).not.toBeNull();
    await expect(fs.readFile(path.join(planHookDir!, 'before_user_prompt.md'), 'utf-8')).resolves.toContain(
      'plan-before-coding'
    );
  });

  it('copies workspace commands during temp-to-project migration', async () => {
    const sourceWorkspace = path.join(tempRoot, 'workspace-source');
    const targetWorkspace = path.join(tempRoot, 'workspace-target');
    const sourceCommandsFile = getWorkspaceCommandsFile(sourceWorkspace)!;
    const targetCommandsFile = getWorkspaceCommandsFile(targetWorkspace)!;

    await fs.mkdir(path.dirname(sourceCommandsFile), { recursive: true });
    await fs.writeFile(
      sourceCommandsFile,
      `${JSON.stringify(
        [
          {
            id: 'copied-command',
            enabled: true,
            name: 'copied-command',
            description: 'Copied from temp workspace',
            template: 'echo copied',
          },
        ],
        null,
        2
      )}\n`,
      'utf-8'
    );

    await copyWorkspaceAutomationCommands(sourceWorkspace, targetWorkspace);

    await expect(fs.readFile(targetCommandsFile, 'utf-8')).resolves.toContain('"copied-command"');
  });

  it('copies workspace hook selection during temp-to-project migration even when no hook directories were customized', async () => {
    const sourceWorkspace = path.join(tempRoot, 'workspace-source-hooks');
    const targetWorkspace = path.join(tempRoot, 'workspace-target-hooks');
    const sourceHooksFile = getWorkspaceHooksFile(sourceWorkspace)!;
    const targetHooksFile = getWorkspaceHooksFile(targetWorkspace)!;

    await fs.mkdir(path.dirname(sourceHooksFile), { recursive: true });
    await fs.writeFile(
      sourceHooksFile,
      `${JSON.stringify(
        {
          enabledHooks: ['quality-gate', 'plan-before-coding'],
        },
        null,
        2
      )}\n`,
      'utf-8'
    );

    await copyWorkspaceAutomationHooks(sourceWorkspace, targetWorkspace);

    await expect(fs.readFile(targetHooksFile, 'utf-8')).resolves.toContain('"quality-gate"');
    await expect(readWorkspaceHookSelection(targetWorkspace)).resolves.toEqual(['quality-gate', 'plan-before-coding']);
  });
});
