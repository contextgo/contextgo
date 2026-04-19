# Project Runtime Boundary Implementation Plan

Status: Rejected and superseded on 2026-04-19.

Do not implement this plan.

The original version of this document described a project-owned runtime home under `<workspace>/.contextgo/`, plus project-managed runtime policy and imported runtime state. That direction is no longer valid.

Current stable rule:

- see [docs/conventions/runtime-boundary.md](../../conventions/runtime-boundary.md)

Archived reason:

- runtime config, auth, sessions, caches, sqlite, plugins, and logs remain in each runtime's native global locations
- ContextGo only manages workspace-scoped metadata under `.contextgo/`
- runtime-facing workspace outputs are limited to entry-doc compatibility and skill projections
- imported external sessions still read native runtime state, not project mirrors

If another document still references `.contextgo` as a runtime home, `.contextgo/runtime.json`, or project-copied runtime config/auth/session state, treat that reference as stale and update it to the stable boundary document above.
