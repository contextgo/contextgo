# ContextGo Cloud Auth Service

This directory contains the lightweight cloud-side auth and API service for ContextGo.

## Features

- GitHub OAuth login
- Google OAuth login
- SQLite-backed users, OAuth accounts, sessions, and OAuth state
- Browser-session-backed device registration and device management
- WebSocket-based Official Remote cloud relay for live desktop sessions
- Device-token-backed sync API with append-only event cursor
- Shared secure session cookie for `*.contextgo.io`
- Human-friendly login page on `auth.contextgo.io`
- JSON session API on `api.contextgo.io`

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

uvicorn contextgo_cloud.app:app --host 127.0.0.1 --port 3001
```

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

## Public Endpoints

- `GET /healthz`
- `GET /login`
- `GET /remote/devices`
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

## InferMesh Provisioning

`GET /api/integrations/infermesh/provider` supports both browser session auth and device-token auth.

It provisions or reuses a deterministic InferMesh account for the current ContextGo Cloud user, ensures a managed API token exists, fetches the current model list from InferMesh, and returns a ready-to-save `new-api` provider payload for the desktop app.
