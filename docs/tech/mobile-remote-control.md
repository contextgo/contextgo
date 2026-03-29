# Mobile Remote-Control Architecture

This document defines the **long-lived product model** for mobile access.

Use this as the canonical reference when changing:

- mobile shell projects under `mobile-shell/`
- WebUI / browser runtime behavior
- remote access, login, and file upload flows
- Electron-only features that may need WebUI fallbacks

For current feasibility and validation status, see `docs/tech/mobile-shell-readiness.md`.
For command entry points and platform build commands, see `docs/tech/mobile-shell-cmd.md`.
For release policy, signing expectations, and platform distribution standards, see `docs/tech/release-distribution-standards.md`.

## Core Product Model

AionUi uses a **desktop-host + remote-client** architecture for mobile access.

- The **desktop app** remains the real execution host.
- The **mobile app** acts as a remote user client / control client.
- The mobile shell does **not** try to run the Electron main process locally.
- Mobile clients should connect to the existing AionUi WebUI / server runtime.

In practical terms:

- Windows / macOS keep using Electron as the full local host application.
- Android / iOS / HarmonyOS use native shell apps that embed the existing WebUI in a WebView.
- The repository stays unified, but packaging remains platform-specific.

## Stable Facts

The following assumptions should be treated as stable unless there is an explicit product decision to change them.

### 1. Desktop is the authority for execution

When a user connects remotely from mobile, the desktop-side AionUi instance remains responsible for:

- model calls
- agent execution
- workspace access
- document conversion / preview services
- long-running jobs
- any Electron-only or machine-local capability

Mobile should be designed as a remote interaction surface, not as a second full host.

### 2. Mobile is a use-side / control-side client

Mobile shells are intended for:

- checking session state
- reading and sending messages
- remote task control
- previewing supported content
- uploading phone-local files to the desktop host

Mobile should not assume it can fully replace desktop-local capabilities.

### 3. Mobile shells must connect to the real WebUI origin

The mobile shell should load the actual AionUi WebUI / server origin.

Reasons:

- `/login` and session cookies already exist
- `/api/*` endpoints already exist
- browser-side WebSocket transport already exists
- upload and auth flows already assume same-origin hosting

This means mobile should reuse the existing WebUI runtime instead of maintaining a disconnected static frontend fork.

### 4. FRP or reverse tunneling is a transport choice, not the product runtime

FRP is a valid way to expose a reachable desktop-hosted AionUi instance to external clients.

But the product logic still remains:

- AionUi desktop / WebUI provides the real application runtime
- FRP only exposes connectivity
- user identity, session, and authorization must still be handled by AionUi itself

Future networking changes should preserve this boundary.

### 5. Mobile local file upload is a required capability

When a mobile user picks a local file on the phone:

1. the native shell / WebView should allow local file selection
2. the file should be uploaded through the existing WebUI upload path
3. the desktop host should persist the uploaded file into workspace uploads or temp storage
4. all later processing should happen from the desktop-hosted file

This means the file **originates on mobile**, but the file **executes / persists / is processed on the desktop host**.

### 6. Electron-only features must degrade or be marked desktop-only

If a feature depends on Electron-specific bridges, it must do one of the following:

- provide a browser/WebUI-safe fallback
- move the capability behind the desktop host and expose it through WebUI/server APIs
- stay explicitly desktop-only

Do not assume a mobile shell can access Electron-only APIs directly.

### 7. Shared code should live in the WebUI path when possible

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

### 8. Native shell apps are packaging layers, not separate products

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
- the shell model as a full replacement for the desktop host

## Design Guardrails For Future Iteration

When adding or changing a feature, use this decision model:

### If the feature is mostly UI / interaction logic

Prefer implementing it in the shared renderer / WebUI path so desktop and mobile remote clients both benefit.

### If the feature requires machine-local capability

Keep execution on the desktop host and expose the result through an existing or new WebUI/server API.

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
- or redesign it so the desktop host performs the privileged action

## Relevant Implementation References

- `docs/tech/architecture.md`
- `docs/tech/mobile-shell-readiness.md`
- `mobile-shell/README.md`
- `src/renderer/services/FileService.ts`
- `src/process/webserver/routes/apiRoutes.ts`
- `src/renderer/components/media/FileAttachButton.tsx`
