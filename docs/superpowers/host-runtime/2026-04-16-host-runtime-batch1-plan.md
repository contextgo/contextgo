# Host Runtime Batch 1 Plan

## Scope

This batch implements the next concrete tranche under the Host Runtime mainline:

- `#114` auth hierarchy cleanup
- `#115` Official Remote-first remote-entry surface cleanup
- `#116` formal host-form expression for GUI vs headless/Linux host

## Goals

1. Make auth source semantics explicit enough for renderer and server code to distinguish:
   - `cloud`
   - `host-session`
   - `breakglass-local`
2. Keep Official Remote as the primary user-facing remote path and keep legacy `/settings/webui` behavior downgraded to system/runtime management rather than a normal entry path.
3. Stop hardcoding host runtime mode to `gui-host`; derive a formal host mode and supported-client surface from actual runtime context.

## Non-goals

- Full headless bootstrap UX redesign
- Full rewrite of WebuiModalContent into a new page architecture
- Full host auth protocol redesign beyond source semantics and breakglass downgrade

## Main code areas

- `src/process/webserver/routes/authRoutes.ts`
- `src/process/webserver/auth/middleware/AuthMiddleware.ts`
- `src/renderer/hooks/context/AuthContext.tsx`
- `src/renderer/pages/login/index.tsx`
- `src/common/types/cloud.ts`
- `src/process/services/cloud/CloudService.ts`
- `src/process/services/host/`
- `src/renderer/components/settings/SettingsModal/contents/WebuiModalContent.tsx`
- `src/renderer/pages/RemoteDevicesPage.tsx`
- `src/common/adapter/browserAuthRedirect.ts`
- related tests under `tests/unit/process/cloud/`, `tests/unit/renderer/settings/`, `tests/unit/common/`, and `tests/unit/renderer/layout/`

## Implementation slices

### Slice 1: Auth source hierarchy

- Expand auth source vocabulary from `local/cloud` to a clearer layered model.
- Keep cloud-session as primary remote path.
- Mark local admin login as breakglass/local recovery rather than default product login.
- Ensure `/api/auth/user` and renderer auth state preserve the new auth source.

### Slice 2: Official Remote-first entry surface

- Remove remaining user-facing wording that teaches local/LAN/self-hosted as a primary path.
- Keep `/settings/webui` as a compatibility redirect only.
- Keep Remote Devices / Official Remote pages and settings copy consistent with the Host Runtime model.

### Slice 3: Formal host forms

- Derive `hostRuntime.mode` instead of hardcoding `gui-host`.
- Distinguish at least:
  - `gui-host`
  - `headless-host`
- Reflect platform and supported clients in a way that matches current runtime state and future Linux/headless productization.

## Verification target

- `bunx tsc --noEmit`
- focused auth/runtime tests
- focused remote-entry/settings tests
- focused host-runtime tests
