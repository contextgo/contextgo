# ContextGo Docs App

This directory contains the standalone documentation site for `docs.contextgo.io`.

## Local Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run serve`

Or from the repository root:

- `npm run docs:install`
- `npm run docs:dev`
- `npm run docs:build`
- `npm run docs:serve`

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

- `docs/` contains the documentation pages
- `sidebars.js` defines the primary navigation
- `docusaurus.config.js` defines site routing and theme behavior
