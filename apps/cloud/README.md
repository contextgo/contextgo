# ContextGo Cloud Auth Service

This directory contains the lightweight cloud-side auth and API service for ContextGo.

## Features

- GitHub OAuth login
- Google OAuth login
- SQLite-backed users, OAuth accounts, sessions, and OAuth state
- Browser-session-backed device registration and device management
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
- `GET /api/auth/providers`
- `GET /api/auth/oauth/{provider}/start`
- `GET /api/auth/oauth/{provider}/callback`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/devices/register`
- `GET /api/devices`
- `POST /api/devices/{device_id}/revoke`
- `POST /api/sync/push`
- `GET /api/sync/pull`
