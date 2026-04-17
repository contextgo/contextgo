# Workflows

Figma Closed Loop ships six executable workflows. Each one corresponds to a packaged skill and a workspace command seed.

## Workflow Map

| Workflow                 | Skill                            | Command               | Phase   |
| ------------------------ | -------------------------------- | --------------------- | ------- |
| New Figma file scaffold  | `figma-file-bootstrap`           | `/figma-new-file`     | Phase 1 |
| Push code page to Figma  | `figma-screen-generate`          | `/figma-push-screen`  | Phase 1 |
| Sync component library   | `figma-library-sync`             | `/figma-sync-library` | Phase 1 |
| Sync design system rules | `figma-design-system-rules-sync` | `/figma-sync-rules`   | Phase 1 |
| Implementation handoff   | `figma-implementation-handoff`   | `/figma-implement`    | Phase 2 |
| Drift audit              | `figma-drift-audit`              | `/figma-audit-drift`  | Phase 3 |

## Phase 1: Code -> Figma Sync

The first three workflows establish a writable channel from code into Figma.

- `figma-file-bootstrap` creates a new file with explicit ownership and intent
- `figma-screen-generate` pushes a single page or screen as a frame draft
- `figma-library-sync` sends recent component changes into the linked library
- `figma-design-system-rules-sync` projects DESIGN.md, tokens, and theme variables into Figma rules

## Phase 2: Figma -> Code Handoff

`figma-implementation-handoff` accepts a Figma URL, file key, and node id and produces an implementation suggestion or a scoped code-change draft. The result must include explicit assumptions, missing-token callouts, and a reviewable handoff record.

## Phase 3: Long-Term Audit

`figma-drift-audit` compares tokens, components, library version, and screen structure between code and Figma, classifies each drift item, and proposes a remediation plan.

## Composition Rules

- always pair `figma-design-system-rules-sync` with a downstream `figma-library-sync` when token changes affect components
- run `figma-drift-audit` before a `figma-library-sync` when the last sync was more than a week ago
- never run `figma-implementation-handoff` if `figma-drift-audit` shows a divergent token in the targeted node

## Recommended Hooks

These hooks are recommended for a follow-up phase but are not yet shipped as bundled hook seeds in this package:

- when `DESIGN.md`, token files, or theme variables change in the workspace, prompt the user to consider re-running `figma-design-system-rules-sync`
- before `figma-implement` runs, validate Figma MCP connectivity, file key, node id format, and the existence of the target code path
- after every closed-loop action completes, append a record to the closed-loop ledger with file key, node id, code path, executor, timestamp, and reviewer status
