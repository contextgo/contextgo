import type { PresetAgentType } from '@/common/types/acpTypes';

export type AssistantPreset = {
  id: string;
  avatar: string;
  presetAgentType?: PresetAgentType;
  harnessTagI18n?: Record<string, string>;
  recommendedDomainI18n?: Record<string, string>;
  workspaceBootstrapHintI18n?: Record<string, string>;
  /**
   * Directory containing all resources for this preset (relative to project root).
   * If set, both ruleFiles and skillFiles will be resolved from this directory.
   * Default: rules/ for rules, skills/ for skills
   */
  resourceDir?: string;
  ruleFiles: Record<string, string>;
  skillFiles?: Record<string, string>;
  /**
   * Default enabled skills for this assistant (skill names from skills/ directory).
   * 此助手默认启用的技能列表（来自 skills/ 目录的技能名称）
   */
  defaultEnabledSkills?: string[];
  /**
   * Default enabled hooks for this assistant (hook names from hooks/ directory).
   * 此助手默认启用的 hooks 列表（来自 hooks/ 目录的 hook 名称）
   */
  defaultEnabledHooks?: string[];
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promptsI18n?: Record<string, string[]>;
};

export const ENGINEERING_DEFAULT_HOOKS = [
  'repo-context-bootstrap',
  'plan-before-coding',
  'secret-guard',
  'tool-safety-guard',
  'quality-gate',
  'tdd-guard',
  'continuity-handoff',
] as const;

export const ENGINEERING_WORKBENCH_SKILLS = [
  'agent-harness-engineering',
  'using-superpowers',
  'brainstorming',
  'engineering-planning',
  'writing-plans',
  'executing-plans',
  'using-git-worktrees',
  'subagent-driven-development',
  'dispatching-parallel-agents',
  'finishing-a-development-branch',
  'requesting-code-review',
  'receiving-code-review',
  'systematic-debugging',
  'tdd-workflow',
  'code-review-workflow',
  'security-review',
  'verification-loop',
  'tooling-mcp-playbook',
] as const;

export const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: 'morph-ppt',
    avatar: 'morph-ppt.svg',
    presetAgentType: 'codex',
    resourceDir: 'src/process/resources/assistant/morph-ppt',
    ruleFiles: {
      'en-US': 'morph-ppt.md',
      'zh-CN': 'morph-ppt.zh-CN.md',
    },
    defaultEnabledSkills: ['morph-ppt'],
    recommendedDomainI18n: {
      'en-US': 'Presentations',
      'zh-CN': '演示文稿',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace if you want generated PPTX files, briefs, and build scripts saved into the project folder.',
      'zh-CN': '如果希望把生成的 PPTX、brief 和构建脚本直接落到项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Morph PPT',
      'zh-CN': 'Morph PPT',
    },
    descriptionI18n: {
      'en-US':
        'A specialist assistant for building polished PowerPoint decks with Morph animations, structured storytelling, and reproducible build scripts.',
      'zh-CN': '一个专门产出带 Morph 动画、叙事结构清晰且可复现构建脚本的 PPT 专项助手。',
    },
    promptsI18n: {
      'en-US': [
        'Create a Morph-animated presentation for this product launch narrative',
        'Turn this report into a polished PPT deck with strong motion and story flow',
        'Plan the deck first, then generate the PPTX and build script for this topic',
      ],
      'zh-CN': [
        '围绕这个产品发布主题做一套带 Morph 动画的演示文稿',
        '把这份报告做成一套叙事感强、动态效果好的 PPT',
        '先规划整套 deck，再生成这次主题的 PPTX 和构建脚本',
      ],
    },
  },
  {
    id: 'superpowers',
    avatar: 'superpowers.svg',
    presetAgentType: 'codex',
    resourceDir: 'src/process/resources/assistant/engineering/superpowers',
    ruleFiles: {
      'en-US': 'superpowers.md',
      'zh-CN': 'superpowers.zh-CN.md',
    },
    defaultEnabledSkills: [...ENGINEERING_WORKBENCH_SKILLS],
    defaultEnabledHooks: [...ENGINEERING_DEFAULT_HOOKS],
    harnessTagI18n: {
      'en-US': 'Superpowers',
      'zh-CN': 'Superpowers',
    },
    recommendedDomainI18n: {
      'en-US': 'Engineering',
      'zh-CN': '研发',
    },
    workspaceBootstrapHintI18n: {
      'en-US': 'Link a workspace before starting. Best for repository-based engineering delivery.',
      'zh-CN': '开始前建议先关联工作空间，更适合基于仓库的研发交付。',
    },
    nameI18n: {
      'en-US': 'Superpowers Harness',
      'zh-CN': 'Superpowers Harness',
    },
    descriptionI18n: {
      'en-US':
        'Engineering harness assistant inspired by Superpowers. Guides spec, planning, TDD, review, and final verification around a linked workspace.',
      'zh-CN': '受 Superpowers 启发的工程 Harness 助手，围绕已关联工作空间推进规格、规划、TDD、评审和最终验证。',
    },
    promptsI18n: {
      'en-US': [
        'Attach this repository and drive it with a strict spec -> plan -> TDD -> review workflow',
        'Set up an engineering harness for this repo before implementation starts',
        'Use a workspace-first development process with explicit planning and verification',
      ],
      'zh-CN': [
        '先关联这个仓库，再按 spec -> plan -> TDD -> review 的严格流程推进',
        '在开始实现前，先为这个仓库建立工程 harness',
        '用先绑定工作空间、再规划和验证的研发流程来推进这个任务',
      ],
    },
  },
  {
    id: 'everything-in-claude-code',
    avatar: 'everything-claude-code.svg',
    presetAgentType: 'claude',
    resourceDir: 'src/process/resources/assistant/engineering/everything-in-claude-code',
    ruleFiles: {
      'en-US': 'everything-in-claude-code.md',
      'zh-CN': 'everything-in-claude-code.zh-CN.md',
    },
    defaultEnabledSkills: [...ENGINEERING_WORKBENCH_SKILLS],
    defaultEnabledHooks: [...ENGINEERING_DEFAULT_HOOKS],
    harnessTagI18n: {
      'en-US': 'Everything Claude Code',
      'zh-CN': 'Everything Claude Code',
    },
    recommendedDomainI18n: {
      'en-US': 'Engineering',
      'zh-CN': '研发',
    },
    workspaceBootstrapHintI18n: {
      'en-US': 'Link a workspace before starting. Best for repository-focused Claude Code style delivery.',
      'zh-CN': '开始前建议先关联工作空间，更适合 Claude Code 风格的仓库研发交付。',
    },
    nameI18n: {
      'en-US': 'Everything Claude Code Harness',
      'zh-CN': 'Everything Claude Code Harness',
    },
    descriptionI18n: {
      'en-US':
        'Engineering harness assistant inspired by Everything in Claude Code. Optimized for role-based engineering loops, review gates, and workspace-backed delivery.',
      'zh-CN': '受 Everything in Claude Code 启发的工程 Harness 助手，强调角色分工、评审门禁和基于工作空间的持续交付。',
    },
    promptsI18n: {
      'en-US': [
        'Link my repo and run a role-specialized engineering workflow before coding',
        'Prepare a Claude Code style engineering harness for this workspace',
        'Use a workspace-backed planning, build, review, and verification loop for this project',
      ],
      'zh-CN': [
        '先关联仓库，再按角色分工的工程流程推进编码工作',
        '为这个工作空间准备 Claude Code 风格的工程 harness',
        '用基于工作空间的 planning、build、review、verification 流程推进这个项目',
      ],
    },
  },
];
