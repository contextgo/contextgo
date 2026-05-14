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

## TestFlight CI Workflow

Dedicated GitHub Actions entry:

- `.github/workflows/ios-testflight.yml`

Reusable implementation:

- `.github/workflows/_ios-testflight-reusable.yml`

The current supported CI path is manual signing plus App Store Connect upload:

- `IOS_BUILD_CERTIFICATE_BASE64`: base64-encoded `Apple Distribution` `.p12`
- `IOS_P12_PASSWORD`: password for the `.p12`
- `IOS_BUILD_PROVISION_PROFILE_BASE64`: base64-encoded App Store provisioning profile for `io.contextgo.ios`
- `IOS_KEYCHAIN_PASSWORD`: optional temporary keychain password override
- `APPLE_API_PRIVATE_KEY`: App Store Connect API private key contents for TestFlight upload
- `APPLE_API_KEY_ID`: upload API key id
- `APPLE_API_ISSUER_ID`: upload API issuer id
- `IOS_DEVELOPMENT_TEAM`: Apple Team ID, defaults to `DQ362F38WB`
- `IOS_APP_BUNDLE_ID`: bundle identifier, defaults to `io.contextgo.ios`
- `IOS_CODE_SIGN_IDENTITY`: optional signing identity override, for example `Apple Distribution`

Automatic triggers:

- after a successful `Build and Release` run on `main` when `ENABLE_IOS_TESTFLIGHT_RELEASES=true` or `ENABLE_IOS_SHELL_RELEASES=true`

Manual trigger:

- run `iOS TestFlight` with a branch, tag, or commit SHA in the `ref` input

The workflow builds the archive through `mobile-shell/scripts/build-ios-release.sh`, exports an IPA, then uploads it through `mobile-shell/scripts/upload-ios-testflight.sh`.

## Team API Key Entry Point

Optional future-facing inputs:

- `APPLE_PROVISIONING_API_PRIVATE_KEY`
- `APPLE_PROVISIONING_API_KEY_ID`
- `APPLE_PROVISIONING_API_ISSUER_ID`

These are for provisioning/auth during `xcodebuild -allowProvisioningUpdates`, not for the final TestFlight upload step.

Important boundary:

- a personal App Store Connect API key can work for upload authorization
- a personal key does not unlock the Provisioning API needed for certificate/profile management
- if you want CI-driven provisioning updates, create a Team-scoped App Store Connect API key and provide all three provisioning inputs together

Even with the Team key path enabled, the runner still needs an Apple-valid signing environment. The supported baseline remains uploaded `p12 + mobileprovision`.
