# Figma MCP Setup

The Figma Closed Loop package depends on a working Figma MCP connection. None of the round-trip workflows can run if MCP connectivity is missing.

## Prerequisites

- a Figma account with edit permission on every target file
- a Figma MCP server (or compatible Figma protocol bridge) reachable from the runtime
- a Figma personal access token or OAuth credential scoped to the target team
- the desktop runtime authorized to make network calls to the Figma host

## Required Capabilities

The MCP server must expose at minimum:

- `read_file` — fetch file structure, frames, components, and tokens
- `list_components` — list components in a library file
- `read_node` — fetch a single node by file key + node id
- `write_frame` — create or update a frame in a target file
- `write_component_variant` — write a component variant change in a library file
- `publish_library` — gated publish action (must require explicit confirmation)

If any of these are missing, fall back to `design-director` for read-only critique workflows and stop the closed-loop request.

## Connectivity Self-Check

Before any closed-loop workflow runs, the assistant should:

1. confirm Figma MCP server is reachable
2. confirm the credential is valid and not expired
3. confirm the target file key is in scope of the credential
4. confirm write permission for files that will be written

If any check fails, surface the failure clearly and stop. Do not retry blindly.

## Permission Model

- read access is enough for `figma-implementation-handoff` and `figma-drift-audit`
- write access is required for `figma-file-bootstrap`, `figma-screen-generate`, `figma-library-sync`, and `figma-design-system-rules-sync`
- library publish must remain a manual confirmation step, even if the credential technically allows it

## Auditing

The package treats every successful MCP write as an auditable event. The closed-loop ledger should record:

- file key
- node id (when applicable)
- originating code path or workspace artifact
- which skill or command initiated the write
- timestamp
- reviewer or approver, when applicable

Refusing to record an action is equivalent to refusing to perform it.
