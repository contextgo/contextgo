# Standalone Docs Site PR Draft

Date: 2026-04-17  
Branch: `docs/site-ia-review`

## Title

`feat(docs): launch standalone docs.contextgo.io site and redirect public docs entry`

## Summary

This branch introduces a standalone documentation site for `docs.contextgo.io`, migrates the public docs entry away from the old release-docs rendering path, and ships a first complete product-docs structure oriented around real user workflows instead of internal release language.

The change includes:

- a new standalone docs app under `apps/docs/`
- CI/CD workflow for docs deployment to Cloudflare Pages
- public website `/docs` redirect behavior to the standalone docs site
- updated public docs URL generation for app-facing links
- a first content set in both `zh-Hans` and `en`
- planning and IA documents that describe the product-architecture-driven doc model and use-case strategy

## Why This Change Exists

The old public docs path had three structural problems:

1. it was tightly coupled to `contextgo-releases`
2. it rendered public docs through a custom export/fetch pipeline
3. the content read too much like internal release-facing guidance instead of product-facing documentation

The new direction is:

- standalone docs domain: `docs.contextgo.io`
- documentation treated as website content, not release artifacts
- product-user-first structure
- use-case-first entry paths

## Scope

### 1. Standalone Docs App

New app:

- `apps/docs/`

Key files:

- [package.json](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/package.json)
- [docusaurus.config.js](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docusaurus.config.js)
- [sidebars.js](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/sidebars.js)
- [README.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/README.md)

The app is based on Docusaurus and supports:

- standalone deployment
- product-oriented navigation
- `zh-Hans + en` locale structure
- custom landing page layout

### 2. Docs Deployment Workflow

New workflow:

- [.github/workflows/deploy-docs.yml](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/.github/workflows/deploy-docs.yml)

This workflow:

- installs docs dependencies
- builds the docs site
- deploys `apps/docs/build` to Cloudflare Pages

### 3. Public Website Redirect To Standalone Docs

Updated website routes:

- [apps/web/src/app/[lang]/docs/page.tsx](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/web/src/app/[lang]/docs/page.tsx)
- [apps/web/src/app/[lang]/docs/[slug]/page.tsx](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/web/src/app/[lang]/docs/[slug]/page.tsx)

Added redirect helper:

- [apps/web/src/lib/docsSite.ts](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/web/src/lib/docsSite.ts)

This helper maps legacy public doc slugs to their new docs-site routes.

### 4. Updated Public Docs URLs

Updated app-facing public docs URL generation:

- [src/common/update/publicUrls.ts](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/src/common/update/publicUrls.ts)

This now points to:

- `https://docs.contextgo.io`

instead of:

- `https://contextgo.io/{lang}/docs/...`

### 5. Root Scripts

New root scripts:

- `docs:install`
- `docs:dev`
- `docs:build`
- `docs:serve`

File:

- [package.json](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/package.json)

### 6. Documentation Content Added

The docs app now includes:

- homepage
- Start Here
- Use Cases
- Workbench
- Context
- Agents & Capabilities
- Publish
- Collaboration
- Remote & Devices
- Manage

Key examples:

- [apps/docs/docs/index.mdx](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docs/index.mdx)
- [apps/docs/docs/use-cases/index.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docs/use-cases/index.md)
- [apps/docs/docs/context/context-engine.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docs/context/context-engine.md)
- [apps/docs/docs/publish/publish-overview.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docs/publish/publish-overview.md)
- [apps/docs/docs/remote/remote-access-overview.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/docs/remote/remote-access-overview.md)

English counterparts were added under:

- [apps/docs/i18n/en/docusaurus-plugin-content-docs/current](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/docs/i18n/en/docusaurus-plugin-content-docs/current)

### 7. Planning Docs Included

Included as supporting docs:

- [2026-04-17-public-docs-ia-review.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/docs/superpowers/2026-04-17-public-docs-ia-review.md)
- [2026-04-17-use-cases-batch1-drafts.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/docs/superpowers/2026-04-17-use-cases-batch1-drafts.md)
- [2026-04-17-use-cases-batch2-drafts.md](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/docs/superpowers/2026-04-17-use-cases-batch2-drafts.md)

## Verification

Validated in this branch:

### Docs App

Ran successfully:

```bash
cd apps/docs
npm run build
```

Result:

- generated static output in `apps/docs/build`
- generated English locale output in `apps/docs/build/en`

### Main Website

Ran successfully:

```bash
cd apps/web
npm ci
npm run build
```

Result:

- main website built successfully
- `/[lang]/docs` and `/[lang]/docs/[slug]` remained valid routes, now redirecting to the standalone docs site

## Required Deployment Configuration

### GitHub Actions Secrets

Required for docs deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### GitHub Actions Variables

Docs workflow variables:

- `DOCS_CLOUDFLARE_PROJECT_NAME`
  - default: `contextgo-docs`
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH`
  - default: `main`

Main website variable:

- `NEXT_PUBLIC_DOCS_SITE_URL`
  - recommended: `https://docs.contextgo.io`

### Cloudflare Pages

Expected setup:

- one dedicated Pages project for docs
- custom domain bound to `docs.contextgo.io`
- deployment triggered by GitHub Actions, not manual dashboard publishing

## Commit Structure

This branch was intentionally split into three commits:

1. `6ad2f2e6` `feat(docs): scaffold standalone docs site`
2. `ed0f3d06` `feat(web): redirect public docs to docs site`
3. `4cc76aaf` `docs(planning): add docs IA and use-case drafts`

This makes review easier:

- docs app creation and content
- public website redirect integration
- planning/reference docs

## Risks / Notes

### 1. Product Copy Will Continue To Evolve

The product-facing docs structure is now much stronger, but copy refinement should continue as product naming settles further.

### 2. English Content Is Now Structurally Present

The English site is no longer only a shell. However, some pages are still shorter and less polished than the Chinese originals. Further editorial pass is expected.

### 3. Old Release-Docs Path Is No Longer The Product Docs Surface

The public website docs routes now redirect out to the standalone docs site.

This is intentional and aligns the product with the standalone-docs direction.

## Suggested PR Description

### What changed

- added standalone `apps/docs` Docusaurus site for `docs.contextgo.io`
- added docs deployment workflow for Cloudflare Pages
- redirected public website `/docs` routes to the standalone docs site
- updated public docs URL generation to use `docs.contextgo.io`
- added first full product-docs structure in Chinese and English
- added planning docs for IA and use-case strategy

### Why

- decouple public docs from the release-artifact pipeline
- move public docs away from release-facing internal language
- establish a product-user-first docs structure
- support a real standalone docs domain with CI/CD deployment

### Verification

- `cd apps/docs && npm run build`
- `cd apps/web && npm ci && npm run build`

### Required deployment config

- Cloudflare Pages project for docs
- `DOCS_CLOUDFLARE_PROJECT_NAME`
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH`
- `NEXT_PUBLIC_DOCS_SITE_URL`
