# Site Content Publishing Guide

This document defines where ContextGo website content should be edited, which workflow publishes it, and when a content change also requires a release-repository sync.

Use this before updating:

- `contextgo.io`
- `docs.contextgo.io`
- blog article copy
- release-facing docs/blog payloads exported to `contextgo/contextgo-releases`

## Quick Answer

### If you are updating `docs.contextgo.io`

Edit:

- `apps/docs/docs/` for Chinese docs
- `apps/docs/i18n/en/docs/` for English docs
- `apps/docs/navigation.js` for docs navigation

Publish behavior:

- push to `main`
- GitHub Actions automatically runs `.github/workflows/deploy-docs.yml`
- that workflow validates, exports, and deploys `docs.contextgo.io`

### If you are updating blog layout or blog page behavior on `contextgo.io`

Edit:

- `apps/web/src/components/content/ContentIndexPage.tsx`
- `apps/web/src/components/content/ContentArticlePage.tsx`
- `apps/web/src/app/globals.css`
- related `apps/web/` page or site-content files

Publish behavior:

- push to `main`
- GitHub Actions automatically runs `.github/workflows/deploy-site.yml`
- that workflow deploys `contextgo.io`

### If you are updating blog article content

Authoring source:

- `apps/web/src/content/blog/zh/`
- `apps/web/src/content/blog/en/`

Important production rule:

- local development prefers these draft files directly
- production blog content is resolved from `contextgo/contextgo-releases/site/blog/...`
- the relevant fetch logic lives in `apps/web/src/lib/releaseBlog.ts`

Publish behavior:

- push to `main`
- GitHub Actions automatically runs `.github/workflows/sync-blog-content.yml`
- that workflow exports `site/blog/**` into `contextgo/contextgo-releases`
- production then resolves the updated payloads through `apps/web/src/lib/releaseBlog.ts`

Operational meaning:

- blog UI or layout change: push to `main` is enough
- blog article copy change: push to `main` is enough

## Content Source Of Truth

### 1. Main site

The main public website lives in:

- `apps/web/`

This includes:

- homepage
- download page
- changelog page
- blog layout and rendering
- redirect behavior for `/docs`

Automatic deploy workflow:

- `.github/workflows/deploy-site.yml`

Trigger:

- push to `main` with changes under `apps/web/**`

### 2. Standalone docs site

The public docs site lives in:

- `apps/docs/`

This is the source of truth for:

- `docs.contextgo.io`
- Mintlify navigation
- standalone docs-site branding and docs-only structure

Automatic deploy workflow:

- `.github/workflows/deploy-docs.yml`

Trigger:

- push to `main` with changes under `apps/docs/**`

### 3. Release-facing public docs and blog payloads

Structured public payloads are exported from the source repository into:

- `contextgo/contextgo-releases`
- specifically under `site/docs/` and `site/blog/`

The export logic lives in:

- `scripts/release/export-release-site-content.mjs` for tagged release docs + blog payload exports
- `scripts/release/export-release-blog-content.mjs` for ordinary blog-content syncs

The release workflow that performs the sync lives in:

- `.github/workflows/build-and-release.yml`

The blog-only sync workflow lives in:

- `.github/workflows/sync-blog-content.yml`

This is the source that production `apps/web` reads for:

- release docs payloads through `apps/web/src/lib/releaseDocs.ts`
- production blog payloads through `apps/web/src/lib/releaseBlog.ts`

## Current Recommended Editing Rules

### Customer-facing docs updates

When the goal is to update `docs.contextgo.io`, edit only:

- `apps/docs/docs/**`
- `apps/docs/i18n/en/docs/**`
- `apps/docs/navigation.js`

Do not start with `apps/web/src/content/docs/**` for normal docs-site copy updates.

### Blog article updates

When the goal is to update the public blog article text, edit:

- `apps/web/src/content/blog/zh/**`
- `apps/web/src/content/blog/en/**`

Then:

1. verify locally in `apps/web`
2. merge to `main`
3. let `.github/workflows/sync-blog-content.yml` sync `contextgo-releases/site/blog/**`

Production blog payload publishing is automatic for normal article-source changes.

### Blog presentation updates

When the goal is to update blog spacing, typography, metadata blocks, or article-page layout, edit:

- `apps/web/src/components/content/**`
- `apps/web/src/app/globals.css`
- `apps/web/src/lib/site-content/**`

These changes deploy through `.github/workflows/deploy-site.yml` on push to `main`.

### Versioned release-doc payload updates

`apps/web/src/content/docs/**` should be treated as the release-payload source, not the primary authoring surface for the standalone public docs site.

Edit that tree when the goal is to:

- change release-exported docs payloads
- maintain website fallback docs content
- sync versioned docs into `contextgo-releases/site/docs/**`

## Local Preview Commands

### Main site and blog

```bash
cd apps/web
npm run dev
```

### Standalone docs site

```bash
cd apps/docs
npm run dev
```

## Do Not Edit By Hand

Do not manually edit exported content in `contextgo-releases/site/**` unless there is an emergency production repair.

Normal flow should remain:

1. edit source content in this repository
2. verify locally
3. let the matching workflow publish it

## Current Automation Boundary

Today, the automation boundary is:

- `apps/docs` changes: automatically deploy `docs.contextgo.io`
- `apps/web` code or layout changes: automatically deploy `contextgo.io`
- blog article source changes: automatically sync `contextgo-releases/site/blog/**`
- release docs payload sync into `contextgo-releases/site/docs/**`: still tied to the tagged release workflow
