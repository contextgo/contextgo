# Blog Editorial Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the main-site `blog` section into a more professional editorial journal while keeping the existing content source and routing model intact.

**Architecture:** Keep `apps/web/src/content/blog/*` and the generated public-content pipeline unchanged. Replace the current generic blog index/article presentation with blog-specific editorial components and small shared theme utility extensions in the website app.

**Tech Stack:** Next.js App Router, React, Tailwind v4 utilities, existing ContextGo site theme tokens.

---

### Task 1: Add blog-specific presentation components

**Files:**

- Create: `apps/web/src/components/content/EditorialJournalIndex.tsx`
- Create: `apps/web/src/components/content/EditorialJournalArticle.tsx`
- Modify: `apps/web/src/app/[lang]/blog/page.tsx`
- Modify: `apps/web/src/app/[lang]/blog/[slug]/page.tsx`

- [ ] Build a blog index component with three zones: editorial hero, featured article, article ledger.
- [ ] Build a blog article component with a narrower reading column, stronger headline stack, and a calmer sidebar card.
- [ ] Switch blog routes to use the new components without changing content fetching logic.

### Task 2: Extend theme styling for editorial presentation

**Files:**

- Modify: `apps/web/src/app/globals.css`

- [ ] Add reusable utility classes or content styles for editorial hero blocks, overlines, list separators, and improved blog article typography.
- [ ] Keep styling aligned with the existing site palette and typography rather than introducing a separate visual language.

### Task 3: Verify locally

**Files:**

- Verify only

- [ ] Run the website content build and local dev server.
- [ ] Check the main blog index and one article route in the local preview.
- [ ] Run at least one lightweight verification command after edits.
