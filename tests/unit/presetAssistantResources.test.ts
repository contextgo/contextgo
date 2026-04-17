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
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageDefaultEnabledSkillNames,
} from '../../src/common/config/presets/bundledAgentPackageRegistry';

const DESIGN_DIRECTOR_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-design-director')!;
const STARTUP_STRATEGIST_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-startup-strategist')!;
const OFFICE_ANALYST_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-office-analyst')!;
const FINANCE_ANALYST_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-finance-analyst')!;
const PM_WORKBENCH_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-pm-workbench')!;
const KARPATHY_CODING_GUARD_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames(
  'builtin-karpathy-coding-guard'
)!;
const ENGINEERING_WORKBENCH_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-superpowers')!;
const ENGINEERING_DEFAULT_HOOKS = getBundledAgentPackageDefaultEnabledHookNames('builtin-superpowers')!;

function createDeps(overrides: Partial<PresetAssistantResourceDeps> = {}): PresetAssistantResourceDeps {
  return {
    readAssistantRule: vi.fn(async () => ''),
    readAssistantSkill: vi.fn(async () => ''),
    readBundledAgentPackageContent: vi.fn(async () => ({
      success: true,
      data: { agentsDocument: null },
    })),
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
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => ['verification-before-completion']),
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
      enabledSkills: ['verification-before-completion'],
      enabledHooks: ['before_user_prompt'],
    });
    expect(deps.readBundledAgentPackageContent).toHaveBeenCalledOnce();
    expect(deps.warn).toHaveBeenCalledTimes(2);
  });

  it('falls back to builtin default skills and hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
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

  it('falls back to builtin PM preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-pm-workbench',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...PM_WORKBENCH_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });

  it('falls back to builtin startup preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-startup-strategist',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...STARTUP_STRATEGIST_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });

  it('falls back to builtin design preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-design-director',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...DESIGN_DIRECTOR_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });

  it('falls back to builtin office preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-office-analyst',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...OFFICE_ANALYST_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });

  it('falls back to builtin finance preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-finance-analyst',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...FINANCE_ANALYST_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });

  it('falls back to karpathy coding guard preset default skills without hooks when stored config is missing', async () => {
    const deps = createDeps({
      readBundledAgentPackageContent: vi.fn(async () => ({
        success: true,
        data: { agentsDocument: { content: 'builtin rules' } },
      })),
      getEnabledSkills: vi.fn(async () => undefined),
      getEnabledHooks: vi.fn(async () => undefined),
    });

    await expect(
      loadPresetAssistantResources(
        {
          customAgentId: 'builtin-karpathy-coding-guard',
          localeKey: 'en-US',
          fallbackRules: 'fallback rules',
        },
        deps
      )
    ).resolves.toEqual({
      rules: 'builtin rules',
      skills: '',
      enabledSkills: [...KARPATHY_CODING_GUARD_DEFAULT_SKILLS],
      enabledHooks: undefined,
    });
  });
});
