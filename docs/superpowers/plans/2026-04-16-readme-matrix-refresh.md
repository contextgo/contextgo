# README Matrix Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the public README surfaces for `contextgo`, `connector`, `skillmarket`, and `contextgo-releases` so they share one product narrative and one bilingual documentation pattern.

**Architecture:** Keep `contextgo` as the main product and brand entry point, and reposition the other three repositories as product-matrix subprojects. Each repository gets a Chinese-first `README.md`, a full English `README_EN.md`, and stable README-friendly brand assets where needed.

**Tech Stack:** Markdown, GitHub README rendering, lightweight PNG asset reuse, git / GitHub PR workflow.

---

### Task 1: Add the design and planning records

**Files:**

- Create: `docs/superpowers/specs/2026-04-16-readme-matrix-refresh-design.md`
- Create: `docs/superpowers/plans/2026-04-16-readme-matrix-refresh.md`

- [ ] **Step 1: Write the design record**

Document the approved narrative, repository roles, visual direction, and verification scope in the design spec.

- [ ] **Step 2: Write the implementation plan**

Document the four-repository README rewrite scope and the expected verification steps in the plan file.

- [ ] **Step 3: Review both files for ambiguity**

Check that the repository names, language strategy, and scope boundaries are explicit and consistent.

### Task 2: Rewrite the main product README in `contextgo`

**Files:**

- Modify: `README.md`
- Create: `README_EN.md`

- [ ] **Step 1: Replace the outdated Chinese root README**

Lead with the ContextGo product definition: Harness Agent, Agent Group, Context Engine, Context Connector, host/client, and local-first execution.

- [ ] **Step 2: Add the full English companion README**

Mirror the same structure and boundaries in clear English, without reviving the old "Cowork app" framing.

- [ ] **Step 3: Check local image references**

Make sure every local image used by the rewritten README exists under `resources/`.

### Task 3: Add shared subproject brand assets

**Files:**

- Create: `connector/docs/assets/contextgo-readme-header.png`
- Create: `connector/docs/assets/contextgo-logo.png`
- Create: `skillmarket/market/assets/contextgo-readme-header.png`
- Create: `skillmarket/market/assets/contextgo-logo.png`
- Create: `contextgo-releases/docs/assets/contextgo-readme-header.png`
- Create: `contextgo-releases/docs/assets/contextgo-logo.png`

- [ ] **Step 1: Create target asset directories where needed**

Use existing documentation-adjacent directories when possible so README assets stay easy to discover.

- [ ] **Step 2: Copy the shared ContextGo brand assets**

Reuse stable existing assets from the main product repository so the subproject READMEs stay self-contained.

### Task 4: Rewrite the `connector` repository README

**Files:**

- Modify: `connector/README.md`
- Create: `connector/README_EN.md`

- [ ] **Step 1: Reposition the repository narrative**

Explain `connector` as ContextGo's open connector and controlled-execution boundary, not just an internal CLI reference.

- [ ] **Step 2: Keep technical usage practical**

Preserve the useful `cgo` quick-start and boundary explanations, but move them below the product framing.

- [ ] **Step 3: Add the English companion**

Mirror the same structure and positioning in `README_EN.md`.

### Task 5: Rewrite the `skillmarket` repository README

**Files:**

- Modify: `skillmarket/README.md`
- Create: `skillmarket/README_EN.md`

- [ ] **Step 1: Reframe the repository as a market/distribution layer**

Explain the repository in terms of skill discovery, mirroring, curation, bundling, and static delivery for Agent ecosystems.

- [ ] **Step 2: Retain the real operational commands**

Keep the current mirror and deployment commands, but present them as implementation details of the product layer.

- [ ] **Step 3: Add the English companion**

Mirror the same structure in `README_EN.md`.

### Task 6: Rewrite the `contextgo-releases` repository README

**Files:**

- Modify: `contextgo-releases/README.md`
- Create: `contextgo-releases/README_EN.md`

- [ ] **Step 1: Reframe the repository as the public release endpoint**

Explain the relationship between the main product repository and the public release repository.

- [ ] **Step 2: Preserve the operational boundary**

Keep the current release / website export explanations, but restructure them around public distribution responsibilities.

- [ ] **Step 3: Add the English companion**

Mirror the same structure in `README_EN.md`.

### Task 7: Verify and prepare delivery

**Files:**

- Modify: `README.md`
- Create: `README_EN.md`
- Modify: `connector/README.md`
- Create: `connector/README_EN.md`
- Modify: `skillmarket/README.md`
- Create: `skillmarket/README_EN.md`
- Modify: `contextgo-releases/README.md`
- Create: `contextgo-releases/README_EN.md`

- [ ] **Step 1: Run whitespace and patch checks**

Run `git diff --check` in each repository to catch broken patch output and whitespace issues.

- [ ] **Step 2: Validate local README asset paths**

Check that each README-referenced local image file exists in the repository where it is referenced.

- [ ] **Step 3: Review cross-repo links**

Confirm repository links point to the correct GitHub remotes.

- [ ] **Step 4: Commit, push, and open PRs**

Create one docs-focused commit per repository, push the branches, create any missing issues, then open one PR per repository.
