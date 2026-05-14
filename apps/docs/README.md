# ContextGo Docs

This directory contains the standalone Mintlify documentation site for `docs.contextgo.io`.

## Local Commands

- `npm install`
- `npm run sync`
- `npm run dev`
- `npm run validate`
- `npm run broken-links`
- `npm run build`

Or from the repository root:

- `npm run docs:install`
- `npm run docs:sync`
- `npm run docs:dev`
- `npm run docs:validate`
- `npm run docs:broken-links`
- `npm run docs:build`

The Mintlify wrapper prefers a globally installed `mint` CLI and falls back to a transient `npx` install when the global binary is unavailable.

## Deployment Model

This app is intended to deploy through the repository CI/CD pipeline, not through a third-party dashboard-first publishing flow.

Primary workflow:

- `.github/workflows/deploy-docs.yml`

Expected GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Expected GitHub Actions variables:

- `DOCS_CLOUDFLARE_PROJECT_NAME`
  - Cloudflare Pages project name for `docs.contextgo.io`
  - default in workflow: `contextgo-docs`
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH`
  - branch name passed to `wrangler pages deploy`
  - default in workflow: `main`

Related main-site variable:

- `NEXT_PUBLIC_DOCS_SITE_URL`
  - used by the main website to redirect `/docs` traffic to the standalone docs site
  - currently wired in `.github/workflows/deploy-site.yml`

## Suggested Cloudflare Pages Setup

- One dedicated Pages project for docs
- Custom domain: `docs.contextgo.io`
- GitHub Actions remains the deploy entry, Cloudflare provides hosting and domain routing

## Content Structure

- `docs/` contains the Chinese source docs
- `i18n/en/docs/` contains the English source docs
- `navigation.js` remains the source of truth for the primary navigation
- `scripts/sync-from-contextgo.mjs` maps the source docs into the Mintlify `site/` shell
- `site/` contains the Mintlify app shell and generated pages used for build/export
