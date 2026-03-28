# Mobile Shell Readiness

## Summary

Current AionUi is **well prepared for remote mobile access**, but **not ready for full mobile parity with the Electron desktop app**.

Canonical long-lived product model:

- `docs/tech/mobile-remote-control.md`

Canonical command entry points:

- `docs/tech/mobile-shell-cmd.md`

Canonical release and distribution policy:

- `docs/tech/release-distribution-standards.md`

Recommended packaging strategy:

- Treat mobile as a **native shell + remote WebUI** product.
- Reuse the existing WebUI, login flow, and WebSocket bridge.
- Keep shell projects in the same repository, but separate from the existing Expo native client.
- Do **not** treat the shell as a standalone replacement for the desktop main process.
- Treat desktop as the real execution host when mobile is used as a remote client.

Readiness score:

- Mobile WebUI / remote-control shell: **7.5 / 10**
- Full standalone mobile app parity with Electron desktop: **3 / 10**

## What Is Already Reusable

### 1. Browser/WebUI transport already exists

The architecture already supports browser clients, not only Electron windows.

- [`architecture.md`](architecture.md) defines a WebUI server built on Express + WebSocket.
- [`browser.ts`](../../src/common/adapter/browser.ts) switches between Electron IPC and browser WebSocket automatically.
- [`main.tsx`](../../src/renderer/main.tsx) already supports a non-Electron runtime.

This is the main reason a native mobile shell is realistic for this repository.

### 2. Renderer already contains mobile-oriented UI behavior

The renderer is not desktop-only.

- [`Layout.tsx`](../../src/renderer/components/layout/Layout.tsx) detects mobile viewports and coarse/touch input.
- [`base.css`](../../src/renderer/styles/themes/base.css) includes safe-area helpers for notched mobile devices.
- [`usePwaMode.ts`](../../src/renderer/hooks/system/usePwaMode.ts) explicitly detects PWA standalone mode.
- [`PwaPullToRefresh.tsx`](../../src/renderer/components/layout/PwaPullToRefresh.tsx) adds iOS pull-to-refresh handling for standalone mobile usage.
- [`FileAttachButton.tsx`](../../src/renderer/components/media/FileAttachButton.tsx) already distinguishes Electron desktop from WebUI browser/mobile file picking.
- [`FileService.ts`](../../src/renderer/services/FileService.ts) already uploads browser/mobile-selected files through HTTP multipart in WebUI mode.

### 3. A separate mobile client already exists

This repository already contains an Expo-based native client under [`mobile/package.json`](../../mobile/package.json).

- [`mobile/package.json`](../../mobile/package.json) exposes iOS / Android build scripts.
- [`mobile/app.config.ts`](../../mobile/app.config.ts) already defines iOS and Android package metadata.
- [`mobile/app/connect.tsx`](../../mobile/app/connect.tsx) already parses `/qr-login` URLs and connects to an AionUi server.

That existing app is a **different product model** from the shell approach. It talks to the backend over direct API/WebSocket, while the new shell packages the existing WebUI itself.

## What Prevents Full Mobile Parity

### 1. Server mode intentionally drops Electron-only bridges

Mobile shells can only reuse what the WebUI / server runtime exposes.

- [`architecture.md`](architecture.md) documents that pure server mode drops Electron-only bridges such as `fsBridge`, `mcpBridge`, `dialogBridge`, `shellBridge`, `windowControlsBridge`, `updateBridge`, and `notificationBridge`.

That means a mobile shell can act as a strong remote client, but not as a full replacement for the desktop host.

### 2. Some preview surfaces still assume Electron hosts

Before this worktree, several preview paths still relied on Electron-specific `<webview>` behavior.

- [`WebviewHost.tsx`](../../src/renderer/components/media/WebviewHost.tsx)
- [`PDFViewer.tsx`](../../src/renderer/pages/conversation/Preview/components/viewers/PDFViewer.tsx)

These areas need browser fallbacks for native mobile shells.

### 3. Browser runtime assumes same-origin hosting

The browser runtime expects the frontend and backend to live on the same origin.

- [`browser.ts`](../../src/common/adapter/browser.ts) derives the WebSocket endpoint from `window.location`.
- [`AuthContext.tsx`](../../src/renderer/hooks/context/AuthContext.tsx) calls `/api/auth/user` and posts login to `/login`.
- [`FileService.ts`](../../src/renderer/services/FileService.ts) uploads to `/api/upload`.

Because of that, the shell should load the real AionUi WebUI origin rather than a disconnected static bundle.

## Practical Assessment

Good candidates for mobile shell reuse:

- Login and authenticated browsing through WebUI
- Conversation browsing and chat interaction
- Mobile layout, safe areas, and responsive navigation
- Browser-side uploads from the local device
- Remote administration scenarios where the desktop / server host keeps the heavy runtime

Weak or incomplete areas:

- Desktop-grade preview flows backed by Electron webview
- Any workflow requiring direct local OS integration from the mobile device
- Feature parity with Electron-only bridges
- A fully offline or standalone mobile deployment of the complete AionUi product

## Repository Recommendation

Use a **single Git repository** with two separate mobile tracks:

- `mobile/` keeps the existing Expo native client.
- `mobile-shell/` contains the new Android / iOS / HarmonyOS shell apps.

This is the best maintenance tradeoff because:

- the shell model and the Expo model are different runtimes
- HarmonyOS does not fit naturally into the Expo pipeline
- one repository still keeps shared docs, scripts, and product evolution together

## Recommendation

The right near-term delivery model is:

1. Run AionUi as a reachable WebUI / server host.
2. Package native Android, iOS, and HarmonyOS shells under `mobile-shell/`.
3. Let the shells accept either:
   - a base WebUI URL such as `http://host:port`
   - or a `/qr-login?token=...` URL generated by AionUi
4. Persist the last connected endpoint locally and reopen it directly in WebView on the next launch.

This achieves a publishable mobile client path without pretending the Electron main process itself can move onto mobile.

## Remote-Control Interpretation

For current product direction, mobile should be understood as:

- a remote use-side / control-side client
- attached to a desktop-hosted AionUi runtime
- optionally exposed over FRP or another reverse-tunnel / reverse-proxy layer

The expected file flow is:

1. user selects a local file on the phone
2. the mobile shell / WebView uploads the file to the AionUi host
3. the desktop host stores and processes the uploaded file
4. later preview / agent work continues against the host-side copy

## Verification In This Worktree

The new shell workspace was created under [`mobile-shell/`](../../mobile-shell) inside the same repository.

Verified locally in this worktree:

- `bash mobile-shell/scripts/bootstrap.sh` succeeded and generated:
  - [`mobile-shell/ios/AionUiShell.xcodeproj`](../../mobile-shell/ios/AionUiShell.xcodeproj)
  - Android Gradle wrapper under `mobile-shell/android/gradle/wrapper`
- `xcodebuild -list -project mobile-shell/ios/AionUiShell.xcodeproj` succeeded and exposed the `AionUiShell` target and scheme.
- `xcodebuild -showdestinations -project mobile-shell/ios/AionUiShell.xcodeproj -scheme AionUiShell` succeeded after the iOS runtime installation completed on 2026-03-28 and listed usable iOS Simulator destinations.
- `xcodebuild -project mobile-shell/ios/AionUiShell.xcodeproj -scheme AionUiShell -destination 'id=88D8275A-21B1-4B7D-AF87-3871965664BC' CODE_SIGNING_ALLOWED=NO build` succeeded for the iPhone 17 Pro simulator on iOS 26.3.1.
- `xcrun simctl install 88D8275A-21B1-4B7D-AF87-3871965664BC <DerivedData>/AionUiShell.app` succeeded.
- `xcrun simctl launch 88D8275A-21B1-4B7D-AF87-3871965664BC com.aionui.shell.ios` succeeded and returned a live process id.
- `mobile-shell/scripts/android-gradlew.sh tasks --all` succeeded and exposed standard Android assemble / install tasks.
- `mobile-shell/scripts/android-gradlew.sh assembleDebug` succeeded and produced a debug APK.
- `ohpm install` succeeded in `mobile-shell/harmony/`.
- `DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk" hvigorw tasks` succeeded in `mobile-shell/harmony/` on 2026-03-28 after correcting the HarmonyOS SDK root path.
- `DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk" hvigorw assembleApp --debug --stacktrace` succeeded in `mobile-shell/harmony/` on 2026-03-28.
- HarmonyOS unsigned package outputs were generated at:
  - `mobile-shell/harmony/build/outputs/default/harmony-default-unsigned.app`
  - `mobile-shell/harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`

Remaining release blockers are operational, not architectural:

- HarmonyOS CLI requires the correct SDK root and current project SDK version alignment:
  - `DEVECO_SDK_HOME` must point to `~/Library/Huawei/command-line-tools/sdk`
  - `mobile-shell/harmony/build-profile.json5` must match the locally installed HarmonyOS SDK version
- The current assembled HarmonyOS artifacts are unsigned because `signingConfigs` are intentionally empty in [`mobile-shell/harmony/build-profile.json5`](../../mobile-shell/harmony/build-profile.json5).
- Release signing and store publishing still depend on the final DevEco signing material and publisher account setup.
