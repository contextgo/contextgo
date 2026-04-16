# Host Runtime #112 Closure Design

## Goal

Close the remaining semantic gap in `#112` by removing the last active code-path leaks that still describe host runtime lifecycle and local host access in legacy `WebUI / host browser entry` terms.

## Current State

The major architecture work behind `#112` is already merged:

- host runtime lifecycle ownership exists in `HostRuntimeService`
- Official Remote readiness is modeled through shared `hostRuntime` status
- `/settings/webui` already redirects away from a first-class settings route
- Official Remote is already the dominant user-facing remote path

What still leaks the old product model is the remaining active implementation vocabulary:

- startup helpers still use `hostBrowserEntry` naming
- persisted host-local access preferences still use `webui.desktop.*` keys
- the service/bridge layer still exposes a `WebuiService` class even though it already delegates to host runtime ownership

These leaks keep the codebase in an awkward half-transition state and make `#112` feel unfinished even though the underlying architecture has largely landed.

## Chosen Closure Slice

This implementation deliberately stays narrow:

1. Rename startup helpers from `hostBrowserEntryStartup` semantics to `hostRuntimeStartup`.
2. Migrate active host-local-access preference keys from `webui.desktop.*` to `host.runtime.localAccess.*`.
3. Keep read compatibility for old keys so existing installs do not break.
4. Reframe the process service ownership language from `WebuiService` toward host-runtime access semantics while preserving the external IPC namespace for compatibility.

## Non-Goals

- Do not rename the public IPC namespace from `webui` in this slice.
- Do not redesign Official Remote flows again.
- Do not rebuild headless-host deployment UX in this slice.
- Do not reopen removed settings routes or product navigation.

## Why This Is Enough To Close #112

After this slice lands:

- runtime lifecycle ownership is no longer described by active startup helpers in old browser-entry terms
- persisted local host access is stored as host-runtime state rather than desktop-WebUI state
- remaining WebUI references are compatibility/protocol surfaces, not architecture owners

At that point, `#112` stops being an umbrella with active architecture debt and becomes a completed host-runtime model transition, with later work continuing under sibling or downstream issues instead.
