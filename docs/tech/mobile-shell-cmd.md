# Mobile Shell Command Map

This document records the stable command-entry paths for the WebView shell projects under `mobile-shell/`.

Use this when you need to:

- bootstrap or regenerate shell project files
- run Android CLI tasks
- locate the iOS Xcode project
- locate the HarmonyOS project entry
- understand which repository-root commands are expected to stay stable over time

## Canonical Paths

- Workspace root: `mobile-shell/`
- Bootstrap script: `mobile-shell/scripts/bootstrap.sh`
- Android Gradle wrapper helper: `mobile-shell/scripts/android-gradlew.sh`
- Android project root: `mobile-shell/android/`
- iOS project file: `mobile-shell/ios/ContextGo.xcodeproj`
- iOS project definition source: `mobile-shell/ios/project.yml`
- HarmonyOS project root: `mobile-shell/harmony/`

## Repository-Root Commands

Run these from the repository root.

### Bootstrap / regenerate shell projects

```bash
bun run mobile-shell:bootstrap
```

Equivalent direct path:

```bash
bash mobile-shell/scripts/bootstrap.sh
```

Purpose:

- install or refresh generated native shell project files
- regenerate the iOS Xcode project from `mobile-shell/ios/project.yml`
- ensure Android wrapper and shared shell scaffolding exist

### Android: inspect Gradle tasks

```bash
bun run mobile-shell:android:tasks
```

Equivalent direct path:

```bash
bash mobile-shell/scripts/android-gradlew.sh tasks --all
```

### Android: build debug APK

```bash
bun run mobile-shell:android:assemble:debug
```

Equivalent direct path:

```bash
bash mobile-shell/scripts/android-gradlew.sh assembleDebug
```

Expected output path:

- `mobile-shell/android/app/build/outputs/apk/debug/app-debug.apk`

### iOS: inspect project targets and schemes

```bash
bun run mobile-shell:ios:list
```

Equivalent direct path:

```bash
xcodebuild -list -project mobile-shell/ios/ContextGo.xcodeproj
```

## IDE Entry Points

### Android

Open:

- `mobile-shell/android/`

Or run CLI tasks through:

- `mobile-shell/scripts/android-gradlew.sh`

### iOS

Open:

- `mobile-shell/ios/ContextGo.xcodeproj`

If the project layout changes, `mobile-shell/ios/project.yml` remains the source of truth and should be regenerated through `bun run mobile-shell:bootstrap`.

### HarmonyOS

Open:

- `mobile-shell/harmony/`

Current package-manager install command:

```bash
cd mobile-shell/harmony
ohpm install
```

Current HarmonyOS CLI environment:

```bash
export DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk"
export PATH="$HOME/Library/Huawei/command-line-tools/bin:$HOME/Library/Huawei/command-line-tools/ohpm/bin:$PATH"
```

Verification command:

```bash
cd mobile-shell/harmony
hvigorw tasks
```

Full local assemble command:

```bash
cd mobile-shell/harmony
DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk" hvigorw assembleApp --debug --stacktrace
```

Important:

- `DEVECO_SDK_HOME` must point to `.../command-line-tools/sdk`
- do not point it to `.../command-line-tools/sdk/default`, or `hvigor` will fail to discover the installed SDK components

Current output files:

- `mobile-shell/harmony/build/outputs/default/harmony-default-unsigned.app`
- `mobile-shell/harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`

Current signing state:

- the project assembles successfully without signing material
- release/store publishing still requires `signingConfigs` to be added in `mobile-shell/harmony/build-profile.json5`

## Host Runtime Commands

The mobile shells are not standalone product runtimes. They load a reachable ContextGo host.

Recommended host commands:

```bash
bun run webui:prod:remote
```

or:

```bash
bun run server:start:prod:remote
```

Use `docs/tech/mobile-remote-control.md` as the canonical product-model reference before changing these assumptions.

## Stability Rules

Unless there is an explicit product or tooling decision to change them, treat the following as stable:

- `mobile-shell/` is the workspace root for WebView shell packaging
- repository-root `mobile-shell:*` scripts are the primary CLI entry points
- `mobile-shell/scripts/bootstrap.sh` is the canonical regeneration path
- Android CLI flows go through `mobile-shell/scripts/android-gradlew.sh`
- iOS Xcode import goes through `mobile-shell/ios/ContextGo.xcodeproj`
- HarmonyOS import goes through `mobile-shell/harmony/`
