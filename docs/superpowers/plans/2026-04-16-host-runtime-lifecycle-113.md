# Host Runtime Lifecycle Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move host runtime lifecycle ownership into a first-class host service so startup, Official Remote, and local-access flows stop owning runtime state independently.

**Architecture:** Introduce a thin `HostRuntimeService` façade above `HostBrowserEntryService` and host preference helpers. Keep `HostBrowserEntryService` as the low-level browser-entry runtime, but route startup/bootstrap, WebUI bridge, and cloud Official Remote readiness through the façade so lifecycle ownership is centralized without changing user auth or UI models.

**Tech Stack:** TypeScript, Electron main-process services, Vitest

---

### Task 1: Add Host Runtime Service façade

**Files:**

- Create: `src/process/services/host/HostRuntimeService.ts`
- Create: `tests/unit/process/services/host/hostRuntimeService.test.ts`

- [ ] **Step 1: Write the failing façade tests**

```ts
it('restores local-client runtime demand from persisted host preferences', async () => {
  getHostLocalClientAccessPreferencesMock.mockResolvedValue({
    enabled: true,
    allowRemote: true,
    preferredPort: 35809,
  });

  const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
  await getHostRuntimeService().restoreLocalClientAccessFromPreferences();

  expect(ensureForDemandMock).toHaveBeenCalledWith('local-client', {
    preferredPort: 35809,
    allowRemote: true,
    reason: 'desktop-preferences',
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts`
Expected: FAIL because `HostRuntimeService.ts` does not exist yet

- [ ] **Step 3: Write the minimal façade implementation**

```ts
export class HostRuntimeService {
  public async restoreLocalClientAccessFromPreferences(): Promise<void> {
    const preferences = await getHostLocalClientAccessPreferences();
    if (!preferences.enabled) return;
    await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort: preferences.preferredPort,
      allowRemote: preferences.allowRemote,
      reason: 'desktop-preferences',
    });
  }
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/services/host/HostRuntimeService.ts tests/unit/process/services/host/hostRuntimeService.test.ts
git commit -m "feat(host): add host runtime lifecycle service"
```

### Task 2: Route startup/bootstrap ownership through HostRuntimeService

**Files:**

- Modify: `src/index.ts`
- Modify: `tests/unit/process/services/host/hostRuntimeService.test.ts`
- Modify: `tests/unit/process/services/host/hostBrowserEntryStartup.test.ts`

- [ ] **Step 1: Extend tests for startup entrypoints**

```ts
it('prepares official-remote runtime from a stored device token', async () => {
  processConfigGetMock.mockResolvedValue('ctxdev_token');
  getPreferredHostBrowserEntryPortMock.mockResolvedValue(35808);

  const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
  await getHostRuntimeService().prepareOfficialRemoteAtStartup();

  expect(ensureForDemandMock).toHaveBeenCalledWith('official-remote', {
    preferredPort: 35808,
    allowRemote: false,
    reason: 'app-startup-official-remote',
    allowPortFallback: true,
  });
});
```

- [ ] **Step 2: Run targeted tests to verify the new assertions fail**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryStartup.test.ts`
Expected: FAIL until startup code uses the new façade

- [ ] **Step 3: Update startup callers to use HostRuntimeService**

```ts
const hostRuntimeService = getHostRuntimeService();
await hostRuntimeService.prepareOfficialRemoteAtStartup();
await hostRuntimeService.prepareForWebUiMode({ preferredPort, allowRemote });
void hostRuntimeService.restoreLocalClientAccessFromPreferences();
```

- [ ] **Step 4: Re-run startup tests**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryStartup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryStartup.test.ts
git commit -m "refactor(host): route startup ownership through host runtime service"
```

### Task 3: Route WebUI and cloud lifecycle calls through HostRuntimeService

**Files:**

- Modify: `src/process/bridge/services/WebuiService.ts`
- Modify: `src/process/bridge/webuiBridge.ts`
- Modify: `src/process/services/cloud/CloudService.ts`
- Modify: `tests/unit/process/bridge/webuiService.test.ts`
- Modify: `tests/unit/process/cloud/officialRemoteHostEntry.test.ts`

- [ ] **Step 1: Add failing tests for façade-based lifecycle calls**

```ts
it('starts local access through HostRuntimeService', async () => {
  ensureLocalClientAccessMock.mockResolvedValue({
    port: 43123,
    localUrl: 'http://localhost:43123',
  });

  const { WebuiService } = await import('@/process/bridge/services/WebuiService');
  await WebuiService.startLocalAccess({ port: 43000, allowRemote: true });

  expect(ensureLocalClientAccessMock).toHaveBeenCalledWith({
    preferredPort: 43000,
    allowRemote: true,
    reason: 'webui.start',
  });
});
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `bun run test -- tests/unit/process/bridge/webuiService.test.ts tests/unit/process/cloud/officialRemoteHostEntry.test.ts`
Expected: FAIL until call sites switch to `HostRuntimeService`

- [ ] **Step 3: Update the bridge/service call sites**

```ts
const hostRuntimeService = getHostRuntimeService();
await hostRuntimeService.ensureOfficialRemoteRuntime('official-remote');
await hostRuntimeService.releaseOfficialRemoteRuntime(reason);
await hostRuntimeService.stopLocalClientAccess('Server shutting down');
```

- [ ] **Step 4: Run the focused host-runtime regression suite**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryService.test.ts tests/unit/process/bridge/webuiService.test.ts tests/unit/process/cloud/officialRemoteHostEntry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/bridge/services/WebuiService.ts src/process/bridge/webuiBridge.ts src/process/services/cloud/CloudService.ts tests/unit/process/bridge/webuiService.test.ts tests/unit/process/cloud/officialRemoteHostEntry.test.ts tests/unit/process/services/host/hostRuntimeService.test.ts
git commit -m "refactor(host): centralize runtime lifecycle ownership"
```

### Task 4: Final verification

**Files:**

- Modify: `docs/superpowers/plans/2026-04-16-host-runtime-lifecycle-113.md`

- [ ] **Step 1: Run the full focused verification batch**

Run: `bun run test -- tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryService.test.ts tests/unit/process/services/host/hostBrowserEntryStartup.test.ts tests/unit/process/bridge/webuiService.test.ts tests/unit/process/cloud/officialRemoteHostEntry.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run formatting/lint checks on touched files**

Run: `bunx oxfmt --check src/process/services/host/HostRuntimeService.ts src/index.ts src/process/bridge/services/WebuiService.ts src/process/bridge/webuiBridge.ts src/process/services/cloud/CloudService.ts tests/unit/process/services/host/hostRuntimeService.test.ts tests/unit/process/services/host/hostBrowserEntryStartup.test.ts tests/unit/process/bridge/webuiService.test.ts tests/unit/process/cloud/officialRemoteHostEntry.test.ts docs/superpowers/plans/2026-04-16-host-runtime-lifecycle-113.md`
Expected: PASS

- [ ] **Step 4: Commit the final verified state**

```bash
git add docs/superpowers/plans/2026-04-16-host-runtime-lifecycle-113.md
git commit -m "docs(host): capture lifecycle ownership implementation plan"
```
