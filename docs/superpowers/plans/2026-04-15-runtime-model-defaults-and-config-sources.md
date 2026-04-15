# Runtime Model Defaults And Config Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ACP runtime model defaults come from cached runtime facts instead of hardcoded product fallbacks, and make the runtime settings page expose all config/auth sources for runtimes like Codex and OpenCode.

**Architecture:** Keep the runtime probe path as the source of truth, but use it to refresh ContextGo-managed cache/config state rather than to provide per-session UI placeholders. Runtime settings keeps reading bridge-reported config entries, but the UI should treat them as a list of sources instead of a single path and open every relevant file consistently.

**Tech Stack:** TypeScript, React, Electron IPC bridge, Vitest 4, Bun.

---

### Task 1: Lock Guid Selection To Runtime-Backed Defaults

**Files:**

- Modify: `tests/unit/guidAgentSelection.dom.test.ts`
- Test: `tests/unit/guidAgentSelection.dom.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('does not invent a codex default model when no cached or preferred runtime model exists', async () => {
  setupMocks({
    cachedModels: {},
    acpConfig: {},
  });

  const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

  await waitFor(() => {
    expect(result.current.availableAgents).toBeDefined();
  });

  act(() => {
    result.current.setSelectedAgentKey('codex');
  });

  await waitFor(() => {
    expect(result.current.selectedAgentKey).toBe('codex');
  });

  expect(result.current.currentAcpCachedModelInfo).toBeNull();
  expect(result.current.selectedAcpModel).toBeNull();
});

it('prefers a probed runtime default for codex after cache refresh', async () => {
  ipcMock.probeModelInfo.mockResolvedValueOnce({
    success: true,
    data: {
      modelInfo: {
        source: 'configOption',
        currentModelId: 'gpt-5.4',
        currentModelLabel: 'gpt-5.4',
        availableModels: [
          { id: 'gpt-5.4', label: 'gpt-5.4' },
          { id: 'gpt-5.3-codex', label: 'gpt-5.3-codex' },
        ],
        canSwitch: true,
      },
    },
  });

  setupMocks({
    cachedModels: {},
    acpConfig: {},
  });

  const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

  await waitFor(() => {
    expect(result.current.availableAgents).toBeDefined();
  });

  act(() => {
    result.current.setSelectedAgentKey('codex');
  });

  await waitFor(() => {
    expect(result.current.currentAcpCachedModelInfo?.currentModelId).toBe('gpt-5.4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/guidAgentSelection.dom.test.ts`
Expected: FAIL because Codex currently falls back to `DEFAULT_CODEX_MODELS[0]`.

- [ ] **Step 3: Commit checkpoint**

```bash
git add tests/unit/guidAgentSelection.dom.test.ts
git commit -m "test(guid): lock runtime-backed model defaults"
```

### Task 2: Remove Hardcoded Codex Default Selection

**Files:**

- Modify: `src/renderer/pages/guid/hooks/useGuidAgentSelection.ts`
- Modify: `src/common/types/codex/codexModels.ts`
- Test: `tests/unit/guidAgentSelection.dom.test.ts`

- [ ] **Step 1: Write the minimal implementation**

```ts
// useGuidAgentSelection.ts
const currentAcpCachedModelInfo = useMemo(() => {
  const backend = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
  if (backend === 'custom') {
    return null;
  }

  return acpCachedModels[backend] ?? null;
}, [acpCachedModels, selectedAgentInfo, selectedAgentKey]);
```

```ts
// codexModels.ts
// Keep DEFAULT_CODEX_MODELS only as a fallback available-model catalog for runtime code paths
// that explicitly need a known list, not as a UI-selected default.
```

- [ ] **Step 2: Run the Guid selection tests**

Run: `bun run test -- tests/unit/guidAgentSelection.dom.test.ts`
Expected: PASS and no synthetic Codex model selection before cached/runtime data exists.

- [ ] **Step 3: Verify typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit checkpoint**

```bash
git add src/renderer/pages/guid/hooks/useGuidAgentSelection.ts src/common/types/codex/codexModels.ts tests/unit/guidAgentSelection.dom.test.ts
git commit -m "refactor(guid): use runtime-backed model defaults"
```

### Task 3: Lock Runtime Settings To Multi-Source Config Opening

**Files:**

- Modify: `tests/unit/renderer/RuntimeSettings.dom.test.tsx`
- Test: `tests/unit/renderer/RuntimeSettings.dom.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('opens every runtime config source returned for opencode', async () => {
  getManagedRuntimeConfigLocationInvokeMock.mockResolvedValueOnce({
    success: true,
    data: {
      backend: 'opencode',
      entries: [
        { kind: 'config', path: '/Users/tester/.config/opencode/opencode.json', exists: true },
        { kind: 'auth', path: '/Users/tester/.local/share/opencode/auth.json', exists: true },
      ],
    },
  });

  renderRuntimeSettings();

  await screen.findByText('Runtime Management');
  fireEvent.click(within(screen.getByTestId('runtime-card-opencode')).getByRole('button', { name: 'Open config' }));

  await waitFor(() => {
    expect(openFilePreviewMock).toHaveBeenCalledWith({ path: '/Users/tester/.config/opencode/opencode.json' });
    expect(openFilePreviewMock).toHaveBeenCalledWith({ path: '/Users/tester/.local/share/opencode/auth.json' });
  });
});
```

- [ ] **Step 2: Run the runtime settings tests to verify current failures**

Run: `bun run test -- tests/unit/renderer/RuntimeSettings.dom.test.tsx`
Expected: FAIL if any code path still assumes a single config source or misses a second entry.

- [ ] **Step 3: Commit checkpoint**

```bash
git add tests/unit/renderer/RuntimeSettings.dom.test.tsx
git commit -m "test(runtime): cover multi-source config opening"
```

### Task 4: Surface All Runtime Config Sources In Settings

**Files:**

- Modify: `src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx`
- Modify: `src/common/adapter/ipcBridge.ts` (only if bridge typing needs extension)
- Modify: `src/common/types/acpTypes.ts` (only if config entry typing needs extension)
- Test: `tests/unit/renderer/RuntimeSettings.dom.test.tsx`
- Test: `tests/unit/acpConversationBridge.test.ts`

- [ ] **Step 1: Implement UI and source handling**

```ts
// CustomAcpAgent.tsx
const configPaths = getRuntimeConfigPaths(configLocation);
for (const configPath of configPaths) {
  const opened = await openFilePreview({ path: configPath });
  if (!opened) {
    await shell.openFile.invoke(configPath);
  }
}
```

```tsx
// CustomAcpAgent.tsx
{configLocation?.entries?.length ? (
  <div>
    {configLocation.entries.map((entry) => (
      <div key={entry.path}>{entry.kind}: {entry.path}</div>
    ))}
  </div>
) : null}
```

- [ ] **Step 2: Run targeted runtime settings and bridge tests**

Run: `bun run test -- tests/unit/renderer/RuntimeSettings.dom.test.tsx tests/unit/acpConversationBridge.test.ts`
Expected: PASS, including Codex multi-file and OpenCode multi-file cases.

- [ ] **Step 3: Run final targeted verification bundle**

Run: `bun run test -- tests/unit/guidAgentSelection.dom.test.ts tests/unit/renderer/RuntimeSettings.dom.test.tsx tests/unit/acpConversationBridge.test.ts`
Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```bash
git add src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx src/common/adapter/ipcBridge.ts src/common/types/acpTypes.ts tests/unit/renderer/RuntimeSettings.dom.test.tsx tests/unit/acpConversationBridge.test.ts
git commit -m "feat(runtime): align defaults and config sources with runtimes"
```
