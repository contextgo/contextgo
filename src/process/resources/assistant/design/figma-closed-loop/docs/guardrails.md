# Guardrails

Figma Closed Loop is allowed to write into Figma files and to project Figma intent into code. Both directions are high-impact, so the package enforces a small number of non-negotiable guardrails.

## Hard Rules

1. **Never publish a Figma library version without explicit user confirmation.** A `figma-library-sync` may stage component updates, but the publish step always requires a human go-ahead.
2. **Never delete or rename Figma frames, components, or styles without explicit user confirmation.** Destructive writes must be opt-in per action, not implicit.
3. **Never run a Figma write workflow if Figma MCP, file access, or write permission is missing.** Stop and report instead of retrying or guessing.
4. **Never silently rewrite a node that already exists.** If an intended write would replace existing structure, surface the diff and require confirmation.
5. **Never invent a Figma file key or node id.** If the value is not provided or cannot be discovered through MCP, ask the user.
6. **Never bypass the closed-loop ledger.** Every successful write must be recorded with file key, node id, code path, executor, timestamp, and reviewer status.

## Soft Rules

- prefer creating new frames or component variants over mutating existing ones when the design intent is exploratory
- prefer staging library changes in a dedicated branch when the runtime supports Figma branching
- prefer producing implementation suggestions before applying code changes when the Figma source still has unresolved divergent tokens

## Escalation

If any of the following becomes true mid-execution, stop and surface:

- a token referenced by the Figma node does not exist in the code-side token set
- a component referenced by the Figma node has no code-side counterpart
- the closed-loop ledger cannot be written (read-only filesystem, missing credential, etc.)
- the design system rules sync would touch more than 20 percent of the existing token set in one pass

Stopping is not failure. Silent partial sync is failure.

## Fallback To Design Director

When the request turns out to be:

- screenshot critique
- reference absorption from Figma without write-back
- visual judgement only
- DESIGN.md drafting before there is a Figma file at all

then return control to `design-director`. Figma Closed Loop is for the execution loop, not for the design-judgement layer.
