# Checklist

This document is the practical execution checklist for multi-platform release preparation.

Use it together with:

- `docs/tech/release-distribution-standards.md`
- `docs/tech/mobile-remote-control.md`
- `docs/tech/mobile-shell-readiness.md`
- `docs/tech/mobile-shell-cmd.md`

## Background

The repository now supports a unified product direction:

- desktop remains the real execution host
- mobile access uses `mobile-shell/` native WebView shells
- future website download pages may live in the same repository
- Git tags plus GitHub Releases remain the intended release source of truth

The current goal is not "ship every platform through every store immediately".

The current goal is:

- make direct-download release paths realistic
- keep future store publication possible
- preserve one repository and one maintainable release model

## Current Repository Status

As of 2026-03-28, the following foundations already exist in `main`:

- `mobile-shell/` exists for Android, iOS, and HarmonyOS
- mobile shell architecture and command docs are already merged
- the repository has existing GitHub Actions for desktop build and release
- the desktop build workflows now support switching between GitHub-hosted and self-hosted runners
- current desktop release workflow still only covers desktop artifacts
- mobile-shell release automation is not yet wired into GitHub release workflows

Important current blockers:

- no self-hosted runners are currently registered for `contextgo/contextgo`
- no repository-level GitHub Actions secrets or variables are currently visible through GitHub CLI
- no GitHub Actions environments are currently configured
- Android, iOS, and HarmonyOS release signing materials are not yet configured in CI
- iOS and HarmonyOS still depend on account and signing setup outside the repository
- GitHub Actions billing is currently blocking hosted workflow execution:
  - the manual build run `23683160605` failed before job startup on 2026-03-28
  - GitHub reported: recent account payments have failed or the spending limit needs to be increased

## What Was Completed Today

These items are already completed in the repository:

- [x] Mobile shell workspace merged into `main`
- [x] Mobile remote-control architecture documented
- [x] Multi-platform release and distribution standards documented
- [x] `AGENTS.md` updated so future agents load the release context before changing tags, signing, or publishing assumptions
- [x] Release checklist added as a canonical execution document
- [x] Release workflows updated to fall back to the built-in `github.token` instead of requiring a custom `GH_TOKEN` secret for GitHub-side operations
- [x] Desktop build workflows updated to support self-hosted runner mode through GitHub Actions variables and manual workflow input

These items are still pending because they require external accounts, certificates, or final product decisions:

- [ ] Apple Developer Program enrollment
- [ ] Android release keystore generation and secure backup
- [ ] HUAWEI Developer account and HarmonyOS release signing setup
- [ ] Website deployment credentials and official download page
- [ ] Mobile-shell release automation in GitHub Actions

## Must Do Now

These are the highest-priority tasks. Do them before trying to standardize public multi-platform release.

### Product identity

- [ ] Confirm the official product naming strategy across desktop, mobile, and website
- [ ] Confirm the public website domain
- [ ] Confirm the support email
- [ ] Publish a privacy-policy URL
- [ ] Publish a terms-of-service URL

### Stable application identifiers

- [ ] Confirm macOS bundle identifier
- [ ] Confirm iOS bundle identifier
- [ ] Confirm Android application ID
- [ ] Confirm HarmonyOS bundle or package identifier

Do not defer this. Identifier churn later causes avoidable migration problems.

### Apple account and macOS/iOS foundation

- [ ] Enroll in Apple Developer Program with the long-term owning entity
- [ ] Prepare D-U-N-S number if the account will be organization-based
- [ ] Confirm the Apple Team ID
- [ ] Prepare Developer ID distribution capability for macOS
- [ ] Plan notarization credentials for macOS release
- [ ] Prepare App Store Connect access for iOS TestFlight

### Android release identity

- [ ] Generate the formal Android release keystore
- [ ] Record the keystore password
- [ ] Record the key alias
- [ ] Record the key password
- [ ] Back up the keystore outside the repository

### HarmonyOS release identity

- [ ] Register the long-term HUAWEI Developer account
- [ ] Complete required verification for the intended account type
- [ ] Prepare HarmonyOS signing material
- [ ] Confirm the final HarmonyOS release package identity

### Release hosting

- [ ] Confirm GitHub Releases stays the initial artifact source of truth
- [ ] Confirm the future download page will consume release assets from GitHub Releases or a manifest generated from them
- [ ] Decide whether the official website will live in `site/` or `apps/site/`

### GitHub Actions execution path

- [ ] Register at least one self-hosted control runner with `bash`, `git`, and outbound network access
- [ ] Register the self-hosted platform runners required for the release targets you actually want to ship now
- [ ] Set `BUILD_RUNNER_MODE=self-hosted`
- [ ] Set `RELEASE_BUILD_PLATFORMS` to the supported subset until the full runner fleet exists
- [ ] Set `SELF_HOSTED_CONTROL_RUNNER_LABELS_JSON`
- [ ] Set `SELF_HOSTED_MACOS_RUNNER_LABELS_JSON`
- [ ] Set `SELF_HOSTED_WINDOWS_RUNNER_LABELS_JSON`
- [ ] Set `SELF_HOSTED_LINUX_RUNNER_LABELS_JSON`

Do not leave `RELEASE_BUILD_PLATFORMS=all` unless corresponding runners actually exist. Otherwise tag-triggered release workflows will queue on unavailable labels.

## Can Wait Until Store Submission

These items matter, but they do not block the near-term direct-download strategy.

### Android

- [ ] Google Play Console registration
- [ ] Play Store listing metadata
- [ ] Play screenshots, descriptions, and policy forms

### iOS

- [ ] App Store screenshots and review metadata
- [ ] App Store privacy label finalization
- [ ] App Store category and age-rating preparation

### HarmonyOS

- [ ] AppGallery listing metadata
- [ ] AppGallery screenshots and release copy
- [ ] Region-specific store distribution settings

### Windows

- [ ] Windows code-signing certificate for public-distribution trust improvements

## GitHub Actions Secrets Checklist

The repository should gradually converge on the following GitHub Actions secrets inventory.

### Desktop and Apple

- [ ] `APPLE_ID`
- [ ] `APPLE_ID_PASSWORD`
- [ ] `TEAM_ID`
- [ ] `IDENTITY`
- [ ] `BUILD_CERTIFICATE_BASE64`
- [ ] `P12_PASSWORD`
- [ ] `KEYCHAIN_PASSWORD`

### App Store Connect API

- [ ] `APPLE_API_KEY_ID`
- [ ] `APPLE_API_ISSUER_ID`
- [ ] `APPLE_API_PRIVATE_KEY`

### Android

- [ ] `ANDROID_KEYSTORE_BASE64`
- [ ] `ANDROID_KEYSTORE_PASSWORD`
- [ ] `ANDROID_KEY_ALIAS`
- [ ] `ANDROID_KEY_PASSWORD`

### HarmonyOS

- [ ] `HARMONY_KEYSTORE_BASE64`
- [ ] `HARMONY_KEYSTORE_PASSWORD`
- [ ] `HARMONY_KEY_ALIAS`
- [ ] `HARMONY_KEY_PASSWORD`

### Website deployment

- [ ] `SITE_DEPLOY_TOKEN`
- [ ] `CLOUDFLARE_API_TOKEN` or equivalent hosting-provider deployment token
- [ ] `CLOUDFLARE_ACCOUNT_ID` or equivalent hosting-provider account identifier

### Optional observability

- [ ] `SENTRY_DSN`
- [ ] `SENTRY_AUTH_TOKEN`
- [ ] `SENTRY_ORG`
- [ ] `SENTRY_PROJECT`

## GitHub Actions Variables Checklist

Prefer GitHub Actions variables for stable non-secret configuration.

- [ ] `BUILD_RUNNER_MODE`
- [ ] `RELEASE_BUILD_PLATFORMS`
- [ ] `SELF_HOSTED_CONTROL_RUNNER_LABELS_JSON`
- [ ] `SELF_HOSTED_MACOS_RUNNER_LABELS_JSON`
- [ ] `SELF_HOSTED_WINDOWS_RUNNER_LABELS_JSON`
- [ ] `SELF_HOSTED_LINUX_RUNNER_LABELS_JSON`
- [ ] `SUPPORT_EMAIL`
- [ ] `PRIVACY_POLICY_URL`
- [ ] `TERMS_OF_SERVICE_URL`
- [ ] `OFFICIAL_WEBSITE_URL`
- [ ] `DOWNLOAD_WEBSITE_URL`
- [ ] `MAC_BUNDLE_ID`
- [ ] `IOS_BUNDLE_ID`
- [ ] `ANDROID_APPLICATION_ID`
- [ ] `HARMONY_BUNDLE_NAME`

## What We Can Realistically Release Before Store Submission

Near-term recommended release surface:

- [ ] macOS direct-download release
- [ ] Windows direct-download release
- [ ] Android signed direct-download package
- [ ] HarmonyOS signed direct-download package
- [ ] iOS TestFlight build

Do not treat these as near-term assumptions:

- [ ] public direct IPA download for general users
- [ ] full native mobile replacement for the Electron desktop runtime
- [ ] mobile-shell store automation before signing materials exist

## Today-Only Action Plan

These are the practical actions that can be finished without waiting for external account approval.

### Repository and workflow work

- [x] document the release model
- [x] document the execution checklist
- [x] wire the checklist into long-lived agent guidance
- [x] reduce GitHub workflow dependency on custom `GH_TOKEN` secret

### GitHub-side actions that can still be done today

- [ ] add GitHub Actions variables once final product URLs and IDs are confirmed
- [ ] add GitHub Actions secrets once signing materials are generated
- [ ] register and label self-hosted runners
- [ ] switch `BUILD_RUNNER_MODE` to `self-hosted`
- [x] manually trigger at least one desktop build workflow from `main`
- [ ] restore GitHub Actions billing so hosted jobs can actually start

### Actions that cannot be honestly completed today without your inputs

- [ ] Apple Developer enrollment
- [ ] Android release keystore creation if you want the final production keystore to be created under your own security process
- [ ] HUAWEI Developer verification
- [ ] official website deployment credential setup
- [ ] GitHub billing or spending-limit correction if you are the account owner or billing admin

## Recommended Order For You

Follow this order to minimize rework.

1. Confirm product naming, domain, support email, and legal page URLs.
2. Confirm all platform bundle and package identifiers.
3. Enroll the Apple developer account and collect Team ID details.
4. Generate and back up the Android release keystore.
5. Register and verify the HUAWEI Developer account.
6. Register and label the self-hosted runner fleet, then switch `BUILD_RUNNER_MODE` to `self-hosted`.
7. Add GitHub Actions secrets and variables.
8. Wire Android and HarmonyOS signing into CI.
9. Add iOS TestFlight automation.
10. Add website deployment automation.
11. Only then decide whether store submission should become part of the standard release path.

## Agent Notes

Future agents should treat this file as the execution-oriented companion to `docs/tech/release-distribution-standards.md`.

If this checklist and the release standard ever diverge:

- update both in the same change
- prefer explicit checklists over implied tribal knowledge
- verify any platform-policy assumption against current official docs before changing automation
