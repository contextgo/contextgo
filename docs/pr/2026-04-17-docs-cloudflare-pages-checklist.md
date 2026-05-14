# Docs Cloudflare Pages Checklist

Date: 2026-04-17  
Scope: `docs.contextgo.io` deployment checklist  
Related branch: `docs/site-ia-review`

## Goal

This checklist is for the person who will actually wire up and verify the standalone docs site deployment.

The target model is:

- source repo builds `apps/docs`
- GitHub Actions deploys the static output
- Cloudflare Pages hosts the site
- custom domain is `docs.contextgo.io`

This checklist assumes the workflow file already exists:

- [.github/workflows/deploy-docs.yml](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/.github/workflows/deploy-docs.yml)

## 1. GitHub Actions Secrets

Set these repository secrets before the first deploy:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Recommended token scope

The token should be able to deploy to Cloudflare Pages for the target account.

Minimum intent:

- Pages write/deploy capability
- access limited to the intended Cloudflare account

## 2. GitHub Actions Variables

Set these repository variables:

### Required / recommended

- `DOCS_CLOUDFLARE_PROJECT_NAME`
  - recommended value: `contextgo-docs`
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH`
  - recommended value: `main`
- `NEXT_PUBLIC_DOCS_SITE_URL`
  - recommended value: `https://docs.contextgo.io`

### Why they matter

- `DOCS_CLOUDFLARE_PROJECT_NAME` is used by the docs deploy workflow
- `DOCS_CLOUDFLARE_DEPLOY_BRANCH` is the branch name passed to `wrangler pages deploy`
- `NEXT_PUBLIC_DOCS_SITE_URL` is used by the main website so `/docs` routes redirect to the standalone docs site

## 3. Cloudflare Pages Project

Create one dedicated Pages project for docs.

Recommended project name:

- `contextgo-docs`

Important rule:

- this Pages project should represent the standalone docs site only
- do not reuse the existing main-site Pages project

## 4. Custom Domain

Bind this custom domain to the docs Pages project:

- `docs.contextgo.io`

Important rule:

- the main website remains on `contextgo.io`
- the docs site should live on `docs.contextgo.io`

## 5. DNS / Domain Check

Before first public verification, confirm:

- `docs.contextgo.io` resolves to the Pages project
- SSL is active
- Cloudflare shows the custom domain as healthy

## 6. GitHub Workflow Trigger Check

The docs workflow currently triggers on:

- pushes to `main` that affect `apps/docs/**`
- manual dispatch

File:

- [.github/workflows/deploy-docs.yml](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/.github/workflows/deploy-docs.yml)

Confirm:

- workflow is visible in GitHub Actions
- manual dispatch is available
- the repository has permission to use the required secrets and variables

## 7. First Manual Deploy

For the first rollout, use manual dispatch instead of waiting for a content push.

Suggested sequence:

1. Open GitHub Actions
2. Run `Deploy Docs Site`
3. Wait for `npm install`
4. Wait for `npm run build`
5. Wait for `wrangler pages deploy`
6. Check the final deployment URL from workflow logs

## 8. Post-Deploy Verification

### Docs site verification

Check:

- `https://docs.contextgo.io`
- `https://docs.contextgo.io/start-here`
- `https://docs.contextgo.io/use-cases`
- `https://docs.contextgo.io/context`
- `https://docs.contextgo.io/agents`
- `https://docs.contextgo.io/publish`

Confirm:

- homepage loads
- sidebar renders
- locale switcher is visible
- English pages load under `/en`

### Main site redirect verification

Check:

- `https://contextgo.io/zh/docs`
- `https://contextgo.io/en/docs`
- one legacy slug path such as `https://contextgo.io/zh/docs/remote-access`

Confirm:

- main-site docs route redirects to `docs.contextgo.io`
- legacy slug routes redirect to the mapped standalone docs path

## 9. Build Verification Commands

If local verification is needed before deploy:

### Docs app

```bash
cd apps/docs
npm install
npm run build
```

### Main site

```bash
cd apps/web
npm ci
npm run build
```

## 10. Common Failure Points

### 1. Docs workflow fails before deploy

Likely causes:

- missing `CLOUDFLARE_API_TOKEN`
- missing `CLOUDFLARE_ACCOUNT_ID`
- wrong `DOCS_CLOUDFLARE_PROJECT_NAME`

### 2. Main site still links to old docs path

Likely cause:

- `NEXT_PUBLIC_DOCS_SITE_URL` was not set in repo variables

### 3. Docs deploy succeeds but domain does not open

Likely causes:

- custom domain not bound yet
- DNS still points elsewhere
- SSL not fully active

### 4. `/docs` redirects but wrong target page opens

Likely cause:

- legacy slug mapping needs update in:
  - [apps/web/src/lib/docsSite.ts](/Users/bytedance/contextgo/contextgo/.worktrees/docs-site-ia-review/apps/web/src/lib/docsSite.ts)

## 11. Minimal Sign-Off Checklist

Mark all of these before considering rollout complete:

- [ ] `CLOUDFLARE_API_TOKEN` set
- [ ] `CLOUDFLARE_ACCOUNT_ID` set
- [ ] `DOCS_CLOUDFLARE_PROJECT_NAME` set
- [ ] `DOCS_CLOUDFLARE_DEPLOY_BRANCH` set
- [ ] `NEXT_PUBLIC_DOCS_SITE_URL` set
- [ ] Pages project created
- [ ] `docs.contextgo.io` custom domain bound
- [ ] first docs workflow run succeeded
- [ ] `docs.contextgo.io` homepage opens
- [ ] `/en` docs path opens
- [ ] `contextgo.io/{lang}/docs` redirects correctly

## 12. Suggested Hand-Off Note

If this needs to be handed to another operator, send this:

> Configure one dedicated Cloudflare Pages project for `docs.contextgo.io`, set the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, set repo variables `DOCS_CLOUDFLARE_PROJECT_NAME`, `DOCS_CLOUDFLARE_DEPLOY_BRANCH`, and `NEXT_PUBLIC_DOCS_SITE_URL`, then manually run `.github/workflows/deploy-docs.yml` and verify both `docs.contextgo.io` and `contextgo.io/*/docs` redirects.
