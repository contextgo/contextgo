# Karpathy Coding Guard Agent Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new built-in engineering Agent Package that absorbs Andrej Karpathy-inspired coding constraints into a standalone, out-of-the-box ContextGo assistant.

**Architecture:** Add a new bundled package root under `src/process/resources/assistant/engineering/karpathy-coding-guard`, register it in the bundled preset catalog, and keep the first version focused on runtime rules, packaged skills, and workspace scaffold only. Reuse the existing bundled package manifest flow so the assistant becomes visible, bootstrappable, and readable everywhere that already consumes `agent-package.json`, `AGENTS.md`, and packaged skills.

**Tech Stack:** TypeScript, bundled agent-package manifest protocol, Vitest 4, existing preset registry utilities, packaged markdown/skill assets.

---

### Task 1: Lock The New Built-In Assistant Into The Catalog With Failing Tests

**Files:**

- Modify: `tests/unit/common/config/builtinAssistantDefaults.test.ts`
- Modify: `tests/unit/common/config/agentPackageManifest.test.ts`
- Modify: `tests/unit/presetAssistantResources.test.ts`

- [ ] **Step 1: Add failing expectations for the new builtin assistant in defaults tests**

Add a new constant and assertions for `builtin-karpathy-coding-guard`, then extend the expected builtin list length and ids order.

- [ ] **Step 2: Run the defaults test to verify it fails**

Run: `bun run test tests/unit/common/config/builtinAssistantDefaults.test.ts`
Expected: FAIL because `builtin-karpathy-coding-guard` is not built yet.

- [ ] **Step 3: Add manifest coverage expectations for the new package**

Extend the manifest test cases so the package count and expected scaffold targets include the new engineering package.

- [ ] **Step 4: Run the manifest test to verify it fails**

Run: `bun run test tests/unit/common/config/agentPackageManifest.test.ts`
Expected: FAIL because the new package root and manifest do not exist yet.

- [ ] **Step 5: Add preset resource fallback expectations**

Add a `builtin-karpathy-coding-guard` fallback case that expects bundled `AGENTS.md` rules and packaged default skills without hooks.

- [ ] **Step 6: Run the preset resources test to verify it fails**

Run: `bun run test tests/unit/presetAssistantResources.test.ts`
Expected: FAIL because the preset has no default skill payload yet.

### Task 2: Add The New Agent Package Assets

**Files:**

- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/AGENTS.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/agent-package.json`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/karpathy-coding-guard.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/karpathy-coding-guard.zh-CN.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/docs/README.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/docs/design.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/docs/design.zh-CN.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/workspace/AGENTS.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/workspace/docs/README.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/workspace/docs/assumptions/README.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/workspace/docs/changes/README.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/workspace/docs/verification/README.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/skills/assumption-audit/SKILL.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/skills/simplicity-first/SKILL.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/skills/surgical-change/SKILL.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/skills/goal-driven-execution/SKILL.md`
- Create: `src/process/resources/assistant/engineering/karpathy-coding-guard/skills/diff-minimization-review/SKILL.md`

- [ ] **Step 1: Write the package manifest and runtime entry documents**

Create a runtime-neutral `agent-package.json` with `workspaceScaffold` and `skills` payloads only, plus concise `AGENTS.md` and assistant rule markdown files.

- [ ] **Step 2: Write package notes and absorption design docs**

Document the upstream repo, commit, license, absorbed principles, and ContextGo-specific adaptations in `docs/`.

- [ ] **Step 3: Write the workspace scaffold**

Seed a minimal workspace documentation map focused on assumptions, change boundaries, and verification artifacts.

- [ ] **Step 4: Write the packaged skills**

Split the upstream single guideline into focused packaged skills for assumption handling, simplicity, surgical edits, goal-driven execution, and diff review.

- [ ] **Step 5: Run the manifest test to verify the package assets pass**

Run: `bun run test tests/unit/common/config/agentPackageManifest.test.ts`
Expected: PASS with the new package root and scaffold targets recognized.

### Task 3: Register The Preset And Make It Bootstrappable

**Files:**

- Modify: `src/common/config/presets/assistantPresets.ts`
- Modify: `src/common/config/presets/builtinAssistantDefaults.ts`
- Modify: `src/common/config/presets/bundledAgentPackageRegistry.ts`

- [ ] **Step 1: Add the preset metadata**

Register `karpathy-coding-guard` in `ASSISTANT_PRESETS` with localized name, description, prompts, and workspace bootstrap hint.

- [ ] **Step 2: Add the manifest import and descriptor**

Register the package in `BUNDLED_AGENT_PACKAGE_DESCRIPTORS`.

- [ ] **Step 3: Mark the new assistant as enabled by default**

Add `karpathy-coding-guard` to `DEFAULT_ENABLED_BUILTIN_PRESET_IDS`.

- [ ] **Step 4: Run the defaults and preset-resource tests**

Run:
`bun run test tests/unit/common/config/builtinAssistantDefaults.test.ts`
`bun run test tests/unit/presetAssistantResources.test.ts`

Expected: PASS with the new preset exposed as a featured built-in assistant and bundled default skills available.

### Task 4: Verify Type Safety And Finish The Delivery Notes

**Files:**

- Modify: `src/process/resources/assistant/README.md`
- Optional: `docs/superpowers/plans/2026-04-17-karpathy-coding-guard-agent-package.md`

- [ ] **Step 1: Update the bundled assistant catalog notes**

Add the new engineering package to `src/process/resources/assistant/README.md`.

- [ ] **Step 2: Run focused verification**

Run:
`bunx tsc --noEmit`
`bun run test tests/unit/common/config/agentPackageManifest.test.ts`
`bun run test tests/unit/common/config/builtinAssistantDefaults.test.ts`
`bun run test tests/unit/presetAssistantResources.test.ts`

Expected: PASS for all commands.

- [ ] **Step 3: Review the diff for scope discipline**

Run: `git status --short` and `git diff --stat`
Expected: Only the new package, registry/preset wiring, tests, and package catalog notes are changed.

- [ ] **Step 4: Prepare issue and PR drafts**

Summarize the motivation, problem statement, solution shape, verification, and absorbed upstream references so the branch can be opened as a clean PR.
