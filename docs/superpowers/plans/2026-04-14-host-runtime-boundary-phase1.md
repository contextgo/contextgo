# Host Runtime Boundary Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract host browser-entry lifecycle ownership from desktop WebUI settings and make Official Remote depend on a dedicated host-side runtime service instead of user-facing local-access settings.

**Architecture:** Add a dedicated `HostBrowserEntryService` in the main process as the single lifecycle owner for the host browser entry, then refactor cloud/relay callers and legacy WebUI bridge code to use it. Keep the host-side browser origin as an internal runtime surface, preserve the local fast path for current-device access, and remove user-facing local/LAN/self-hosted entry points from the normal settings surface.

**Tech Stack:** Electron main process services, renderer React settings UI, existing WebSocket/WebUI runtime, Vitest, TypeScript strict mode.

---

### Task 1: Introduce Host Browser Entry Service

**Files:**

- Create: `src/process/services/host/HostBrowserEntryService.ts`
- Modify: `src/process/utils/webuiConfig.ts`
- Modify: `src/process/bridge/webuiBridge.ts`
- Test: `tests/unit/process/services/host/hostBrowserEntryService.test.ts`

- [ ] **Step 1: Add failing service-level tests for lifecycle ownership**

Write tests that cover:

- start/reuse behavior
- demand tracking for `local-client` and `official-remote`
- resolving the local base URL from the active instance
- release behavior when a demand source is removed

- [ ] **Step 2: Implement `HostBrowserEntryService`**

Move the runtime owner responsibilities out of `webuiConfig.ts` and into the new service. Keep the existing underlying server start/stop mechanics, but expose a cleaner API for callers:

- `ensureForDemand(...)`
- `releaseDemand(...)`
- `getRuntimeStatus()`
- `getLocalBaseUrl()`

- [ ] **Step 3: Reduce `webuiConfig.ts` to compatibility/config helper responsibilities**

Keep config parsing and compatibility helpers there, but stop treating it as the lifecycle owner.

- [ ] **Step 4: Refactor `webuiBridge.ts` to call the service instead of owning server lifecycle directly**

The bridge should become a facade for status and legacy diagnostics.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
vitest run tests/unit/process/services/host/hostBrowserEntryService.test.ts
```

Expected:

- host-browser-entry tests pass

- [ ] **Step 6: Run typecheck**

Run:

```bash
bunx tsc --noEmit
```

Expected:

- no new type errors

### Task 2: Refactor Official Remote and relay callers

**Files:**

- Modify: `src/process/services/cloud/CloudService.ts`
- Modify: `src/process/services/cloud/OfficialRemoteTunnelService.ts`
- Modify: `src/process/services/cloud/OfficialRemoteBrowserRelay.ts`
- Modify: `src/process/utils/webuiConfig.ts`
- Test: `tests/unit/process/services/cloud/officialRemoteHostEntry.test.ts`

- [ ] **Step 1: Add failing tests for Official Remote readiness without `webui.desktop.enabled`**

Cover:

- Official Remote can ensure host-browser-entry readiness through the new service
- relay availability no longer falls back to `webui.desktop.enabled`
- browser relay can resolve the local base URL from the service

- [ ] **Step 2: Refactor `CloudService`**

Change `ensureOfficialRemoteReady()` and related readiness paths to call the host-browser-entry service, not desktop-WebUI helpers.

- [ ] **Step 3: Refactor tunnel and browser relay**

Replace direct reads of `webui.desktop.enabled` and `webui.desktop.port` with service queries wherever runtime availability is the real question.

- [ ] **Step 4: Keep compatibility config reads only where truly needed**

If `webui.desktop.port` remains the preferred port source, keep that as configuration input only, not as lifecycle ownership.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
vitest run tests/unit/process/services/cloud/officialRemoteHostEntry.test.ts
```

Expected:

- Official Remote host-entry integration tests pass

- [ ] **Step 6: Run typecheck**

Run:

```bash
bunx tsc --noEmit
```

Expected:

- no new type errors

### Task 3: Remove user-facing local/LAN/self-hosted browser entry surface

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/WebuiModalContent.tsx`
- Modify: `src/renderer/pages/settings/WebuiSettings.tsx`
- Modify: `src/renderer/pages/settings/components/settingsNavigation.ts`
- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/settings.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/settings.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/settings.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/settings.json`
- Test: `tests/unit/renderer/settings/webuiSettingsVisibility.dom.test.tsx`

- [ ] **Step 1: Add failing renderer tests for hidden user-facing local-access controls**

Cover:

- normal users do not see local/LAN/self-hosted access controls
- settings navigation does not present WebUI as a normal product capability

- [ ] **Step 2: Downgrade or hide WebUI settings entry**

Make the renderer no longer present local/LAN/self-hosted access as a first-class product path.
Keep any remaining panel behavior behind an internal/dev-only path if needed.

- [ ] **Step 3: Update user-facing copy**

Remove user-facing language that implies local browser-entry hosting is a supported product mode.

- [ ] **Step 4: Run targeted renderer tests**

Run:

```bash
vitest run tests/unit/renderer/settings/webuiSettingsVisibility.dom.test.tsx
```

Expected:

- settings visibility tests pass

- [ ] **Step 5: Run typecheck**

Run:

```bash
bunx tsc --noEmit
```

Expected:

- no new type errors

### Task 4: Final verification and delivery

**Files:**

- Modify: `docs/superpowers/specs/2026-04-14-host-runtime-boundary-phase1-design.md`
- Modify: `docs/superpowers/plans/2026-04-14-host-runtime-boundary-phase1.md`

- [ ] **Step 1: Run formatting and lint autofix**

Run:

```bash
bun run lint:fix
bun run format
```

Expected:

- changed files are normalized

- [ ] **Step 2: Run focused verification**

Run:

```bash
bunx tsc --noEmit
vitest run tests/unit/process/services/host/hostBrowserEntryService.test.ts tests/unit/process/services/cloud/officialRemoteHostEntry.test.ts tests/unit/renderer/settings/webuiSettingsVisibility.dom.test.tsx
```

Expected:

- targeted tests pass
- no new type errors

- [ ] **Step 3: Record unrelated baseline failures**

Document that full `bun run test` is already red before this work due to unrelated suites, including:

- `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- `tests/unit/channelBridge.test.ts`
- `tests/unit/fsBridge.skills.test.ts`
- `tests/unit/process/bridge/fsBridge.standalone.test.ts`
- `tests/unit/workspaceUtils.test.ts`
- `tests/unit/release/publicContentBuilder.test.ts`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-14-host-runtime-boundary-phase1-design.md docs/superpowers/plans/2026-04-14-host-runtime-boundary-phase1.md src/process/services/host src/process/utils/webuiConfig.ts src/process/bridge/webuiBridge.ts src/process/services/cloud src/renderer/components/settings/SettingsModal/contents/WebuiModalContent.tsx src/renderer/pages/settings/WebuiSettings.tsx src/renderer/pages/settings/components/settingsNavigation.tsx src/renderer/services/i18n/locales/en-US/settings.json src/renderer/services/i18n/locales/zh-CN/settings.json src/renderer/services/i18n/locales/zh-TW/settings.json src/renderer/services/i18n/locales/ja-JP/settings.json src/renderer/services/i18n/locales/ko-KR/settings.json src/renderer/services/i18n/locales/tr-TR/settings.json tests/unit/process/services/host tests/unit/process/services/cloud tests/unit/renderer/settings
git commit -m "refactor(host): split host browser entry lifecycle from webui settings"
```
