# Repository Topology

This repository is now the single source of truth for ContextGo code.

## Authoritative Paths

- `src/`: Electron desktop application
- `mobile/`: React Native mobile shell
- `apps/web/`: `contextgo.io` marketing and download website
- `apps/cloud/`: cloud auth, device binding, and sync API service

## Ownership Rule

The old `ContextGo-Web` repository is deprecated for feature work.

- New website changes must land in `apps/web/`
- New cloud auth or sync changes must land in `apps/cloud/`
- Domain, auth, and sync architecture should be documented from this repository first

## Current Domain Mapping

- `contextgo.io` and `www.contextgo.io`: public website from `apps/web/`
- `auth.contextgo.io`: cloud auth service from `apps/cloud/`
- `api.contextgo.io`: cloud API and sync service from `apps/cloud/`
- `remote.contextgo.io`: FRP-backed desktop remote WebUI entry
- `tunnel.contextgo.io`: FRP server endpoint

## Local Commands

- `bun run web:install`
- `bun run web:dev`
- `bun run web:build`
- `bun run cloud:test`
- `bun run cloud:run`

## Migration Notes

- Keep the legacy deployment repo read-only until CI/CD is switched to this repository.
- Do not split website and cloud changes back out into a separate repo.
