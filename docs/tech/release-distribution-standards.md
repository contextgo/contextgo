# Release And Distribution Standards

This document defines the long-lived release and distribution model for ContextGo.

Use this before changing:

- GitHub Actions release workflows
- tag naming or release asset naming
- platform signing, bundle identifiers, or store metadata
- `mobile-shell/` packaging and release assumptions
- future website download-page or release-page integration

Related references:

- `docs/tech/checklist.md`
- `docs/tech/mobile-remote-control.md`
- `docs/tech/mobile-shell-readiness.md`
- `docs/tech/mobile-shell-cmd.md`
- `.github/workflows/build-and-release.yml`
- `.github/workflows/_build-reusable.yml`

## Product And Repository Model

The repository should continue to act as a single product repository with platform-specific packaging layers.

- The repository root remains the main desktop and WebUI codebase.
- `mobile-shell/` packages the same product for Android, iOS, and HarmonyOS through native WebView shells.
- `mobile/` is an existing Expo-based native client and should not be confused with the WebView-shell track.
- Future website code may live in the same repository, but in a dedicated top-level directory such as `site/` or `apps/site/`.

Stable rule:

- do not split desktop, mobile-shell, and future website release logic into separate repositories unless there is an explicit product decision

Current explicit exception:

- the source repository may remain private while public installers, manifests, and GitHub Releases are published from a dedicated public distribution repository under the same organization
- when this model is active, the public distribution repository becomes the website-facing release endpoint and download source of truth

## Distribution Policy By Platform

### Windows

Baseline distribution path:

- direct download from the official website or GitHub Releases

Recommended operational standard:

- use a code-signing certificate for public distribution

Microsoft Store is optional and should not be treated as the baseline release path.

### macOS

Baseline distribution path:

- direct download from the official website or GitHub Releases

Stable operational standard:

- do not require Mac App Store submission for the baseline macOS release path
- public macOS releases should assume Developer ID signing and notarization

Mac App Store publication is optional and should be treated as an additional distribution channel, not as the default plan.

### Android

Baseline distribution path:

- direct signed APK distribution from the official website or GitHub Releases

Optional later path:

- Google Play

Stable operational standard:

- keep Android package names and signing keys stable across releases
- treat Play Console submission as optional, but preserve a path to add it later without renaming the application

### HarmonyOS

Baseline distribution path:

- direct signed HAP or APP distribution from the official website or private channels

Optional later path:

- AppGallery / AppGallery Connect distribution

Stable operational standard:

- keep HarmonyOS bundle identifiers and signing material stable
- do not treat unsigned build output as releasable output

### iOS

Baseline non-App-Store distribution path:

- TestFlight

Stable operational standard:

- do not assume public website-hosted IPA distribution is a normal path for general users
- treat TestFlight as the default external testing or preview path until there is a deliberate App Store strategy

App Store publication is a later product decision. Ad hoc and enterprise distribution should not be used as the assumed public-release path.

## Release Source Of Truth

Git tags plus GitHub Releases should remain the canonical release source of truth.

Stable rules:

- one product release should map to one Git tag
- one public product release should map to one GitHub Release
- release artifacts for all supported distribution channels should be attached to that GitHub Release when practical
- the official website should consume release metadata or release assets instead of becoming the source of truth itself

## Tagging Standard

Use these formats for future work unless there is an explicit replacement plan.

### Stable releases

```text
vX.Y.Z
```

Examples:

- `v1.10.0`
- `v2.0.1`

### Pre-releases

```text
vX.Y.Z-beta.N
vX.Y.Z-alpha.N
vX.Y.Z-rc.N
```

Examples:

- `v1.10.0-beta.1`
- `v1.10.0-rc.2`

### Internal or dev builds

```text
vX.Y.Z-dev-<shortsha>
```

This matches the existing development-tag direction already used in repository history and in `build-and-release.yml`.

Stable rule:

- do not use `-dev-` tags as the public stable release identity

## GitHub Actions Release Strategy

The current desktop release workflow already lives in:

- `.github/workflows/build-and-release.yml`
- `.github/workflows/_build-reusable.yml`

Future release automation should extend or compose this path instead of creating a disconnected second release pipeline.

Stable rules:

- desktop release builds should keep using tag-triggered GitHub Actions as the default automation path
- future mobile-shell release jobs should be added as additional jobs or reusable workflows in the same release system
- release workflows should upload distributable artifacts with stable, human-readable names
- direct-download artifacts should be publishable without requiring store submission
- release workflows must support both GitHub-hosted and self-hosted runners without maintaining two disconnected workflow trees
- runner selection should be driven by GitHub Actions variables or manual workflow inputs, not by ad hoc YAML edits on every release
- control-plane jobs such as matrix generation, tagging, release creation, and build summaries should run on a POSIX-capable runner with `bash`, `git`, and network access
- if the self-hosted runner fleet only covers part of the target matrix, constrain the release matrix through configuration before editing workflow source

Recommended release artifact targets:

- Windows: installer packages
- macOS: signed DMG or ZIP, with notarization when available
- Linux: current desktop packages
- Android: signed APK and optionally AAB
- HarmonyOS: signed HAP or APP
- iOS: build archive outputs for TestFlight or store upload, not public direct-download IPA as the default

## Website Release Strategy

If website code is added to this repository later, keep the website deployment lifecycle separate from the product tag lifecycle.

Stable rules:

- do not trigger full desktop and mobile product builds for every website content change
- do not require a product release tag for every website deployment
- do not make the website deployment workflow the owner of product versioning

Recommended website deployment model:

- website deploys from `main` or from a dedicated website workflow
- website reads product-version metadata from GitHub Releases or another release manifest
- website download pages link to the signed release assets or store destinations

## Platform Preparation Checklist

These are the long-lived prerequisites that should exist before public multi-platform release automation is considered complete.

### Shared preparation

- stable product name
- stable package or bundle identifiers for every platform
- support email
- official website domain
- privacy-policy URL
- terms-of-service URL
- release notes process
- long-term storage and backup for signing materials

### Windows

- code-signing certificate
- timestamped signing process in CI or release tooling

### macOS

- Apple Developer Program account
- Apple Team ID
- Developer ID certificate
- notarization credentials

### iOS

- Apple Developer Program account
- App Store Connect access
- iOS App ID or bundle identifier
- signing certificates and provisioning profiles
- TestFlight-ready release path

### Android

- stable Android application ID
- release keystore
- key alias and passwords managed in CI secrets
- if Play submission is later required, preserve compatibility with Play Console requirements

### HarmonyOS

- HUAWEI Developer account
- AppGallery Connect project or release path
- signing configuration for release builds
- DevEco-compatible SDK and CLI environment

## Recommended GitHub Actions Secrets

Current desktop workflows already reference secrets such as:

- `GH_TOKEN`
- `APP_ID`
- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `TEAM_ID`
- `IDENTITY`
- `BUILD_CERTIFICATE_BASE64`
- `P12_PASSWORD`
- `KEYCHAIN_PASSWORD`

Recommended future secret inventory for platform expansion:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`
- `APPLE_API_PRIVATE_KEY`
- `HARMONY_SIGNING_*` secrets aligned with the final Harmony signing format
- website deployment secrets kept separate from app-signing secrets

Stable rule:

- do not reuse one platform's signing secret format as the naming standard for another platform unless the workflow actually consumes that shape

## Recommended GitHub Actions Variables

The release pipeline now supports self-hosted execution through repository variables.

Recommended baseline variables:

- `BUILD_RUNNER_MODE`
- `RELEASE_BUILD_PLATFORMS`
- `SELF_HOSTED_CONTROL_RUNNER_LABELS_JSON`
- `SELF_HOSTED_MACOS_RUNNER_LABELS_JSON`
- `SELF_HOSTED_WINDOWS_RUNNER_LABELS_JSON`
- `SELF_HOSTED_LINUX_RUNNER_LABELS_JSON`

Variable expectations:

- `BUILD_RUNNER_MODE` should be `hosted` or `self-hosted`
- `RELEASE_BUILD_PLATFORMS` should be `all` or a comma-separated subset such as `macos-arm64,linux`
- `*_LABELS_JSON` values should be JSON arrays of runner labels, for example `["self-hosted","macOS","arm64","aionui-macos"]`

Stable rule:

- treat runner-label variables as infrastructure configuration, not as per-branch application logic

## Agent Guardrails

Agents working on release automation should treat the following as default assumptions:

- desktop remains the real execution host even when mobile-shell artifacts are shipped
- macOS direct-download release is a first-class path and does not depend on Mac App Store submission
- Android and HarmonyOS may use direct-download distribution before store publication
- iOS should default to TestFlight or App Store workflows, not public direct IPA download
- future website deployment should remain separate from product tag creation

Before changing release logic, read:

- `AGENTS.md`
- `docs/tech/mobile-remote-control.md`
- `docs/tech/mobile-shell-readiness.md`
- this document

If a platform policy may have changed, verify the latest official platform documentation before changing automation or release guarantees.

## Official Reference Pointers

These links are stable starting points for future verification work:

- Apple Developer Program enrollment: `https://developer.apple.com/programs/enroll/`
- Apple Developer ID and notarization: `https://developer.apple.com/support/developer-id/`
- Apple TestFlight: `https://developer.apple.com/testflight/`
- Google Play Console account setup: `https://support.google.com/googleplay/android-developer/answer/6112435`
- Android developer verification: `https://developer.android.com/developer-verification`
- Android alternative distribution: `https://developer.android.com/distribute/marketing-tools/alternative-distribution`
- HUAWEI AppGallery / AppGallery Connect: `https://developer.huawei.com/consumer/en/appgallery`
