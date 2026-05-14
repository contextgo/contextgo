# Mobile Remote-Control Architecture

This document defines the **long-lived remote-access product model** for ContextGo.

It is not limited to phones. The canonical model is now:

- a machine-local **Host Runtime** that remains the execution authority
- a cloud **Official Remote** control plane at `remote.contextgo.io`
- multiple client shells, including desktop and mobile

Mobile remains an important client type, but it is no longer the only remote-access frame of reference.

Use this as the canonical reference when changing:

- mobile shell projects under `mobile-shell/`
- WebUI / browser runtime behavior
- remote access, login, and file upload flows
- Electron-only features that may need WebUI fallbacks

For current feasibility and validation status, see `docs/tech/mobile-shell-readiness.md`.
For command entry points and platform build commands, see `docs/tech/mobile-shell-cmd.md`.
For release policy, signing expectations, and platform distribution standards, see `docs/tech/release-distribution-standards.md`.

## Core Product Model

ContextGo uses a **Host Runtime + Official Remote + client shell** architecture.

- The **Host Runtime** is the real execution authority.
- The **Official Remote** cloud path provides sign-in, device discovery, relay orchestration, and device opening.
- The **desktop shell** can either host a local runtime or act as a client to another host.
- The **mobile shell** acts as a remote user client / control client.
- Client shells do **not** try to run the Electron main process or agent runtime locally.
- Remote clients should connect to the existing ContextGo WebUI / server runtime exposed by the target host.

In practical terms:

- macOS / Windows desktop builds may run as `GUI Host` or as a remote `Desktop Client`.
- Linux should be treated as a first-class `Host Runtime` platform, with or without a desktop GUI.
- Android / iOS / HarmonyOS use native shells that embed the existing remote UI flow in a WebView.
- The repository stays unified, but packaging remains platform-specific.

## Stable Facts

The following assumptions should be treated as stable unless there is an explicit product decision to change them.

### 1. Host Runtime is the authority for execution

When a user connects remotely from desktop or mobile, the target ContextGo host remains responsible for:

- model calls
- agent execution
- workspace access
- document conversion / preview services
- long-running jobs
- local CLI / tool invocation, including Codex and Claude Code style runtimes
- any Electron-only or machine-local capability

Clients should be designed as remote interaction surfaces, not as second full hosts.

### 2. Client roles must stay separate from host roles

Mobile shells are intended for:

- checking session state
- reading and sending messages
- remote task control
- previewing supported content
- uploading phone-local files to the host runtime

Desktop shells must also be allowed to act as remote clients:

- opening another device from the same cloud account
- switching between local-host and remote-host views
- using the same Official Remote device list entry flow as mobile

Desktop and mobile clients should share the same top-level mental model:

- sign in to one cloud account
- land on the Official Remote device list
- open the selected host

Clients should not assume they can fully replace host-local capabilities.

### 3. Client shells must connect to the real host WebUI origin

The remote shell should load the actual ContextGo host WebUI / server origin.

Reasons:

- `/login` and session cookies already exist
- `/api/*` endpoints already exist
- browser-side WebSocket transport already exists
- upload and auth flows already assume same-origin hosting
  This means remote clients should reuse the existing host-side WebUI runtime instead of maintaining a disconnected static frontend fork.

### 4. Remote transport does not replace the product runtime

Official Remote should use a host-initiated cloud relay, not a tunnel product as a first-class product path.

Self-hosted users can still choose their own reverse proxy, VPN, or tunnel when exposing a host-hosted ContextGo instance to external clients, but that should no longer be the default user-facing product path.

For the official cloud path, `apps/cloud` remains a control plane: it owns sign-in, device discovery, and relay orchestration. It should not become a second hosted frontend that diverges from the host runtime. When a browser opens a remote device, the expected target is still the host-hosted WebUI for that device.

But the product logic still remains:

- ContextGo host / WebUI provides the real application runtime
- the transport layer only exposes connectivity
- user identity, session, and authorization must still be handled by ContextGo itself

Future networking changes should preserve this boundary.

### 5. Mobile local file upload is a required capability

When a mobile user picks a local file on the phone:

1. the native shell / WebView should allow local file selection
2. the file should be uploaded through the existing WebUI upload path
3. the host runtime should persist the uploaded file into workspace uploads or temp storage
4. all later processing should happen from the host-side file

This means the file **originates on mobile**, but the file **executes / persists / is processed on the host runtime**.

### 6. Electron-only features must degrade or be marked desktop-only

If a feature depends on Electron-specific bridges, it must do one of the following:

- provide a browser/WebUI-safe fallback
- move the capability behind the host runtime and expose it through WebUI/server APIs
- stay explicitly desktop-only

Do not assume a mobile shell can access Electron-only APIs directly.

### 7. Official Remote is the default UI path

For normal product UX:

- all user-facing remote links should route through `remote.contextgo.io`
- users should sign in with one ContextGo cloud account and see one device list
- desktop and mobile shells should both open remote hosts from that same Official Remote entry flow
- desktop settings should not expose local/LAN/self-hosted network setup as a first-class product path

This rule does **not** remove the host-side WebUI runtime. It removes the expectation that ordinary users should self-configure network exposure from desktop settings.

### 8. Shared code should live in the WebUI path when possible

For long-term maintainability, shared behavior should prefer:

- `src/renderer/`
- `src/common/`
- WebUI / browser-safe services and transport paths

This is the code that can benefit:

- Electron desktop
- browser WebUI
- Android shell
- iOS shell
- HarmonyOS shell

### 9. Native shell apps are packaging layers, not separate products

The Android / iOS / HarmonyOS shell directories exist to package and host the shared WebUI product.

They may add platform-specific items such as:

- app icons
- bundle identifiers / package names
- permissions
- file picker bridging
- signing
- store packaging metadata

But they should not diverge into separate business logic products unless there is an explicit product decision.

## Repository Positioning

The repository currently contains two mobile tracks:

- `mobile/` — an existing Expo-based native client
- `mobile-shell/` — native shell projects for WebView-based remote access

For the remote-control architecture described here, `mobile-shell/` is the relevant path.

Future contributors should not confuse:

- the Expo client as a direct substitute for the shell model
- a remote shell as a full replacement for the host runtime

## Design Guardrails For Future Iteration

When adding or changing a feature, use this decision model:

### If the feature is mostly UI / interaction logic

Prefer implementing it in the shared renderer / WebUI path so desktop and mobile remote clients both benefit.

### If the feature requires machine-local capability

Keep execution on the host runtime and expose the result through an existing or new WebUI/server API.

Examples:

- document conversion
- local workspace reads
- agent execution
- host-local preview tooling

### If the feature depends on Electron-only behavior

Do not silently assume it works on mobile.

Instead:

- add a browser fallback
- or mark the feature desktop-only
- or redesign it so the host runtime performs the privileged action

## Relevant Implementation References

- `docs/tech/architecture.md`
- `docs/tech/mobile-shell-readiness.md`
- `mobile-shell/README.md`
- `src/renderer/services/FileService.ts`
- `src/process/webserver/routes/apiRoutes.ts`
- `src/renderer/components/media/FileAttachButton.tsx`
