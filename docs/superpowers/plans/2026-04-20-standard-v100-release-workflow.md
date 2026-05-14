# Standard v1.0.0 Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the standard public `v1.0.0` tag release path with the approved conservative release model: desktop + Android + HarmonyOS on tag push, iOS manual-only.

**Architecture:** Keep the change localized to the existing GitHub Actions workflow. Adjust job-level conditions for Android and HarmonyOS so compliant `v*` tag pushes automatically include those artifacts in the existing release assembly step, while preserving manual dispatch booleans and leaving iOS unchanged.

**Tech Stack:** GitHub Actions workflow YAML, existing release asset scripts, Bun project verification commands

---

### Task 1: Update Standard Release Trigger Semantics

**Files:**

- Modify: `.github/workflows/build-and-release.yml`

- [ ] **Step 1: Change Android build job condition**

Set the `build-android-shell` job `if:` expression so it runs for either:

```yaml
github.event_name == 'push'
```

or:

```yaml
github.event_name == 'workflow_dispatch' && inputs.build_android_shell
```

- [ ] **Step 2: Change HarmonyOS build job condition**

Set the `build-harmony-shell` job `if:` expression so it runs for either:

```yaml
github.event_name == 'push'
```

or:

```yaml
github.event_name == 'workflow_dispatch' && inputs.build_harmony_shell
```

- [ ] **Step 3: Leave iOS manual-only**

Do not change the `build-ios-shell` job condition. It must remain:

```yaml
github.event_name == 'workflow_dispatch' && inputs.build_ios_shell
```

### Task 2: Validate Release Assembly Compatibility

**Files:**

- Inspect: `.github/workflows/build-and-release.yml`

- [ ] **Step 1: Confirm release job still downloads all artifacts**

Verify the release job continues to use:

```yaml
uses: actions/download-artifact@v7
```

without narrowing artifact names, so Android and HarmonyOS artifacts are automatically included when those jobs run.

- [ ] **Step 2: Confirm release asset glob coverage**

Verify the release creation step still includes:

```yaml
release-assets/**/*.apk
release-assets/**/*.aab
release-assets/**/*.hap
release-assets/**/*.app
```

so no extra release-file wiring is required.

### Task 3: Verify And Prepare Clean Re-Release

**Files:**

- Modify: `docs/superpowers/plans/2026-04-20-standard-v100-release-workflow.md`

- [ ] **Step 1: Run workflow-focused verification**

Run:

```bash
bun run test
```

Expected: repository test suite exits successfully.

Then run:

```bash
bunx prettier --check .github/workflows/build-and-release.yml docs/superpowers/plans/2026-04-20-standard-v100-release-workflow.md
```

Expected: both files are correctly formatted.

- [ ] **Step 2: Review git diff**

Run:

```bash
git diff -- .github/workflows/build-and-release.yml docs/superpowers/plans/2026-04-20-standard-v100-release-workflow.md
```

Expected: only the approved conservative release behavior and its implementation plan are present.

- [ ] **Step 3: Commit the workflow update**

Run:

```bash
git add .github/workflows/build-and-release.yml docs/superpowers/plans/2026-04-20-standard-v100-release-workflow.md
git commit -m "fix(ci): include mobile release jobs in tag releases"
```

- [ ] **Step 4: Push and perform release cleanup**

After commit verification, push `main`, delete the existing public `v1.0.0` release and obsolete `v1.0.0` tags, then recreate `v1.0.0` from the updated release commit.
