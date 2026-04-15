# Mobile Startup Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the mobile shell white screen after brand splash by keeping native startup overlays alive until the hosted WebUI is ready, rendering a non-blank Web bootstrap loader, and warming the correct remote-entry routes.

**Architecture:** Add a hosted-ready signal that mobile shells can observe, keep shell overlays visible through a brand-to-connecting handoff, render a Web bootstrap loader instead of returning `null`, and expand renderer route prewarming for the mobile remote critical path. Keep the fix scoped to the existing mobile-shell and renderer startup boundaries.

**Tech Stack:** SwiftUI + WKWebView, Android WebView, React 19, TypeScript strict mode, Vitest

---

### Task 1: Lock renderer startup behavior with failing tests

**Files:**

- Create: `tests/unit/renderer/main.dom.test.tsx`
- Modify: `tests/unit/renderer/layout/routerLocation.test.ts`

- [ ] Add a DOM test proving the renderer shows a startup loader while auth is unresolved instead of rendering a blank root.
- [ ] Add unit assertions proving the mobile remote critical routes are included in route prewarm coverage.
- [ ] Run the targeted renderer test files and confirm the new expectations fail against the current implementation.

### Task 2: Implement non-blank renderer bootstrap and hosted ready signaling

**Files:**

- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/components/layout/AppLoader.tsx`
- Modify: `src/renderer/components/layout/Router.tsx`
- Modify: `src/renderer/components/layout/routerLocation.ts`

- [ ] Change the renderer root so unresolved auth renders a startup loader instead of `null`.
- [ ] Add a browser-safe hosted ready signal that fires once the initial shell is mountable for mobile-shell clients.
- [ ] Expand remote-route prewarming to cover `/remote/devices` and the remote-device conversation path.
- [ ] Keep the changes browser-safe and avoid Electron-only dependencies in renderer code.

### Task 3: Keep the iOS mobile shell overlay alive through hosted readiness

**Files:**

- Modify: `mobile-shell/ios/Sources/Web/WebViewStore.swift`
- Modify: `mobile-shell/ios/Sources/App/ContentView.swift`

- [ ] Replace the current `didCommit`-driven overlay dismissal with stronger readiness tracking.
- [ ] Distinguish brand and connecting phases so the shell can show desktop-loading copy during remote-device entry.
- [ ] Listen for the hosted ready signal from the WebView and dismiss the overlay only after stronger readiness is reached.

### Task 4: Add the same startup handoff to Android

**Files:**

- Modify: `mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt`
- Modify: `mobile-shell/android/app/src/main/res/layout/activity_main.xml`
- Modify: `mobile-shell/android/app/src/main/res/values/strings.xml`

- [ ] Add a startup overlay layer above the Android WebView that survives the initial page load.
- [ ] Feed the overlay with desktop/device-list loading copy based on the resolved target.
- [ ] Observe WebView navigation and hosted ready signaling so the Android handoff matches iOS.

### Task 5: Verify and polish the critical path

**Files:**

- Modify: files touched above as needed

- [ ] Run the targeted renderer tests again and confirm they pass.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `bun run lint:fix` on touched files if needed and `bun run format`.
- [ ] Run an Android resource/build sanity check and an iOS source sanity check appropriate to the changed shell files.
- [ ] Review the final diff to ensure the scope stayed on startup loading and route warming only.
