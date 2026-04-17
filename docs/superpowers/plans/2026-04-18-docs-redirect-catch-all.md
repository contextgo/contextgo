# Docs Redirect Catch-All Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve complete legacy `contextgo.io/[lang]/docs/**` redirects after moving public docs to `docs.contextgo.io`.

**Architecture:** Keep `apps/web` as the redirecting shell and `apps/docs` as the standalone docs site. Extend the shared docs redirect helper to accept nested paths, then switch the Next.js route from a single-segment slug to a catch-all route so old multi-level docs URLs redirect without truncation.

**Tech Stack:** Next.js App Router, TypeScript, Vitest

---

### Task 1: Lock Redirect Semantics With Tests

**Files:**

- Create: `tests/unit/web/docsSite.test.ts`
- Modify: `apps/web/src/lib/docsSite.ts`

- [ ] **Step 1: Write the failing test**
  Add expectations for:
  - `getDocsSiteUrl()` returning `https://docs.contextgo.io`
  - `getDocsSiteUrl('quick-start')` returning `https://docs.contextgo.io/start-here/quick-start`
  - `getDocsSiteUrl(['start-here', 'quick-start'])` returning `https://docs.contextgo.io/start-here/quick-start`

- [ ] **Step 2: Run test to verify it fails**
  Run: `bunx vitest run tests/unit/web/docsSite.test.ts`
  Expected: FAIL because the helper does not accept nested path segments yet.

- [ ] **Step 3: Write minimal implementation**
  Update `apps/web/src/lib/docsSite.ts` so the resolver accepts either a single slug string or a string-array catch-all path and normalizes both into the standalone docs URL.

- [ ] **Step 4: Run test to verify it passes**
  Run: `bunx vitest run tests/unit/web/docsSite.test.ts`
  Expected: PASS

### Task 2: Restore Catch-All Redirect Routing

**Files:**

- Delete: `apps/web/src/app/[lang]/docs/[slug]/page.tsx`
- Create: `apps/web/src/app/[lang]/docs/[...slug]/page.tsx`
- Modify: `apps/web/src/lib/docsSite.ts`
- Test: `tests/unit/web/docsSite.test.ts`

- [ ] **Step 1: Write the route change**
  Replace the single-segment docs route with a catch-all route that forwards `params.slug` into `getDocsSiteUrl`.

- [ ] **Step 2: Run focused tests**
  Run: `bunx vitest run tests/unit/web/docsSite.test.ts`
  Expected: PASS and no redirect-helper regression.

- [ ] **Step 3: Run typecheck for touched app code**
  Run: `bunx tsc --noEmit`
  Expected: PASS
