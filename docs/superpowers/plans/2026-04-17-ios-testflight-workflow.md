# Dedicated iOS TestFlight Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated GitHub Actions workflow that builds and uploads the iOS mobile shell to TestFlight using the current supported manual-signing path, while documenting an optional Team API key provisioning path.

**Architecture:** Introduce a reusable workflow that owns the iOS archive/export/upload logic and a separate trigger workflow that runs automatically after the release workflow or manually on demand. Remove the old inline TestFlight job from the shared release workflow so TestFlight ownership becomes explicit and isolated.

**Tech Stack:** GitHub Actions YAML, existing `mobile-shell/scripts/*.sh` release helpers, Xcode CLI signing/export flow, Markdown documentation.

---

### Task 1: Add the workflow documentation artifacts

**Files:**

- Create: `docs/superpowers/specs/2026-04-17-ios-testflight-workflow-design.md`
- Create: `docs/superpowers/plans/2026-04-17-ios-testflight-workflow.md`

- [ ] **Step 1: Write the design document**

Write a short design covering:

- reusable workflow plus dedicated trigger workflow
- `workflow_run` and `workflow_dispatch` trigger model
- supported manual-signing path with `p12 + mobileprovision + API key`
- future Team API key entry point

- [ ] **Step 2: Write the implementation plan**

Document the execution tasks for workflow extraction, documentation updates, and validation.

### Task 2: Extract the iOS TestFlight workflow logic

**Files:**

- Create: `.github/workflows/_ios-testflight-reusable.yml`
- Create: `.github/workflows/ios-testflight.yml`
- Modify: `.github/workflows/build-and-release.yml`

- [ ] **Step 1: Write the reusable workflow**

Add a workflow-call entry that:

- checks out the requested ref
- resolves the app version
- prepares upload API key material
- prepares either manual-signing assets or Team API key provisioning auth
- bootstraps `mobile-shell/`
- runs `mobile-shell/scripts/build-ios-release.sh`
- runs `mobile-shell/scripts/upload-ios-testflight.sh`
- uploads archive and IPA artifacts

- [ ] **Step 2: Write the dedicated trigger workflow**

Add a standalone workflow file with:

- `workflow_dispatch` input for `ref`
- `workflow_run` trigger on successful completion of `Build and Release`
- call into the reusable workflow with the chosen ref

- [ ] **Step 3: Remove the inline TestFlight job**

Delete the old `build-ios-testflight` job from `build-and-release.yml` and remove it from the downstream `release` job dependency list and success guard.

### Task 3: Update iOS release documentation

**Files:**

- Modify: `mobile-shell/ios/README.md`
- Modify: `mobile-shell/README.md`

- [ ] **Step 1: Document the supported release path**

Explain the required secrets and variables for:

- `IOS_BUILD_CERTIFICATE_BASE64`
- `IOS_P12_PASSWORD`
- `IOS_BUILD_PROVISION_PROFILE_BASE64`
- `IOS_KEYCHAIN_PASSWORD`
- `APPLE_API_PRIVATE_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`
- `IOS_DEVELOPMENT_TEAM`
- `IOS_APP_BUNDLE_ID`

- [ ] **Step 2: Document the future provisioning path**

Explain the optional Team API key variables/secrets, the difference from the upload key, and the limitation that an individual key cannot create provisioning resources.

### Task 4: Validate the workflow and docs

**Files:**

- Verify: `.github/workflows/_ios-testflight-reusable.yml`
- Verify: `.github/workflows/ios-testflight.yml`
- Verify: `.github/workflows/build-and-release.yml`
- Verify: `mobile-shell/ios/README.md`
- Verify: `mobile-shell/README.md`

- [ ] **Step 1: Validate YAML syntax**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/_ios-testflight-reusable.yml'); YAML.load_file('.github/workflows/ios-testflight.yml'); YAML.load_file('.github/workflows/build-and-release.yml')"
```

Expected: command exits successfully with no syntax error.

- [ ] **Step 2: Review workflow references**

Run:

```bash
rg -n "build-ios-release|upload-ios-testflight|APPLE_PROVISIONING_API|workflow_run|workflow_dispatch" .github/workflows mobile-shell/ios/README.md mobile-shell/README.md
```

Expected: the new workflow files reference the existing shell scripts, the dedicated trigger surface, and the documented optional Team API key path.

- [ ] **Step 3: Check git diff**

Run:

```bash
git diff -- .github/workflows/build-and-release.yml .github/workflows/_ios-testflight-reusable.yml .github/workflows/ios-testflight.yml mobile-shell/ios/README.md mobile-shell/README.md docs/superpowers/specs/2026-04-17-ios-testflight-workflow-design.md docs/superpowers/plans/2026-04-17-ios-testflight-workflow.md
```

Expected: diff shows the dedicated workflow extraction, documentation updates, and no unrelated file reverts.
