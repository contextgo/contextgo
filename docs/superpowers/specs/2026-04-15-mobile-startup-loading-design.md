# Mobile Startup Loading Design

**Date:** 2026-04-15
**Status:** Approved for implementation
**Source:** GitHub issue #157

## Overview

Fix the mobile-shell startup gap that currently appears when a phone opens a desktop device through Official Remote. The existing loading chain breaks in two places:

- the native shell removes its launch overlay before the hosted WebUI has a meaningful first frame
- the WebUI root renders nothing while auth bootstrap is still resolving

This design closes that gap with a continuous loading handoff and a small set of targeted startup optimizations.

## Goals

- Eliminate the visible white screen after the brand overlay disappears.
- Keep the native shell loading experience continuous until the hosted WebUI is actually ready to show content.
- Ensure the WebUI always renders an intentional loader or shell during auth bootstrap.
- Reduce real startup latency on the mobile-to-desktop path by warming the correct remote routes earlier.
- Keep the implementation scoped to the critical path without redesigning Official Remote.

## Non-Goals

- Redesign the Official Remote information architecture.
- Build a separate mobile-specific frontend instead of reusing the host WebUI.
- Refactor all renderer bootstrapping or route loading behavior outside the mobile remote critical path.
- Rework device readiness semantics in the cloud service beyond preload/prewarm hooks already available.

## Root Cause Summary

### 1. Native launch overlay exits on navigation commit, not visual readiness

On iOS, `shouldShowLaunchOverlay` is derived from `isPageLoading && !hasCommittedNavigation`. The overlay disappears as soon as `didCommit` flips `hasCommittedNavigation` to `true`, but that only means the response started committing. It does not mean the page has rendered a meaningful frame yet.

### 2. Web bootstrap returns a blank root during auth bootstrap

The renderer root returns `null` before `useAuth().ready` becomes `true`. That creates a genuine blank WebView frame during `/api/auth/user` resolution.

### 3. Route prewarm misses the actual mobile remote path

The current prewarm set is desktop-centric and starts only after `status === 'authenticated'`. This leaves the mobile remote landing path colder than it should be.

## Evaluated Approaches

### Approach A: Pure visual patch

Keep current startup timing but extend the native spinner/brand screen.

Pros:

- smallest change
- fast to ship

Cons:

- hides but does not reduce the real gap
- still risks flashing from native overlay to blank WebView
- does not improve hosted route readiness

### Approach B: Web-only fix

Add a loader in the renderer root and leave native timing unchanged.

Pros:

- fixes the literal blank React root
- testable with existing Vitest coverage

Cons:

- still allows the native overlay to disappear too early
- leaves mobile shells inconsistent across platforms

### Approach C: Coordinated startup fix

Use a continuous native overlay, wait for stronger readiness before dismissing it, render a Web-side boot loader instead of blank content, and prewarm the correct mobile remote routes.

Pros:

- fixes the user-visible white screen
- reduces the real critical-path latency
- keeps scope tight and architecture-compatible

Cons:

- touches iOS, Android, and renderer startup code
- requires small new signaling between hosted WebUI and native shells

### Recommendation

Use **Approach C: Coordinated startup fix**.

## Final Design

### Native Shell Handoff

The native shell should own the first loading surface and keep it visible through two internal states:

1. `brand`
2. `connecting`

Behavior:

- entering a remote target starts in `brand`
- once navigation begins, transition to `connecting`
- dismiss only after the hosted WebUI reports a stronger readiness signal than `didCommit`

For this slice, the readiness contract should be:

- iOS: `didFinish` plus a hosted WebUI `app-ready` signal when available
- Android: `onPageFinished` plus the same hosted `app-ready` signal
- fallback: if the hosted signal never arrives, dismiss after navigation has finished and a short grace window passes

The connecting state should reuse desktop-specific loading copy when opening a desktop target and device-list copy when loading `/remote/devices`.

### Hosted WebUI Bootstrap

The renderer root must never return a blank screen during auth bootstrap.

Behavior:

- when `ready` is false, render a boot loader
- once auth resolves, hand off to the normal router

The loader does not need to become a brand-new subsystem. It can reuse `AppLoader` with an optional startup-friendly variant so the first Web frame looks intentional and visually compatible with the native overlay.

### Hosted Ready Signal

The hosted WebUI should expose a lightweight browser-safe ready signal that mobile shells can observe.

Behavior:

- once the renderer has mounted past the blank-root stage and can show a meaningful shell, publish a ready event
- native shells listen for that event and use it to finalize overlay dismissal

The signal must be a no-op in desktop Electron and browser-only contexts that do not need it.

### Route Prewarm

The renderer should warm the mobile remote critical path earlier and more accurately.

Required prewarm additions:

- `/remote/devices`
- the default post-auth hosted remote landing route
- the conversation route loader used when opening a remote device

The warm path should remain narrow: only first-frame dependencies belong here.

## Components and Responsibilities

### iOS native shell

- keep a continuous launch overlay until stronger readiness is observed
- distinguish list-loading vs desktop-loading copy
- listen for the hosted ready signal

### Android native shell

- add equivalent overlay behavior to match iOS
- avoid exposing a raw blank WebView during remote-device loading
- listen for the hosted ready signal

### Renderer bootstrap

- render a boot loader while auth is unresolved
- publish the hosted ready signal after the initial shell is mountable

### Router preload helpers

- expand warm-critical behavior to cover the mobile remote path

## Testing Strategy

### Renderer tests

- add a DOM test proving the root shows a loader while auth is unresolved
- add unit coverage proving remote-route prewarm includes the mobile critical path

### Native verification

- verify iOS build still succeeds
- verify Android compilation/resources remain valid
- manually confirm the overlay-to-content handoff no longer flashes white

## Risks

- if the hosted ready signal fires too early, the overlay can still disappear before meaningful content
- if it fires too late or not at all, the overlay can linger
- expanding route prewarm too broadly could increase startup cost elsewhere

## Risk Mitigation

- keep a fallback dismissal path after finished navigation
- scope the hosted ready signal to “initial shell visible” rather than “all data loaded”
- limit route warming strictly to the mobile remote critical path
