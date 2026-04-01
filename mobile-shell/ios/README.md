# iOS Shell

## Open

- Open `ContextGo.xcodeproj` in Xcode

## Requirements

- Xcode installed
- iOS platform/runtime components installed from `Xcode > Settings > Components`

If `xcodebuild` says the scheme has no valid destination, the usual reason is that the iOS platform runtime is not installed on the current machine yet.

Verified locally on 2026-03-28:

- `xcodebuild -showdestinations -project mobile-shell/ios/ContextGo.xcodeproj -scheme ContextGo`
- `xcodebuild -project mobile-shell/ios/ContextGo.xcodeproj -scheme ContextGo -destination 'id=88D8275A-21B1-4B7D-AF87-3871965664BC' CODE_SIGNING_ALLOWED=NO build`
- `xcrun simctl launch 88D8275A-21B1-4B7D-AF87-3871965664BC io.contextgo.ios`

## Shell Behavior

- First launch stays on the native connection screen until the user chooses Official Remote or enters a custom host
- Tapping Official Remote opens `https://remote.contextgo.io/remote/devices`
- Custom host mode still accepts a base WebUI URL such as `http://192.168.1.10:3000`
- Custom host mode still accepts a QR-login URL such as `http://192.168.1.10:3000/qr-login?token=...`
- Persists the last successful endpoint in `UserDefaults`
- Loads the target in `WKWebView`

## Release Packaging

Signed archive/export packaging for stable tag builds uses:

```bash
CONTEXTGO_RELEASE_BUILD_NUMBER=123 \
IOS_DEVELOPMENT_TEAM=TEAMID1234 \
IOS_BUILD_CERTIFICATE_BASE64=... \
IOS_P12_PASSWORD=... \
IOS_BUILD_PROVISION_PROFILE_BASE64=... \
CONTEXTGO_IOS_EXPORT_OPTIONS_PLIST=/path/to/ExportOptions.plist \
bash ../scripts/build-ios-release.sh 1.0.2 /tmp/contextgo-ios-release
```
