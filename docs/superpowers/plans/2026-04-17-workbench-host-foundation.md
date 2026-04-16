# Workbench Host Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a minimal `WorkbenchHost` layer so conversation becomes an explicit workbench slice instead of the renderer's implicit default middle-area surface.

**Architecture:** Add a small renderer host container plus typed context, then route `/conversation/:id` through it with `workbenchKind='conversation-cowork'`. Keep `ChatLayout` unchanged so this PR only establishes the host boundary required by `#188`.

**Tech Stack:** React, React Router, TypeScript, Vitest

---

### Task 1: Add the failing route-host regression test

**Files:**

- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`

- [ ] Add a mocked `WorkbenchHost` wrapper.
- [ ] Assert the conversation route renders inside the host container.
- [ ] Assert the host receives `workbenchKind='conversation-cowork'`.
- [ ] Run the focused router test and confirm it fails because the host layer does not exist yet.

### Task 2: Add the minimal renderer host abstraction

**Files:**

- Create: `src/renderer/pages/WorkbenchHost/context.ts`
- Create: `src/renderer/pages/WorkbenchHost/index.tsx`
- Modify: `src/renderer/components/layout/Router.tsx`

- [ ] Add `WorkbenchKind` typing and context.
- [ ] Add the minimal `WorkbenchHost` provider/container component.
- [ ] Route `/conversation/:id` through `WorkbenchHost`.
- [ ] Re-run the focused router test and confirm it passes.

### Task 3: Verify shell regressions stay green

**Files:**

- Test: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Test: `tests/unit/renderer/layout/Sider.dom.test.tsx`
- Test: `tests/unit/renderer/Titlebar.dom.test.tsx`

- [ ] Re-run the focused renderer shell tests.
- [ ] Run `bunx tsc --noEmit --pretty false`.
