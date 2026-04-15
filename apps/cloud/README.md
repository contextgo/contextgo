# ContextGo Cloud Auth Service

This directory contains the lightweight cloud-side auth and API service for ContextGo.

## Product Boundary

`apps/cloud` is the official ContextGo Cloud control-plane service. It is responsible for:

- user sign-in and OAuth session management
- desktop device registration and ownership
- Official Remote relay presence and long-lived device connections
- lightweight cloud APIs such as sync and provider bootstrap
- Obsidian vault sync orchestration objects such as `vault_binding`, `replica`,
  `file_manifest`, `change_batch`, and `sync_checkpoint`

It is **not** the public marketing website, and it is **not** meant to run a second hosted copy of the product UI.

Important sync boundary:

- `apps/cloud` is the sync orchestration authority
- it is not the only file authority
- desktop and mobile replicas still keep their own local full-vault copies
- remote WebUI remains a control/status surface rather than the only sync execution surface

Current domain split:

- `contextgo.io` / `www.contextgo.io`: public website from `apps/web`
- `auth.contextgo.io`: human-facing cloud auth pages from `apps/cloud`
- `api.contextgo.io`: cloud auth / sync / remote APIs from `apps/cloud`
- `remote.contextgo.io`: official remote control-plane entry from `apps/cloud`; device open should resolve to the desktop-hosted WebUI rather than a separate cloud-rendered app shell

## Features

- GitHub OAuth login
- Google OAuth login
- SQLite-backed users, OAuth accounts, sessions, and OAuth state
- Browser-session-backed device registration and device management
- WebSocket-based Official Remote cloud relay for live desktop sessions
- Device-token-backed sync API with append-only event cursor
- Obsidian multi-replica vault sync control plane
- Shared secure session cookie for `*.contextgo.io`
- Human-friendly login page on `auth.contextgo.io`
- JSON session API on `api.contextgo.io`
- ContextGo SSO (OIDC) endpoints for InferMesh and other first-party consumers
- InferMesh account bootstrap and direct handoff flows for ContextGo Cloud users

## Environment Variables

- `CONTEXTGO_DATABASE_PATH`
- `CONTEXTGO_AUTH_BASE_URL`
- `CONTEXTGO_API_BASE_URL`
- `CONTEXTGO_SESSION_COOKIE_DOMAIN`
- `CONTEXTGO_ALLOWED_EMAILS`
- `CONTEXTGO_GITHUB_CLIENT_ID`
- `CONTEXTGO_GITHUB_CLIENT_SECRET`
- `CONTEXTGO_GOOGLE_CLIENT_ID`
- `CONTEXTGO_GOOGLE_CLIENT_SECRET`
- `CONTEXTGO_INFERMESH_API_BASE_URL`
- `CONTEXTGO_INFERMESH_CONSOLE_BASE_URL`
- `CONTEXTGO_INFERMESH_ADMIN_BASE_URL`
- `CONTEXTGO_INFERMESH_ADMIN_USERNAME`
- `CONTEXTGO_INFERMESH_ADMIN_PASSWORD`
- `CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_ID`
- `CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_SECRET`
- `CONTEXTGO_INFERMESH_PASSWORD_SECRET`
- `CONTEXTGO_INFERMESH_USERNAME_PREFIX`
- `CONTEXTGO_INFERMESH_PROVIDER_NAME`
- `CONTEXTGO_OIDC_CLIENT_ID`
- `CONTEXTGO_OIDC_CLIENT_SECRET`
- `CONTEXTGO_OIDC_CLIENT_NAME`
- `CONTEXTGO_OIDC_REDIRECT_URIS`
- `CONTEXTGO_OIDC_SIGNING_KEY_PEM`
- `CONTEXTGO_OIDC_SIGNING_KEY_ID`

## Local Run

```bash
cd cloud
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export CONTEXTGO_DATABASE_PATH="$(pwd)/data/contextgo-cloud.db"
export CONTEXTGO_AUTH_BASE_URL="http://127.0.0.1:3001"
export CONTEXTGO_API_BASE_URL="http://127.0.0.1:3001"
export CONTEXTGO_SESSION_COOKIE_DOMAIN=""
export CONTEXTGO_ALLOWED_EMAILS="yeyitech@gmail.com"
export CONTEXTGO_GITHUB_CLIENT_ID="..."
export CONTEXTGO_GITHUB_CLIENT_SECRET="..."
export CONTEXTGO_GOOGLE_CLIENT_ID="..."
export CONTEXTGO_GOOGLE_CLIENT_SECRET="..."
export CONTEXTGO_INFERMESH_API_BASE_URL="https://api.infermesh.org"
export CONTEXTGO_INFERMESH_CONSOLE_BASE_URL="https://newapi.infermesh.org"
export CONTEXTGO_INFERMESH_ADMIN_BASE_URL="https://newapi-admin.infermesh.org"
export CONTEXTGO_INFERMESH_ADMIN_USERNAME="root"
export CONTEXTGO_INFERMESH_ADMIN_PASSWORD="..."
export CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_ID="..."
export CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_SECRET="..."
export CONTEXTGO_INFERMESH_PASSWORD_SECRET="..."
export CONTEXTGO_INFERMESH_USERNAME_PREFIX="cg"
export CONTEXTGO_INFERMESH_PROVIDER_NAME="InferMesh Cloud"
export CONTEXTGO_OIDC_CLIENT_ID="infermesh-oidc-client"
export CONTEXTGO_OIDC_CLIENT_SECRET="..."
export CONTEXTGO_OIDC_CLIENT_NAME="InferMesh"
export CONTEXTGO_OIDC_REDIRECT_URIS="https://newapi.infermesh.org/oauth/oidc,https://newapi-admin.infermesh.org/oauth/oidc"
export CONTEXTGO_OIDC_SIGNING_KEY_PEM="-----BEGIN PRIVATE KEY-----..."
export CONTEXTGO_OIDC_SIGNING_KEY_ID="contextgo-auth-1"

uvicorn contextgo_cloud.app:app --host 127.0.0.1 --port 3001
```

## Deployment Model

- Deployment is triggered by GitHub Actions from this repository.
- `apps/web` deploys to Cloudflare Pages.
- `apps/cloud` deploys to GCP Compute Engine through `gcloud` in `.github/workflows/deploy-site.yml`.
- Cloud and website share the repository, but they are separate deploy targets and should be treated as separate services.

## Local Tests

```bash
cd cloud
python3 -m unittest discover -s tests
```

## Device Token Flow

1. Sign in on `auth.contextgo.io`
2. Call `POST /api/devices/register` with the browser session cookie
3. Persist the returned `ctxdev_...` token on the device
4. Use `Authorization: Bearer ctxdev_...` for sync APIs

## Obsidian Vault Sync Model

For Obsidian vault sync, `apps/cloud` should act as the control plane for:

- `vault_binding`
- `replica`
- `file_manifest`
- `change_batch`
- `sync_checkpoint`

The intended product model is:

- one `Space` maps to one `vault binding`
- desktop and mobile can both register writable replicas for that binding
- `apps/cloud` allocates cursors, records checkpoints, and routes batches
- local plugins remain responsible for watching, pushing, pulling, and applying vault changes

This model intentionally differs from a single central cloud filesystem:

- Cloud orchestrates sync
- replicas still own their local full-vault copies
- risk from third-party sync tools may be detected and surfaced, but coexistence is not a formal compatibility target in the MVP

## Public Endpoints

- `GET /healthz`
- `GET /login`
- `GET /remote/devices`
- `GET /.well-known/openid-configuration`
- `GET /oauth/jwks`
- `GET /oauth/authorize`
- `POST /oauth/token`
- `GET /oauth/userinfo`
- `GET /api/auth/providers`
- `GET /api/auth/oauth/{provider}/start`
- `GET /api/auth/oauth/{provider}/callback`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/devices/register`
- `GET /api/devices`
- `GET /api/remote/devices`
- `POST /api/devices/{device_id}/revoke`
- `WS /api/remote/device-connect`
- `WS /api/remote/client-connect?device_id=...`
- `GET /api/integrations/infermesh/provider`
- `POST /api/sync/push`
- `GET /api/sync/pull`
- `POST /api/obsidian-sync/replicas/register`
- `POST /api/obsidian-sync/batches/push`
- `POST /api/obsidian-sync/batches/pull`

## InferMesh Integration

ContextGo Cloud currently supports two first-party InferMesh sign-in patterns:

- ContextGo SSO (OIDC)
  - InferMesh redirects the browser to ContextGo Cloud and completes a standard OIDC authorization-code sign-in flow.
  - This is the right choice when the product surface should read as "Continue with ContextGo" while keeping a standard SSO protocol underneath.
- InferMesh bootstrap + handoff
  - ContextGo Cloud provisions or reuses a managed InferMesh account and token for the signed-in ContextGo Cloud user.
  - It can also mint a signed handoff URL that lands the same user directly inside InferMesh.

## InferMesh Provisioning

`GET /api/integrations/infermesh/provider` supports both browser session auth and device-token auth.

It provisions or reuses a deterministic InferMesh account for the current ContextGo Cloud user, ensures a managed API token exists, fetches the current model list from InferMesh, and returns a ready-to-save `new-api` provider payload for the desktop app.

This path is about provider bootstrap, not browser SSO. For browser sign-in, use the ContextGo SSO (OIDC) endpoints above.
