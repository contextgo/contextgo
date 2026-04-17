import { describe, it, expect, vi, beforeEach } from 'vitest';

// Normalize paths to forward slashes for cross-platform key matching
const norm = (p: string) => p.replace(/\\/g, '/');

// Use vi.hoisted() so tracking variables are initialized before vi.mock factories run
const {
  mkdirCalls,
  symlinkCalls,
  copyFileCalls,
  writeFileCalls,
  fileContents,
  statResults,
  lstatResults,
  existsSyncResults,
  resetAll,
} = vi.hoisted(() => {
  const mkdirCalls: string[] = [];
  const symlinkCalls: Array<{ source: string; target: string; type: string }> = [];
  const copyFileCalls: Array<{ source: string; target: string }> = [];
  const writeFileCalls: Array<{ path: string; content: string }> = [];
  const fileContents: Record<string, string> = {};
  const statResults: Record<string, boolean> = {};
  const lstatResults: Record<string, boolean> = {};
  const existsSyncResults: Record<string, boolean> = {};

  const resetAll = () => {
    mkdirCalls.length = 0;
    symlinkCalls.length = 0;
    copyFileCalls.length = 0;
    writeFileCalls.length = 0;
    for (const key of Object.keys(fileContents)) delete fileContents[key];
    for (const key of Object.keys(statResults)) delete statResults[key];
    for (const key of Object.keys(lstatResults)) delete lstatResults[key];
    for (const key of Object.keys(existsSyncResults)) delete existsSyncResults[key];
  };

  return {
    mkdirCalls,
    symlinkCalls,
    copyFileCalls,
    writeFileCalls,
    fileContents,
    statResults,
    lstatResults,
    existsSyncResults,
    resetAll,
  };
});

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(async (p: string) => {
      const normalizedPath = norm(p);
      if (normalizedPath.endsWith('/SKILL.md')) {
        const skillDir = normalizedPath.slice(0, -'/SKILL.md'.length);
        const nestedSkillsDir = `${skillDir}/skills`;
        const hasSkillDir = existsSyncResults[skillDir] || statResults[skillDir] || lstatResults[skillDir];
        const isSkillPack =
          existsSyncResults[nestedSkillsDir] || statResults[nestedSkillsDir] || lstatResults[nestedSkillsDir];

        if (
          existsSyncResults[normalizedPath] ||
          statResults[normalizedPath] ||
          lstatResults[normalizedPath] ||
          (hasSkillDir && !isSkillPack)
        ) {
          return;
        }
      }

      if (existsSyncResults[normalizedPath] || statResults[normalizedPath] || lstatResults[normalizedPath]) return;
      throw new Error(`ENOENT: ${p}`);
    }),
    mkdir: vi.fn(async (dir: string) => {
      mkdirCalls.push(norm(dir));
    }),
    readdir: vi.fn(async (dir: string, _options?: { withFileTypes?: boolean }) => {
      const normalizedDir = norm(dir);

      if (!existsSyncResults[normalizedDir] && !statResults[normalizedDir] && !lstatResults[normalizedDir]) {
        throw new Error(`ENOENT: ${dir}`);
      }

      const childEntries = new Map<string, 'file' | 'directory'>();
      const knownPaths = new Set([
        ...Object.keys(existsSyncResults),
        ...Object.keys(statResults),
        ...Object.keys(lstatResults),
        ...Object.keys(fileContents),
      ]);

      for (const key of knownPaths) {
        if (!key.startsWith(normalizedDir + '/')) continue;

        const relative = key.slice(normalizedDir.length + 1);
        if (!relative || relative.includes('/')) continue;
        const entryType = fileContents[key] !== undefined ? 'file' : 'directory';
        childEntries.set(relative, entryType);
      }

      return Array.from(childEntries.entries()).map(([name, entryType]) => ({
        name,
        isDirectory: () => entryType === 'directory',
        isFile: () => entryType === 'file',
        isSymbolicLink: () => false,
      }));
    }),
    readFile: vi.fn(async (p: string) => {
      const normalizedPath = norm(p);
      if (fileContents[normalizedPath] !== undefined) {
        return fileContents[normalizedPath];
      }

      if (!normalizedPath.endsWith('/SKILL.md')) {
        throw new Error(`ENOENT: ${p}`);
      }

      const skillDir = normalizedPath.slice(0, -'/SKILL.md'.length);
      const nestedSkillsDir = `${skillDir}/skills`;
      const hasSkillDir = existsSyncResults[skillDir] || statResults[skillDir] || lstatResults[skillDir];
      const isSkillPack =
        existsSyncResults[nestedSkillsDir] || statResults[nestedSkillsDir] || lstatResults[nestedSkillsDir];
      const hasSkillFile =
        existsSyncResults[normalizedPath] || statResults[normalizedPath] || lstatResults[normalizedPath];

      if (!hasSkillFile && !(hasSkillDir && !isSkillPack)) {
        throw new Error(`ENOENT: ${p}`);
      }

      const skillName = normalizedPath.split('/').slice(-2, -1)[0];
      return `---\nname: ${skillName}\ndescription: mock skill\n---\n`;
    }),
    writeFile: vi.fn(async (p: string, content: string) => {
      const normalizedPath = norm(p);
      fileContents[normalizedPath] = content;
      existsSyncResults[normalizedPath] = true;
      writeFileCalls.push({ path: normalizedPath, content });
    }),
    stat: vi.fn(async (p: string) => {
      if (statResults[norm(p)]) return {};
      throw new Error(`ENOENT: ${p}`);
    }),
    lstat: vi.fn(async (p: string) => {
      if (lstatResults[norm(p)]) return {};
      throw new Error(`ENOENT: ${p}`);
    }),
    symlink: vi.fn(async (source: string, target: string, type: string) => {
      symlinkCalls.push({ source: norm(source), target: norm(target), type });
    }),
    copyFile: vi.fn(async (source: string, target: string) => {
      const normalizedSource = norm(source);
      const normalizedTarget = norm(target);
      const sourceContent =
        fileContents[normalizedSource] ??
        (normalizedSource.endsWith('/SKILL.md')
          ? `---\nname: ${normalizedSource.split('/').slice(-2, -1)[0]}\ndescription: mock skill\n---\n`
          : undefined);

      if (sourceContent === undefined) {
        throw new Error(`ENOENT: ${source}`);
      }

      copyFileCalls.push({ source: normalizedSource, target: normalizedTarget });
      fileContents[normalizedTarget] = sourceContent;
      existsSyncResults[normalizedTarget] = true;
    }),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => existsSyncResults[norm(p)] ?? false),
}));

vi.mock('@process/utils/initStorage', () => ({
  getAutoSkillsDir: vi.fn(() => '/mock/builtin-skills/_builtin'),
  getSkillsDir: vi.fn(() => '/mock/user/skills'),
  getBuiltinSkillsCopyDir: vi.fn(() => '/mock/builtin-skills'),
  getSystemDir: vi.fn(() => '/mock/system'),
}));

vi.mock('@process/utils/openclawUtils', () => ({
  computeOpenClawIdentityHash: vi.fn(() => 'mock-hash'),
}));

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'mock-uuid'),
}));

describe('initAgent — skill support', () => {
  let hasNativeSkillSupport: (agentTypeOrBackend: string | undefined) => boolean;
  let setupAssistantWorkspace: (
    workspace: string,
    options: { agentType?: string; backend?: string; enabledSkills?: string[]; presetAssistantId?: string }
  ) => Promise<void>;
  let createAcpAgent: (options: unknown) => Promise<{ extra: { workspace: string; customWorkspace?: boolean } }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAll();
    existsSyncResults['/mock/builtin-skills'] = true;
    existsSyncResults['/mock/user/skills'] = true;

    const repoRoot = norm(process.cwd());
    fileContents[`${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\nThis workspace uses Superpowers Harness.\n\nspec -> plan -> TDD -> review\n\nSee docs/reviews/.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/docs/README.md`] =
      '# Engineering Workspace\n\nengineering workflow stack\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/docs/plans/README.md`] =
      '# Implementation Plans\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/docs/specs/README.md`] =
      '# Design Specs\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/docs/reviews/README.md`
    ] = '# Review Notes\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/engineering/superpowers/workspace/docs/testing.md`] =
      '# Testing Strategy\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/AGENTS.md`
    ] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **Everything Claude Code Harness** assistant.\n\n" +
      'Use this file as the workspace entry point for durable collaboration guidance. Keep it short. Put details that only matter for specific kinds of work under `docs/`.\n\n' +
      '## Workspace Model\n\n' +
      '- `.contextgo/` is the installed workspace state for this package.\n' +
      '- Runtime-native directories such as `.claude/skills` or `.agents/skills` are projections only.\n' +
      '- `docs/` is a progressive-disclosure context surface. Load the relevant docs when the task touches that area.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/README.md` for the workspace documentation map.\n' +
      '- Read `docs/skills/README.md` when the task is about packaged skills, skill selection, or project skill extension.\n' +
      '- Read `docs/commands/README.md` when the task is about command entry points or command migration.\n' +
      '- Read `docs/hooks/README.md` when the task is about hook-triggered automation or hook debugging.\n' +
      '- Read `docs/automation/README.md` when the task is about schedules, loops, periodic jobs, or continuous workflows.\n\n' +
      '## Project-Specific Instructions\n\n' +
      'Fill in:\n\n' +
      '- the project purpose and current priorities\n' +
      '- constraints or guardrails that future turns must honor\n' +
      '- where long-lived specs, plans, and verification notes should be written\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/docs/README.md`
    ] =
      '# Workspace Docs\n\n' +
      'This folder stores workspace documents for **Everything Claude Code Harness**.\n\n' +
      'These docs are meant for progressive disclosure. They explain the package surfaces and workspace conventions that an agent should load when a task actually touches that area. They are not meant to duplicate always-on instructions.\n\n' +
      '## Read This Folder As\n\n' +
      '- `docs/skills/README.md` - how packaged skills should be understood, extended, and routed\n' +
      '- `docs/commands/README.md` - how command surfaces work and when they are only compatibility shims\n' +
      '- `docs/hooks/README.md` - how hook-triggered automation works in ContextGo\n' +
      '- `docs/automation/README.md` - how schedules, loops, periodic jobs, and continuous workflows should be modeled\n' +
      '- `docs/specs/` - reviewed design specs and decision docs\n' +
      '- `docs/plans/` - executable implementation plans and verification checklists\n\n' +
      '## Authoring Rule\n\n' +
      '- Keep the root `AGENTS.md` concise and route detailed topic guidance into the relevant docs file.\n' +
      '- Treat these docs as reference context, not as a second always-on prompt surface.\n' +
      '- Keep product behavior grounded in `agent-package.json` and installed `.contextgo/` state.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/docs/skills/README.md`
    ] =
      '# Skills Surface\n\n' +
      'Use this document when the task touches skill selection, packaged skill behavior, or project-specific skill extension.\n\n' +
      '## What Skills Mean Here\n\n' +
      '- Packaged skills are the primary reusable workflow surface for this assistant package.\n' +
      '- Installed skill state lives under `.contextgo/skills`.\n' +
      '- Runtime-native skill directories are projections for runtime compatibility, not the source of truth.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/docs/commands/README.md`
    ] =
      '# Commands Surface\n\n' +
      'Use this document when the task touches command entry points, slash-command compatibility, or command migration.\n\n' +
      '## What Commands Mean Here\n\n' +
      '- Commands are a workspace automation surface managed by ContextGo.\n' +
      '- Installed command state lives in `.contextgo/commands.json`.\n' +
      '- For this harness, commands often preserve upstream ECC entry points while newer workflow behavior moves toward skills-first routing.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/docs/hooks/README.md`
    ] =
      '# Hooks Surface\n\n' +
      'Use this document when the task touches hook-triggered automation, hook configuration, or hook debugging.\n\n' +
      '## What Hooks Mean Here\n\n' +
      '- Hooks are ContextGo workspace automation, not language-level instructions.\n' +
      '- Installed hook payload lives under `.contextgo/hooks/`, and selection state lives in `.contextgo/hooks.json`.\n' +
      '- Hook behavior should be reasoned about as product automation that triggers around tool or workflow events.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/workspace/docs/automation/README.md`
    ] =
      '# Workspace Automation\n\n' +
      'Use this document when the task touches schedules, loops, periodic jobs, or continuous workflows.\n\n' +
      '## What Automation Means Here\n\n' +
      '- This package may express automation through schedules, loop-oriented workflows, and ongoing observation or learning flows.\n' +
      '- These are platform automation capabilities, not facts the agent should always keep in working memory.\n' +
      '- Installed schedule state lives in `.contextgo/schedules.json`.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/startup/startup-strategist/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **Startup Strategist** assistant.\n\n" +
      'Use this file as the founder-facing entry point for workspace guidance. Keep it concise and route deeper strategy context into `docs/`.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/ideas/README.md` for startup idea framing and hypothesis shaping.\n' +
      '- Read `docs/market/README.md` for ICP, segment, and value-proposition work.\n' +
      '- Read `docs/strategy/README.md` for GTM, North Star, and durable strategic choices.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/startup/startup-strategist/workspace/docs/README.md`] =
      '# Workspace Docs\n\n' + 'This folder stores progressive-disclosure context for **Startup Strategist**.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/startup/startup-strategist/workspace/docs/ideas/README.md`
    ] = '# Idea Framing\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/startup/startup-strategist/workspace/docs/market/README.md`
    ] = '# Market and ICP\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/startup/startup-strategist/workspace/docs/strategy/README.md`
    ] = '# Strategy Artifacts\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/design/design-director/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **Design Director** assistant.\n\n" +
      'Use this file as the design entry point for workspace guidance. Keep it concise and route detailed visual work into `docs/`.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/direction/README.md` for visual direction and system-level aesthetic decisions.\n' +
      '- Read `docs/references/README.md` for reference intake, screenshot critique, and Figma absorption.\n' +
      '- Read `docs/handoff/README.md` for implementation-ready design handoff.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/design/design-director/workspace/docs/README.md`] =
      '# Workspace Docs\n\n' + 'This folder stores progressive-disclosure context for **Design Director**.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/design/design-director/workspace/docs/direction/README.md`
    ] = '# Visual Direction\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/design/design-director/workspace/docs/references/README.md`
    ] = '# Reference Intake\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/design/design-director/workspace/docs/handoff/README.md`
    ] = '# Design Handoff\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/product/pm-workbench/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **PM Workbench** assistant.\n\n" +
      'Use this file as the product-work entry point for workspace guidance. Keep it concise and route detailed product context into `docs/`.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/discovery/README.md` for problem framing, evidence, and opportunity shaping.\n' +
      '- Read `docs/prds/README.md` for PRD drafting and scope decisions.\n' +
      '- Read `docs/roadmap/README.md` for sequencing, prioritization, and rollout framing.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/product/pm-workbench/workspace/docs/README.md`] =
      '# Workspace Docs\n\n' + 'This folder stores progressive-disclosure context for **PM Workbench**.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/product/pm-workbench/workspace/docs/discovery/README.md`
    ] = '# Discovery\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/product/pm-workbench/workspace/docs/prds/README.md`] =
      '# PRDs\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/product/pm-workbench/workspace/docs/roadmap/README.md`] =
      '# Roadmap\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/office/office-analyst/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **Office Analyst** assistant.\n\n" +
      'Use this file as the source-aware office-work entry point for workspace guidance. Keep it concise and route detailed analysis context into `docs/`.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/sources/README.md` for source inventory and file traceability.\n' +
      '- Read `docs/analysis/README.md` for spreadsheet, query, and reconciliation work.\n' +
      '- Read `docs/reports/README.md` for report assembly and durable outputs.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/office/office-analyst/workspace/docs/README.md`] =
      '# Workspace Docs\n\n' + 'This folder stores progressive-disclosure context for **Office Analyst**.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/office/office-analyst/workspace/docs/sources/README.md`] =
      '# Source Inventory\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/office/office-analyst/workspace/docs/analysis/README.md`
    ] = '# Analysis Workspace\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/office/office-analyst/workspace/docs/reports/README.md`] =
      '# Reports\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/finance/finance-analyst/workspace/AGENTS.md`] =
      '# Workspace Instructions\n\n' +
      "This workspace was initialized for ContextGo's built-in **Finance Analyst** assistant.\n\n" +
      'Use this file as the finance-work entry point for workspace guidance. Keep it concise and route detailed analytical context into `docs/`.\n\n' +
      '## Context Routing\n\n' +
      '- Read `docs/analysis/README.md` for statement analysis, benchmarks, and variance work.\n' +
      '- Read `docs/valuation/README.md` for valuation framing and comparable work.\n' +
      '- Read `docs/scenarios/README.md` for forecast, memo, and scenario-planning context.\n';
    fileContents[`${repoRoot}/src/process/resources/assistant/finance/finance-analyst/workspace/docs/README.md`] =
      '# Workspace Docs\n\n' + 'This folder stores progressive-disclosure context for **Finance Analyst**.\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/finance/finance-analyst/workspace/docs/analysis/README.md`
    ] = '# Finance Analysis\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/finance/finance-analyst/workspace/docs/valuation/README.md`
    ] = '# Valuation\n';
    fileContents[
      `${repoRoot}/src/process/resources/assistant/finance/finance-analyst/workspace/docs/scenarios/README.md`
    ] = '# Scenarios and Memos\n';

    const mod = await import('@process/utils/initAgent');
    hasNativeSkillSupport = mod.hasNativeSkillSupport;
    setupAssistantWorkspace = mod.setupAssistantWorkspace;
    createAcpAgent = mod.createAcpAgent;
  });

  describe('hasNativeSkillSupport', () => {
    it('should return true for all backends with verified native skill dirs', () => {
      const supported = ['gemini', 'claude', 'codex', 'opencode'];
      for (const backend of supported) {
        expect(hasNativeSkillSupport(backend)).toBe(true);
      }
    });

    it('should return false for backends without native skill support', () => {
      const unsupported = ['auggie', 'copilot', 'nanobot', 'qoder', 'codebuddy', 'droid', 'qwen'];
      for (const backend of unsupported) {
        expect(hasNativeSkillSupport(backend)).toBe(false);
      }
    });

    it('should return false for undefined or empty string', () => {
      expect(hasNativeSkillSupport(undefined)).toBe(false);
      expect(hasNativeSkillSupport('')).toBe(false);
    });

    it('should return false for unknown backend names', () => {
      expect(hasNativeSkillSupport('unknown-agent')).toBe(false);
      expect(hasNativeSkillSupport('custom')).toBe(false);
    });
  });

  describe('setupAssistantWorkspace', () => {
    it('should still project builtin auto skills when enabledSkills is empty', async () => {
      existsSyncResults['/mock/builtin-skills/_builtin'] = true;
      statResults['/mock/builtin-skills/_builtin/schedule'] = true;
      fileContents['/mock/builtin-skills/_builtin/schedule/SKILL.md'] =
        '---\nname: schedule\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: [],
      });

      expect(mkdirCalls).toContain('/tmp/workspace/.contextgo/skills');
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.claude/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/schedule/SKILL.md',
      });
    });

    it('should still project builtin auto skills when enabledSkills is undefined', async () => {
      existsSyncResults['/mock/builtin-skills/_builtin'] = true;
      statResults['/mock/builtin-skills/_builtin/schedule'] = true;
      fileContents['/mock/builtin-skills/_builtin/schedule/SKILL.md'] =
        '---\nname: schedule\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
      });

      expect(mkdirCalls).toContain('/tmp/workspace/.contextgo/skills');
      expect(copyFileCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/schedule/SKILL.md',
      });
    });

    it('should project opencode skills from .contextgo/skills', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'opencode',
        enabledSkills: ['pptx'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.opencode/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
    });

    it('should bootstrap packaged preset skills into .contextgo for non-Claude runtimes', async () => {
      const repoRoot = norm(process.cwd());
      const presetSkillsRoot = `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/skills`;
      const packagedSkillDir = `${presetSkillsRoot}/agent-eval`;

      existsSyncResults[presetSkillsRoot] = true;
      statResults[packagedSkillDir] = true;
      fileContents[`${packagedSkillDir}/SKILL.md`] = '---\nname: agent-eval\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        presetAssistantId: 'builtin-everything-in-claude-code',
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.agents/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: `${packagedSkillDir}/SKILL.md`,
        target: '/tmp/workspace/.contextgo/skills/agent-eval/SKILL.md',
      });
    });

    it('should create symlink in correct dir for claude backend', async () => {
      const skillSource = '/mock/user/skills/pptx';
      statResults[skillSource] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(mkdirCalls).toContain('/tmp/workspace/.contextgo/skills');
      expect(mkdirCalls).toContain('/tmp/workspace/.claude');
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.claude/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
    });

    it('should project codex skills from .contextgo/skills', async () => {
      statResults['/mock/user/skills/pdf'] = true;
      fileContents['/mock/user/skills/pdf/SKILL.md'] = '---\nname: pdf\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: ['pdf'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.agents/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pdf/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pdf/SKILL.md',
      });
    });

    it('materializes enabled skills into project-owned state instead of linking user skill sources directly', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: ['pptx'],
      });

      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
      expect(symlinkCalls).not.toContainEqual({
        source: '/mock/user/skills/pptx',
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
      });
    });

    it('should use junction type for symlinks (Windows compatibility)', async () => {
      statResults['/mock/user/skills/test-skill'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['test-skill'],
      });

      expect(symlinkCalls[0].type).toBe('junction');
    });

    it('should prefer builtin-skills/ over user skills/', async () => {
      existsSyncResults['/mock/builtin-skills/pptx'] = true;
      statResults['/mock/builtin-skills/pptx'] = true;
      fileContents['/mock/builtin-skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(copyFileCalls).toContainEqual({
        source: '/mock/builtin-skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
    });

    it('should resolve bundled skills from nested skill packs', async () => {
      existsSyncResults['/mock/builtin-skills/engineering-pack'] = true;
      existsSyncResults['/mock/builtin-skills/engineering-pack/skills'] = true;
      existsSyncResults['/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack'] = true;
      existsSyncResults['/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack/skills'] = true;
      statResults[
        '/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack/skills/test-driven-development'
      ] = true;
      fileContents[
        '/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack/skills/test-driven-development/SKILL.md'
      ] = '---\nname: test-driven-development\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['test-driven-development'],
      });

      expect(copyFileCalls).toContainEqual({
        source:
          '/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack/skills/test-driven-development/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/test-driven-development/SKILL.md',
      });
    });

    it('should fall back to user skills/ when not in builtin-skills/', async () => {
      existsSyncResults['/mock/builtin-skills/custom-skill'] = false;
      statResults['/mock/user/skills/custom-skill'] = true;
      fileContents['/mock/user/skills/custom-skill/SKILL.md'] =
        '---\nname: custom-skill\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['custom-skill'],
      });

      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/custom-skill/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/custom-skill/SKILL.md',
      });
    });

    it('should project builtin auto skills like schedule into native workspaces', async () => {
      existsSyncResults['/mock/builtin-skills/_builtin'] = true;
      statResults['/mock/builtin-skills/_builtin/schedule'] = true;
      statResults['/mock/builtin-skills/_builtin/contextgo-skills'] = true;
      statResults['/mock/user/skills/pptx'] = true;
      fileContents['/mock/builtin-skills/_builtin/schedule/SKILL.md'] =
        '---\nname: schedule\ndescription: mock skill\n---\n';
      fileContents['/mock/builtin-skills/_builtin/contextgo-skills/SKILL.md'] =
        '---\nname: contextgo-skills\ndescription: mock skill\n---\n';
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['schedule', 'pptx'],
      });

      expect(copyFileCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/schedule/SKILL.md',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/contextgo-skills/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/contextgo-skills/SKILL.md',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
    });

    it('should auto-project workspace connector skills into managed runtime skills', async () => {
      existsSyncResults['/tmp/workspace/.connector/skills'] = true;
      statResults['/tmp/workspace/.connector/skills/github-ops'] = true;
      fileContents['/tmp/workspace/.connector/skills/github-ops/SKILL.md'] =
        '---\nname: github-ops\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: [],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.agents/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/tmp/workspace/.connector/skills/github-ops/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/github-ops/SKILL.md',
      });
    });

    it('should skip managed skill symlink when target already exists', async () => {
      const skillSource = '/mock/user/skills/pptx';
      const skillTarget = '/tmp/workspace/.contextgo/skills/pptx';
      statResults[skillSource] = true;
      lstatResults[skillTarget] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(symlinkCalls).toHaveLength(1);
      expect(symlinkCalls[0]).toEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.claude/skills',
        type: 'junction',
      });
    });

    it('should warn when source skill directory does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['nonexistent-skill'],
      });

      expect(symlinkCalls).toHaveLength(1);
      expect(symlinkCalls[0]).toEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.claude/skills',
        type: 'junction',
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-skill'));
      consoleSpy.mockRestore();
    });

    it('should prefer backend over agentType when both provided', async () => {
      statResults['/mock/user/skills/test-skill'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        agentType: 'gemini',
        backend: 'codex',
        enabledSkills: ['test-skill'],
      });

      // backend 'codex' takes priority -> .agents/skills
      expect(mkdirCalls).toContain('/tmp/workspace/.agents');
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.agents/skills',
        type: 'junction',
      });
    });

    it('should handle multiple enabled skills', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      statResults['/mock/user/skills/pdf'] = true;
      statResults['/mock/user/skills/docx'] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';
      fileContents['/mock/user/skills/pdf/SKILL.md'] = '---\nname: pdf\ndescription: mock skill\n---\n';
      fileContents['/mock/user/skills/docx/SKILL.md'] = '---\nname: docx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx', 'pdf', 'docx'],
      });

      expect(symlinkCalls).toHaveLength(1);
      expect(copyFileCalls).toHaveLength(3);
    });

    it('should project runtime entries per skill when native skills dir already exists as a real directory', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      lstatResults['/tmp/workspace/.claude/skills'] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pptx/SKILL.md',
        target: '/tmp/workspace/.contextgo/skills/pptx/SKILL.md',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills/pptx',
        target: '/tmp/workspace/.claude/skills/pptx',
        type: 'junction',
      });
    });

    it('writes a default project runtime policy during workspace bootstrap', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      fileContents['/mock/user/skills/pptx/SKILL.md'] = '---\nname: pptx\ndescription: mock skill\n---\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: ['pptx'],
      });

      const runtimePolicyCall = writeFileCalls.find(
        (call) => call.path === '/tmp/workspace/.contextgo/runtime.json'
      );
      expect(runtimePolicyCall).toBeDefined();
      expect(runtimePolicyCall?.content).toContain('"mode": "auto"');
    });

    it('projects AGENTS.md into CLAUDE.md for Claude workspaces', async () => {
      existsSyncResults['/tmp/workspace/AGENTS.md'] = true;
      fileContents['/tmp/workspace/AGENTS.md'] = '# Project Rules\n\nUse AGENTS as source.\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: [],
      });

      expect(writeFileCalls).toContainEqual({
        path: '/tmp/workspace/CLAUDE.md',
        content:
          '<!--\n' +
          '  Generated by ContextGo.\n' +
          '  Source of truth: AGENTS.md\n' +
          '  Do not edit this file directly.\n' +
          '-->\n\n' +
          '# Project Rules\n\nUse AGENTS as source.\n',
      });
    });

    it('projects AGENTS.md into GEMINI.md for Gemini workspaces', async () => {
      existsSyncResults['/tmp/workspace/AGENTS.md'] = true;
      fileContents['/tmp/workspace/AGENTS.md'] = '# Project Rules\n\nUse AGENTS as source.\n';

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'gemini',
        enabledSkills: [],
      });

      expect(writeFileCalls).toContainEqual({
        path: '/tmp/workspace/GEMINI.md',
        content:
          '<!--\n' +
          '  Generated by ContextGo.\n' +
          '  Source of truth: AGENTS.md\n' +
          '  Do not edit this file directly.\n' +
          '-->\n\n' +
          '# Project Rules\n\nUse AGENTS as source.\n',
      });
    });

    it('scaffolds project docs for builtin assistant workspaces when the workspace is empty', async () => {
      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        presetAssistantId: 'builtin-superpowers',
      });

      const agentsCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/AGENTS.md');
      const docsReadmeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/README.md');
      const plansReadmeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/plans/README.md');
      const reviewsReadmeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/reviews/README.md');
      const specsReadmeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/specs/README.md');
      const testingDocCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/testing.md');

      expect(agentsCall).toBeDefined();
      expect(agentsCall?.content).toContain('Superpowers Harness');
      expect(agentsCall?.content).toContain('docs/reviews/');
      expect(agentsCall?.content).toContain('spec -> plan -> TDD -> review');

      expect(docsReadmeCall).toBeDefined();
      expect(docsReadmeCall?.content).toContain('Engineering Workspace');
      expect(docsReadmeCall?.content).toContain('engineering workflow stack');

      expect(plansReadmeCall).toBeDefined();
      expect(plansReadmeCall?.content).toContain('Implementation Plans');

      expect(reviewsReadmeCall).toBeDefined();
      expect(reviewsReadmeCall?.content).toContain('Review Notes');

      expect(specsReadmeCall).toBeDefined();
      expect(specsReadmeCall?.content).toContain('Design Specs');

      expect(testingDocCall).toBeDefined();
      expect(testingDocCall?.content).toContain('Testing Strategy');

      expect(mkdirCalls).toContain('/tmp/workspace/docs');
      expect(mkdirCalls).toContain('/tmp/workspace/docs/plans');
      expect(mkdirCalls).toContain('/tmp/workspace/docs/reviews');
      expect(mkdirCalls).toContain('/tmp/workspace/docs/specs');
    });

    it('uses scaffolded AGENTS.md as the source of truth for Claude projections', async () => {
      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        presetAssistantId: 'builtin-superpowers',
      });

      const agentsCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/AGENTS.md');
      const claudeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/CLAUDE.md');

      expect(agentsCall).toBeDefined();
      expect(claudeCall).toBeDefined();
      expect(claudeCall?.content).toContain('Source of truth: AGENTS.md');
      expect(claudeCall?.content).toContain('Superpowers Harness');
    });

    it('does not scaffold project docs into established workspaces that already have root guidance', async () => {
      existsSyncResults['/tmp/workspace/README.md'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        presetAssistantId: 'builtin-superpowers',
      });

      expect(writeFileCalls.some((call) => call.path === '/tmp/workspace/AGENTS.md')).toBe(false);
      expect(writeFileCalls.some((call) => call.path === '/tmp/workspace/docs/README.md')).toBe(false);
      expect(writeFileCalls.some((call) => call.path === '/tmp/workspace/docs/plans/README.md')).toBe(false);
      expect(writeFileCalls.some((call) => call.path === '/tmp/workspace/docs/specs/README.md')).toBe(false);
    });

    it('does not create native instruction files when AGENTS.md is missing', async () => {
      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: [],
      });

      expect(writeFileCalls.some((call) => call.path.endsWith('/CLAUDE.md'))).toBe(false);
      expect(writeFileCalls.some((call) => call.path.endsWith('/GEMINI.md'))).toBe(false);
    });

    it('scaffolds progressive-disclosure ECC docs for builtin harness workspaces', async () => {
      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        presetAssistantId: 'builtin-everything-in-claude-code',
      });

      const agentsCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/AGENTS.md');
      const docsReadmeCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/README.md');
      const skillsCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/skills/README.md');
      const commandsCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/commands/README.md');
      const hooksCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/hooks/README.md');
      const automationCall = writeFileCalls.find((call) => call.path === '/tmp/workspace/docs/automation/README.md');

      expect(agentsCall?.content).toContain('Everything Claude Code Harness');
      expect(agentsCall?.content).toContain('progressive-disclosure context surface');
      expect(agentsCall?.content).toContain('docs/automation/README.md');

      expect(docsReadmeCall?.content).toContain('progressive disclosure');
      expect(docsReadmeCall?.content).toContain('not meant to duplicate always-on instructions');

      expect(skillsCall?.content).toContain('.contextgo/skills');
      expect(commandsCall?.content).toContain('.contextgo/commands.json');
      expect(hooksCall?.content).toContain('not language-level instructions');
      expect(automationCall?.content).toContain('platform automation capabilities');
      expect(automationCall?.content).toContain('.contextgo/schedules.json');
    });

    it('scaffolds specialized workspace docs for non-engineering builtin assistants', async () => {
      const cases = [
        {
          presetAssistantId: 'builtin-startup-strategist',
          workspace: '/tmp/startup-workspace',
          displayName: 'Startup Strategist',
          topicDocs: [
            { path: '/tmp/startup-workspace/docs/ideas/README.md', keyword: 'Idea Framing' },
            { path: '/tmp/startup-workspace/docs/market/README.md', keyword: 'Market and ICP' },
            { path: '/tmp/startup-workspace/docs/strategy/README.md', keyword: 'Strategy Artifacts' },
          ],
        },
        {
          presetAssistantId: 'builtin-design-director',
          workspace: '/tmp/design-workspace',
          displayName: 'Design Director',
          topicDocs: [
            { path: '/tmp/design-workspace/docs/direction/README.md', keyword: 'Visual Direction' },
            { path: '/tmp/design-workspace/docs/references/README.md', keyword: 'Reference Intake' },
            { path: '/tmp/design-workspace/docs/handoff/README.md', keyword: 'Design Handoff' },
          ],
        },
        {
          presetAssistantId: 'builtin-pm-workbench',
          workspace: '/tmp/pm-workspace',
          displayName: 'PM Workbench',
          topicDocs: [
            { path: '/tmp/pm-workspace/docs/discovery/README.md', keyword: 'Discovery' },
            { path: '/tmp/pm-workspace/docs/prds/README.md', keyword: 'PRDs' },
            { path: '/tmp/pm-workspace/docs/roadmap/README.md', keyword: 'Roadmap' },
          ],
        },
        {
          presetAssistantId: 'builtin-office-analyst',
          workspace: '/tmp/office-workspace',
          displayName: 'Office Analyst',
          topicDocs: [
            { path: '/tmp/office-workspace/docs/sources/README.md', keyword: 'Source Inventory' },
            { path: '/tmp/office-workspace/docs/analysis/README.md', keyword: 'Analysis Workspace' },
            { path: '/tmp/office-workspace/docs/reports/README.md', keyword: 'Reports' },
          ],
        },
        {
          presetAssistantId: 'builtin-finance-analyst',
          workspace: '/tmp/finance-workspace',
          displayName: 'Finance Analyst',
          topicDocs: [
            { path: '/tmp/finance-workspace/docs/analysis/README.md', keyword: 'Finance Analysis' },
            { path: '/tmp/finance-workspace/docs/valuation/README.md', keyword: 'Valuation' },
            { path: '/tmp/finance-workspace/docs/scenarios/README.md', keyword: 'Scenarios and Memos' },
          ],
        },
      ];

      for (const testCase of cases) {
        await setupAssistantWorkspace(testCase.workspace, {
          backend: 'codex',
          presetAssistantId: testCase.presetAssistantId,
        });

        const agentsCall = writeFileCalls.find((call) => call.path === `${testCase.workspace}/AGENTS.md`);
        const docsReadmeCall = writeFileCalls.find((call) => call.path === `${testCase.workspace}/docs/README.md`);

        expect(agentsCall?.content).toContain(testCase.displayName);
        expect(docsReadmeCall?.content).toContain('progressive-disclosure context');

        for (const topicDoc of testCase.topicDocs) {
          const docCall = writeFileCalls.find((call) => call.path === topicDoc.path);
          expect(docCall?.content).toContain(topicDoc.keyword);
        }
      }
    });
  });

  describe('createAcpAgent', () => {
    it('bootstraps native skills in user-selected workspaces when explicitly enabled', async () => {
      statResults['/mock/user/skills/pdf'] = true;
      fileContents['/mock/user/skills/pdf/SKILL.md'] = '---\nname: pdf\ndescription: mock skill\n---\n';

      const conversation = await createAcpAgent({
        type: 'acp',
        name: 'Codex Harness',
        model: {} as never,
        extra: {
          backend: 'codex',
          workspace: '/tmp/project-workspace',
          customWorkspace: true,
          nativeWorkspaceBootstrap: true,
          enabledSkills: ['pdf'],
        },
      });

      expect(conversation.extra.workspace).toBe('/tmp/project-workspace');
      expect(conversation.extra.customWorkspace).toBe(true);
      expect(mkdirCalls).toContain('/tmp/project-workspace/.contextgo/skills');
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/project-workspace/.contextgo/skills',
        target: '/tmp/project-workspace/.agents/skills',
        type: 'junction',
      });
      expect(copyFileCalls).toContainEqual({
        source: '/mock/user/skills/pdf/SKILL.md',
        target: '/tmp/project-workspace/.contextgo/skills/pdf/SKILL.md',
      });
    });

    it('preserves discussion-group metadata on child conversations', async () => {
      const conversation = await createAcpAgent({
        extra: {
          backend: 'codex',
          workspace: '/tmp/shared-workspace',
          customWorkspace: false,
          groupMeta: {
            parentGroupId: 'group-1',
            participantId: 'participant-1',
            participantName: 'Codex',
            hiddenFromHistory: true,
          },
        },
      });

      expect(conversation.extra.workspace).toBe('/tmp/shared-workspace');
      expect(conversation.extra.customWorkspace).toBe(false);
      expect(conversation.extra.groupMeta).toEqual({
        parentGroupId: 'group-1',
        participantId: 'participant-1',
        participantName: 'Codex',
        hiddenFromHistory: true,
      });
    });
  });
});
