# Dedicated iOS TestFlight Workflow Design

## Goal

Add a dedicated GitHub Actions workflow for the `mobile-shell/` iOS shell that builds and uploads a TestFlight IPA without keeping that logic embedded inside the general `build-and-release.yml` desktop release workflow.

The current supported path should work immediately with repository-provided signing assets:

- `Apple Distribution` certificate as base64-encoded `.p12`
- matching App Store provisioning profile as base64-encoded `.mobileprovision`
- App Store Connect API key for TestFlight upload

The workflow should also leave a documented entry point for a future Team API key based provisioning flow, but that path is not the primary supported release mode yet.

## Constraints

- Keep the repository release model intact: one repository remains the source of truth, and GitHub Actions remains the release control plane.
- Avoid duplicating the iOS build implementation. Reuse the existing helper scripts under `mobile-shell/scripts/`.
- Avoid relying on a tag-push workflow trigger that may not fire when tags are created by another workflow token.
- Keep the current working release path centered on uploaded signing assets, because the current environment does not have a reusable `Apple Distribution` identity available by default.

## Workflow Shape

Use a two-layer GitHub Actions structure:

1. A reusable workflow that contains the actual iOS archive/export/upload logic.
2. A dedicated entry workflow that triggers the reusable workflow.

This keeps the trigger surface independent while avoiding a second copy of the signing and upload steps.

## Trigger Model

The dedicated entry workflow should support:

- `workflow_dispatch` for explicit maintainer-triggered uploads from a chosen ref
- `workflow_run` after the existing `Build and Release` workflow completes successfully

The `workflow_run` path is the stable automation path. It does not depend on a secondary tag-push event, and it can use the successful release build SHA directly.

## Signing Modes

### Mode A: Current supported mode

Manual signing via repository secrets:

- import the `.p12` certificate into a temporary keychain
- install the `.mobileprovision` profile into `~/Library/MobileDevice/Provisioning Profiles`
- parse the profile metadata and feed `PROVISIONING_PROFILE_SPECIFIER` into the build
- generate an `ExportOptions.plist` for App Store Connect export
- upload the exported IPA through the App Store Connect API key

This is the mode the workflow should validate and document as the primary path.

### Mode B: Future-compatible entry point

If a separate Team API key is supplied for provisioning, allow the reusable workflow to pass that key into `xcodebuild -allowProvisioningUpdates` and keep `Automatic` signing available.

This path should be documented as an advanced option with two caveats:

- an individual App Store Connect API key is not enough for certificate/profile provisioning APIs
- the repository still needs a signing environment that Apple accepts for archive/export, which may depend on team configuration and runner state

## Release Behavior Changes

- Remove the inline `build-ios-testflight` job from `.github/workflows/build-and-release.yml`.
- Remove the release job dependency on that inline job.
- Keep the general release workflow focused on repository tagging and release artifacts.
- Let the dedicated iOS workflow own TestFlight uploads.

## Documentation

Update the iOS mobile-shell release documentation to explain:

- required GitHub Actions secrets and variables for the supported manual-signing path
- optional Team API key inputs for future automatic provisioning
- the difference between upload API credentials and provisioning API credentials
- how the dedicated workflow is triggered automatically and manually

## Verification

Verification for this change should focus on:

- YAML syntax validation for new and modified workflow files
- sanity checks that the new workflow references the existing scripts and correct environment variables
- documentation review for required secrets, variables, and signing caveats
