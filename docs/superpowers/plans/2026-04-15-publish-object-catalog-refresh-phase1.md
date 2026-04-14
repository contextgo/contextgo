# Publish Object Catalog Refresh Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist explicit publish-object catalog refresh/backfill state so fallback entries can be distinguished from entries that have already been repaired by later object discovery.

**Architecture:** Extend the publish-object catalog model with lightweight refresh metadata computed from display quality and merge history. The publication service will persist that metadata and upgrade it when later inbound/runtime facts replace a technical fallback title with a readable object identity.

**Tech Stack:** TypeScript, Vitest, Electron main-process services.

---

### Task 1: Refresh-State Tests

**Files:**

- Modify: `tests/unit/process/projectChannelPublicationCatalog.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

- fallback/manual entries persist `needs-refresh` state
- later readable identities upgrade the same catalog entry to `ready` and stamp a backfill timestamp

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: FAIL because catalog refresh-state fields do not exist yet.

### Task 2: Refresh-State Persistence

**Files:**

- Modify: `src/process/channels/types.ts`
- Modify: `src/process/channels/core/ProjectChannelPublicationService.ts`

- [ ] **Step 1: Add refresh-state model**

Implement:

- catalog refresh status/reason types
- optional `refreshState` on `IChannelPublishObjectCatalogEntry`
- normalization/merge logic that persists refresh state

- [ ] **Step 2: Add backfill upgrade logic**

Implement:

- fallback entries become `needs-refresh`
- when a later higher-quality entry replaces a fallback title for the same object, persist `backfilledAt`
- preserve refresh-state history across repeated catalog writes

- [ ] **Step 3: Run the tests to verify they pass**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: PASS

### Task 3: Verification

**Files:**

- Modify: `docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase1.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts
bunx tsc --noEmit
bunx oxfmt --check src/process/channels/types.ts src/process/channels/core/ProjectChannelPublicationService.ts tests/unit/process/projectChannelPublicationCatalog.test.ts docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase1.md
```

Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add src/process/channels/types.ts src/process/channels/core/ProjectChannelPublicationService.ts tests/unit/process/projectChannelPublicationCatalog.test.ts docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase1.md
git commit -m "feat(channels): persist publish object refresh state"
```
