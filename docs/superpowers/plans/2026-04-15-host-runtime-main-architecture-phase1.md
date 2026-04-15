# Host Runtime Main Architecture Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the finished `#113` host-lifecycle boundary work into `#112`, then expose an explicit `hostRuntime` product-model snapshot through shared cloud status types so the main architecture vocabulary exists in code before broader UI cleanup.

**Architecture:** Keep the runtime behavior unchanged, but lift the architecture model into shared status types. `CloudService.getStatus()` should derive a `hostRuntime` snapshot from `HostBrowserEntryService` runtime state plus Official Remote state, while renderer consumers remain source-compatible and can adopt the new field incrementally.

**Tech Stack:** TypeScript, Electron main process services, shared IPC types, Vitest.

---

### Task 1: Restack The #112 Worktree On The Latest #113 Boundary Commit

**Files:**

- Modify: `.worktrees/feat-host-runtime-main-architecture` git history
- Verify: `git -C /Users/bytedance/contextgo/contextgo/.worktrees/feat-host-runtime-main-architecture status --short --branch`

- [ ] **Step 1: Check the current stacked branch point**

Run: `git -C /Users/bytedance/contextgo/contextgo/.worktrees/feat-host-runtime-main-architecture log --oneline --decorate -3`
Expected: HEAD still points at `2cef0083` and does not yet include `01d8e242`.

- [ ] **Step 2: Cherry-pick the latest #113 host-boundary commit**

Run: `git -C /Users/bytedance/contextgo/contextgo/.worktrees/feat-host-runtime-main-architecture cherry-pick 01d8e242`
Expected: The worktree now includes the bridge-slimming and host-preference-centralization changes from `#113`.

- [ ] **Step 3: Verify the branch is clean before new code**

Run: `git -C /Users/bytedance/contextgo/contextgo/.worktrees/feat-host-runtime-main-architecture status --short --branch`
Expected: Clean worktree on `feat/host-runtime-main-architecture`.

### Task 2: Add Explicit Host Runtime Architecture State To CloudStatus

**Files:**

- Modify: `src/common/types/cloud.ts`
- Modify: `src/process/services/cloud/CloudService.ts`
- Test: `tests/unit/process/cloud/cloudServiceLoopback.test.ts`

- [ ] **Step 1: Write the failing tests for the new `hostRuntime` snapshot**

Add assertions that `CloudService.getStatus()` returns a `hostRuntime` object similar to:

```ts
expect(status.hostRuntime).toMatchObject({
  authority: 'host-runtime',
  defaultRemoteAccess: 'official-remote',
  exposure: 'loopback',
  mode: 'gui-host',
  officialRemoteDesired: true,
  officialRemoteReady: true,
  platform: 'macos',
  running: true,
  supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
});
```

- [ ] **Step 2: Run the cloud-service test to verify it fails for the right reason**

Run: `bunx vitest run tests/unit/process/cloud/cloudServiceLoopback.test.ts`
Expected: FAIL because `hostRuntime` is missing from `CloudStatus`.

- [ ] **Step 3: Add the shared `hostRuntime` types and derive them in CloudService**

Implement a minimal shape in `src/common/types/cloud.ts` and `src/process/services/cloud/CloudService.ts`:

```ts
export type HostRuntimeStatus = {
  authority: 'host-runtime';
  defaultRemoteAccess: 'official-remote';
  exposure: 'loopback' | 'external';
  lifecycle: 'stopped' | 'starting' | 'running' | 'stopping' | 'degraded';
  mode: 'gui-host' | 'headless-host';
  platform: 'macos' | 'windows' | 'linux';
  running: boolean;
  supportedClients: Array<'desktop-client' | 'mobile-client' | 'browser-client'>;
  officialRemoteDesired: boolean;
  officialRemoteReady: boolean;
  localUrl?: string;
  networkUrl?: string;
};
```

Derive it from `getHostBrowserEntryService().getRuntimeStatus()` plus the existing `officialRemote` state in `CloudService.getStatus()`.

- [ ] **Step 4: Re-run the cloud-service test to verify it passes**

Run: `bunx vitest run tests/unit/process/cloud/cloudServiceLoopback.test.ts`
Expected: PASS with the new `hostRuntime` snapshot asserted.

### Task 3: Update Shared Fixtures And Verify Renderer Compatibility

**Files:**

- Modify: `tests/unit/renderer/CloudSyncSection.dom.test.tsx`
- Modify: `tests/unit/renderer/layout/RemoteDevicesPage.dom.test.tsx`
- Modify: `src/common/types/cloud.ts`

- [ ] **Step 1: Update renderer test fixtures to include the new `hostRuntime` field**

Mirror the same minimal snapshot in the fixture objects:

```ts
hostRuntime: {
  authority: 'host-runtime',
  defaultRemoteAccess: 'official-remote',
  exposure: 'loopback',
  lifecycle: 'running',
  mode: 'gui-host',
  platform: 'macos',
  running: true,
  supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
  officialRemoteDesired: true,
  officialRemoteReady: true,
}
```

- [ ] **Step 2: Run the targeted renderer/process regression set**

Run:

```bash
bunx vitest run \
  tests/unit/process/cloud/cloudServiceLoopback.test.ts \
  tests/unit/renderer/CloudSyncSection.dom.test.tsx \
  tests/unit/renderer/layout/RemoteDevicesPage.dom.test.tsx
```

Expected: PASS with no fixture/type regressions.

- [ ] **Step 3: Run formatting and type verification**

Run:

```bash
bunx oxfmt --check \
  src/common/types/cloud.ts \
  src/process/services/cloud/CloudService.ts \
  tests/unit/process/cloud/cloudServiceLoopback.test.ts \
  tests/unit/renderer/CloudSyncSection.dom.test.tsx \
  tests/unit/renderer/layout/RemoteDevicesPage.dom.test.tsx
bunx tsc --noEmit
```

Expected: Formatting clean and TypeScript exits 0.

- [ ] **Step 4: Commit the phase-1 architecture model slice**

```bash
git add \
  src/common/types/cloud.ts \
  src/process/services/cloud/CloudService.ts \
  tests/unit/process/cloud/cloudServiceLoopback.test.ts \
  tests/unit/renderer/CloudSyncSection.dom.test.tsx \
  tests/unit/renderer/layout/RemoteDevicesPage.dom.test.tsx
git commit -m "refactor(host): expose host runtime status model"
```
