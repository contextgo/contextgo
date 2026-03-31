# Space Connector Catalog

This folder defines the first-wave connector fusion contract for `ContextGo`.

The goal is not to implement every connector runtime here immediately. Instead, this catalog makes
three boundaries explicit before runtime work expands:

- which first-wave connectors are treated as `Space`-owned product capabilities
- which upstream execution model each connector family depends on
- which storage and ingestion target each connector should converge toward inside `ContextGo`

Current first-wave coverage:

- `ContextGo Browser`
- `ContextGo Clipboard` — managed runtime wrapper scaffolded with config, status, and manual sampling
- `Feishu OpenAPI`
- `Google Workspace` family (`Drive`, `Docs`, `Sheets`, `Gmail`, `Calendar`)

## Clipboard Sidecar Notes

`ContextGo Clipboard` now includes a managed observer wrapper. By default it looks for the sibling
`../connector` repository and launches `python3 -m infohub.activity_clipboard_observer`.

Optional overrides:

- `CONTEXTGO_CONNECTOR_REPO_DIR`
- `CONTEXTGO_CONNECTOR_PYTHON`

## Feishu OpenAPI Sidecar Notes

`Feishu / Lark` is modeled as a managed external runtime around the official
`larksuite/lark-openapi-mcp` package (`@larksuiteoapi/lark-mcp`).

Current wrapper behavior:

- stores app credentials in ContextGo config
- launches the package through `npx` / `npm exec`
- treats the runtime as a desktop-managed sidecar instead of an IM channel plugin

## Google Drive Sidecar Notes

`Google Drive` is currently modeled as a managed Go-based sidecar contract around the official
Google Drive API Go client.

Current wrapper behavior:

- stores OAuth client credentials in ContextGo config
- expects a Go runtime or explicit sidecar command override
- defaults to `go run .` with `cwd=resources/native/google-drive-sidecar-go` for the current stub contract
