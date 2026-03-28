# Mobile Shell Readiness

## Summary

Current AionUi is **well prepared for remote mobile access**, but **not ready for full mobile parity with the Electron desktop app**.

Recommended packaging strategy:

- Treat mobile as a **native shell + remote WebUI** product.
- Reuse the existing WebUI, login flow, and WebSocket bridge.
- Do **not** treat the shell as a standalone replacement for the desktop main process.

Readiness score:

- Mobile WebUI / remote-control shell: **7.5 / 10**
- Full standalone mobile app parity with Electron desktop: **3 / 10**

## What Is Already Reusable

### 1. Browser/WebUI transport already exists

The architecture already supports browser clients, not only Electron windows.

- [`docs/tech/architecture.md`](/Users/bytedance/project/AionUi/docs/tech/architecture.md#L23) defines a WebUI server built on Express + WebSocket.
- [`docs/tech/architecture.md`](/Users/bytedance/project/AionUi/docs/tech/architecture.md#L33) states that browser-side WebSocket and Electron IPC both reach the same bridge handlers and services.
- [`src/common/adapter/browser.ts`](/Users/bytedance/project/AionUi/src/common/adapter/browser.ts#L23) switches between Electron IPC and browser WebSocket automatically.
- [`src/renderer/main.tsx`](/Users/bytedance/project/AionUi/src/renderer/main.tsx#L8) already supports a non-Electron runtime.

This is the main reason a native mobile shell is realistic for this repository.

### 2. Renderer already contains mobile-oriented UI behavior

The renderer is not desktop-only.

- [`src/renderer/components/layout/Layout.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/layout/Layout.tsx#L34) detects mobile viewports and coarse/touch input.
- [`src/renderer/components/layout/Layout.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/layout/Layout.tsx#L221) auto-collapses the sider when entering mobile mode.
- [`src/renderer/styles/themes/base.css`](/Users/bytedance/project/AionUi/src/renderer/styles/themes/base.css#L83) includes safe-area helpers for notched mobile devices.
- [`src/renderer/hooks/system/usePwaMode.ts`](/Users/bytedance/project/AionUi/src/renderer/hooks/system/usePwaMode.ts#L10) explicitly detects PWA standalone mode.
- [`src/renderer/components/layout/PwaPullToRefresh.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/layout/PwaPullToRefresh.tsx#L12) adds iOS pull-to-refresh handling for standalone mobile usage.
- [`src/renderer/components/media/FileAttachButton.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/media/FileAttachButton.tsx#L27) already distinguishes Electron desktop from WebUI browser/mobile file picking.

### 3. A separate mobile product already exists

This repository already contains a native mobile client under [`mobile/package.json`](/Users/bytedance/project/AionUi/mobile/package.json#L1).

- [`mobile/package.json`](/Users/bytedance/project/AionUi/mobile/package.json#L7) exposes Expo-based iOS/Android build scripts.
- [`mobile/app.config.ts`](/Users/bytedance/project/AionUi/mobile/app.config.ts#L15) already defines iOS and Android package metadata.
- [`mobile/app/connect.tsx`](/Users/bytedance/project/AionUi/mobile/app/connect.tsx#L12) already parses `/qr-login` URLs and connects to an AionUi server.

This means the product direction "mobile device connects to AionUi server" is already recognized in the codebase.

## What Prevents Full Mobile Parity

### 1. Server mode intentionally drops Electron-only bridges

Mobile shells can only reuse what the WebUI/server runtime exposes.

- [`docs/tech/architecture.md`](/Users/bytedance/project/AionUi/docs/tech/architecture.md#L57) documents that pure server mode drops 10 Electron-only bridges, including `fsBridge`, `mcpBridge`, `dialogBridge`, `shellBridge`, `windowControlsBridge`, `updateBridge`, and `notificationBridge`.

That means a mobile shell can act as a strong remote client, but not as a full replacement for the desktop host.

### 2. Some preview surfaces are still Electron-host-specific

There are renderer features that still assume Electron's `<webview>` host.

- [`src/renderer/pages/conversation/Preview/components/viewers/PDFViewer.tsx`](/Users/bytedance/project/AionUi/src/renderer/pages/conversation/Preview/components/viewers/PDFViewer.tsx#L27) defines an Electron webview type and mounts a `<webview>` element at [`src/renderer/pages/conversation/Preview/components/viewers/PDFViewer.tsx`](/Users/bytedance/project/AionUi/src/renderer/pages/conversation/Preview/components/viewers/PDFViewer.tsx#L159).
- [`src/renderer/components/media/WebviewHost.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/media/WebviewHost.tsx#L33) is explicitly built around Electron `WebviewTag`.

These areas are high-risk for behavior differences in native mobile WebView shells.

### 3. Browser runtime assumes same-origin hosting

The browser runtime expects the frontend and backend to live on the same origin.

- [`src/common/adapter/browser.ts`](/Users/bytedance/project/AionUi/src/common/adapter/browser.ts#L44) derives the WebSocket endpoint from `window.location`.
- [`src/renderer/hooks/context/AuthContext.tsx`](/Users/bytedance/project/AionUi/src/renderer/hooks/context/AuthContext.tsx#L36) calls `/api/auth/user`.
- [`src/renderer/hooks/context/AuthContext.tsx`](/Users/bytedance/project/AionUi/src/renderer/hooks/context/AuthContext.tsx#L111) posts login to `/login`.
- [`src/renderer/services/FileService.ts`](/Users/bytedance/project/AionUi/src/renderer/services/FileService.ts#L27) uploads to `/api/upload`.

Because of that, a mobile shell should load the real AionUi WebUI origin rather than bundling raw static assets without a matching backend origin.

## Practical Assessment

Good candidates for mobile shell reuse:

- Login and authenticated browsing through WebUI
- Conversation browsing and chat interaction
- Mobile layout, safe areas, and responsive navigation
- Browser-side uploads from the local device
- Remote administration scenarios where the desktop/server host keeps the heavy runtime

Weak or incomplete areas:

- Desktop-grade preview flows backed by Electron webview
- Any workflow requiring direct local OS integration from the mobile device
- Feature parity with Electron-only bridges
- A fully offline or standalone mobile deployment of the complete AionUi product

## Recommendation

The right near-term delivery model is:

1. Run AionUi as a reachable WebUI/server host.
2. Package native Android, iOS, and HarmonyOS shells.
3. Let the shells accept either:
   - a base WebUI URL such as `http://host:port`
   - or a `/qr-login?token=...` URL generated by AionUi
4. Persist the last connected endpoint locally and reopen it directly in WebView on the next launch.

This achieves a publishable mobile client path without pretending the Electron main process itself can move onto mobile.
