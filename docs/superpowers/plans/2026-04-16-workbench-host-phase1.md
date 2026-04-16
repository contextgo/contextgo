# Workbench Host Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the first real `WorkbenchHost` layer so conversation becomes an explicit workbench slice instead of the implicit middle-area default.

**Architecture:** Add a lightweight renderer host container and context, then route `/conversation/:id` through it with `workbenchKind='conversation-cowork'`. Keep `ChatLayout` untouched so this change establishes architecture before broader UI migration.

**Tech Stack:** React, React Router, TypeScript, Vitest

---

### Task 1: Add the failing route-host test

**Files:**

- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`

- [ ] Assert that the conversation route mounts through `WorkbenchHost`.
- [ ] Verify `workbenchKind='conversation-cowork'`.

### Task 2: Add the minimal host abstraction

**Files:**

- Create: `src/renderer/pages/WorkbenchHost/index.tsx`
- Create: `src/renderer/pages/WorkbenchHost/context.ts`
- Modify: `src/renderer/components/layout/Router.tsx`

- [ ] Add the first `WorkbenchHost` container.
- [ ] Add `WorkbenchKind` typing and context.
- [ ] Route `/conversation/:id` through the new host layer.

### Task 3: Verify the shell still behaves

**Files:**

- Test: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Test: `tests/unit/renderer/layout/Sider.dom.test.tsx`
- Test: `tests/unit/renderer/Titlebar.dom.test.tsx`

- [ ] Re-run shell/router regression tests.
- [ ] Run `bunx tsc --noEmit --pretty false`.
