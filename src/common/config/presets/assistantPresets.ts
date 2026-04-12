import type { PresetAgentType } from '@/common/types/acpTypes';

export type AssistantWorkspaceAutomationProfile = 'contextgo-harness' | 'claude-ecc';

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
  hideDefaultSkillsFromLibrary?: boolean;
  skillPackageNameI18n?: Record<string, string>;
  skillPackageDescriptionI18n?: Record<string, string>;
  /**
   * Names of bundled skills owned by this preset package.
   * Used for library hiding and package attribution even when the preset relies on native harness bootstrap.
   */
  packagedSkillNames?: string[];
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
  /**
   * Workspace automation bootstrap profile for this assistant.
   */
  workspaceAutomationProfile?: AssistantWorkspaceAutomationProfile;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promptsI18n?: Record<string, string[]>;
};

export const SUPERPOWERS_DEFAULT_HOOKS = [
  'repo-context-bootstrap',
  'plan-before-coding',
  'secret-guard',
  'tool-safety-guard',
  'quality-gate',
  'tdd-guard',
  'continuity-handoff',
] as const;

export const SUPERPOWERS_DEFAULT_SKILLS = [
  'using-superpowers',
  'brainstorming',
  'writing-plans',
  'writing-skills',
  'executing-plans',
  'test-driven-development',
  'using-git-worktrees',
  'subagent-driven-development',
  'dispatching-parallel-agents',
  'finishing-a-development-branch',
  'requesting-code-review',
  'receiving-code-review',
  'systematic-debugging',
  'verification-before-completion',
] as const;

export const EVERYTHING_CLAUDE_CODE_PACKAGED_SKILLS = [
  'agent-eval',
  'agent-harness-construction',
  'agent-payment-x402',
  'agentic-engineering',
  'ai-first-engineering',
  'ai-regression-testing',
  'android-clean-architecture',
  'api-design',
  'architecture-decision-records',
  'article-writing',
  'autonomous-agent-harness',
  'autonomous-loops',
  'backend-patterns',
  'benchmark',
  'blueprint',
  'brand-voice',
  'browser-qa',
  'bun-runtime',
  'canary-watch',
  'carrier-relationship-management',
  'ck',
  'claude-api',
  'claude-devfleet',
  'click-path-audit',
  'clickhouse-io',
  'codebase-onboarding',
  'coding-standards',
  'compose-multiplatform-patterns',
  'configure-ecc',
  'connections-optimizer',
  'content-engine',
  'content-hash-cache-pattern',
  'context-budget',
  'continuous-agent-loop',
  'continuous-learning',
  'continuous-learning-v2',
  'cost-aware-llm-pipeline',
  'cpp-coding-standards',
  'cpp-testing',
  'crosspost',
  'customer-billing-ops',
  'customs-trade-compliance',
  'data-scraper-agent',
  'database-migrations',
  'deep-research',
  'deployment-patterns',
  'design-system',
  'django-patterns',
  'django-security',
  'django-tdd',
  'django-verification',
  'dmux-workflows',
  'docker-patterns',
  'documentation-lookup',
  'e2e-testing',
  'energy-procurement',
  'enterprise-agent-ops',
  'eval-harness',
  'exa-search',
  'fal-ai-media',
  'flutter-dart-code-review',
  'foundation-models-on-device',
  'frontend-patterns',
  'frontend-slides',
  'gan-style-harness',
  'git-workflow',
  'golang-patterns',
  'golang-testing',
  'google-workspace-ops',
  'healthcare-cdss-patterns',
  'healthcare-emr-patterns',
  'healthcare-eval-harness',
  'healthcare-phi-compliance',
  'hexagonal-architecture',
  'inventory-demand-planning',
  'investor-materials',
  'investor-outreach',
  'iterative-retrieval',
  'java-coding-standards',
  'jpa-patterns',
  'kotlin-coroutines-flows',
  'kotlin-exposed-patterns',
  'kotlin-ktor-patterns',
  'kotlin-patterns',
  'kotlin-testing',
  'laravel-patterns',
  'laravel-plugin-discovery',
  'laravel-security',
  'laravel-tdd',
  'laravel-verification',
  'lead-intelligence',
  'liquid-glass-design',
  'logistics-exception-management',
  'manim-video',
  'market-research',
  'mcp-server-patterns',
  'nanoclaw-repl',
  'nextjs-turbopack',
  'nutrient-document-processing',
  'nuxt4-patterns',
  'openclaw-persona-forge',
  'opensource-pipeline',
  'perl-patterns',
  'perl-security',
  'perl-testing',
  'plankton-code-quality',
  'postgres-patterns',
  'product-lens',
  'production-scheduling',
  'project-flow-ops',
  'project-guidelines-example',
  'prompt-optimizer',
  'python-patterns',
  'python-testing',
  'pytorch-patterns',
  'quality-nonconformance',
  'ralphinho-rfc-pipeline',
  'regex-vs-llm-structured-text',
  'remotion-video-creation',
  'repo-scan',
  'returns-reverse-logistics',
  'rules-distill',
  'rust-patterns',
  'rust-testing',
  'safety-guard',
  'santa-method',
  'search-first',
  'security-review',
  'security-scan',
  'skill-comply',
  'skill-stocktake',
  'social-graph-ranker',
  'springboot-patterns',
  'springboot-security',
  'springboot-tdd',
  'springboot-verification',
  'strategic-compact',
  'swift-actor-persistence',
  'swift-concurrency-6-2',
  'swift-protocol-di-testing',
  'swiftui-patterns',
  'tdd-workflow',
  'team-builder',
  'token-budget-advisor',
  'ui-demo',
  'verification-loop',
  'video-editing',
  'videodb',
  'visa-doc-translate',
  'workspace-surface-audit',
  'x-api',
] as const;

export const ENGINEERING_DEFAULT_HOOKS = SUPERPOWERS_DEFAULT_HOOKS;
export const ENGINEERING_WORKBENCH_SKILLS = SUPERPOWERS_DEFAULT_SKILLS;

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
    defaultEnabledSkills: [...SUPERPOWERS_DEFAULT_SKILLS],
    packagedSkillNames: [...SUPERPOWERS_DEFAULT_SKILLS],
    hideDefaultSkillsFromLibrary: true,
    skillPackageNameI18n: {
      'en-US': 'Superpowers Harness Pack',
      'zh-CN': 'Superpowers Harness 技能包',
    },
    skillPackageDescriptionI18n: {
      'en-US':
        'Bundled engineering workflow package absorbed from the open-source Superpowers repository. It is attached as a built-in pack instead of being exposed as standalone skills.',
      'zh-CN': '吸收自开源 Superpowers 仓库的工程工作流技能包，作为内置包挂载给助手使用，不单独暴露为可选技能。',
    },
    defaultEnabledHooks: [...SUPERPOWERS_DEFAULT_HOOKS],
    workspaceAutomationProfile: 'contextgo-harness',
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
    packagedSkillNames: [...EVERYTHING_CLAUDE_CODE_PACKAGED_SKILLS],
    hideDefaultSkillsFromLibrary: true,
    skillPackageNameI18n: {
      'en-US': 'Everything Claude Code Harness Pack',
      'zh-CN': 'Everything Claude Code Harness 技能包',
    },
    skillPackageDescriptionI18n: {
      'en-US':
        'Bundled harness package absorbed from the open-source Everything Claude Code repository, including its native skills, legacy command shims, and hook runtime payload.',
      'zh-CN': '吸收自开源 Everything Claude Code 仓库的完整 harness 包，包含原生 skills、兼容命令 shim 和 hook 运行时载荷，作为内置包挂载给助手使用。',
    },
    workspaceAutomationProfile: 'claude-ecc',
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
        'Engineering harness assistant absorbed from Everything Claude Code. Ships its native skill pack, legacy slash shims, and Claude workspace hook payload as a first-class built-in preset.',
      'zh-CN': '从 Everything Claude Code 完整吸收进来的工程 Harness 助手，内置其原生 skill 包、兼容 slash 命令和 Claude 工作区 hook 载荷。',
    },
    promptsI18n: {
      'en-US': [
        'Link my repo and run the native Everything Claude Code harness in this workspace',
        'Prepare a Claude Code style engineering harness for this workspace before coding',
        'Use the bundled ECC skill pack, command shims, and hook runtime for this project',
      ],
      'zh-CN': [
        '先关联仓库，再在这个工作空间里启用原生 Everything Claude Code harness',
        '在开始编码前，为这个工作空间准备 Claude Code 风格的完整工程 harness',
        '用内置的 ECC skill 包、命令 shim 和 hook 运行时来推进这个项目',
      ],
    },
  },
];
