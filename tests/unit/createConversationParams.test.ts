/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLocaleKey } from '../../src/common/utils';

const loadPresetAssistantResources = vi.fn();
const configGet = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {},
}));

vi.mock('@/common/config/storage', async () => {
  const actual = await vi.importActual<typeof import('../../src/common/config/storage')>(
    '../../src/common/config/storage'
  );
  return {
    ...actual,
    ConfigStorage: {
      get: configGet,
    },
  };
});

vi.mock('@/renderer/utils/model/presetAssistantResources', () => ({
  loadPresetAssistantResources,
}));

const { buildCliAgentParams, buildDiscussionGroupParams, buildPresetAssistantParams, buildWorkflowGroupParams } =
  await import('../../src/renderer/pages/conversation/utils/createConversationParams');

describe('createConversationParams', () => {
  beforeEach(() => {
    loadPresetAssistantResources.mockReset();
    configGet.mockReset();
  });

  it('uses the shared locale resolver for Turkish', async () => {
    loadPresetAssistantResources.mockResolvedValue({
      rules: 'preset rules',
      skills: '',
      enabledSkills: ['verification-before-completion'],
      enabledHooks: ['quality-gate'],
    });
    configGet.mockResolvedValue([
      {
        id: 'provider-1',
        platform: 'openai',
        name: 'Provider',
        baseUrl: 'https://example.com',
        apiKey: 'token',
        model: ['gpt-4.1'],
        enabled: true,
      },
    ]);

    const params = await buildPresetAssistantParams(
      {
        backend: 'custom',
        name: 'Preset Assistant',
        customAgentId: 'preset-gemini-assistant',
        isPreset: true,
        presetAgentType: 'gemini',
      },
      '/tmp/workspace',
      'tr'
    );

    expect(resolveLocaleKey('tr')).toBe('tr-TR');
    expect(loadPresetAssistantResources).toHaveBeenCalledWith({
      customAgentId: 'preset-gemini-assistant',
      localeKey: 'tr-TR',
    });
    expect(params.extra.presetRules).toBe('preset rules');
    expect(params.extra.enabledSkills).toEqual(['verification-before-completion']);
    expect(params.extra.enabledHooks).toEqual(['quality-gate']);
    expect(params.model.useModel).toBe('gpt-4.1');
  });

  it('maps acp preset assistants to presetContext and backend', async () => {
    loadPresetAssistantResources.mockResolvedValue({
      rules: 'acp preset rules',
      skills: '',
      enabledSkills: undefined,
      enabledHooks: ['plan-before-coding'],
    });

    const params = await buildPresetAssistantParams(
      {
        backend: 'custom',
        name: 'Codebuddy Assistant',
        customAgentId: 'preset-1',
        isPreset: true,
        presetAgentType: 'codebuddy',
      },
      '/tmp/workspace',
      'zh'
    );

    expect(params.type).toBe('acp');
    expect(params.extra.presetContext).toBe('acp preset rules');
    expect(params.extra.backend).toBe('codebuddy');
    expect(params.extra.nativeWorkspaceBootstrap).toBe(true);
    expect(params.extra.enabledHooks).toEqual(['plan-before-coding']);
  });

  it('falls back to the saved gemini.defaultModel when provider config is empty', async () => {
    loadPresetAssistantResources.mockResolvedValue({
      rules: 'gemini preset rules',
      skills: '',
      enabledSkills: ['quality-gate'],
      enabledHooks: ['plan-before-coding'],
    });
    configGet.mockImplementation(async (key: string) => {
      if (key === 'model.config') {
        return [];
      }
      if (key === 'gemini.defaultModel') {
        return {
          id: 'google-auth-gemini',
          useModel: 'auto',
        };
      }
      return undefined;
    });

    const params = await buildPresetAssistantParams(
      {
        backend: 'custom',
        name: 'Preset Assistant',
        customAgentId: 'preset-gemini-assistant',
        isPreset: true,
        presetAgentType: 'gemini',
      },
      '/tmp/workspace',
      'zh'
    );

    expect(params.model).toMatchObject({
      id: 'google-auth-gemini',
      useModel: 'auto',
      platform: 'gemini-with-google-auth',
    });
  });

  it('builds mixed discussion group participants for preset assistants and cli agents', async () => {
    loadPresetAssistantResources.mockResolvedValue({
      rules: 'preset rules',
      skills: '',
      enabledSkills: ['quality-gate'],
      enabledHooks: ['plan-before-coding'],
    });

    const params = await buildDiscussionGroupParams({
      name: 'Mixed Group',
      spaceId: 'space-team',
      workspace: '/tmp/workspace',
      language: 'en-US',
      mode: 'debate',
      participants: [
        {
          type: 'preset-assistant',
          participantKey: 'builtin-superpowers',
          name: 'Superpowers Harness',
          description: 'Preset assistant',
          presetAgentType: 'codex',
        },
        {
          type: 'cli-agent',
          participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
          name: 'Codex CLI',
          description: 'codex · /usr/local/bin/codex',
          agent: {
            backend: 'codex',
            name: 'Codex CLI',
            cliPath: '/usr/local/bin/codex',
          },
        },
      ],
    });

    expect(params.type).toBe('group');
    expect(params.extra.spaceId).toBe('space-team');
    expect(params.extra.participants).toHaveLength(2);
    expect(params.extra.participants?.[0]).toMatchObject({
      participantType: 'preset-assistant',
      participantKey: 'builtin-superpowers',
      assistantId: 'builtin-superpowers',
      name: 'Superpowers Harness',
    });
    expect(params.extra.participants?.[0].conversation).toMatchObject({
      type: 'acp',
      extra: {
        backend: 'codex',
        presetContext: 'preset rules',
        enabledSkills: ['quality-gate'],
        enabledHooks: ['plan-before-coding'],
        spaceId: 'space-team',
        nativeWorkspaceBootstrap: true,
      },
    });
    expect(params.extra.participants?.[1]).toMatchObject({
      participantType: 'cli-agent',
      participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
      assistantId: undefined,
      name: 'Codex CLI',
    });
    expect(params.extra.participants?.[1].conversation).toMatchObject({
      type: 'acp',
      name: 'Codex CLI',
      extra: {
        backend: 'codex',
        cliPath: '/usr/local/bin/codex',
        spaceId: 'space-team',
      },
    });
  });

  it('uses OpenClaw native agent workspace and agent id for CLI conversations', async () => {
    const params = await buildCliAgentParams(
      {
        backend: 'openclaw-gateway',
        name: 'Reviewer (reviewer)',
        cliPath: '/usr/local/bin/openclaw',
        openclawAgentId: 'reviewer',
        workspace: '/Users/test/.openclaw/workspace-reviewer',
      },
      '/tmp/ignored-workspace',
      'space-review'
    );

    expect(params).toMatchObject({
      type: 'openclaw-gateway',
      name: 'Reviewer (reviewer)',
      extra: {
        backend: 'openclaw-gateway',
        cliPath: '/usr/local/bin/openclaw',
        openclawAgentId: 'reviewer',
        workspace: '/Users/test/.openclaw/workspace-reviewer',
        customWorkspace: true,
        nativeWorkspaceBootstrap: true,
        spaceId: 'space-review',
      },
    });
  });

  it('marks standard CLI workspaces for native bootstrap so auto skills can be projected', async () => {
    const params = await buildCliAgentParams(
      {
        backend: 'codex',
        name: 'Codex CLI',
        cliPath: '/usr/local/bin/codex',
      },
      '/tmp/project-workspace',
      'space-dev'
    );

    expect(params).toMatchObject({
      type: 'acp',
      name: 'Codex CLI',
      extra: {
        backend: 'codex',
        cliPath: '/usr/local/bin/codex',
        workspace: '/tmp/project-workspace',
        customWorkspace: true,
        nativeWorkspaceBootstrap: true,
        spaceId: 'space-dev',
      },
    });
  });

  it('keeps relay groups on a single orchestration round', async () => {
    const params = await buildDiscussionGroupParams({
      name: 'Relay Group',
      workspace: '/tmp/workspace',
      language: 'en-US',
      mode: 'relay',
      participants: [
        {
          type: 'cli-agent',
          participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
          name: 'Codex CLI',
          description: 'codex · /usr/local/bin/codex',
          agent: {
            backend: 'codex',
            name: 'Codex CLI',
            cliPath: '/usr/local/bin/codex',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'qwen:/usr/local/bin/qwen:Qwen CLI',
          name: 'Qwen CLI',
          description: 'qwen · /usr/local/bin/qwen',
          agent: {
            backend: 'qwen',
            name: 'Qwen CLI',
            cliPath: '/usr/local/bin/qwen',
          },
        },
      ],
    });

    expect(params.extra.orchestration).toEqual({
      kind: 'discussion',
      mode: 'relay',
      rounds: 1,
    });
  });

  it('stores harness collaboration metadata and ordered participant roles', async () => {
    const params = await buildDiscussionGroupParams({
      name: 'Harness Group',
      workspace: '/tmp/workspace',
      language: 'en-US',
      mode: 'debate',
      collaborationMode: 'planner-generator-evaluator',
      gitRepository: {
        isRepository: true,
        repositoryRoot: '/tmp/workspace',
        branch: 'main',
        gitDir: '/tmp/workspace/.git',
        remoteUrl: 'git@github.com:example/repo.git',
      },
      participants: [
        {
          type: 'cli-agent',
          participantKey: 'codex:/usr/local/bin/codex:Planner',
          name: 'Planner',
          description: 'codex · /usr/local/bin/codex',
          agent: {
            backend: 'codex',
            name: 'Planner',
            cliPath: '/usr/local/bin/codex',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'qwen:/usr/local/bin/qwen:Generator',
          name: 'Generator',
          description: 'qwen · /usr/local/bin/qwen',
          agent: {
            backend: 'qwen',
            name: 'Generator',
            cliPath: '/usr/local/bin/qwen',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'claude:/usr/local/bin/claude:Evaluator',
          name: 'Evaluator',
          description: 'claude · /usr/local/bin/claude',
          agent: {
            backend: 'claude',
            name: 'Evaluator',
            cliPath: '/usr/local/bin/claude',
          },
        },
      ],
    });

    expect(params.extra.collaboration).toEqual({
      mode: 'planner-generator-evaluator',
      executionBoundary: {
        type: 'git-repository',
        repositoryRoot: '/tmp/workspace',
        branch: 'main',
        gitDir: '/tmp/workspace/.git',
        remoteUrl: 'git@github.com:example/repo.git',
      },
    });
    expect(params.extra.participants?.map((participant) => participant.role)).toEqual([
      'planner',
      'generator',
      'evaluator',
    ]);
  });

  it('builds planner-writer-evaluator workflow groups with explicit roles', async () => {
    loadPresetAssistantResources.mockResolvedValue({
      rules: 'preset rules',
      skills: '',
      enabledSkills: ['quality-gate'],
      enabledHooks: ['plan-before-coding'],
    });

    const params = await buildWorkflowGroupParams({
      name: 'Workflow Group',
      workspace: '/tmp/workspace',
      language: 'en-US',
      participants: [
        {
          type: 'preset-assistant',
          participantKey: 'builtin-superpowers',
          name: 'Planner',
          description: 'Preset planner',
          presetAgentType: 'codex',
          role: 'planner',
        },
        {
          type: 'cli-agent',
          participantKey: 'codex:/usr/local/bin/codex:Writer CLI',
          name: 'Writer CLI',
          description: 'codex · /usr/local/bin/codex',
          role: 'writer',
          agent: {
            backend: 'codex',
            name: 'Writer CLI',
            cliPath: '/usr/local/bin/codex',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'qwen:/usr/local/bin/qwen:Evaluator CLI',
          name: 'Evaluator CLI',
          description: 'qwen · /usr/local/bin/qwen',
          role: 'evaluator',
          agent: {
            backend: 'qwen',
            name: 'Evaluator CLI',
            cliPath: '/usr/local/bin/qwen',
          },
        },
      ],
    });

    expect(params.type).toBe('group');
    expect(params.extra.orchestration).toEqual({
      kind: 'workflow',
      template: 'planner-writer-evaluator',
      maxIterations: 3,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
      reviewMode: 'per-iteration',
    });
    expect(params.extra.participants).toEqual([
      expect.objectContaining({
        role: 'planner',
        participantType: 'preset-assistant',
      }),
      expect.objectContaining({
        role: 'writer',
        participantType: 'cli-agent',
      }),
      expect.objectContaining({
        role: 'evaluator',
        participantType: 'cli-agent',
      }),
    ]);
  });

  it('builds plan-build-evaluate workflow groups with single-pass review defaults', async () => {
    const params = await buildWorkflowGroupParams({
      name: 'Single Pass Workflow',
      workspace: '/tmp/workspace',
      language: 'en-US',
      template: 'plan-build-evaluate',
      participants: [
        {
          type: 'cli-agent',
          participantKey: 'planner:/usr/local/bin/planner:Planner CLI',
          name: 'Planner CLI',
          description: 'planner · /usr/local/bin/planner',
          role: 'planner',
          agent: {
            backend: 'codex',
            name: 'Planner CLI',
            cliPath: '/usr/local/bin/planner',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'builder:/usr/local/bin/builder:Builder CLI',
          name: 'Builder CLI',
          description: 'builder · /usr/local/bin/builder',
          role: 'writer',
          agent: {
            backend: 'qwen',
            name: 'Builder CLI',
            cliPath: '/usr/local/bin/builder',
          },
        },
        {
          type: 'cli-agent',
          participantKey: 'evaluator:/usr/local/bin/evaluator:Evaluator CLI',
          name: 'Evaluator CLI',
          description: 'evaluator · /usr/local/bin/evaluator',
          role: 'evaluator',
          agent: {
            backend: 'claude',
            name: 'Evaluator CLI',
            cliPath: '/usr/local/bin/evaluator',
          },
        },
      ],
    });

    expect(params.extra.orchestration).toEqual({
      kind: 'workflow',
      template: 'plan-build-evaluate',
      maxIterations: 1,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
      reviewMode: 'final-only',
    });
  });
});
