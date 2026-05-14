# Remove WebUI Settings Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the user-facing `webui / 远程连接` settings entry and page while preserving Official Remote device switching and keeping legacy `/settings/webui` links safe.

**Architecture:** Keep the host-side WebUI runtime intact, but remove the desktop settings entry points that expose local/LAN/self-hosted access as a normal product path. Existing or stale `/settings/webui` routes should redirect to `/settings/system`, and Official Remote surfaces should no longer point users back to the removed page.

**Tech Stack:** React, React Router, Vitest, Playwright, i18next

---

### Task 1: Lock the removal behavior with regression tests

**Files:**

- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Create: `tests/unit/renderer/settings/SettingsEntryRemoval.dom.test.tsx`

- [ ] **Step 1: Add a router regression test for the legacy route**

Add a test to `tests/unit/renderer/layout/Router.dom.test.tsx` that starts at `/#/settings/webui` and verifies the rendered page becomes `system-settings` instead of `webui-settings`.

- [ ] **Step 2: Add a settings entry regression test**

Create `tests/unit/renderer/settings/SettingsEntryRemoval.dom.test.tsx` to verify:

```tsx
expect(container.querySelector('[data-settings-id="webui"]')).toBeNull();
expect(screen.queryByText('settings.webui')).not.toBeInTheDocument();
```

and that the desktop settings modal does not render a `settings.webui` tab.

- [ ] **Step 3: Run the focused tests and confirm they fail for the current code**

Run:

```bash
bun run vitest tests/unit/renderer/layout/Router.dom.test.tsx tests/unit/renderer/settings/SettingsEntryRemoval.dom.test.tsx
```

Expected: the new assertions fail because `/settings/webui` still resolves and the settings entry is still present.

### Task 2: Remove the settings entry points and legacy route surface

**Files:**

- Modify: `src/renderer/pages/settings/components/SettingsSider.tsx`
- Modify: `src/renderer/components/settings/SettingsModal/index.tsx`
- Modify: `src/renderer/components/layout/Router.tsx`
- Modify: `src/renderer/components/layout/routerLocation.ts`
- Modify: `src/renderer/pages/RemoteDevicesPage.tsx`
- Modify: `src/renderer/components/layout/Titlebar/index.tsx`

- [ ] **Step 1: Remove the settings sider item**

Delete the `webui` builtin item and remove it from the builtin tab ordering in `src/renderer/pages/settings/components/SettingsSider.tsx`.

- [ ] **Step 2: Remove the modal tab**

Delete the `webui` built-in tab type, menu item, and render branch from `src/renderer/components/settings/SettingsModal/index.tsx`.

- [ ] **Step 3: Redirect the legacy route**

In `src/renderer/components/layout/Router.tsx`, replace the `/settings/webui` lazy route with:

```tsx
<Route path='/settings/webui' element={<Navigate to='/settings/system' replace />} />
```

and remove the now-unused lazy import.

- [ ] **Step 4: Remove stale preloading and page-specific labels**

Delete the `/settings/webui` preloader entry from `src/renderer/components/layout/routerLocation.ts`, and remove the dedicated `/settings/webui` title branch from `src/renderer/components/layout/Titlebar/index.tsx`.

- [ ] **Step 5: Update in-app backlinks**

Change `src/renderer/pages/RemoteDevicesPage.tsx` so its desktop-only “Go to settings” button opens `/settings/system` instead of `/settings/webui`.

### Task 3: Update tests and helper references that still assume the old page

**Files:**

- Modify: `tests/e2e/helpers/navigation.ts`
- Modify: `tests/e2e/specs/channels.e2e.ts`
- Delete: `tests/e2e/specs/webui.e2e.ts`

- [ ] **Step 1: Point channel navigation at the surviving route**

Update `tests/e2e/helpers/navigation.ts` so `goToChannelsTab()` navigates through `#/settings/channels` instead of `#/settings/webui`.

- [ ] **Step 2: Remove the obsolete WebUI settings E2E coverage**

Delete `tests/e2e/specs/webui.e2e.ts`, because the user-facing page it validates is intentionally removed.

- [ ] **Step 3: Refresh outdated comments**

Update references like “webui tab → channels sub-tab” to describe direct channel settings navigation.

### Task 4: Align architecture documentation with the new product model

**Files:**

- Modify: `docs/tech/mobile-remote-control.md`
- Modify: `docs/tech/architecture.md`

- [ ] **Step 1: Promote the host-runtime model**

Rewrite the top-level remote model language so the canonical stance is:

```text
Host Runtime + Official Remote control plane + desktop/mobile clients
```

and explicitly allow desktop shells to act as remote clients to other hosts.

- [ ] **Step 2: Reduce desktop-first wording**

Update `docs/tech/architecture.md` so product language no longer treats the desktop GUI as the product boundary, while still keeping host-local execution as the authority.

### Task 5: Verify the change set

**Files:**

- Verify only

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
bun run vitest tests/unit/renderer/layout/Router.dom.test.tsx tests/unit/renderer/settings/SettingsEntryRemoval.dom.test.tsx tests/unit/renderer/settings/settingsNavigation.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run typecheck for touched renderer code**

Run:

```bash
bunx tsc --noEmit
```

Expected: no type errors introduced by the route and settings-tab removals.
