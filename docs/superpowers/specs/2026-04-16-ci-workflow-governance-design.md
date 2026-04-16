# CI Workflow Governance Design

**Date:** 2026-04-16
**Status:** Approved for implementation
**Source:** User request to reduce GitHub Actions spend for a private repository under paid usage

## Overview

The repository currently allows several GitHub Actions paths that can consume significant hosted-runner minutes or external API budget:

- PR checks can expand into longer-running CI jobs
- release packaging can start automatically from branch pushes
- Homebrew verification runs on a daily schedule
- AI review workflows are documented as auto-triggered even though the governance target is explicit-only execution

This design changes the default CI posture to **lightweight by default, expensive by explicit intent**.

## Goals

- Keep default PR automation limited to lightweight checks.
- Reduce workflow surface area to the small set of product-critical pipelines.
- Require a maintainer action for expensive CI paths such as build tests, release packaging, and manual QA.
- Make CI intent visible in workflow logic instead of relying on team memory.
- Preserve the ability to run heavy workflows when they are genuinely needed.

## Non-Goals

- Redesign the release artifact format or distribution strategy.
- Remove existing heavy workflows from the repository.
- Rework hosted-services deployment triggers unless required for CI governance.
- Introduce new external services or GitHub Apps for workflow orchestration.

## Current Cost Risks

### 1. PR workflow can consume more than the lightweight baseline

`pr-checks.yml` includes multi-job CI and a long-running `build-test` matrix with a 45-minute timeout per platform. Even with `skip_build_test`, the default automatic path is still broader than the desired low-cost baseline.

### 2. Release packaging starts automatically from branch pushes

`build-and-release.yml` currently reacts to `push` on `main`. That means a normal merge can start release packaging minutes across multiple platforms without an explicit release decision.

### 3. The workflow surface contains sidecar automation not central to product delivery

AI review workflows, Homebrew verification, and dormant project automation all expand the maintenance surface without belonging to the core product-delivery path.

## Evaluated Approaches

### Approach A: Only tighten timeouts

Reduce `timeout-minutes` and keep the current trigger model.

Pros:

- smallest change
- low migration cost

Cons:

- does not stop accidental workflow starts
- still spends minutes on runs that should never have started

### Approach B: Manual-only for everything expensive, plus workflow consolidation

Remove automatic triggers for release and scheduled work, gate PR-expensive jobs behind explicit labels, and collapse overlapping manual tooling flows.

Pros:

- directly aligns cost with maintainer intent
- easy to explain
- reduces accidental spend the most

Cons:

- maintainers must remember the opt-in labels and manual workflows

### Approach C: Variable-driven soft governance

Keep triggers but ask maintainers to control scope through repository variables.

Pros:

- flexible
- low YAML churn

Cons:

- still relies on operational discipline
- easy to misconfigure back into expensive defaults

### Recommendation

Use **Approach B: Manual-only for everything expensive**.

## Final Design

### PR Checks

`pr-checks.yml` should become a lightweight default PR workflow.

Automatic PR events should only run:

- code quality checks
- Linux-scoped lightweight unit tests
- i18n validation

Expensive PR jobs should require explicit intent:

- `build-test` runs only when the PR carries label `ci:build-test`
- `coverage-tests` runs only when the PR carries label `ci:coverage`

Label changes must be observable by the workflow, so PR events should include `labeled` and `unlabeled`. Lightweight jobs must not rerun on label-only events.

The default platform scope should move from `all` to `linux-only`.

### Release Packaging

`build-and-release.yml` should become manual-only via `workflow_dispatch`. A release build must start only when a maintainer chooses to run it.

The workflow should also gain a repository-level concurrency gate so duplicate manual release runs do not execute in parallel.

### Manual QA Consolidation

`build-manual.yml` and `pr-e2e-artifacts.yml` should become a single `manual-qa.yml` workflow with explicit task inputs:

- `build`
- `e2e-artifacts`
- `runner-health`

This keeps the manual debugging surface available while reducing the number of entry points maintainers need to remember.

### Sidecar Workflow Removal

The following workflows should be removed from the main repository workflow surface:

- AI review workflows
- Homebrew verification workflow
- dormant project automation workflow

### Documentation

Workflow documentation should explicitly describe:

- the lightweight default PR path
- the opt-in labels for heavier PR checks
- the reduced workflow surface after removing sidecar automation
- the `manual-qa.yml` entry point for human-triggered debugging and validation

## Trigger Contract

### Automatic by default

- PR code quality
- PR Linux unit tests
- PR i18n validation
- hosted services deploys that are intentionally left outside this governance change

### Explicit by label

- `ci:build-test`
- `ci:coverage`

### Manual only

- release packaging
- manual QA tasks (`build`, `e2e-artifacts`, `runner-health`)

## Verification Strategy

- parse the edited workflow YAML files with a YAML parser
- inspect key `if` conditions and event types in the rendered source
- run targeted repository checks relevant to changed docs and workflow files

## Risks

- maintainers may forget the opt-in labels when they actually need heavier PR validation
- release operations become slightly more manual
- a combined manual QA workflow can grow broad if new tasks are added carelessly

## Risk Mitigation

- encode the labels directly in workflow conditions
- document the labels and consolidated workflow surface in CI setup docs
- keep the `manual-qa.yml` task list narrow and explicit
