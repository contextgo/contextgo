# Mobile Shell Cross-Platform Alignment Design

## Summary

This change aligns the `mobile-shell/` Android and HarmonyOS runtimes with the existing iOS mobile-shell baseline for remote access.

The target is not full native feature parity with the iOS shell home screen. The target is a consistent shell contract across Android, iOS, and HarmonyOS so the shared renderer can reliably detect a mobile-shell runtime and the shell can support the same critical remote flows:

- Official Remote default entry at `/remote/devices`
- stable mobile-shell runtime detection from the shared renderer
- startup readiness handoff between WebUI and the native shell
- deep-link and callback handling for remote login flows
- file chooser forwarding for host-side WebUI uploads
- predictable return-to-shell / change-host recovery behavior

## Problem

The current repository has a strong iOS shell implementation, a lighter Android shell, and a basic HarmonyOS shell scaffold.

The main gaps are:

1. HarmonyOS defaults Official Remote to `/login` instead of `/remote/devices`.
2. The renderer relies on `isMobileShellWebView()` and the `ContextGoMobileShell` user-agent token, but HarmonyOS does not currently provide an equivalent runtime marker.
3. Android and HarmonyOS do not yet match the iOS shell contract for login recovery, deep-link handling, and shell startup readiness.
4. HarmonyOS still lacks shell-level support for file uploads from the device into the host-side WebUI flow.

These gaps cause platform-specific behavior differences in shared renderer code, including login startup routing, titlebar/layout chrome, and mobile-shell-only UX branches.

## Goals

- Make Android, iOS, and HarmonyOS agree on the Official Remote default route.
- Make Android and HarmonyOS positively identify themselves as mobile-shell runtimes to the shared renderer.
- Preserve the product model from `docs/tech/mobile-remote-control.md`: desktop host remains the execution authority, mobile shells remain remote clients.
- Add the minimum native-shell behavior needed for Android and HarmonyOS to support iOS-equivalent remote login and upload flows.
- Keep the implementation inside `mobile-shell/` plus shared renderer runtime detection; do not modify the Expo client under `mobile/`.

## Non-Goals

- Port the full iOS native home/device-list UI to Android or HarmonyOS.
- Create a standalone mobile host runtime.
- Re-architect cloud remote product flows.
- Redesign WebUI layout or unrelated mobile styling.

## Scope

### In scope

- `mobile-shell/android/`
- `mobile-shell/harmony/`
- shared renderer runtime detection and any minimal renderer integration needed to consume the shell contract
- tests covering runtime detection and target resolution behavior

### Out of scope

- `mobile/` Expo app
- desktop Electron runtime behavior
- new cloud backend APIs

## Design

### 1. Shared shell contract

The shared renderer already treats `ContextGoMobileShell` as the mobile-shell runtime marker. This contract should remain the single source of truth, but Android and HarmonyOS must both implement it consistently.

The contract is:

- the shell user agent includes `ContextGoMobileShell/1.0`
- Official Remote resolves to `https://remote.contextgo.io/remote/devices`
- the shell emits or observes the existing startup-ready signal:
  - `window.__CONTEXTGO_STARTUP_READY === true`
  - `document.documentElement.dataset.contextgoStartupReady === 'true'`
  - `contextgo:startup-ready`
- the shell supports device-local file selection for HTML file inputs inside the host WebUI

### 2. Official Remote target normalization

Android, iOS, and HarmonyOS must normalize inputs the same way:

- `remote.contextgo.io/`, `/login`, or a host-only Official Remote URL must become `/remote/devices`
- custom host URLs with no path should become `/login`
- custom `/qr-login?token=...` URLs should remain intact
- callback/deep-link wrappers should preserve the wrapped target

This keeps shell behavior aligned across platforms and avoids platform-specific remote landing differences.

### 3. Android shell alignment

Android already has:

- startup overlay with startup-ready observer
- file chooser forwarding
- a `ContextGoMobileShell` user-agent token
- deep-link intent filters for `https://remote.contextgo.io` and `contextgo-remote`

Android needs to close the remaining gap with iOS by adding explicit login callback and recovery handling instead of relying only on generic WebView navigation.

The Android shell should:

- keep the current lightweight native shell UI
- recognize official OAuth/login callback URLs and route them through a native recovery path
- treat Official Remote login redirects consistently with iOS target resolution rules
- continue to expose startup overlay and file picker support

### 4. HarmonyOS shell alignment

HarmonyOS is currently the largest gap. It should be upgraded from a basic `Web` container to a mobile-shell runtime that matches the shared contract.

HarmonyOS should:

- default Official Remote to `/remote/devices`
- expose the same runtime marker used by Android and iOS
- add startup-ready observation so shell launch timing matches the existing renderer signal
- add deep-link callback handling for remote login completion
- add device-local file upload support for file inputs rendered by the host WebUI
- keep the native shell UI lightweight, similar in scope to Android rather than iOS

### 5. Renderer integration

Shared renderer changes should stay minimal and browser-safe.

The renderer should continue to use `isMobileShellWebView()` as the capability gate, but the runtime marker must no longer be “iOS by convention only.” Comments and naming should be updated so the code clearly describes Android, iOS, and HarmonyOS mobile-shell runtimes.

If HarmonyOS cannot provide the exact same user-agent mechanism, the fallback should still preserve a single shared detection path from renderer code, not platform-specific conditionals scattered around the UI.

## File-Level Impact

- `src/renderer/utils/platform.ts`
  - clarify or extend mobile-shell runtime detection if needed
- Android shell entry and target resolver code
  - align login recovery and official remote normalization
- HarmonyOS shell entry page and ability configuration
  - add runtime marker, startup-ready integration, target normalization, and upload/deep-link support
- tests for renderer runtime detection and resolver behavior

## Risks

### 1. HarmonyOS Web capability differences

HarmonyOS `Web` container APIs may differ from Android WebView and iOS WKWebView for user-agent overrides, file chooser hooks, and deep-link callbacks. The implementation must use HarmonyOS primary APIs instead of assuming Android-like behavior.

### 2. Renderer false positives

Any runtime marker change must avoid causing normal mobile browsers to be detected as mobile shells.

### 3. Login regression

Official Remote callback handling is sensitive. The Android and HarmonyOS changes must preserve custom host `/qr-login` flows and avoid forcing all auth through native-only logic.

## Testing Strategy

- unit tests for shared runtime detection and URL normalization logic
- targeted Vitest runs for affected renderer/runtime tests
- `bunx tsc --noEmit`
- Android debug assemble
- HarmonyOS debug assemble if the local toolchain is available in this environment

Because the repository-wide `bun run test` currently hangs in this environment before any new changes, task completion will rely on targeted verification plus explicit note of the baseline full-suite issue.

## Rollout

Single PR on a dedicated branch:

1. align shared shell contract and URL normalization
2. implement Android callback/recovery alignment
3. implement HarmonyOS shell upgrades
4. add tests and run targeted verification
