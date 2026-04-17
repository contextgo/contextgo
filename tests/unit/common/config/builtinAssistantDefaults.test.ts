/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import {
  buildBuiltinAssistants,
  buildContextEngineSystemAssistants,
  resolveBuiltinAssistantEnabledHooks,
  resolveBuiltinAssistantEnabledSkills,
} from '@/common/config/presets/builtinAssistantDefaults';
import {
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageDefaultEnabledSkillNames,
} from '@/common/config/presets/bundledAgentPackageRegistry';
import { describe, expect, it } from 'vitest';

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

describe('builtinAssistantDefaults', () => {
  it('builds product builtin assistants with featured defaults', () => {
    const assistants = buildBuiltinAssistants();
    const designAssistant = assistants.find((assistant) => assistant.id === 'builtin-design-director');
    const startupAssistant = assistants.find((assistant) => assistant.id === 'builtin-startup-strategist');
    const financeAssistant = assistants.find((assistant) => assistant.id === 'builtin-finance-analyst');
    const officeAssistant = assistants.find((assistant) => assistant.id === 'builtin-office-analyst');
    const codingGuardAssistant = assistants.find((assistant) => assistant.id === 'builtin-karpathy-coding-guard');

    expect(assistants).toHaveLength(9);
    expect(assistants.map((assistant) => assistant.id)).toEqual([
      'builtin-morph-ppt',
      'builtin-startup-strategist',
      'builtin-design-director',
      'builtin-pm-workbench',
      'builtin-office-analyst',
      'builtin-finance-analyst',
      'builtin-superpowers',
      'builtin-everything-in-claude-code',
      'builtin-karpathy-coding-guard',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-morph-ppt')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: ['morph-ppt'],
        recommendedDomainI18n: {
          'en-US': 'Presentations',
          'zh-CN': '演示文稿',
        },
      })
    );
    expect(designAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...DESIGN_DIRECTOR_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Design Direction',
          'zh-CN': '设计方向',
        },
        harnessTagI18n: {
          'en-US': 'Design Director',
          'zh-CN': 'Design Director',
        },
      })
    );
    expect(designAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'design-style-archetype-selection',
        'design-system-distillation',
        'design-landing-page-art-direction',
        'design-product-surface-art-direction',
        'design-ui-critique-and-polish',
        'design-screenshot-critique',
        'design-figma-reference-absorption',
        'design-system-adaptation',
        'design-component-visual-spec',
        'design-handoff-brief',
      ])
    );
    expect(startupAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...STARTUP_STRATEGIST_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Startup Strategy',
          'zh-CN': '创业战略',
        },
        harnessTagI18n: {
          'en-US': 'Startup Strategist',
          'zh-CN': 'Startup Strategist',
        },
      })
    );
    expect(startupAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'startup-founder-problem-framing',
        'startup-startup-canvas',
        'startup-value-proposition',
        'startup-ideal-customer-profile',
        'startup-go-to-market-strategy',
        'startup-north-star-metric',
      ])
    );
    expect(officeAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...OFFICE_ANALYST_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Office Productivity',
          'zh-CN': '办公生产力',
        },
        harnessTagI18n: {
          'en-US': 'Office Analyst',
          'zh-CN': 'Office Analyst',
        },
      })
    );
    expect(officeAssistant?.enabledSkills).toEqual(
      expect.arrayContaining(['office-cross-file-join-analysis', 'office-report-drilldown', 'office-pdf-table-query'])
    );
    expect(financeAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...FINANCE_ANALYST_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Finance & Planning',
          'zh-CN': '财务与经营规划',
        },
        harnessTagI18n: {
          'en-US': 'Finance Analyst',
          'zh-CN': 'Finance Analyst',
        },
      })
    );
    expect(financeAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'finance-financial-statement-analysis',
        'finance-dcf-valuation',
        'finance-saas-metrics',
        'finance-comparable-valuation',
        'finance-investment-screening',
        'finance-thesis-stress-test',
      ])
    );
    expect(assistants.find((assistant) => assistant.id === 'builtin-pm-workbench')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...PM_WORKBENCH_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Product Management',
          'zh-CN': '产品管理',
        },
        harnessTagI18n: {
          'en-US': 'PM Workbench',
          'zh-CN': 'PM Workbench',
        },
      })
    );
    expect(assistants.find((assistant) => assistant.id === 'builtin-superpowers')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: [...ENGINEERING_DEFAULT_HOOKS],
        enabledSkills: [...ENGINEERING_WORKBENCH_SKILLS],
        harnessTagI18n: {
          'en-US': 'Superpowers',
          'zh-CN': 'Superpowers',
        },
      })
    );
    expect(codingGuardAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...KARPATHY_CODING_GUARD_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Engineering',
          'zh-CN': '研发',
        },
        harnessTagI18n: {
          'en-US': 'Karpathy Coding Guard',
          'zh-CN': 'Karpathy Coding Guard',
        },
      })
    );
    expect(codingGuardAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'assumption-audit',
        'simplicity-first',
        'surgical-change',
        'goal-driven-execution',
        'diff-minimization-review',
      ])
    );
    expect(assistants.find((assistant) => assistant.id === 'builtin-everything-in-claude-code')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'claude',
        recommendedDomainI18n: {
          'en-US': 'Engineering',
          'zh-CN': '研发',
        },
      })
    );
  });

  it('marks system assistants with explicit system metadata', () => {
    const systemAssistants = buildContextEngineSystemAssistants();
    const sessionCompactor = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-session-compactor'
    );
    const projectPromoter = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-project-promoter'
    );
    const projectCapabilityCurator = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-project-capability-curator'
    );

    expect(systemAssistants).toHaveLength(6);
    expect(sessionCompactor).toEqual(
      expect.objectContaining({
        builtinTier: 'system',
        builtinVisibility: 'featured',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-session-compactor',
        executionBoundary: 'space-vault-root',
        triggerKinds: ['hook', 'lifecycle', 'manual'],
        promptProfile: expect.objectContaining({
          role: 'system-maintenance',
          jobType: 'session_compaction',
        }),
      })
    );
    expect(projectPromoter).toEqual(
      expect.objectContaining({
        builtinTier: 'system',
        builtinVisibility: 'featured',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-project-promoter',
        executionBoundary: 'space-vault-root',
        triggerKinds: ['derived', 'manual'],
      })
    );
    expect(projectCapabilityCurator).toEqual(
      expect.objectContaining({
        builtinTier: 'system',
        builtinVisibility: 'featured',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-project-capability-curator',
        executionBoundary: 'space-vault-root',
        triggerKinds: ['hook', 'timer', 'manual', 'derived'],
        promptProfile: expect.objectContaining({
          role: 'system-maintenance',
          jobType: 'project_capability_curation',
        }),
      })
    );
  });

  it('falls back to preset defaults only when enabled hooks are missing', () => {
    expect(resolveBuiltinAssistantEnabledHooks('builtin-superpowers', undefined)).toEqual([
      ...ENGINEERING_DEFAULT_HOOKS,
    ]);
    expect(resolveBuiltinAssistantEnabledHooks('builtin-superpowers', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledHooks('custom-agent', undefined)).toBeUndefined();
  });

  it('falls back to preset defaults only when enabled skills are missing', () => {
    expect(resolveBuiltinAssistantEnabledSkills('builtin-morph-ppt', undefined)).toEqual(['morph-ppt']);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-design-director', undefined)).toEqual([
      ...DESIGN_DIRECTOR_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-startup-strategist', undefined)).toEqual([
      ...STARTUP_STRATEGIST_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-office-analyst', undefined)).toEqual([
      ...OFFICE_ANALYST_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-finance-analyst', undefined)).toEqual([
      ...FINANCE_ANALYST_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-pm-workbench', undefined)).toEqual([
      ...PM_WORKBENCH_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-superpowers', undefined)).toEqual([
      ...ENGINEERING_WORKBENCH_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-everything-in-claude-code', undefined)).toBeUndefined();
    expect(resolveBuiltinAssistantEnabledSkills('builtin-superpowers', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills('custom-agent', undefined)).toBeUndefined();
  });

  it('preserves explicit hook and skill overrides on builtin assistants', () => {
    const assistant = {
      id: 'builtin-superpowers',
      name: 'Superpowers Harness',
      enabledHooks: [],
      enabledSkills: [],
    } as AcpBackendConfig;

    expect(resolveBuiltinAssistantEnabledHooks(assistant.id, assistant.enabledHooks)).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills(assistant.id, assistant.enabledSkills)).toEqual([]);
  });
});
