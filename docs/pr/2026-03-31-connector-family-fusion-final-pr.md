# PR Draft: `feat/connector-family-fusion-final`

## Title

`feat(connectors): fuse clipboard, Feishu, and Google Workspace connector families`

## Summary

This PR upgrades connectors from a static catalog into a product-facing connector container with:

- `Overview / Configure` tabs
- support-source provenance for official docs / official runtime / official SDK / connector repo / native ContextGo implementation
- first-wave connector fusion scaffolding across:
  - `ContextGo Clipboard`
  - `Feishu / Lark`
  - `Google Drive`
  - `Google Docs`
  - `Google Sheets`
  - `Gmail`
  - `Google Calendar`

## Main Product Changes

### Connector shell

- refactors the connector detail view into a two-tab container:
  - `Overview`
  - `Configure`
- adds support-source cards so each connector can clearly point to:
  - official docs
  - official runtime / SDK
  - sibling `connector` repository
  - native ContextGo implementation

### ContextGo-native / sibling-repo connector fusion

- `clipboard`
  - managed observer wrapper
  - local event store
  - collect workflow
  - Configure-tab runtime controls and debug views

### Managed official runtime fusion

- `feishu`
  - managed sidecar skeleton around `lark-openapi-mcp`
  - Configure-tab runtime and credential controls

### Google Workspace family

- `google-drive`
  - Go sidecar stub
  - auth URL generation
  - callback/code exchange
  - token cache
  - `files.list`
  - `Sync Now` persistence into ContextGo store

- `google-docs`
  - shared Google Workspace token reuse
  - docs listing
  - local store skeleton

- `google-sheets`
  - shared Google Workspace token reuse
  - sheets listing
  - local store skeleton

- `gmail`
  - shared Google Workspace token reuse
  - message list
  - local store skeleton

- `google-calendar`
  - shared Google Workspace token reuse
  - calendar list
  - local store skeleton

## Structure Changes

### Process services

- `src/process/services/space/connectors/catalog/`
- `src/process/services/space/connectors/clipboard/`
- `src/process/services/space/connectors/feishu/`
- `src/process/services/space/connectors/googleDrive/`
- `src/process/services/space/connectors/googleDocs/`
- `src/process/services/space/connectors/googleWorkspace/`

### Bridges

- `src/process/bridge/clipboardConnectorBridge.ts`
- `src/process/bridge/feishuConnectorBridge.ts`
- `src/process/bridge/googleDriveConnectorBridge.ts`
- `src/process/bridge/googleDocsConnectorBridge.ts`
- `src/process/bridge/googleWorkspaceFamilyBridges.ts`

### Renderer

- `src/renderer/pages/connectors/panels/`

### Native runtime

- `resources/native/google-drive-sidecar-go/`

## Validation

Completed in this environment:

- Google Drive Go sidecar stub runs locally
- Google Drive auth URL generation works
- Google Drive store persistence works
- Google Workspace family service imports resolve
- Gmail message-list service path resolves

Not fully completed in this environment:

- full `vitest` run
- full `tsc` run
- real Google end-to-end auth with a live account
- full `gh pr create` flow

## Known Limitations

- `google-drive` is still the most complete Google Workspace connector in this PR
- `google-docs / google-sheets / gmail / google-calendar` are now product-visible and sync-capable skeletons, but still need deeper per-product polish
- renderer-focused runtime validation is still constrained by missing local dependencies in this environment

## Suggested PR Body

This PR introduces the first complete connector-fusion slice for ContextGo.

It upgrades connectors into a product-facing `Overview / Configure` container, clarifies support
source provenance, and adds managed runtime/control-plane scaffolding for clipboard, Feishu, and
Google Workspace connectors.

The Google Workspace family now shares one OAuth/token model and one Go sidecar contract across
Drive, Docs, Sheets, Gmail, and Calendar.

## Before Opening The PR

Recommended local steps:

1. `git status`
2. `bun run test`
3. `bunx tsc --noEmit`
4. commit on `feat/connector-family-fusion-final`
5. push branch
6. open PR with this draft
