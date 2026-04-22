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
import { CONTEXT_ENGINE_SYSTEM_ASSISTANTS } from '@/common/config/presets/systemAssistants';
import {
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageDefaultEnabledSkillNames,
} from '@/common/config/presets/bundledAgentPackageRegistry';
import { describe, expect, it } from 'vitest';

const DESIGN_DIRECTOR_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-design-director')!;
const FIGMA_CLOSED_LOOP_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-figma-closed-loop')!;
const MARKETING_CREATIVE_STUDIO_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames(
  'builtin-marketing-creative-studio'
)!;
const MOTION_STUDIO_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames('builtin-motion-studio')!;
const VISUAL_ARTIFACT_RUNNER_DEFAULT_SKILLS = getBundledAgentPackageDefaultEnabledSkillNames(
  'builtin-visual-artifact-runner'
)!;
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
    const figmaClosedLoopAssistant = assistants.find((assistant) => assistant.id === 'builtin-figma-closed-loop');
    const marketingCreativeStudioAssistant = assistants.find(
      (assistant) => assistant.id === 'builtin-marketing-creative-studio'
    );
    const motionAssistant = assistants.find((assistant) => assistant.id === 'builtin-motion-studio');
    const visualArtifactRunnerAssistant = assistants.find(
      (assistant) => assistant.id === 'builtin-visual-artifact-runner'
    );

    expect(assistants).toHaveLength(13);
    expect(assistants.map((assistant) => assistant.id)).toEqual([
      'builtin-morph-ppt',
      'builtin-startup-strategist',
      'builtin-design-director',
      'builtin-figma-closed-loop',
      'builtin-marketing-creative-studio',
      'builtin-motion-studio',
      'builtin-visual-artifact-runner',
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
    expect(figmaClosedLoopAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...FIGMA_CLOSED_LOOP_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Design Execution',
          'zh-CN': '设计执行闭环',
        },
        harnessTagI18n: {
          'en-US': 'Figma Closed Loop',
          'zh-CN': 'Figma Closed Loop',
        },
      })
    );
    expect(figmaClosedLoopAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'figma-file-bootstrap',
        'figma-screen-generate',
        'figma-library-sync',
        'figma-design-system-rules-sync',
        'figma-implementation-handoff',
        'figma-drift-audit',
      ])
    );
    expect(marketingCreativeStudioAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...MARKETING_CREATIVE_STUDIO_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Marketing & Creative',
          'zh-CN': '市场与创意',
        },
        harnessTagI18n: {
          'en-US': 'Marketing Creative Studio',
          'zh-CN': 'Marketing Creative Studio',
        },
      })
    );
    expect(marketingCreativeStudioAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'marketing-context-normalizer',
        'brand-theme-pack',
        'ad-creative-builder',
        'social-asset-batch',
        'visual-copy-pairing',
        'campaign-variant-generator',
      ])
    );
    expect(motionAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...MOTION_STUDIO_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Motion and Video',
          'zh-CN': '动效与视频',
        },
        harnessTagI18n: {
          'en-US': 'Motion Studio',
          'zh-CN': 'Motion Studio',
        },
      })
    );
    expect(motionAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'motion-storyboard',
        'motion-scene-builder',
        'motion-poster-builder',
        'motion-render-ops',
        'motion-qc',
      ])
    );
    expect(visualArtifactRunnerAssistant).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: [...VISUAL_ARTIFACT_RUNNER_DEFAULT_SKILLS],
        recommendedDomainI18n: {
          'en-US': 'Visual Artifacts',
          'zh-CN': '视觉产物',
        },
        harnessTagI18n: {
          'en-US': 'Visual Artifact Runner',
          'zh-CN': 'Visual Artifact Runner',
        },
      })
    );
    expect(visualArtifactRunnerAssistant?.enabledSkills).toEqual(
      expect.arrayContaining([
        'deck-from-brief',
        'deck-from-report',
        'pdf-to-deck',
        'report-to-infographic',
        'deck-theme-apply',
        'artifact-qc',
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
    const spaceMemoryDistiller = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-space-memory-distiller'
    );
    const connectorDigester = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-connector-digester'
    );

    expect(systemAssistants).toHaveLength(6);
    expect(sessionCompactor).toEqual(
      expect.objectContaining({
        avatar: 'context-engine-session-keeper.svg',
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
        avatar: 'context-engine-project-promoter.svg',
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
        avatar: 'context-engine-project-capability.svg',
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
    expect(spaceMemoryDistiller).toEqual(
      expect.objectContaining({
        avatar: 'context-engine-space-distiller.svg',
        triggerKinds: ['timer', 'manual'],
      })
    );
    expect(connectorDigester).toEqual(
      expect.objectContaining({
        avatar: 'context-engine-connector-digest.svg',
        triggerKinds: ['connector', 'timer', 'manual'],
      })
    );
    expect(
      CONTEXT_ENGINE_SYSTEM_ASSISTANTS.find(
        (assistant) => assistant.id === 'system-context-engine-space-memory-distiller'
      )
    ).toEqual(expect.objectContaining({ deliveryStatus: 'live' }));
    expect(
      CONTEXT_ENGINE_SYSTEM_ASSISTANTS.find((assistant) => assistant.id === 'system-context-engine-connector-digester')
    ).toEqual(expect.objectContaining({ deliveryStatus: 'live' }));
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
    expect(resolveBuiltinAssistantEnabledSkills('builtin-figma-closed-loop', undefined)).toEqual([
      ...FIGMA_CLOSED_LOOP_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-marketing-creative-studio', undefined)).toEqual([
      ...MARKETING_CREATIVE_STUDIO_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-motion-studio', undefined)).toEqual([
      ...MOTION_STUDIO_DEFAULT_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-visual-artifact-runner', undefined)).toEqual([
      ...VISUAL_ARTIFACT_RUNNER_DEFAULT_SKILLS,
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
