# Space Connector Catalog

This folder defines the first-wave connector fusion contract for `ContextGo`.

The goal is not to implement every connector runtime here immediately. Instead, this catalog makes
three boundaries explicit before runtime work expands:

- which first-wave connectors are treated as `Space`-owned product capabilities
- which upstream execution model each connector family depends on
- which storage and ingestion target each connector should converge toward inside `ContextGo`

Current first-wave coverage:

- `ContextGo Browser`
- `ContextGo Clipboard` — connector-project owned activity runtime consumed through external capability catalog
- `Feishu Connector` — runtime ownership has moved to the standalone `connector` project and should no longer be implemented inside this folder
- `Google Workspace` family (`Drive`, `Docs`, `Sheets`, `Gmail`, `Calendar`)

## Connector Boundary Notes

`ContextGo Clipboard`, `Feishu / Lark`, and the `Google Workspace` family should all now be treated
as external connector runtimes owned by the standalone `connector` project.

Current expected boundary:

- `cgo connectors show <connector> --json` is the product-facing source of truth for capability display
- connector-owned runtime/auth/config state lives outside this folder
- ContextGo consumes connector outputs and routes them into Context Engine, Space memory, and downstream product surfaces

## Feishu Connector Notes

`Feishu / Lark` should now be treated as an external connector runtime owned by the standalone
`connector` project. ContextGo should only model the product boundary, datasource ownership, and
Context Engine integration points.

Current expected boundary:

- `cgo feishu ...` owns runtime setup, official CLI wrapping, and auth state
- ContextGo does not ship or launch a Feishu sidecar from this folder anymore
- future product integration should consume connector-project outputs rather than rebuilding Feishu runtime code here
