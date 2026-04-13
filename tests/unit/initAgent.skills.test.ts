import { describe, it, expect, vi, beforeEach } from 'vitest';

// Normalize paths to forward slashes for cross-platform key matching
const norm = (p: string) => p.replace(/\\/g, '/');

// Use vi.hoisted() so tracking variables are initialized before vi.mock factories run
const { mkdirCalls, symlinkCalls, writeFileCalls, fileContents, statResults, lstatResults, existsSyncResults, resetAll } =
  vi.hoisted(() => {
  const mkdirCalls: string[] = [];
  const symlinkCalls: Array<{ source: string; target: string; type: string }> = [];
  const writeFileCalls: Array<{ path: string; content: string }> = [];
  const fileContents: Record<string, string> = {};
  const statResults: Record<string, boolean> = {};
  const lstatResults: Record<string, boolean> = {};
  const existsSyncResults: Record<string, boolean> = {};

  const resetAll = () => {
    mkdirCalls.length = 0;
    symlinkCalls.length = 0;
    writeFileCalls.length = 0;
    for (const key of Object.keys(fileContents)) delete fileContents[key];
    for (const key of Object.keys(statResults)) delete statResults[key];
    for (const key of Object.keys(lstatResults)) delete lstatResults[key];
    for (const key of Object.keys(existsSyncResults)) delete existsSyncResults[key];
  };

  return { mkdirCalls, symlinkCalls, writeFileCalls, fileContents, statResults, lstatResults, existsSyncResults, resetAll };
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

      const childNames = new Set<string>();
      const knownPaths = new Set([
        ...Object.keys(existsSyncResults),
        ...Object.keys(statResults),
        ...Object.keys(lstatResults),
      ]);

      for (const key of knownPaths) {
        if (!key.startsWith(normalizedDir + '/')) continue;

        const relative = key.slice(normalizedDir.length + 1);
        if (!relative || relative.includes('/')) continue;
        childNames.add(relative);
      }

      return Array.from(childNames).map((name) => ({
        name,
        isDirectory: () => true,
        isFile: () => false,
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
      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule',
        target: '/tmp/workspace/.contextgo/skills/schedule',
        type: 'junction',
      });
    });

    it('should still project builtin auto skills when enabledSkills is undefined', async () => {
      existsSyncResults['/mock/builtin-skills/_builtin'] = true;
      statResults['/mock/builtin-skills/_builtin/schedule'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
      });

      expect(mkdirCalls).toContain('/tmp/workspace/.contextgo/skills');
      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule',
        target: '/tmp/workspace/.contextgo/skills/schedule',
        type: 'junction',
      });
    });

    it('should project opencode skills from .contextgo/skills', async () => {
      statResults['/mock/user/skills/pptx'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'opencode',
        enabledSkills: ['pptx'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.opencode/skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/pptx',
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
      });
    });

    it('should bootstrap packaged preset skills into .contextgo for non-Claude runtimes', async () => {
      const repoRoot = norm(process.cwd());
      const presetSkillsRoot = `${repoRoot}/src/process/resources/assistant/engineering/everything-in-claude-code/skills`;
      const packagedSkillDir = `${presetSkillsRoot}/agent-eval`;

      existsSyncResults[presetSkillsRoot] = true;
      statResults[packagedSkillDir] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        presetAssistantId: 'builtin-everything-in-claude-code',
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.codex/skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: packagedSkillDir,
        target: '/tmp/workspace/.contextgo/skills/agent-eval',
        type: 'junction',
      });
    });

    it('should create symlink in correct dir for claude backend', async () => {
      const skillSource = '/mock/user/skills/pptx';
      statResults[skillSource] = true;

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
      expect(symlinkCalls).toContainEqual({
        source: skillSource,
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
      });
    });

    it('should project codex skills from .contextgo/skills', async () => {
      statResults['/mock/user/skills/pdf'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: ['pdf'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.codex/skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/pdf',
        target: '/tmp/workspace/.contextgo/skills/pdf',
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

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/pptx',
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
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

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['test-driven-development'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/engineering-pack/skills/workflow-execution-pack/skills/test-driven-development',
        target: '/tmp/workspace/.contextgo/skills/test-driven-development',
        type: 'junction',
      });
    });

    it('should fall back to user skills/ when not in builtin-skills/', async () => {
      existsSyncResults['/mock/builtin-skills/custom-skill'] = false;
      statResults['/mock/user/skills/custom-skill'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['custom-skill'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/custom-skill',
        target: '/tmp/workspace/.contextgo/skills/custom-skill',
        type: 'junction',
      });
    });

    it('should project builtin auto skills like schedule into native workspaces', async () => {
      existsSyncResults['/mock/builtin-skills/_builtin'] = true;
      statResults['/mock/builtin-skills/_builtin/schedule'] = true;
      statResults['/mock/builtin-skills/_builtin/contextgo-skills'] = true;
      statResults['/mock/user/skills/pptx'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['schedule', 'pptx'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/schedule',
        target: '/tmp/workspace/.contextgo/skills/schedule',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/mock/builtin-skills/_builtin/contextgo-skills',
        target: '/tmp/workspace/.contextgo/skills/contextgo-skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/pptx',
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
      });
    });

    it('should auto-project workspace connector skills into managed runtime skills', async () => {
      existsSyncResults['/tmp/workspace/.connector/skills'] = true;
      statResults['/tmp/workspace/.connector/skills/github-ops'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'codex',
        enabledSkills: [],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.codex/skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.connector/skills/github-ops',
        target: '/tmp/workspace/.contextgo/skills/github-ops',
        type: 'junction',
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

      // backend 'codex' takes priority -> .codex/skills
      expect(mkdirCalls).toContain('/tmp/workspace/.codex');
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills',
        target: '/tmp/workspace/.codex/skills',
        type: 'junction',
      });
    });

    it('should handle multiple enabled skills', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      statResults['/mock/user/skills/pdf'] = true;
      statResults['/mock/user/skills/docx'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx', 'pdf', 'docx'],
      });

      expect(symlinkCalls).toHaveLength(4);
    });

    it('should project runtime entries per skill when native skills dir already exists as a real directory', async () => {
      statResults['/mock/user/skills/pptx'] = true;
      lstatResults['/tmp/workspace/.claude/skills'] = true;

      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: ['pptx'],
      });

      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/pptx',
        target: '/tmp/workspace/.contextgo/skills/pptx',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/tmp/workspace/.contextgo/skills/pptx',
        target: '/tmp/workspace/.claude/skills/pptx',
        type: 'junction',
      });
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

    it('does not create native instruction files when AGENTS.md is missing', async () => {
      await setupAssistantWorkspace('/tmp/workspace', {
        backend: 'claude',
        enabledSkills: [],
      });

      expect(writeFileCalls.some((call) => call.path.endsWith('/CLAUDE.md'))).toBe(false);
      expect(writeFileCalls.some((call) => call.path.endsWith('/GEMINI.md'))).toBe(false);
    });
  });

  describe('createAcpAgent', () => {
    it('bootstraps native skills in user-selected workspaces when explicitly enabled', async () => {
      statResults['/mock/user/skills/pdf'] = true;

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
        target: '/tmp/project-workspace/.codex/skills',
        type: 'junction',
      });
      expect(symlinkCalls).toContainEqual({
        source: '/mock/user/skills/pdf',
        target: '/tmp/project-workspace/.contextgo/skills/pdf',
        type: 'junction',
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
