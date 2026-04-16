# CI Workflow Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make default GitHub Actions execution lightweight while moving expensive CI, release, and verification paths behind manual dispatch or explicit PR labels.

**Architecture:** Keep the existing workflow set, but tighten triggers and job conditions so only lightweight PR checks run automatically. Heavy jobs remain available, but they start only through manual dispatch or explicit labels. Add concurrency guards where manual workflows currently allow accidental overlap.

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
- Modify: `.github/workflows/bump-homebrew.yml`
- Modify: `.github/workflows/pr-e2e-artifacts.yml`
- Modify: `.github/workflows/build-manual.yml`

- [ ] Remove automatic release packaging on branch push.
- [ ] Remove scheduled Homebrew verification.
- [ ] Add effective concurrency groups to manual heavy workflows.

### Task 4: Update operator-facing workflow docs

**Files:**

- Modify: `.github/workflows/README.md`
- Modify: `.github/CICD_SETUP.md`

- [ ] Rewrite GPT workflow docs to reflect explicit-only execution.
- [ ] Document the `ci:build-test` and `ci:coverage` labels and the lightweight default PR path.
- [ ] Align CI setup guidance with the new manual release model.

### Task 5: Verify edited workflow configuration

**Files:**

- Modify: files touched above as needed

- [ ] Parse the edited workflow YAML files with a YAML parser.
- [ ] Run targeted repository checks over the changed workflow/docs files.
- [ ] Review the final diff to confirm the governance model matches the approved design.
