# Project Runtime Boundary Design

Status: Rejected and superseded.

Superseded on: 2026-04-19

Current stable rule:

- see [docs/conventions/runtime-boundary.md](../../conventions/runtime-boundary.md)

## Historical Note

This design explored a project-owned runtime home under `<workspace>/.contextgo/` and a project-level runtime policy model.

That design is no longer valid.

Rejected ideas:

- treating `.contextgo/` as the runtime home
- overriding `HOME`, `XDG_CONFIG_HOME`, or `XDG_DATA_HOME` to point at the workspace
- importing or projecting runtime config, auth, sqlite, logs, caches, or plugin mirrors into the project
- introducing `.contextgo/runtime.json` as a project runtime policy source of truth
- creating `.contextgo/.codex`, `.contextgo/.claude`, `.contextgo/.gemini`, or `.contextgo/.opencode` as live runtime homes

Accepted replacement:

- runtime config and runtime-generated state remain runtime-native and user-owned
- ContextGo controls launch-time behavior only, such as `cwd`, workspace docs, skill projections, and explicit session-level overrides
- `.contextgo/` stores ContextGo-owned workspace metadata only

If another document still references the rejected project-runtime-home design, treat that reference as stale and update it to the stable boundary document above.
