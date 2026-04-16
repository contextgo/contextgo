# CI Workflow Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make default GitHub Actions execution lightweight while shrinking the workflow surface to product-critical pipelines plus a single manual QA entry point.

**Architecture:** Keep the core product workflows (`pr-checks`, `deploy-site`, `build-and-release`, `_build-reusable`), tighten triggers so only lightweight PR checks run automatically, and merge the remaining human-triggered debugging tasks into one `manual-qa.yml` workflow. Remove orphaned sidecar workflows and dead AI-review actions.

**Tech Stack:** GitHub Actions workflow YAML, composite actions, repository documentation

---

### Task 1: Document the governance decision

**Files:**

- Create: `docs/superpowers/specs/2026-04-16-ci-workflow-governance-design.md`
- Create: `docs/superpowers/plans/2026-04-16-ci-workflow-governance.md`

- [ ] Capture the approved design that defines lightweight automatic PR checks and explicit-only heavy workflows.
- [ ] Record the intended labels and manual-only workflow list so later changes have a source of truth.

### Task 2: Tighten PR workflow defaults

**Files:**

- Modify: `.github/workflows/pr-checks.yml`

- [ ] Change the default PR platform scope from `all` to `linux-only`.
- [ ] Add PR label events so label-gated jobs can react without reopening the PR.
- [ ] Keep lightweight jobs on normal PR lifecycle events only.
- [ ] Gate expensive jobs behind explicit PR labels and preserve manual dispatch behavior.

### Task 3: Remove automatic expensive workflow starts

**Files:**

- Modify: `.github/workflows/build-and-release.yml`
- Create: `.github/workflows/manual-qa.yml`
- Delete: `.github/workflows/build-manual.yml`
- Delete: `.github/workflows/pr-e2e-artifacts.yml`
- Delete: `.github/workflows/bump-homebrew.yml`
- Delete: `.github/workflows/gpt-review.yml`
- Delete: `.github/workflows/gpt-pr-assessment.yml`
- Delete: `.github/workflows/ai_pr_reviewer.yml`
- Delete: `.github/workflows/project-automation.yml`
- Delete: `.github/workflows/README.md`

- [ ] Remove automatic release packaging on branch push.
- [ ] Merge manual build and E2E tooling into a single `manual-qa.yml`.
- [ ] Remove sidecar workflows that are no longer part of the core delivery path.

### Task 4: Update operator-facing workflow docs

**Files:**

- Modify: `.github/CICD_SETUP.md`
- Modify: `docs/superpowers/specs/2026-04-16-ci-workflow-governance-design.md`
- Modify: `docs/superpowers/plans/2026-04-16-ci-workflow-governance.md`

- [ ] Document the `ci:build-test` and `ci:coverage` labels and the lightweight default PR path.
- [ ] Replace old manual build / E2E workflow references with `manual-qa.yml`.
- [ ] Align CI setup guidance with the reduced workflow surface.

### Task 5: Remove dead GitHub composite actions

**Files:**

- Delete: `.github/actions/call-openai/action.yml`
- Delete: `.github/actions/gather-pr-diff/action.yml`
- Delete: `.github/actions/read-file-contents/action.yml`

- [ ] Remove composite actions that were only used by deleted AI review workflows.

### Task 6: Verify edited workflow configuration

**Files:**

- Modify: files touched above as needed

- [ ] Parse the edited workflow YAML files with a YAML parser.
- [ ] Run targeted repository checks over the changed workflow/docs files.
- [ ] Review the final diff to confirm the governance model matches the approved design.
