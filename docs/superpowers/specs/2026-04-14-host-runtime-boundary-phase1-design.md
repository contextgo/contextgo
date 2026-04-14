# Host Runtime Boundary Phase 1 Design

## Summary

This design covers Phase 1 of `#144`:

- lock the host boundary
- stop treating desktop WebUI settings as the lifecycle owner of the host browser entry
- preserve the host-side browser origin as an internal runtime surface
- remove local/LAN/self-hosted browser access from the user-facing product model

The product direction is now explicit:

- `Desktop Shell` is a client shell
- `Current Device Host` is the local execution authority when present
- `Remote Device Host` is another device's execution authority
- `Host Browser Entry` is the host-side internal browser origin used by the shell and by Official Remote
- `Official Remote` is the only user-facing remote entry path

This is a client/server split, not a “force everything through cloud relay” redesign.
When the desktop shell opens the current device host, it should still use a local fast path.

## Problem

Current implementation still mixes three different concerns:

1. local desktop browser-access preferences
2. host browser-entry runtime lifecycle
3. Official Remote readiness

The coupling is visible in these places:

- `src/process/utils/webuiConfig.ts`
  - owns startup, reuse, and release of the desktop browser entry
  - still names this runtime as `desktop WebUI`
- `src/process/services/cloud/CloudService.ts`
  - ensures Official Remote readiness through `ensureDesktopWebUIForOfficialRemote()`
- `src/process/services/cloud/OfficialRemoteTunnelService.ts`
  - falls back to `webui.desktop.enabled` to infer browser-entry availability
- `src/process/services/cloud/OfficialRemoteBrowserRelay.ts`
  - falls back to `webui.desktop.port`
- `src/renderer/components/settings/SettingsModal/contents/WebuiModalContent.tsx`
  - still presents local/LAN/self-hosted browser access as a user-facing product capability

That is the wrong ownership model for the product boundary now in force.

## Goals

- establish one runtime owner for the host browser entry
- separate runtime lifecycle from desktop local-access preferences
- let Official Remote depend on host-browser-entry availability instead of “desktop WebUI enabled”
- keep the local fast path for current-device access
- remove user-facing local/LAN/self-hosted browser-entry product surface

## Non-Goals

- do not redesign Official Remote authentication in this phase
- do not redesign device-list UX in this phase
- do not formalize Linux/headless host mode in this phase
- do not migrate all config keys in this phase
- do not change mobile shell architecture in this phase

## Target Model

### 1. Runtime roles

- `Desktop Shell`
  - a client shell
  - may connect to the current device host or to a remote device host
- `Current Device Host`
  - the local execution authority on this machine
- `Remote Device Host`
  - a different device's execution authority
- `Host Browser Entry`
  - the internal browser origin that exposes the host-side renderer/API/WebSocket surface
- `Official Remote`
  - the cloud control plane that discovers devices and opens the selected host

### 2. Access paths

- current-device access
  - desktop shell opens the current device host through local loopback access
  - no cloud relay in the normal local path
- remote-device access
  - desktop/mobile shell opens the target host through Official Remote
  - once opened, the UI source of truth comes from the target host

### 3. Ownership

The host browser entry lifecycle must be owned by a dedicated process service.

That service must answer:

- is the host browser entry running
- what base URL should internal callers use
- what demand sources currently require it
- should it be started, reused, or released

Desktop settings UI must not own any of these decisions.

## Proposed Architecture

### New service: `HostBrowserEntryService`

Create a process service at:

- `src/process/services/host/HostBrowserEntryService.ts`

Responsibilities:

- own the host browser-entry runtime lifecycle
- start/reuse/stop the underlying browser-entry server
- expose runtime status
- provide the internal local base URL for relay/browser callers
- track demand from callers using a narrow demand model

Initial demand kinds:

- `local-client`
- `official-remote`

The service is the only place that may decide whether the entry should remain alive.

### Existing modules after refactor

- `src/process/utils/webuiConfig.ts`
  - becomes a compatibility/config helper, not the runtime owner
- `src/process/bridge/webuiBridge.ts`
  - becomes a bridge facade for status and legacy diagnostics
- `src/process/services/cloud/CloudService.ts`
  - requests host-browser-entry readiness through the new service
- `src/process/services/cloud/OfficialRemoteTunnelService.ts`
  - checks runtime availability through the new service
- `src/process/services/cloud/OfficialRemoteBrowserRelay.ts`
  - resolves its local target URL through the new service

## Config Semantics In Phase 1

Keep existing persisted keys for compatibility:

- `webui.desktop.enabled`
- `webui.desktop.allowRemote`
- `webui.desktop.port`

But reinterpret them more narrowly:

- `webui.desktop.port`
  - preferred local port for the internal host browser entry
- `webui.desktop.allowRemote`
  - legacy compatibility flag only
  - not a user-facing product capability
- `webui.desktop.enabled`
  - legacy compatibility flag only
  - not the lifecycle owner of the host browser entry

The new runtime owner should no longer infer Official Remote readiness from `webui.desktop.enabled`.

## Renderer Surface Changes

Phase 1 should remove local/LAN/self-hosted browser access from the normal product surface.

Practical effect:

- `WebuiModalContent` is no longer a first-class product panel
- “Allow LAN / Self-Hosted Access” should not be shown to normal users
- settings should not suggest copying localhost/LAN URLs as the main product path

If needed for transition safety, the panel may remain behind a dev-only or internal-only gate.

## Runtime Rules

### Rule 1: Current device access is fast-path local

When the desktop shell opens the current device host:

- use local loopback access
- do not route the normal local path through Official Remote relay

### Rule 2: Official Remote is the only user-facing remote entry

When the user opens another device:

- they do so from Official Remote device flow
- the target host becomes the UI source of truth

### Rule 3: Browser-entry lifecycle is demand-driven

The host browser entry stays alive when at least one demand source requires it.

Initial demand sources:

- local desktop client
- Official Remote

### Rule 4: Settings UI is not the owner

Desktop settings may show status or diagnostics, but may not own start/stop/reuse decisions.

## Implementation Plan Shape

Phase 1 should be implemented in this order:

1. add `HostBrowserEntryService`
2. move lifecycle ownership there
3. refactor cloud/relay callers to use the new service
4. downgrade or hide user-facing WebUI settings entry

## Acceptance Criteria

- desktop shell can still open the current device host through a local fast path
- Official Remote no longer depends on “desktop WebUI enabled” semantics
- `CloudService` does not directly own desktop-WebUI lifecycle semantics
- relay/browser services resolve browser-entry availability through the new host service
- user-facing local/LAN/self-hosted browser-entry controls are removed from the normal product surface
- existing host-side browser origin remains available as an internal runtime surface

## Risks

### Legacy naming drift

Many modules still use `webui` naming for historical reasons.
Phase 1 should fix ownership first and defer broad renaming where possible.

### Transition UI drift

If renderer settings are only partially hidden, users may still infer that local browser access is a supported product path.
The user-facing entry should be clearly downgraded in the same phase.

### Baseline instability

The current worktree baseline is already red in several unrelated test areas.
Phase 1 verification should focus on targeted tests plus typecheck, while documenting unrelated baseline failures.
