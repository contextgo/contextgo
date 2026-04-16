# Project Commands Source Of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project `.contextgo/commands.json` the only source of truth for managed commands by initializing it from the current preset assistant and removing the runtime `builtin/custom` split.

**Architecture:** Collapse managed slash commands into one persisted project-command record shape, then let workspace bootstrap write the full command list during project initialization. Renderer loading, command editing, and slash menu hydration all read directly from project command files without injecting fallback builtin records at runtime.

**Tech Stack:** TypeScript, React, Electron IPC bridge, Vitest 4, i18next

---

### Task 1: Replace the builtin/custom command record model with a single project command record

**Files:**

- Modify: `src/common/chat/slash/library.ts`
- Test: `tests/unit/common/slashCommandLibrary.test.ts`

- [ ] **Step 1: Write the failing library tests for the new project-command shape**

```ts
it('returns an empty project command list when storage is empty', () => {
  expect(normalizeManagedSlashCommandLibrary(undefined)).toEqual([]);
});

it('keeps only valid project command records and removes duplicate names', () => {
  const library = normalizeManagedSlashCommandLibrary([
    {
      id: 'project-plan',
      enabled: true,
      name: '/plan',
      description: 'Plan the task',
      template: 'Write a plan first.',
    },
    {
      id: 'duplicate-plan',
      enabled: true,
      name: 'plan',
      description: 'Duplicate',
      template: 'Duplicate',
    },
    {
      id: 'invalid',
      enabled: true,
      name: 'bad name!',
      description: 'Invalid',
      template: 'Invalid',
    },
  ]);

  expect(library).toEqual([
    {
      id: 'project-plan',
      enabled: true,
      name: 'plan',
      description: 'Plan the task',
      template: 'Write a plan first.',
    },
  ]);
});

it('resolves project commands directly into slash menu items without builtin translation branches', () => {
  const resolved = resolveManagedSlashCommands(
    [
      {
        id: 'project-verify',
        enabled: true,
        name: 'verify',
        description: 'Verify end to end',
        template: 'Verify the current implementation.',
      },
    ],
    (key, fallback) => `${key}:${fallback}`
  );

  expect(resolved).toEqual([
    {
      id: 'project-verify',
      enabled: true,
      name: 'verify',
      description: 'Verify end to end',
      template: 'Verify the current implementation.',
    },
  ]);
});
```

- [ ] **Step 2: Run the targeted library tests to verify they fail against the builtin/custom model**

Run: `bun run test -- tests/unit/common/slashCommandLibrary.test.ts`

Expected: FAIL because the current implementation still returns builtin defaults and builtin-specific fields such as `type` / `id: 'plan'`.

- [ ] **Step 3: Rewrite the library helpers around a single persisted project command record**

```ts
export interface ManagedSlashCommandRecord {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
}

export interface ResolvedManagedSlashCommand {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
}

export function normalizeManagedSlashCommandLibrary(value: unknown): ManagedSlashCommandRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const records: ManagedSlashCommandRecord[] = [];

  for (const item of value) {
    const normalized = normalizeManagedSlashCommandRecord(item);
    if (!normalized) {
      continue;
    }

    const normalizedName = normalized.name.toLowerCase();
    if (usedIds.has(normalized.id) || usedNames.has(normalizedName)) {
      continue;
    }

    usedIds.add(normalized.id);
    usedNames.add(normalizedName);
    records.push(normalized);
  }

  return records;
}

export function resolveManagedSlashCommands(
  library: ManagedSlashCommandRecord[],
  _resolveText: SlashCommandTranslationResolver
): ResolvedManagedSlashCommand[] {
  return library.map((record) => ({ ...record }));
}
```

- [ ] **Step 4: Remove dead builtin-oriented helpers and update slash menu item generation**

```ts
export function toSlashCommandItems(commands: ResolvedManagedSlashCommand[]): SlashCommandItem[] {
  return commands
    .filter((command) => command.enabled)
    .map((command) => ({
      name: command.name,
      description: command.description,
      kind: 'template',
      source: 'custom',
      template: command.template,
    }));
}
```

- [ ] **Step 5: Run the library tests again to verify they pass**

Run: `bun run test -- tests/unit/common/slashCommandLibrary.test.ts`

Expected: PASS for the new normalization and resolution expectations.

### Task 2: Bootstrap full project command files from preset assistants and remove runtime default injection

**Files:**

- Modify: `src/process/bridge/services/workspaceAutomation.ts`
- Modify: `src/process/bridge/conversationBridge.ts`
- Test: `tests/unit/process/bridge/workspaceAutomation.test.ts`

- [ ] **Step 1: Write the failing bootstrap tests for fully materialized project commands**

```ts
it('writes fully materialized project commands for the harness preset', async () => {
  await ensureHarnessWorkspaceAutomationForConversation({
    type: 'acp',
    extra: {
      workspace: workspaceDir,
      presetAssistantId: 'builtin-superpowers',
    },
  } as any);

  const commandLibrary = JSON.parse(await fs.readFile(getWorkspaceCommandsFile(workspaceDir)!, 'utf-8'));
  expect(commandLibrary).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'plan', description: expect.any(String), template: expect.any(String) }),
      expect.objectContaining({ name: 'brainstorm', description: expect.any(String), template: expect.any(String) }),
    ])
  );
  expect(commandLibrary.some((record: { type?: string }) => 'type' in record)).toBe(false);
});

it('returns an empty managed library when a workspace has no commands.json', async () => {
  const library = await readWorkspaceCommandLibrary(workspaceWithoutCommands);
  expect(library).toBeNull();
});
```

- [ ] **Step 2: Run the workspace automation tests to verify the old shape still fails**

Run: `bun run test -- tests/unit/process/bridge/workspaceAutomation.test.ts`

Expected: FAIL because preset bootstrap still emits builtin/custom records and `readWorkspaceCommandLibrary()` still normalizes against builtin defaults.

- [ ] **Step 3: Add a helper that materializes preset command definitions into plain project records**

```ts
function createPresetProjectCommand(
  id: string,
  name: string,
  description: string,
  template: string,
  enabled = true
): ManagedSlashCommandRecord {
  return { id, enabled, name, description, template };
}

const CONTEXTGO_HARNESS_COMMANDS: ManagedSlashCommandRecord[] = [
  createPresetProjectCommand(
    'harness-plan',
    'plan',
    'Restate the task, identify risks, and produce a step-by-step plan before coding.',
    'Restate the task, identify the main constraints and risks, then propose a clear step-by-step implementation plan. Do not modify files yet. Wait for confirmation before executing.'
  ),
  createPresetProjectCommand(
    'harness-brainstorm',
    'brainstorm',
    'Turn a vague request into an explicit design before implementation.',
    'Use the `brainstorming` skill for this request...'
  ),
];
```

- [ ] **Step 4: Stop injecting defaults when reading or resolving managed command libraries**

```ts
export const readWorkspaceCommandLibrary = async (workspace?: string): Promise<ManagedSlashCommandRecord[] | null> => {
  const content = await readWorkspaceAutomationJson<unknown>(getWorkspaceCommandsFile(workspace));
  if (content === null) {
    return null;
  }

  return normalizeManagedSlashCommandLibrary(content);
};

async function resolveManagedSlashCommandLibrary(
  conversation?: TChatConversation
): Promise<ManagedSlashCommandRecord[]> {
  const workspacePath = getConversationWorkspacePath(conversation);
  if (!workspacePath) {
    return [];
  }

  return (await readWorkspaceCommandLibrary(workspacePath)) ?? [];
}
```

- [ ] **Step 5: Run the workspace automation tests again to verify bootstrap and no-file behavior**

Run: `bun run test -- tests/unit/process/bridge/workspaceAutomation.test.ts`

Expected: PASS with plain project command records written to `.contextgo/commands.json`.

### Task 3: Make the renderer edit and display only project commands

**Files:**

- Modify: `src/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor.tsx`
- Modify: `src/renderer/pages/schedule/components/ProjectAutomationModal.tsx`
- Modify: `src/renderer/hooks/chat/useSlashCommands.ts`
- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/settings.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/settings.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/settings.json`
- Modify: `src/renderer/services/i18n/i18n-keys.d.ts`
- Test: `tests/unit/useSlashCommands.dom.test.ts`
- Test: `tests/unit/renderer/settings/tools/ManagedCommandLibraryEditor.dom.test.tsx`
- Test: `tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

- [ ] **Step 1: Write the failing renderer tests for file-only commands and tag removal**

```ts
it('does not render builtin or custom tags in the project command editor', async () => {
  render(
    <ManagedCommandLibraryEditor
      title='Commands'
      description='Manage workspace commands'
      loadLibrary={vi.fn().mockResolvedValue([
        {
          id: 'project-plan',
          enabled: true,
          name: 'plan',
          description: 'Plan the task',
          template: 'Write a plan first.',
        },
      ])}
      saveLibrary={vi.fn().mockResolvedValue(undefined)}
    />
  );

  await waitFor(() => expect(screen.getByText('/plan')).toBeInTheDocument());
  expect(screen.queryByText('settings.commands.builtinTag')).not.toBeInTheDocument();
  expect(screen.queryByText('settings.commands.customTag')).not.toBeInTheDocument();
});

it('does not fall back to managedLibrary from getSlashCommands when commands.json is missing', async () => {
  readFileInvokeMock.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

  render(<ProjectAutomationModal visible conversation={conversation} onCancel={vi.fn()} />);

  await waitFor(() => {
    expect(getSlashCommandsInvokeMock).not.toHaveBeenCalled();
  });
});

it('surfaces only the managed project commands returned by the backend', async () => {
  getSlashCommandsInvokeMock.mockResolvedValue({
    success: true,
    data: {
      commands: [],
      managedLibrary: [
        {
          id: 'project-plan',
          enabled: true,
          name: 'plan',
          description: 'Plan the task',
          template: 'Write a plan first.',
        },
      ],
    },
  });
});
```

- [ ] **Step 2: Run the renderer-focused tests to verify they fail before the UI refactor**

Run: `bun run test -- --project dom tests/unit/useSlashCommands.dom.test.ts tests/unit/renderer/settings/tools/ManagedCommandLibraryEditor.dom.test.tsx tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

Expected: FAIL because the editor still shows builtin/custom tags and the automation modal still falls back to `getSlashCommands()` for missing files.

- [ ] **Step 3: Simplify the command editor to one project-command list and update the reset action text**

```tsx
const projectCommands = resolvedCommands;

const restoreDefaults = async () => {
  await persistLibrary(initialLibrary, 'settings.commands.restoreSuccess');
};

<div className='flex flex-col gap-12px'>{projectCommands.map((command) => renderCommandCard(command))}</div>;
```

```tsx
{
  command.description ? (
    <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{command.description}</Typography.Paragraph>
  ) : null;
}
```

- [ ] **Step 4: Remove renderer-side fallback hydration and let slash commands merge runtime items with project-file commands only**

```ts
const loadProjectCommandLibrary = useCallback(async (): Promise<ManagedSlashCommandRecord[]> => {
  if (!automationPaths) {
    return [];
  }

  try {
    const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.commandsFile });
    return normalizeManagedSlashCommandLibrary(JSON.parse(raw));
  } catch (error) {
    if (isMissingWorkspaceFileError(error)) {
      return [];
    }
    throw error;
  }
}, [automationPaths]);
```

```ts
const managedLibrary = normalizeManagedSlashCommandLibrary(response.data?.managedLibrary ?? []);
const resolvedManagedCommands = resolveManagedSlashCommands(managedLibrary, (key, defaultValue) =>
  t(key, { defaultValue })
);
```

- [ ] **Step 5: Update i18n strings to match the project-only model**

```json
{
  "restoreDefaults": "Reset Project Commands",
  "restoreSuccess": "Project commands reset",
  "restoreFailed": "Failed to reset project commands"
}
```

Also remove the unused keys:

```json
{
  "builtinTag": "...",
  "customTag": "..."
}
```

- [ ] **Step 6: Run the renderer tests again to verify the project-only behavior**

Run: `bun run test -- --project dom tests/unit/useSlashCommands.dom.test.ts tests/unit/renderer/settings/tools/ManagedCommandLibraryEditor.dom.test.tsx tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

Expected: PASS with no builtin/custom labels and no commands fallback path when the project file is absent.

### Task 4: Final verification and cleanup

**Files:**

- Modify: `docs/superpowers/plans/2026-04-13-project-commands-source-of-truth.md`
- Verify: `src/common/chat/slash/library.ts`
- Verify: `src/process/bridge/services/workspaceAutomation.ts`
- Verify: `src/process/bridge/conversationBridge.ts`
- Verify: `src/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor.tsx`
- Verify: `src/renderer/pages/schedule/components/ProjectAutomationModal.tsx`
- Verify: `src/renderer/hooks/chat/useSlashCommands.ts`

- [ ] **Step 1: Regenerate i18n key types after removing command-tag keys**

Run: `bun run i18n:types`

Expected: `✅ i18n key types generated: src/renderer/services/i18n/i18n-keys.d.ts`

- [ ] **Step 2: Run targeted command-related tests**

Run: `bun run test -- tests/unit/common/slashCommandLibrary.test.ts tests/unit/process/bridge/workspaceAutomation.test.ts`

Expected: PASS

- [ ] **Step 3: Run targeted DOM tests for the renderer command flows**

Run: `bun run test -- --project dom tests/unit/useSlashCommands.dom.test.ts tests/unit/renderer/settings/tools/ManagedCommandLibraryEditor.dom.test.tsx tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

Expected: PASS

- [ ] **Step 4: Run typechecking and i18n validation**

Run: `bunx tsc --noEmit`

Expected: exit code 0

Run: `node scripts/check-i18n.js`

Expected: validation passes; existing unrelated warnings may remain, but no new command-key drift is introduced.

- [ ] **Step 5: Commit**

```bash
git add \
  docs/superpowers/plans/2026-04-13-project-commands-source-of-truth.md \
  src/common/chat/slash/library.ts \
  src/process/bridge/services/workspaceAutomation.ts \
  src/process/bridge/conversationBridge.ts \
  src/renderer/hooks/chat/useSlashCommands.ts \
  src/renderer/pages/schedule/components/ProjectAutomationModal.tsx \
  src/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor.tsx \
  src/renderer/services/i18n/i18n-keys.d.ts \
  src/renderer/services/i18n/locales/en-US/settings.json \
  src/renderer/services/i18n/locales/ja-JP/settings.json \
  src/renderer/services/i18n/locales/ko-KR/settings.json \
  src/renderer/services/i18n/locales/tr-TR/settings.json \
  src/renderer/services/i18n/locales/zh-CN/settings.json \
  src/renderer/services/i18n/locales/zh-TW/settings.json \
  tests/unit/common/slashCommandLibrary.test.ts \
  tests/unit/process/bridge/workspaceAutomation.test.ts \
  tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx \
  tests/unit/renderer/settings/tools/ManagedCommandLibraryEditor.dom.test.tsx \
  tests/unit/useSlashCommands.dom.test.ts

git commit -m "refactor(commands): make project files the only source of truth"
```

---

## Self-Review

- Spec coverage: the plan covers data model collapse, preset-based project bootstrap, removal of runtime fallback injection, editor/UI cleanup, and targeted verification.
- Placeholder scan: no `TODO` / `TBD` placeholders remain; each task lists exact files and concrete commands.
- Type consistency: the plan uses one persisted `ManagedSlashCommandRecord` shape across bootstrap, bridge, renderer, and tests.
