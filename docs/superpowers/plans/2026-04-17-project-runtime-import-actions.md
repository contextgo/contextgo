# Project Runtime Import Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level `Import`, `Re-import`, `Use ContextGo model center`, and `Reset to global` runtime actions so ContextGo-managed workspaces can fully override runtime config without mutating the user's global CLI setup.

**Architecture:** Keep `.contextgo/runtime.json` as the project policy source of truth and materialize backend-specific override files under `.contextgo/<runtime>/...`. Implement import/reset/materialize actions in the main process, expose them through IPC, and drive them from the existing `ProjectAutomationModal > Runtime` tab. Supported real import flow in this phase: Codex, Claude Code, OpenCode; Gemini remains a UI-visible placeholder without import execution.

**Tech Stack:** TypeScript, Electron IPC bridge, React, Arco Design, Vitest 4, Bun, existing runtime path helpers.

---

## File Plan

This work should stay inside the runtime boundary slice that already exists.

- `src/process/services/runtime/runtimeImporters.ts`
  - Own backend-specific import/re-import/reset file operations.
- `src/process/services/runtime/ProjectRuntimeService.ts`
  - Own high-level action methods and policy updates.
- `src/process/bridge/acpConversationBridge.ts`
  - Expose runtime action methods to renderer.
- `src/common/adapter/ipcBridge.ts`
  - Define typed IPC contracts for runtime actions.
- `src/renderer/pages/schedule/components/ProjectAutomationModal.tsx`
  - Replace direct `runtime.json` editing with action-oriented runtime controls.
- `src/renderer/utils/workspace/workspace.ts`
  - Already carries `runtimePolicyFile`; may need helper exposure only if action UI needs more paths.
- `src/renderer/services/i18n/locales/*/conversation.json`
  - Add action labels and backend support messages.
- `tests/unit/process/services/runtime/projectRuntimeService.test.ts`
  - Extend with import/materialize/reset behavior tests.
- `tests/unit/acpConversationBridge.test.ts`
  - Add bridge action coverage.
- `tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`
  - Add runtime action UI coverage.

No new renderer directories are needed. Keep all new UI inside the existing Runtime tab.

---

### Task 1: Add Runtime Importer File Operations

**Files:**

- Modify: `src/process/services/runtime/runtimeImporters.ts`
- Modify: `src/process/services/runtime/ProjectRuntimePaths.ts`
- Test: `tests/unit/process/services/runtime/projectRuntimeService.test.ts`

- [ ] **Step 1: Write the failing importer-focused tests**

```ts
it('imports codex global config into project-owned override files', async () => {
  const writePolicy = vi.fn();
  const importLocalRuntime = vi.fn(async () => ({
    imported: true,
    importedFrom: {
      codex: '~/.codex/config.toml',
    },
    lastImportedAt: '2026-04-17T12:00:00.000Z',
  }));

  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'auto',
      resolvedSource: 'model_center',
      providerProtocol: 'openai',
      baseUrl: null,
      apiKeyRef: null,
      defaultModel: null,
      importedFrom: null,
      lastImportedAt: null,
    }),
    writePolicy,
    importLocalRuntime,
  });

  const resolved = await service.resolve('/workspace/app');

  expect(importLocalRuntime).toHaveBeenCalledWith(
    '/workspace/app',
    expect.objectContaining({ mode: 'auto' })
  );
  expect(resolved.policy.resolvedSource).toBe('imported_local_runtime');
  expect(resolved.policy.importedFrom).toEqual({ codex: '~/.codex/config.toml' });
});

it('does not mark the policy as imported when importer reports failure', async () => {
  const writePolicy = vi.fn();
  const importLocalRuntime = vi.fn(async () => ({
    imported: false,
    importedFrom: null,
    lastImportedAt: null,
  }));

  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'import_local_runtime',
      resolvedSource: 'model_center',
      providerProtocol: 'openai',
      baseUrl: null,
      apiKeyRef: null,
      defaultModel: null,
      importedFrom: null,
      lastImportedAt: null,
    }),
    writePolicy,
    importLocalRuntime,
  });

  const resolved = await service.resolve('/workspace/app');

  expect(resolved.policy.resolvedSource).toBe('model_center');
  expect(resolved.policy.importedFrom).toBeNull();
});
```

- [ ] **Step 2: Run the targeted runtime service test to confirm current gaps**

Run:

```bash
bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts
```

Expected:

- current tests pass or partially pass
- new import-action expectations fail because real file import/reset methods do not exist yet

- [ ] **Step 3: Implement backend-specific import helpers in `runtimeImporters.ts`**

```ts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProjectRuntimeBackend, ProjectRuntimePolicy } from '@/common/types/projectRuntime';
import { getProjectRuntimeConfigDir } from './ProjectRuntimePaths';

export type RuntimeImportResult = {
  imported: boolean;
  importedFrom: ProjectRuntimePolicy['importedFrom'];
  lastImportedAt: string | null;
};

type RuntimeImportFile = {
  sourcePath: string;
  targetPath: string;
  importKey: ProjectRuntimeBackend;
};

const getCodexImportFiles = (workspace: string): RuntimeImportFile[] => [
  {
    sourcePath: path.join(os.homedir(), '.codex', 'config.toml'),
    targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'codex'), 'config.toml'),
    importKey: 'codex',
  },
  {
    sourcePath: path.join(os.homedir(), '.codex', 'auth.json'),
    targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'codex'), 'auth.json'),
    importKey: 'codex',
  },
];

const getClaudeImportFiles = (workspace: string): RuntimeImportFile[] => [
  {
    sourcePath: path.join(os.homedir(), '.claude', 'settings.json'),
    targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'claude'), 'settings.json'),
    importKey: 'claude',
  },
];

const getOpenCodeImportFiles = (workspace: string): RuntimeImportFile[] => [
  {
    sourcePath: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'opencode'), 'opencode.json'),
    importKey: 'opencode',
  },
  {
    sourcePath: path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json'),
    targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'opencode'), 'auth.json'),
    importKey: 'opencode',
  },
];

function getImportFiles(workspace: string, backend: ProjectRuntimeBackend): RuntimeImportFile[] {
  switch (backend) {
    case 'codex':
      return getCodexImportFiles(workspace);
    case 'claude':
      return getClaudeImportFiles(workspace);
    case 'opencode':
      return getOpenCodeImportFiles(workspace);
    case 'gemini':
      return [];
  }
}

export async function importProjectLocalRuntime(
  workspace: string,
  policy: ProjectRuntimePolicy
): Promise<RuntimeImportResult> {
  void policy;

  return {
    imported: false,
    importedFrom: null,
    lastImportedAt: null,
  };
}
```

- [ ] **Step 4: Replace the importer stub with minimal supported-backend behavior**

```ts
export async function importProjectLocalRuntimeForBackend(
  workspace: string,
  backend: ProjectRuntimeBackend
): Promise<RuntimeImportResult> {
  const files = getImportFiles(workspace, backend);
  if (files.length === 0) {
    return {
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    };
  }

  const importedFrom: Partial<Record<ProjectRuntimeBackend, string>> = {};

  for (const file of files) {
    await fs.access(file.sourcePath);
    await fs.mkdir(path.dirname(file.targetPath), { recursive: true });
    await fs.copyFile(file.sourcePath, file.targetPath);
    importedFrom[file.importKey] = file.sourcePath.replace(os.homedir(), '~');
  }

  return {
    imported: true,
    importedFrom,
    lastImportedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Re-run the runtime service tests**

Run:

```bash
bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts
```

Expected:

- PASS

- [ ] **Step 6: Commit the importer foundation**

```bash
git add \
  src/process/services/runtime/runtimeImporters.ts \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts
git commit -m "feat(runtime): add project runtime importer actions"
```

---

### Task 2: Add Project Runtime Action Methods In The Service

**Files:**

- Modify: `src/process/services/runtime/ProjectRuntimeService.ts`
- Modify: `tests/unit/process/services/runtime/projectRuntimeService.test.ts`

- [ ] **Step 1: Write failing tests for explicit import, re-import, and reset actions**

```ts
it('imports current global runtime into project-owned files for a specific backend', async () => {
  const writePolicy = vi.fn();
  const importLocalRuntimeForBackend = vi.fn(async () => ({
    imported: true,
    importedFrom: { codex: '~/.codex/config.toml' },
    lastImportedAt: '2026-04-17T12:00:00.000Z',
  }));

  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'auto',
      resolvedSource: 'model_center',
      providerProtocol: 'openai',
      baseUrl: null,
      apiKeyRef: null,
      defaultModel: null,
      importedFrom: null,
      lastImportedAt: null,
    }),
    writePolicy,
    importLocalRuntimeForBackend,
  });

  const result = await service.importCurrentGlobalRuntime('/workspace/app', 'codex');

  expect(result.policy.mode).toBe('import_local_runtime');
  expect(result.policy.resolvedSource).toBe('imported_local_runtime');
  expect(writePolicy).toHaveBeenCalledWith(
    '/workspace/app',
    expect.objectContaining({
      mode: 'import_local_runtime',
      importedFrom: { codex: '~/.codex/config.toml' },
    })
  );
});

it('resets project override state back to global behavior', async () => {
  const writePolicy = vi.fn();
  const clearBackendOverride = vi.fn(async () => {});

  const service = new ProjectRuntimeService({
    readPolicy: async () => ({
      version: 1,
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      providerProtocol: 'openai',
      baseUrl: null,
      apiKeyRef: null,
      defaultModel: null,
      importedFrom: { codex: '~/.codex/config.toml' },
      lastImportedAt: '2026-04-17T12:00:00.000Z',
    }),
    writePolicy,
    clearBackendOverride,
  });

  const result = await service.resetProjectRuntimeOverride('/workspace/app', 'codex');

  expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
  expect(result.policy.mode).toBe('auto');
  expect(result.policy.importedFrom).toBeNull();
});
```

- [ ] **Step 2: Run the test file to verify the new action tests fail**

Run:

```bash
bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts
```

Expected:

- FAIL because explicit action methods do not exist yet

- [ ] **Step 3: Extend `ProjectRuntimeService` with explicit action methods**

```ts
type ProjectRuntimeServiceDeps = {
  readPolicy?: (workspace: string) => Promise<ProjectRuntimePolicy | null>;
  writePolicy?: (workspace: string, policy: ProjectRuntimePolicy) => Promise<void>;
  importLocalRuntime?: (workspace: string, policy: ProjectRuntimePolicy) => Promise<RuntimeImportResult>;
  importLocalRuntimeForBackend?: (
    workspace: string,
    backend: ProjectRuntimeBackend
  ) => Promise<RuntimeImportResult>;
  clearBackendOverride?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<void>;
};

export class ProjectRuntimeService {
  // existing members...
  private readonly importLocalRuntimeForBackend;
  private readonly clearBackendOverride;

  async importCurrentGlobalRuntime(workspace: string, backend: ProjectRuntimeBackend) {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    const imported = await this.importLocalRuntimeForBackend(workspace, backend);
    if (!imported.imported) {
      return {
        policy,
        effectiveSource: policy.resolvedSource,
        runtimeRoot: getProjectRuntimeRoot(workspace),
      };
    }

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      importedFrom: imported.importedFrom,
      lastImportedAt: imported.lastImportedAt,
    };
    await this.writePolicy(workspace, nextPolicy);

    return {
      policy: nextPolicy,
      effectiveSource: nextPolicy.resolvedSource,
      runtimeRoot: getProjectRuntimeRoot(workspace),
    };
  }

  async resetProjectRuntimeOverride(workspace: string, backend: ProjectRuntimeBackend) {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    await this.clearBackendOverride(workspace, backend);

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: 'auto',
      resolvedSource: 'model_center',
      importedFrom: null,
      lastImportedAt: null,
    };
    await this.writePolicy(workspace, nextPolicy);

    return {
      policy: nextPolicy,
      effectiveSource: nextPolicy.resolvedSource,
      runtimeRoot: getProjectRuntimeRoot(workspace),
    };
  }
}
```

- [ ] **Step 4: Add the minimal backend-clear helper**

```ts
import fs from 'node:fs/promises';
import { getProjectRuntimeConfigDir } from './ProjectRuntimePaths';

export async function clearProjectRuntimeOverride(workspace: string, backend: ProjectRuntimeBackend): Promise<void> {
  await fs.rm(getProjectRuntimeConfigDir(workspace, backend), {
    recursive: true,
    force: true,
  });
}
```

- [ ] **Step 5: Re-run the service tests**

Run:

```bash
bun run test -- tests/unit/process/services/runtime/projectRuntimeService.test.ts
```

Expected:

- PASS

- [ ] **Step 6: Commit the service actions**

```bash
git add \
  src/process/services/runtime/ProjectRuntimeService.ts \
  src/process/services/runtime/runtimeImporters.ts \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts
git commit -m "feat(runtime): add project runtime action methods"
```

---

### Task 3: Expose Runtime Actions Through IPC

**Files:**

- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/acpConversationBridge.ts`
- Modify: `tests/unit/acpConversationBridge.test.ts`

- [ ] **Step 1: Write the failing bridge tests**

```ts
it('imports current global runtime for a workspace backend', async () => {
  const result = await handlers['importProjectRuntime']({
    workspace: '/tmp/project',
    backend: 'codex',
  });

  expect(result.success).toBe(true);
  expect(result.data).toEqual(
    expect.objectContaining({
      backend: 'codex',
      policy: expect.objectContaining({
        mode: 'import_local_runtime',
      }),
    })
  );
});

it('resets project runtime override for a workspace backend', async () => {
  const result = await handlers['resetProjectRuntime']({
    workspace: '/tmp/project',
    backend: 'codex',
  });

  expect(result.success).toBe(true);
  expect(result.data?.policy.mode).toBe('auto');
});
```

- [ ] **Step 2: Run the bridge tests to verify failure**

Run:

```bash
bun run test -- tests/unit/acpConversationBridge.test.ts
```

Expected:

- FAIL because action IPC endpoints do not exist yet

- [ ] **Step 3: Add typed IPC contracts**

```ts
import type { ProjectRuntimeMode, ProjectRuntimePolicy, ProjectRuntimeResolvedSource } from '../types/projectRuntime';

type ProjectRuntimeActionResult = {
  backend: AcpBackend;
  policy: ProjectRuntimePolicy;
  effectiveSource: ProjectRuntimeResolvedSource;
  runtimeRoot: string;
};

importProjectRuntime: bridge.buildProvider<
  IBridgeResponse<ProjectRuntimeActionResult>,
  { workspace: string; backend: AcpBackend }
>('acp.import-project-runtime'),

resetProjectRuntime: bridge.buildProvider<
  IBridgeResponse<ProjectRuntimeActionResult>,
  { workspace: string; backend: AcpBackend }
>('acp.reset-project-runtime'),
```

- [ ] **Step 4: Implement bridge handlers**

```ts
const projectRuntimeService = new ProjectRuntimeService();

ipcBridge.acpConversation.importProjectRuntime.provider(async ({ workspace, backend }) => {
  try {
    const resolved = await projectRuntimeService.importCurrentGlobalRuntime(workspace, backend);
    return {
      success: true,
      data: {
        backend,
        policy: resolved.policy,
        effectiveSource: resolved.effectiveSource,
        runtimeRoot: resolved.runtimeRoot,
      },
    };
  } catch (error) {
    return {
      success: false,
      msg: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcBridge.acpConversation.resetProjectRuntime.provider(async ({ workspace, backend }) => {
  try {
    const resolved = await projectRuntimeService.resetProjectRuntimeOverride(workspace, backend);
    return {
      success: true,
      data: {
        backend,
        policy: resolved.policy,
        effectiveSource: resolved.effectiveSource,
        runtimeRoot: resolved.runtimeRoot,
      },
    };
  } catch (error) {
    return {
      success: false,
      msg: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
```

- [ ] **Step 5: Re-run the bridge tests**

Run:

```bash
bun run test -- tests/unit/acpConversationBridge.test.ts
```

Expected:

- PASS

- [ ] **Step 6: Commit the IPC layer**

```bash
git add \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/acpConversationBridge.ts \
  tests/unit/acpConversationBridge.test.ts
git commit -m "feat(runtime): expose runtime import actions over ipc"
```

---

### Task 4: Wire Import / Re-import / Reset Into The Runtime Tab

**Files:**

- Modify: `src/renderer/pages/schedule/components/ProjectAutomationModal.tsx`
- Modify: `src/renderer/services/i18n/locales/en-US/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/conversation.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/conversation.json`
- Test: `tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

- [ ] **Step 1: Write the failing Runtime tab action tests**

```tsx
it('imports the current global runtime config for supported backends', async () => {
  render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Import current global config' }));

  await waitFor(() => {
    expect(importProjectRuntimeInvokeMock).toHaveBeenCalledWith({
      workspace: '/tmp/workspace',
      backend: 'codex',
    });
  });
});

it('resets imported runtime state back to global behavior', async () => {
  render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reset to global' }));

  await waitFor(() => {
    expect(resetProjectRuntimeInvokeMock).toHaveBeenCalledWith({
      workspace: '/tmp/workspace',
      backend: 'codex',
    });
  });
});
```

- [ ] **Step 2: Run the Runtime tab test to confirm failure**

Run:

```bash
bun run test -- tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx
```

Expected:

- FAIL because the tab still only edits `runtime.json` directly

- [ ] **Step 3: Replace direct mode-only write flow with action-oriented handlers**

```tsx
const handleImportRuntime = useCallback(async () => {
  if (!workspacePath) {
    return;
  }

  const result = await ipcBridge.acpConversation.importProjectRuntime.invoke({
    workspace: workspacePath,
    backend: currentBackend,
  });

  if (!result.success || !result.data) {
    throw new Error(result.msg || t('conversation.workspace.automation.runtime.importFailed'));
  }

  setRuntimePolicy(result.data.policy);
}, [currentBackend, t, workspacePath]);

const handleResetRuntime = useCallback(async () => {
  if (!workspacePath) {
    return;
  }

  const result = await ipcBridge.acpConversation.resetProjectRuntime.invoke({
    workspace: workspacePath,
    backend: currentBackend,
  });

  if (!result.success || !result.data) {
    throw new Error(result.msg || t('conversation.workspace.automation.runtime.resetFailed'));
  }

  setRuntimePolicy(result.data.policy);
}, [currentBackend, t, workspacePath]);
```

- [ ] **Step 4: Add the action buttons and backend support guard**

```tsx
const supportsRuntimeImport = currentBackend === 'codex' || currentBackend === 'claude' || currentBackend === 'opencode';

<Button onClick={() => void handleMaterializeProjectManagedRuntime()}>
  {t('conversation.workspace.automation.runtime.mode.projectManaged')}
</Button>
{supportsRuntimeImport ? (
  <>
    <Button onClick={() => void handleImportRuntime()}>
      {t('conversation.workspace.automation.runtime.importAction')}
    </Button>
    <Button onClick={() => void handleImportRuntime()}>
      {t('conversation.workspace.automation.runtime.reimportAction')}
    </Button>
    <Button onClick={() => void handleResetRuntime()}>
      {t('conversation.workspace.automation.runtime.resetAction')}
    </Button>
  </>
) : (
  <Typography.Text type='secondary'>
    {t('conversation.workspace.automation.runtime.importUnsupported')}
  </Typography.Text>
)}
```

- [ ] **Step 5: Add the new translation keys across all locales**

```json
"runtime": {
  "importAction": "Import current global config",
  "reimportAction": "Re-import global config",
  "resetAction": "Reset to global",
  "importFailed": "Failed to import the current global runtime config.",
  "resetFailed": "Failed to reset the project runtime override.",
  "importUnsupported": "Import actions are not available for this backend yet."
}
```

- [ ] **Step 6: Re-run the Runtime tab tests**

Run:

```bash
bun run test -- tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx
```

Expected:

- PASS

- [ ] **Step 7: Regenerate i18n types and validate**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected:

- i18n types regenerate
- validation passes with no new failures caused by this feature

- [ ] **Step 8: Commit the Runtime tab action UI**

```bash
git add \
  src/renderer/pages/schedule/components/ProjectAutomationModal.tsx \
  src/renderer/services/i18n/i18n-keys.d.ts \
  src/renderer/services/i18n/locales/en-US/conversation.json \
  src/renderer/services/i18n/locales/zh-CN/conversation.json \
  src/renderer/services/i18n/locales/zh-TW/conversation.json \
  src/renderer/services/i18n/locales/ja-JP/conversation.json \
  src/renderer/services/i18n/locales/ko-KR/conversation.json \
  src/renderer/services/i18n/locales/tr-TR/conversation.json \
  tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx
git commit -m "feat(runtime): add import actions to runtime tab"
```

---

### Task 5: Final Verification And Delivery

**Files:**

- Verify only

- [ ] **Step 1: Run the full targeted verification bundle**

Run:

```bash
bun run test -- \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts \
  tests/unit/acpConversationBridge.test.ts \
  tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx
```

Expected:

- PASS

- [ ] **Step 2: Run typecheck**

Run:

```bash
bunx tsc --noEmit
```

Expected:

- PASS

- [ ] **Step 3: Format changed files**

Run:

```bash
bun run format -- \
  src/process/services/runtime/runtimeImporters.ts \
  src/process/services/runtime/ProjectRuntimeService.ts \
  src/process/bridge/acpConversationBridge.ts \
  src/common/adapter/ipcBridge.ts \
  src/renderer/pages/schedule/components/ProjectAutomationModal.tsx \
  src/renderer/services/i18n/locales/en-US/conversation.json \
  src/renderer/services/i18n/locales/zh-CN/conversation.json \
  src/renderer/services/i18n/locales/zh-TW/conversation.json \
  src/renderer/services/i18n/locales/ja-JP/conversation.json \
  src/renderer/services/i18n/locales/ko-KR/conversation.json \
  src/renderer/services/i18n/locales/tr-TR/conversation.json \
  tests/unit/process/services/runtime/projectRuntimeService.test.ts \
  tests/unit/acpConversationBridge.test.ts \
  tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx
```

Expected:

- PASS

- [ ] **Step 4: Commit final verification-only fixes if formatting changed files**

```bash
git add -A
git commit -m "chore(runtime): finalize runtime import actions"
```

## Self-Review

Spec coverage check:

- import/re-import/reset actions: covered by Tasks 1-4
- no global file mutation: covered by Task 1 importer shape and Task 2 reset semantics
- project-owned override files: covered by Tasks 1-2
- runtime tab actions: covered by Task 4
- supported backend rollout: covered by Task 4 backend guard and importer scope

Placeholder scan:

- no `TODO` or `TBD`
- every code-changing step includes code
- every verification step includes exact commands

Type consistency:

- `ProjectRuntimePolicy`, `ProjectRuntimeMode`, `ProjectRuntimeBackend`, and IPC result shapes stay aligned with existing runtime domain types
- renderer action names match planned bridge contract names
