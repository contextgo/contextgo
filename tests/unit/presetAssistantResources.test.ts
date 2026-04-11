/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import {
  loadPresetAssistantResources,
  type PresetAssistantResourceDeps,
} from '../../src/renderer/utils/model/presetAssistantResources';
import {
  ENGINEERING_DEFAULT_HOOKS,
  ENGINEERING_WORKBENCH_SKILLS,
} from '../../src/common/config/presets/assistantPresets';

function createDeps(overrides: Partial<PresetAssistantResourceDeps> = {}): PresetAssistantResourceDeps {
  return {
    readAssistantRule: vi.fn(async () => ''),
    readAssistantSkill: vi.fn(async () => ''),
    readBuiltinRule: vi.fn(async () => ''),
    readBuiltinSkill: vi.fn(async () => ''),
    getEnabledSkills: vi.fn(async () => undefined),
    getEnabledHooks: vi.fn(async () => undefined),
    warn: vi.fn(),
    ...overrides,
  };
}

describe('loadPresetAssistantResources', () => {
  it('returns fallback rules when there is no custom assistant id', async () => {
    const deps = createDeps();

    await expect(
      loadPresetAssistantResources(
        {
          localeKey: 'zh-CN',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'fallback rules',
      skills: '',
      enabledSkills: undefined,
      enabledHooks: undefined,
    });
  });

  it('loads user resources and enabled skills first', async () => {
    const deps = createDeps({
      readAssistantRule: vi.fn(async () => 'user rules'),
      readAssistantSkill: vi.fn(async () => 'user skills'),
      getEnabledSkills: vi.fn(async () => ['pptx', 'xlsx']),
      getEnabledHooks: vi.fn(async () => ['before_user_prompt']),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'assistant-1',
          localeKey: 'zh-CN',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'user rules',
      skills: 'user skills',
      enabledSkills: ['pptx', 'xlsx'],
      enabledHooks: ['before_user_prompt'],
    });
  });

  it('falls back to builtin preset resources and warns when user resources fail', async () => {
    const deps = createDeps({
      readAssistantRule: vi.fn(async () => {
        throw new Error('missing user rule');
      }),
      readAssistantSkill: vi.fn(async () => {
        throw new Error('missing user skill');
      }),
      readBuiltinRule: vi.fn(async () => 'builtin rules'),
      readBuiltinSkill: vi.fn(async () => 'builtin skills'),
      getEnabledSkills: vi.fn(async () => ['verification-loop']),
      getEnabledHooks: vi.fn(async () => ['before_user_prompt']),
    });

    const result = await loadPresetAssistantResources(
      {
        customAgentId: 'builtin-superpowers',
        localeKey: 'zh-CN',
        fallbackRules: 'fallback rules',
      },
      deps
    );

    expect(result).toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: ['verification-loop'],
      enabledHooks: ['before_user_prompt'],
    });
    expect(deps.readBuiltinRule).toHaveBeenCalledOnce();
    expect(deps.readBuiltinSkill).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(2);
  });

  it('falls back to builtin default skills and hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBuiltinRule: vi.fn(async () => 'builtin rules'),
      readBuiltinSkill: vi.fn(async () => 'builtin skills'),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-superpowers',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...ENGINEERING_WORKBENCH_SKILLS],
      enabledHooks: [...ENGINEERING_DEFAULT_HOOKS],
    });
  });
});
