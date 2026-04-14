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

## Connector Repository Relationship

`ContextGo` is the product repository and remains the source of truth for product architecture.

The sibling `../connector` repository should be treated as an upstream connector-capability incubator,
not as the place that defines ContextGo's top-level product model.

This distinction matters because ContextGo needs to absorb connector capability into a larger product
surface that already includes:

- multi-end UI and remote access
- `Space` ownership and local-first asset boundaries
- task execution and agent orchestration
- future sync, approval, and context-engine ingestion

Recommended rule:

- product semantics, UX, data ownership, and cross-end behavior are defined in this repository
- connector-specific fetch, collect, normalize, and runtime-adapter logic may be incubated in
  `../connector`
- once a connector becomes productized, its stable contract must be documented here first

Important boundary:

- `connector` means external product access and operation boundary
- `channel / publication` means IM delivery, routing, and audience interaction boundary
- the sibling `../connector` repo owns connector control-plane execution
- this repository owns the publication model in `src/process/channels/`

## Connector Absorption Strategy

When integrating capabilities from `../connector`, prefer a staged absorption path instead of a
hard merge.

### 1. Contract first

Absorb the control-plane model before moving implementation details:

- `Space`
- `Connector`
- `Datasource`
- `Profile`
- `Source Asset`
- `Collect Run`
- `Store`

These concepts need to align with ContextGo's product architecture before individual connector
commands are surfaced in UI or mobile/remote flows.

They should remain separate from the IM publication model:

- `Channel Account`
- `Audience`
- `Publication Binding`
- `Published Agent`

### 2. Runtime second

In the near term, `../connector` may run as a managed desktop-host sidecar or CLI runtime owned by
ContextGo. That is an implementation detail, not the product boundary.

Recommended near-term approach:

- ContextGo desktop owns lifecycle, permissions, and invocation
- connector commands are wrapped behind a stable ContextGo service boundary
- UI and mobile clients never depend on the sibling repository directly

### 3. Storage and ingestion third

Fetched results should converge into ContextGo-owned `runs/`, `store/`, and later
`@contextgo/context-engine` ingestion flows.

Do not leave product-critical context permanently stranded in an external repo's private runtime
shape once the feature is considered part of ContextGo.

## Important Non-Goal

Do not fold context-ingestion connectors into `src/process/channels/` by default.

In this repository, `channels` represent the IM publication and interaction subsystem.
They own transport accounts, audience discovery, routing, durable publication bindings, and
remote interaction state.

The `../connector` repository represents external product access, datasource management, runtime
auth state, collect flows, and store normalization.

Those are adjacent capabilities, but they are not the same module boundary.

## Current Domain Mapping

- `contextgo.io` and `www.contextgo.io`: public website from `apps/web/`
- `auth.contextgo.io`: cloud auth service from `apps/cloud/`
- `api.contextgo.io`: cloud API and sync service from `apps/cloud/`
- `remote.contextgo.io`: official remote control-plane entry from `apps/cloud/`; device selection happens here, but the actual runtime should resolve to the desktop-hosted WebUI instead of a separate cloud-hosted frontend

## Local Commands

- `bun run web:install`
- `bun run web:dev`
- `bun run web:build`
- `bun run cloud:test`
- `bun run cloud:run`

## Migration Notes

- Production website and cloud deployment workflows now live in this repository.
- Keep the legacy deployment repo read-only; it no longer owns production deploys.
- Do not split website and cloud changes back out into a separate repo.
