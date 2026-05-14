# Publish Object Catalog Refresh Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make publish-object refresh explicit in the publication page so users can rerun catalog/session loading and immediately see repaired object identity state.

**Architecture:** Keep the existing publish-object resolution pipeline unchanged and expose it through a renderer-level manual refresh action. The publication page will reuse the current catalog/session fetch path, preserve current selection state, and update object refresh badges after reload.

**Tech Stack:** TypeScript, React, Arco Design, Vitest.

---

### Task 1: Manual Refresh DOM Test

**Files:**

- Modify: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a DOM test that:

- renders the publication panel with an initial fallback object
- clicks a new refresh button
- verifies the second catalog load returns a backfilled object state
- expects the badge to switch from `Needs identification` to `Backfilled`

- [ ] **Step 2: Run the DOM test to verify it fails**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: FAIL because the publication panel does not expose a manual refresh action yet.

### Task 2: Publication Page Refresh Action

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx`

- [ ] **Step 1: Add a manual refresh trigger**

Implement:

- a refresh button in the published-object section header
- the button reuses `loadCatalog()`
- loading state is surfaced through the existing `loading` flag
- current agent selection and editor state remain intact

- [ ] **Step 2: Verify refreshed state is rendered**

Implement:

- refreshed catalog/session payload replaces previous page state
- publish-object badges re-evaluate from the latest `refreshState`
- initial page load behavior stays unchanged

- [ ] **Step 3: Run the DOM test to verify it passes**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

### Task 3: Verification

**Files:**

- Modify: `docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase2.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
bunx tsc --noEmit
bunx oxfmt --check src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase2.md
```

Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx docs/superpowers/plans/2026-04-15-publish-object-catalog-refresh-phase2.md
git commit -m "feat(renderer): refresh publication object catalog on demand"
```
