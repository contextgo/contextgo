# iOS Shell

## Open

- Open `AionUiShell.xcodeproj` in Xcode

## Requirements

- Xcode installed
- iOS platform/runtime components installed from `Xcode > Settings > Components`

If `xcodebuild` says the scheme has no valid destination, the usual reason is that the iOS platform runtime is not installed on the current machine yet.

Verified locally on 2026-03-28:

- `xcodebuild -showdestinations -project mobile-shell/ios/AionUiShell.xcodeproj -scheme AionUiShell`
- `xcodebuild -project mobile-shell/ios/AionUiShell.xcodeproj -scheme AionUiShell -destination 'id=88D8275A-21B1-4B7D-AF87-3871965664BC' CODE_SIGNING_ALLOWED=NO build`
- `xcrun simctl launch 88D8275A-21B1-4B7D-AF87-3871965664BC com.aionui.shell.ios`

## Shell Behavior

- Accepts a base WebUI URL such as `http://192.168.1.10:3000`
- Accepts a QR-login URL such as `http://192.168.1.10:3000/qr-login?token=...`
- Persists the last successful endpoint in `UserDefaults`
- Loads the target in `WKWebView`
