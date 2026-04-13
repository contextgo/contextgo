# Space Connector Catalog

This folder defines the first-wave connector fusion contract for `ContextGo`.

The goal is not to implement every connector runtime here immediately. Instead, this catalog makes
three boundaries explicit before runtime work expands:

- which first-wave connectors are treated as `Space`-owned product capabilities
- which upstream execution model each connector family depends on
- which storage and ingestion target each connector should converge toward inside `ContextGo`

`Space Connector` means external product access capability only.

It does not mean:

- IM bot transport
- audience routing
- agent publication binding
- remote chat/session continuation

Those belong to the `src/process/channels/` subsystem and should be modeled as
`channel / publication`, not as connector.

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

Skill boundary:

- ContextGo product owns repo-local skill injection and connector metadata presentation
- project-local skills under `.connector/skills` teach coding runtimes how to use connector capabilities
- `cgo` remains the execution owner for connector CLI/runtime operations

Capability schema boundary:

- product pages should render connector capability trees from connector-owned catalog payloads
- capability trees describe upstream/native product surfaces such as `docs`, `drive`, `wiki`, `sheets`, or `approval`
- workflow readiness remains a separate layer and should not be inferred from capability-tree existence
- when upstream CLIs expose self-description surfaces such as `--help` or schema export commands, CI should use those as machine-discoverable seeds and merge them with curated product annotations

## Connector Product Page Template

Connector detail pages should follow a stable product template so future agents and contributors do
not collapse connector identity, native capability surface, and ContextGo readiness into one
undifferentiated detail dump.

Required page structure:

- `Overview` — product-facing identity, support status, resources, auth mode, and ownership model
- `Native Capability Surface` — upstream/native capability groups exported by connector-owned catalog payloads
- `ContextGo Readiness` — which workflows ContextGo actually consumes today, with readiness shown per workflow
- `Sources & Boundary` — official docs/runtime links plus runtime-boundary explanations

Three-dimensional constraint for connector pages:

- `dimension A: native capability surface` — what the upstream product can do through its CLI/runtime
- `dimension B: ContextGo readiness` — what ContextGo has actually connected, consumed, or materialized
- `dimension C: sources and runtime boundary` — where the capability claims came from and which runtime owns execution/auth/config

Hard rules:

- do not infer `ContextGo readiness` from capability-tree existence
- do not present connector pages as IM channel/publication setup
- do not treat skills as the connector itself; skills only teach runtimes how to use connector capabilities
- do not center primary product pages on runtime filesystem paths such as `runtime_dir` or `config_path`
- prefer capability-group navigation for large native surfaces such as Feishu / Lark instead of rendering an endless flat card stream

## Feishu Connector Notes

`Feishu / Lark` should now be treated as an external connector runtime owned by the standalone
`connector` project. ContextGo should only model the product boundary, datasource ownership, and
Context Engine integration points.

Current expected boundary:

- `cgo feishu ...` owns runtime setup, official CLI wrapping, and auth state
- ContextGo does not ship or launch a Feishu sidecar from this folder anymore
- future product integration should consume connector-project outputs rather than rebuilding Feishu runtime code here
