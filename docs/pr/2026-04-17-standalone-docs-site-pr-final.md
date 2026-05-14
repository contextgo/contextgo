# Standalone Docs Site PR Description

## Title

`feat(docs): launch standalone docs.contextgo.io site and redirect public docs entry`

## What Changed

- added a standalone Docusaurus docs app under `apps/docs/`
- added a dedicated Cloudflare Pages deployment workflow for `docs.contextgo.io`
- redirected public website `/docs` routes to the standalone docs site
- updated app-facing public docs URLs to use `docs.contextgo.io`
- shipped a first complete product-docs structure in `zh-Hans` and `en`
- added planning docs for IA, use cases, PR summary, and deployment checklist

## Why

The old public docs path had three structural problems:

1. it was tightly coupled to `contextgo-releases`
2. it depended on a custom export/fetch pipeline
3. the public copy read too much like internal release-facing guidance

This PR moves public docs to a standalone product-docs model:

- standalone domain: `docs.contextgo.io`
- docs treated as website content, not release artifacts
- product-user-first structure
- use-case-first entry paths

## Scope

### Standalone docs app

New app:

- `apps/docs/`

Key files:

- `apps/docs/docusaurus.config.js`
- `apps/docs/sidebars.js`
- `apps/docs/README.md`
- `apps/docs/docs/`
- `apps/docs/i18n/en/docusaurus-plugin-content-docs/current/`

### Docs deployment

New workflow:

- `.github/workflows/deploy-docs.yml`

### Main site redirect

Updated routes:

- `apps/web/src/app/[lang]/docs/page.tsx`
- `apps/web/src/app/[lang]/docs/[slug]/page.tsx`

Added helper:

- `apps/web/src/lib/docsSite.ts`

Updated app-facing docs URLs:

- `src/common/update/publicUrls.ts`

### Root scripts

Added:

- `docs:install`
- `docs:dev`
- `docs:build`
- `docs:serve`

## Verification

Ran successfully:

```bash
cd apps/docs
npm run build
```

```bash
cd apps/web
npm ci
npm run build
```

Results:

- standalone docs site builds successfully
- English locale output builds successfully
- public website `/[lang]/docs` routes remain valid and redirect to the standalone docs site

## Required Deployment Config

### GitHub Actions secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### GitHub Actions variables

- `DOCS_CLOUDFLARE_PROJECT_NAME`
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH`
- `NEXT_PUBLIC_DOCS_SITE_URL`

### Cloudflare Pages

- one dedicated Pages project for docs
- custom domain bound to `docs.contextgo.io`

## Commit Structure

1. `6ad2f2e6` `feat(docs): scaffold standalone docs site`
2. `ed0f3d06` `feat(web): redirect public docs to docs site`
3. `4cc76aaf` `docs(planning): add docs IA and use-case drafts`
4. `954bf615` `docs(pr): add standalone docs site PR draft`
5. `146bfab8` `docs(pr): add docs deployment checklist`

## Notes

- English content is now structurally present, but further editorial polish is still expected
- old release-docs rendering is no longer the intended public product-docs surface
