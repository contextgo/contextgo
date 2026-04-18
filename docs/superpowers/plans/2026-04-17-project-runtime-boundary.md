# Project Runtime Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project runtime execution stop consuming global runtime state by default, while adding one project-level runtime policy that can use ContextGo model center, import local runtime config, or auto-resolve between the two.

**Architecture:** Introduce a project-owned runtime root under `.contextgo/` plus a `ProjectRuntimeService` that resolves effective runtime policy, materializes runtime-specific config, and builds project-scoped env vars. Tighten skills so runtime discovery only sees project-owned state, then rewire Claude/Codex/OpenCode/Gemini launch and config resolution to use the project boundary rather than global home directories.

**Tech Stack:** TypeScript, Electron main process services, React settings UI, Vitest 4, Bun.

---

### Task 1: Add The Project Runtime Domain Model And Path Helpers

**Files:**

- Create: `src/common/types/projectRuntime.ts`
- Create: `src/process/services/runtime/ProjectRuntimePaths.ts`
- Test: `tests/unit/process/services/runtime/projectRuntimePaths.test.ts`

- [ ] **Step 1: Write the failing path and type-shape tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  getProjectRuntimeRoot,
  getProjectRuntimePolicyPath,
  getProjectRuntimeSkillsDir,
  getProjectRuntimeConfigDir,
} from '@process/services/runtime/ProjectRuntimePaths';

describe('ProjectRuntimePaths', () => {
  it('resolves the project runtime root under .contextgo', () => {
    expect(getProjectRuntimeRoot('/workspace/app')).toBe('/workspace/app/.contextgo');
    expect(getProjectRuntimePolicyPath('/workspace/app')).toBe('/workspace/app/.contextgo/runtime.json');
    expect(getProjectRuntimeSkillsDir('/workspace/app')).toBe('/workspace/app/.contextgo/skills');
    expect(getProjectRuntimeConfigDir('/workspace/app', 'codex')).toBe('/workspace/app/.contextgo/codex');
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `bun run test -- tests/unit/process/services/runtime/projectRuntimePaths.test.ts`
Expected: FAIL because `ProjectRuntimePaths` does not exist yet.

- [ ] **Step 3: Add the shared runtime policy types**

```ts
// src/common/types/projectRuntime.ts
export const PROJECT_RUNTIME_MODES = ['project_managed', 'import_local_runtime', 'auto'] as const;
export type ProjectRuntimeMode = (typeof PROJECT_RUNTIME_MODES)[number];

export const PROJECT_RUNTIME_BACKENDS = ['gemini', 'claude', 'codex', 'opencode'] as const;
export type ProjectRuntimeBackend = (typeof PROJECT_RUNTIME_BACKENDS)[number];

export type ProjectRuntimeResolvedSource = 'model_center' | 'imported_local_runtime';
export type ProjectRuntimeProviderProtocol = 'openai' | 'anthropic' | 'gemini';

export type ProjectRuntimePolicy = {
  version: 1;
  mode: ProjectRuntimeMode;
  resolvedSource: ProjectRuntimeResolvedSource;
  providerProtocol: ProjectRuntimeProviderProtocol;
  baseUrl: string | null;
  apiKeyRef: string | null;
  defaultModel: string | null;
  importedFrom: Partial<Record<ProjectRuntimeBackend, string>> | null;
  lastImportedAt: string | null;
};
```

```ts
// src/process/services/runtime/ProjectRuntimePaths.ts
import path from 'node:path';
import type { ProjectRuntimeBackend } from '@/common/types/projectRuntime';

export const getProjectRuntimeRoot = (workspace: string): string => path.join(workspace, '.contextgo');
export const getProjectRuntimePolicyPath = (workspace: string): string =>
  path.join(getProjectRuntimeRoot(workspace), 'runtime.json');
export const getProjectRuntimeSkillsDir = (workspace: string): string =>
  path.join(getProjectRuntimeRoot(workspace), 'skills');
export const getProjectRuntimeConfigDir = (workspace: string, backend: ProjectRuntimeBackend): string =>
  path.join(getProjectRuntimeRoot(workspace), backend);
```

- [ ] **Step 4: Re-run the targeted test**

Run: `bun run test -- tests/unit/process/services/runtime/projectRuntimePaths.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```bash
git add \
  src/common/types/projectRuntime.ts \
  src/process/services/runtime/ProjectRuntimePaths.ts \
  tests/unit/process/services/runtime/projectRuntimePaths.test.ts
git commit -m "feat(runtime): add project runtime policy model"
```

### Task 2: Build ProjectRuntimeService And Local-Import Resolution

**Files:**

- Create: `src/process/services/runtime/ProjectRuntimeService.ts`
- Create: `src/process/services/runtime/runtimePolicyStore.ts`
- Create: `src/process/services/runtime/runtimeImporters.ts`
- Test: `tests/unit/process/services/runtime/projectRuntimeService.test.ts`

- [ ] **Step 1: Write failing resolver tests for managed, imported, and auto modes**

```ts
it('returns project-managed model center state without reading global runtime files', async () => {
  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'project_managed',
      resolvedSource: 'model_center',
      providerProtocol: 'openai',
      baseUrl: 'https://model-center.internal/v1',
      apiKeyRef: 'project-secret:runtime-primary',
      defaultModel: 'gpt-5.4',
      importedFrom: null,
      lastImportedAt: null,
    }),
    importLocalRuntime: vi.fn(),
  });

  const resolved = await service.resolve('/workspace/app');

  expect(resolved.policy.mode).toBe('project_managed');
  expect(resolved.effectiveSource).toBe('model_center');
  expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
});

it('imports local runtime config when mode is import_local_runtime', async () => {
  const importLocalRuntime = vi.fn(async () => ({
    importedFrom: { codex: '~/.codex/config.toml' },
    lastImportedAt: '2026-04-17T10:00:00.000Z',
  }));

  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      providerProtocol: 'openai',
      baseUrl: null,
      apiKeyRef: null,
      defaultModel: 'gpt-5.4',
      importedFrom: null,
      lastImportedAt: null,
    }),
    importLocalRuntime,
  });

  const resolved = await service.resolve('/workspace/app');

  expect(importLocalRuntime).toHaveBeenCalledWith('/workspace/app');
  expect(resolved.effectiveSource).toBe('imported_local_runtime');
});
```

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts`
Expected: FAIL because the service and importer modules do not exist.

- [ ] **Step 3: Implement the runtime policy store and resolver**

```ts
// src/process/services/runtime/runtimePolicyStore.ts
import fs from 'node:fs/promises';
import type { ProjectRuntimePolicy } from '@/common/types/projectRuntime';
import { getProjectRuntimePolicyPath } from './ProjectRuntimePaths';

export async function readProjectRuntimePolicy(workspace: string): Promise<ProjectRuntimePolicy | null> {
  try {
    const content = await fs.readFile(getProjectRuntimePolicyPath(workspace), 'utf-8');
    return JSON.parse(content) as ProjectRuntimePolicy;
  } catch {
    return null;
  }
}

export async function writeProjectRuntimePolicy(workspace: string, policy: ProjectRuntimePolicy): Promise<void> {
  const target = getProjectRuntimePolicyPath(workspace);
  await fs.mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(target, JSON.stringify(policy, null, 2) + '\n', 'utf-8');
}
```

```ts
// src/process/services/runtime/ProjectRuntimeService.ts
import type { ProjectRuntimePolicy, ProjectRuntimeResolvedSource } from '@/common/types/projectRuntime';
import { getProjectRuntimeRoot } from './ProjectRuntimePaths';
import { readProjectRuntimePolicy, writeProjectRuntimePolicy } from './runtimePolicyStore';
import { importProjectLocalRuntime } from './runtimeImporters';

export type ResolvedProjectRuntime = {
  policy: ProjectRuntimePolicy;
  effectiveSource: ProjectRuntimeResolvedSource;
  runtimeRoot: string;
};

export class ProjectRuntimeService {
  async resolve(workspace: string): Promise<ResolvedProjectRuntime> {
    const policy = await readProjectRuntimePolicy(workspace);
    if (!policy) {
      throw new Error(`Missing project runtime policy for workspace: ${workspace}`);
    }

    if (policy.mode === 'project_managed') {
      return {
        policy,
        effectiveSource: 'model_center',
        runtimeRoot: getProjectRuntimeRoot(workspace),
      };
    }

    if (policy.mode === 'import_local_runtime' || policy.mode === 'auto') {
      const imported = await importProjectLocalRuntime(workspace, policy);
      const nextPolicy: ProjectRuntimePolicy = {
        ...policy,
        resolvedSource: imported.imported ? 'imported_local_runtime' : 'model_center',
        importedFrom: imported.importedFrom,
        lastImportedAt: imported.lastImportedAt,
      };
      await writeProjectRuntimePolicy(workspace, nextPolicy);
      return {
        policy: nextPolicy,
        effectiveSource: nextPolicy.resolvedSource,
        runtimeRoot: getProjectRuntimeRoot(workspace),
      };
    }

    return {
      policy,
      effectiveSource: policy.resolvedSource,
      runtimeRoot: getProjectRuntimeRoot(workspace),
    };
  }
}
```

- [ ] **Step 4: Stub the importer with explicit “import, not passthrough” shape**

```ts
// src/process/services/runtime/runtimeImporters.ts
import type { ProjectRuntimePolicy } from '@/common/types/projectRuntime';

export type RuntimeImportResult = {
  imported: boolean;
  importedFrom: ProjectRuntimePolicy['importedFrom'];
  lastImportedAt: string | null;
};

export async function importProjectLocalRuntime(
  workspace: string,
  policy: ProjectRuntimePolicy
): Promise<RuntimeImportResult> {
  void workspace;
  void policy;
  return {
    imported: false,
    importedFrom: null,
    lastImportedAt: null,
  };
}
```

- [ ] **Step 5: Re-run the resolver tests**

Run: `bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit checkpoint**

```bash
git add \
  src/process/services/runtime/ProjectRuntimeService.ts \
  src/process/services/runtime/runtimePolicyStore.ts \
  src/process/services/runtime/runtimeImporters.ts \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts
git commit -m "feat(runtime): add project runtime resolver"
```

### Task 3: Make Skills Project-Only And Remove Global Skill Leakage

**Files:**

- Modify: `src/process/utils/initAgent.ts`
- Modify: `src/process/task/AcpSkillManager.ts`
- Modify: `src/process/task/agentUtils.ts`
- Test: `tests/unit/initAgent.skills.test.ts`
- Test: `tests/unit/AcpAgentManagerSkillInjection.test.ts`

- [ ] **Step 1: Add failing tests that prove global skills are not live runtime sources**

```ts
it('materializes enabled skills into the project runtime skills dir instead of linking to global user skill sources', async () => {
  statResults['/mock/user/skills/pptx'] = true;

  await setupAssistantWorkspace('/tmp/workspace', {
    backend: 'codex',
    enabledSkills: ['pptx'],
  });

  expect(symlinkCalls).not.toContainEqual({
    source: '/mock/user/skills/pptx',
    target: '/tmp/workspace/.contextgo/skills/pptx',
    type: 'junction',
  });
});

it('uses prompt injection when a project runtime skills projection has not been materialized yet', async () => {
  const manager = createManager({
    backend: 'claude',
    customWorkspace: true,
    nativeWorkspaceBootstrap: false,
    enabledSkills: ['pptx'],
  });

  await sendFirstMessage(manager);

  expect(mockPrepareFirstMessage).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the skill tests to verify the current implementation fails**

Run: `bun run test -- tests/unit/initAgent.skills.test.ts tests/unit/AcpAgentManagerSkillInjection.test.ts`
Expected: FAIL because `setupAssistantWorkspace()` still uses global skill roots and symlink sources.

- [ ] **Step 3: Update workspace bootstrap to materialize skills into project-owned runtime state**

```ts
// src/process/utils/initAgent.ts
const WORKSPACE_RUNTIME_ROOT = '.contextgo';
const WORKSPACE_RUNTIME_SKILLS_DIR = path.join(WORKSPACE_RUNTIME_ROOT, 'skills');

const getWorkspaceRuntimeSkillsDir = (workspace: string): string => path.join(workspace, WORKSPACE_RUNTIME_SKILLS_DIR);

async function materializeWorkspaceSkill(sourceSkillDir: string, targetSkillDir: string): Promise<void> {
  await fs.rm(targetSkillDir, { recursive: true, force: true });
  await copyDirectory(sourceSkillDir, targetSkillDir);
}
```

```ts
// src/process/task/AcpSkillManager.ts
const dirsToScan = [workspaceRuntimeSkillsDir];
```

```ts
// src/process/task/agentUtils.ts
const skillsDir = path.join(workspace, '.contextgo', 'skills');
```

- [ ] **Step 4: Re-run the skill-related tests**

Run: `bun run test -- tests/unit/initAgent.skills.test.ts tests/unit/AcpAgentManagerSkillInjection.test.ts`
Expected: PASS, with project-owned runtime skills as the only runtime-visible skill source.

- [ ] **Step 5: Commit checkpoint**

```bash
git add \
  src/process/utils/initAgent.ts \
  src/process/task/AcpSkillManager.ts \
  src/process/task/agentUtils.ts \
  tests/unit/initAgent.skills.test.ts \
  tests/unit/AcpAgentManagerSkillInjection.test.ts
git commit -m "refactor(runtime): materialize project-owned skills"
```

### Task 4: Rewire Runtime Launch, Config Resolution, And Env Filtering

**Files:**

- Modify: `src/process/utils/shellEnv.ts`
- Modify: `src/process/agent/acp/acpConnectors.ts`
- Modify: `src/process/agent/acp/index.ts`
- Modify: `src/process/agent/acp/utils.ts`
- Modify: `src/process/agent/codex/connection/CodexConnection.ts`
- Modify: `src/process/task/GeminiAgentManager.ts`
- Test: `tests/unit/shellEnv.test.ts`
- Test: `tests/unit/acpConversationBridge.test.ts`

- [ ] **Step 1: Add failing tests for project-scoped env and path resolution**

```ts
it('does not pass shell-global runtime auth variables through getEnhancedEnv when project runtime env is requested', () => {
  process.env.CODEX_API_KEY = 'global-codex-key';
  process.env.OPENAI_API_KEY = 'global-openai-key';

  const env = getProjectRuntimeEnv({
    workspace: '/workspace/app',
    runtimeRoot: '/workspace/app/.contextgo',
    injectedEnv: { OPENAI_API_KEY: 'project-openai-key' },
  });

  expect(env.HOME).toBe('/workspace/app/.contextgo');
  expect(env.XDG_CONFIG_HOME).toBe('/workspace/app/.contextgo');
  expect(env.OPENAI_API_KEY).toBe('project-openai-key');
  expect(env.CODEX_API_KEY).toBeUndefined();
});

it('resolves codex config and auth paths from the project runtime root', () => {
  expect(getCodexConfigPath('/workspace/app/.contextgo')).toBe('/workspace/app/.contextgo/codex/config.toml');
  expect(getCodexAuthPath('/workspace/app/.contextgo')).toBe('/workspace/app/.contextgo/codex/auth.json');
});
```

- [ ] **Step 2: Run the shell and bridge tests to verify they fail**

Run: `bun run test -- tests/unit/shellEnv.test.ts tests/unit/acpConversationBridge.test.ts`
Expected: FAIL because env construction and config-path helpers are still global-home based.

- [ ] **Step 3: Add a dedicated project-runtime env builder and use it in runtime launchers**

```ts
// src/process/utils/shellEnv.ts
const FILTERED_RUNTIME_ENV_KEYS = new Set([
  'CODEX_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
]);

export function getProjectRuntimeEnv(input: {
  workspace: string;
  runtimeRoot: string;
  injectedEnv?: Record<string, string>;
}): Record<string, string> {
  const base = getEnhancedEnv();
  for (const key of FILTERED_RUNTIME_ENV_KEYS) {
    delete base[key];
  }
  return {
    ...base,
    HOME: input.runtimeRoot,
    XDG_CONFIG_HOME: input.runtimeRoot,
    XDG_DATA_HOME: input.runtimeRoot,
    ...input.injectedEnv,
  };
}
```

```ts
// src/process/agent/acp/utils.ts
export function getClaudeSettingsPath(runtimeRoot?: string): string {
  return runtimeRoot
    ? path.join(runtimeRoot, 'claude', 'settings.json')
    : path.join(os.homedir(), '.claude', 'settings.json');
}
```

```ts
// src/process/agent/codex/connection/CodexConnection.ts
export function getCodexConfigPath(runtimeRoot?: string): string {
  if (runtimeRoot) {
    return join(runtimeRoot, 'codex', 'config.toml');
  }
  // legacy global fallback remains only for explicit import flows
  return join(homedir(), '.codex', 'config.toml');
}
```

- [ ] **Step 4: Replace direct global model lookup with project runtime state lookup**

```ts
// src/process/agent/acp/index.ts
if (this.extra.backend === 'claude') {
  const configuredModel = getClaudeModel(this.extra.runtimeRoot);
  if (configuredModel) {
    await this.connection.setModel(configuredModel);
  }
}
```

```ts
// src/process/task/GeminiAgentManager.ts
// Stop exposing global getSkillsDir() as the worker-facing skill source.
skillsDir: path.join(this.workspace, '.contextgo', 'skills'),
```

- [ ] **Step 5: Re-run the targeted shell and bridge tests**

Run: `bun run test -- tests/unit/shellEnv.test.ts tests/unit/acpConversationBridge.test.ts`
Expected: PASS, with project-runtime env filtering and project-aware runtime config paths.

- [ ] **Step 6: Commit checkpoint**

```bash
git add \
  src/process/utils/shellEnv.ts \
  src/process/agent/acp/acpConnectors.ts \
  src/process/agent/acp/index.ts \
  src/process/agent/acp/utils.ts \
  src/process/agent/codex/connection/CodexConnection.ts \
  src/process/task/GeminiAgentManager.ts \
  tests/unit/shellEnv.test.ts \
  tests/unit/acpConversationBridge.test.ts
git commit -m "feat(runtime): enforce project-scoped launch env"
```

### Task 5: Expose Project Runtime Policy And Config In Bridge And Settings UI

**Files:**

- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/acpConversationBridge.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx`
- Modify: `src/renderer/pages/settings/components/RuntimeConfigDock.tsx`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Test: `tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx`
- Test: `tests/unit/renderer/RuntimeSettings.actions.dom.test.tsx`

- [ ] **Step 1: Add failing UI tests for project runtime config visibility**

```ts
it('opens project runtime config entries instead of home-directory config paths', async () => {
  getManagedRuntimeConfigLocationInvokeMock.mockResolvedValueOnce({
    success: true,
    data: {
      backend: 'codex',
      entries: [
        {
          kind: 'config',
          path: '/workspace/app/.contextgo/codex/config.toml',
          exists: true,
        },
        {
          kind: 'auth',
          path: '/workspace/app/.contextgo/codex/auth.json',
          exists: true,
        },
      ],
    },
  });

  renderRuntimeSettings();

  fireEvent.click(screen.getByRole('button', { name: /open config/i }));

  await waitFor(() => {
    expect(readFileInvokeMock).toHaveBeenCalledWith({
      path: '/workspace/app/.contextgo/codex/config.toml',
    });
  });
});
```

- [ ] **Step 2: Run the runtime settings tests to verify they fail**

Run: `bun run test -- tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx tests/unit/renderer/RuntimeSettings.actions.dom.test.tsx`
Expected: FAIL because the bridge still returns home-directory runtime config paths.

- [ ] **Step 3: Extend the bridge contract to return effective project runtime config entries**

```ts
// src/common/adapter/ipcBridge.ts
getManagedRuntimeConfigLocation: bridge.buildProvider<
  IBridgeResponse<{
    backend: AcpBackend;
    entries: ManagedRuntimeConfigEntry[];
    runtimeRoot?: string;
    mode?: ProjectRuntimeMode;
  } | null>,
  { backend: AcpBackend; workspace?: string }
>(),
```

```ts
// src/process/bridge/acpConversationBridge.ts
const resolved = workspace ? await projectRuntimeService.resolve(workspace) : null;
const runtimeRoot = resolved?.runtimeRoot;
const entries = resolveManagedRuntimeConfigEntries(backend, runtimeRoot);
```

- [ ] **Step 4: Update the settings surface to describe the project-owned runtime boundary**

```tsx
// src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx
<Typography.Text>
  {t('settings.runtimeManager.projectRuntimeHint', {
    defaultValue: 'This runtime reads project-owned config under .contextgo.',
  })}
</Typography.Text>
```

```tsx
// src/renderer/pages/settings/components/RuntimeConfigDock.tsx
subtitle={runtimeRoot ?? entry.path}
```

- [ ] **Step 5: Re-run the renderer settings tests and final targeted bundle**

Run:

```bash
bun run test -- \
  tests/unit/process/services/runtime/projectRuntimePaths.test.ts \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts \
  tests/unit/initAgent.skills.test.ts \
  tests/unit/AcpAgentManagerSkillInjection.test.ts \
  tests/unit/shellEnv.test.ts \
  tests/unit/acpConversationBridge.test.ts \
  tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx \
  tests/unit/renderer/RuntimeSettings.actions.dom.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run typecheck and formatter**

Run:

```bash
bunx tsc --noEmit
bun run format
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint**

```bash
git add \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/acpConversationBridge.ts \
  src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx \
  src/renderer/pages/settings/components/RuntimeConfigDock.tsx \
  src/renderer/services/i18n/locales/zh-CN/settings.json \
  tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx \
  tests/unit/renderer/RuntimeSettings.actions.dom.test.tsx
git commit -m "feat(runtime): surface project runtime boundary in settings"
```
