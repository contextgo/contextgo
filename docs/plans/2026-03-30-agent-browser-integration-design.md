# Design: Agent Browser Integration

**Date:** 2026-03-30
**Status:** Proposed

## Background

The requested product direction is:

- show browser activity in the right-side in-app panel
- let the agent operate a browser in a visible, user-auditable way
- support persistent browser identity such as cookies, login state, and profile-like state
- when appropriate, take over an already-running user browser session instead of forcing a fresh login

ContextGo already has several relevant building blocks:

- the conversation page already owns a right-side preview panel in `src/renderer/pages/conversation/Preview/`
- desktop remains the real execution host per `docs/tech/mobile-remote-control.md`
- the main Electron window already enables `webviewTag` for HTML preview in `src/index.ts`
- the repo already documents CDP-based debugging and MCP-based browser tooling in `docs/cdp.md`

However, these building blocks are not yet the same thing as a first-class agent browser product.

There are three materially different capabilities that must not be conflated:

1. an embedded browser surface inside the app
2. an isolated agent-controlled browser session with its own persistent state
3. takeover of the user's already-running browser session and default profile state

The implementation and security model are different for each one.

## Why This Needs A Dedicated Design

The naive implementation path would be:

- add a browser panel on the right
- attach to Chrome via a remote debugging port
- reuse the user's real browser profile

That path is no longer a safe default.

Chrome announced on **March 17, 2025** that `--remote-debugging-port` and
`--remote-debugging-pipe` are no longer respected when targeting the **default Chrome data
directory**, and now require `--user-data-dir` pointing at a non-standard directory. This makes
"directly attach to the user's default Chrome profile over CDP" a weak foundation for the main
product path.

At the same time, the ecosystem is clearly moving toward two parallel models:

- managed or isolated agent browser sessions such as `agent-browser`
- explicit extension-assisted connection to an existing user browser session

That means ContextGo should support both, but in different phases and with different trust
boundaries.

## Product Goals

Add a desktop-hosted agent browser capability that:

- renders browser activity inside the existing conversation shell
- keeps browser operations visible to the user
- supports persistent login state for repeated tasks
- can later bridge into a user's existing browser session with explicit consent
- fits the current desktop-host + remote-client product model

## Non-Goals

This design should not assume:

- browser takeover works in WebUI-only or mobile-only runtimes
- the app should silently control the user's default browser profile in the background
- the renderer should directly own privileged browser automation logic
- phase 1 needs full plugin marketplace support
- phase 1 needs cross-platform parity outside desktop Electron

## Current Constraints In This Repository

### 1. Desktop remains the execution authority

Per `docs/tech/mobile-remote-control.md`, browser automation that relies on host-local capability
should remain on the desktop host. Mobile and remote clients should act as control surfaces, not as
the actual browser host.

### 2. The right-side panel already exists conceptually

`src/renderer/pages/conversation/components/ChatLayout/index.tsx` already reserves the right side
for `PreviewPanel`. This is the correct product surface for visible browser activity.

### 3. New embedded browser chrome should not be built on `BrowserView`

Electron officially deprecated `BrowserView` and replaced it with `WebContentsView`. Any new
desktop-side embedded browser container should use `WebContentsView` in the main process instead of
expanding old `BrowserView`-style patterns.

### 4. Existing CDP support is useful but not sufficient

`docs/cdp.md` documents CDP mainly for debugging and MCP tooling. That is useful for agent browser
experiments, but it does not itself solve:

- browser identity persistence
- permission mediation
- explicit takeover consent
- active user-browser handoff UX

## Capability Split

### A. Embedded Browser Surface

This means the app can visibly render a browser page in the right-side area.

Recommended implementation:

- desktop-only host surface
- main-process-owned `WebContentsView`
- renderer receives state, navigation events, screenshots, and controls through IPC

This is a UI container problem, not a profile or identity problem.

### B. Isolated Agent Browser Session

This means the agent operates a dedicated browser session that is controlled by ContextGo, with
state persisted in an app-managed profile directory.

This is the safest first shipping mode because:

- the browser state is explicit and isolated
- the user can reason about which session the agent is operating
- the session can be reset, exported, or deleted without touching the user's default browser

This is where `agent-browser` is most useful.

### C. Existing Browser Takeover

This means the agent continues in the user's currently running browser context and uses the user's
existing cookies, logins, and active pages.

This should be treated as a higher-trust mode:

- explicit opt-in only
- clear visual indicator
- narrow session selection
- domain-level permission gating
- easy kill switch

This is best implemented through an extension bridge, not by normalizing "attach to default Chrome
profile over CDP" as the baseline architecture.

## External Options Analysis

### Option 1: `agent-browser` as the primary runtime

What it is:

- a browser automation CLI for AI agents
- supports isolated sessions and persistent profiles
- can connect to a browser via CDP
- can also target cloud browser providers

Strengths:

- good fit for a dedicated agent browser runtime
- profile persistence is explicit and isolated
- easy to treat as a backend service or spawned runtime
- future-compatible with cloud browser providers

Weaknesses:

- not inherently equal to "take over the user's real browser"
- embedded viewing still needs ContextGo-side UI and lifecycle management
- direct CDP attach to the user's default browser profile is no longer a sound default path

Recommendation:

- use as a candidate backend for **isolated agent browser sessions**
- do not define the overall product architecture around its CDP attach mode alone

### Option 2: raw CDP attach to local Chrome

What it is:

- launch or connect to a Chrome instance through a remote debugging port

Strengths:

- good for local debugging
- low implementation overhead for prototypes
- already aligns with current repo documentation

Weaknesses:

- poor fit for default-profile takeover after Chrome's 2025 security changes
- weak permission mediation
- weak UX around user consent and session selection
- easy to become invisible background control if not carefully constrained

Recommendation:

- keep as a development and fallback path
- do not treat as the main product solution for user-browser takeover

### Option 3: browser extension bridge

What it is:

- a browser extension that can explicitly expose active tabs, session choice, and permission
  mediation
- optionally communicates with the desktop host via native messaging

Strengths:

- closest match to "agent can directly operate the user's browser like a human"
- aligns with current Playwright MCP bridge direction
- can leverage existing browser session state with explicit user consent
- supports better trust UX than hidden CDP port attachment

Weaknesses:

- requires extension installation and browser-specific packaging
- needs native messaging or another secure bridge
- more product and review surface than a pure local prototype

Recommendation:

- use as the **phase 2** path for real browser takeover

### Option 4: renderer-only webview or iframe approach

What it is:

- try to host browser behavior directly inside the renderer through iframe or webview-like hacks

Recommendation:

- reject as the main architecture

Reasons:

- wrong trust boundary for privileged automation
- hard to manage sessions and permissions cleanly
- poor fit with the repo's main/renderer separation rules

## Recommended Architecture

### Summary

Ship this in two distinct product modes under one browser capability umbrella:

1. `managed` mode
2. `takeover` mode

`managed` is the first release path.

`takeover` is an explicitly elevated mode built on a browser extension bridge.

## Mode 1: Managed Browser Session

Behavior:

- ContextGo starts and owns an agent browser session
- the session persists in an app-managed profile directory
- the right-side browser pane shows the live session
- the agent operates that session visibly

Recommended stack:

- desktop host service spawns `agent-browser` or a similar runtime
- app-managed session/profile directory under ContextGo-owned storage
- `WebContentsView` hosts the visible page surface
- renderer panel shows navigation state, action log, permissions, and stop/resume controls

Why this should be first:

- no dependency on the user's own browser install state
- no dependence on default-profile CDP access
- simpler security review
- useful for many automation workflows immediately

## Mode 2: Takeover Browser Session

Behavior:

- the user chooses an existing browser tab or active session
- a browser extension explicitly grants access to that session
- ContextGo receives a bridge connection and mirrors the activity inside the app
- the agent can continue where the user already logged in

Recommended stack:

- browser extension for tab/session discovery and opt-in grant
- native messaging host in ContextGo desktop for trusted local communication
- browser bridge service in main process
- renderer-side takeover indicator, active-domain badge, and hard stop control

Why extension-first is the right path:

- explicit user consent
- clearer browser/session selection
- less reliance on unstable or increasingly restricted default-profile debugging paths
- better opportunity to show ongoing control state inside both browser and app

## Proposed Repository Shape

This PR does not implement the feature yet, but the likely code placement should be:

- `src/common/types/browserSession.ts`
  - shared session state, mode, permission, and event types
- `src/process/services/browser/BrowserSessionService.ts`
  - lifecycle for managed sessions
- `src/process/services/browser/BrowserTakeoverService.ts`
  - extension/native-messaging bridge and elevated consent flow
- `src/process/bridge/browserSessionBridge.ts`
  - renderer IPC bridge
- `src/renderer/pages/conversation/BrowserSession/`
  - right-side browser session panel and controls
- `src/renderer/pages/conversation/Preview/`
  - minimal integration point if browser becomes one preview-like surface, but not the owner of
    desktop browser lifecycle

The browser host lifecycle must stay in `src/process/`, not in the renderer.

## Why The Right Pane Should Not Just Reuse Preview Internals

The existing preview module is a good UI anchor, but not a sufficient ownership boundary.

Preview is currently optimized for:

- file and document viewing
- lightweight tab state
- renderer-owned rendering paths

Agent browser needs additional concepts:

- session lifecycle
- tab ownership and selection
- navigation controls
- permission prompts
- takeover consent
- persistent profile state
- stop, pause, and detach actions

So the right approach is:

- reuse the right-side product slot and interaction vocabulary
- add a dedicated browser session module instead of overloading file preview abstractions

## Security Model

### Baseline rules

- browser automation is desktop-hosted only
- browser takeover is opt-in only
- no silent background attach to the user's default browser profile
- every active controlled session must be visible in the app
- the user must have an immediate stop control

### Managed mode rules

- use an app-managed non-default profile directory
- isolate sessions by workspace, task, or explicit session ID
- support wipe/reset of persisted browser state

### Takeover mode rules

- require extension installation
- require explicit session or tab selection
- require per-domain or per-session consent
- surface a visible "agent connected" indicator
- allow immediate revoke from either the app or extension side

## Remote / Mobile Behavior

This feature should follow the existing product model:

- desktop host runs the actual browser session
- WebUI/mobile clients may observe and control that session remotely
- WebUI/mobile clients should not try to host the privileged browser locally as the default path

This keeps the architecture aligned with `docs/tech/mobile-remote-control.md`.

## Delivery Plan

### Phase 0: Research and contract definition

- finalize session model
- finalize event model
- finalize security and consent model
- decide whether `agent-browser` is the initial managed runtime

### Phase 1: Managed browser MVP

- add desktop-hosted browser session service
- add right-side browser session panel
- support open, navigate, click, fill, snapshot, screenshot
- support app-managed persistent browser profiles
- support remote observation from WebUI/mobile

### Phase 2: Takeover bridge MVP

- ship browser extension prototype
- ship native messaging host integration
- support attach to selected active browser session
- expose explicit takeover consent and stop controls

### Phase 3: hardening and distribution

- permission persistence policy
- extension packaging and update path
- telemetry and audit logs
- optional cloud browser provider support for managed mode

## Recommended Decision

Adopt this as the product direction:

- **first-class right-side browser pane on desktop**
- **managed browser session as phase 1**
- **extension-assisted browser takeover as phase 2**

Do not define the first implementation around "reuse the user's default Chrome profile over CDP".

That can remain an internal experiment or fallback path, but it should not be the main architecture.

## External References

- `agent-browser` README:
  https://github.com/vercel-labs/agent-browser/blob/main/README.md
- Playwright MCP extension bridge:
  https://github.com/microsoft/playwright-mcp/blob/main/packages/extension/README.md
- Chrome remote debugging security change, published March 17, 2025:
  https://developer.chrome.com/blog/remote-debugging-port
- Chrome DevTools MCP existing-session announcement, published December 11, 2025:
  https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session
- Chrome extension native messaging:
  https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
- Electron `BrowserView` deprecation:
  https://www.electronjs.org/docs/latest/api/browser-view
- Electron `WebContentsView`:
  https://www.electronjs.org/docs/latest/api/web-contents-view
