---
name: figma-library-sync
description: Sync code-side component library changes into the linked Figma library file, propose a safe publish set, and never bump library version without explicit confirmation.
---

# Figma Library Sync

Use this skill when the code-side component library has changed and the linked Figma library should be updated to match.

## Use when

- one or more components were added, removed, or restructured in code
- variant, slot, or default-prop changes need to land in the Figma library
- the design team asked for a library refresh from the latest code changes

## Do not use when

- only tokens or design rules changed — use `figma-design-system-rules-sync`
- a one-off page change is needed — use `figma-screen-generate`
- the request is exploratory critique — fall back to `design-director`

## Hard Constraints

- never publish a Figma library version without explicit user confirmation
- never delete or rename Figma components without explicit user confirmation
- if a code component has no Figma counterpart, surface it instead of inventing one

## Preconditions

- Figma library file key is known and write permission is granted
- Figma MCP self-check passes
- the recent code-side component changes are identifiable (commit range, diff, or change manifest)

## Workflow

1. Diff recent code-side component additions, removals, structural changes, and default-prop changes
2. Pull the current Figma library state through MCP
3. Build a proposed sync set: per component, the action (add, update, mark-divergent), the impact, and the affected node ids
4. Stage the changes; do not publish
5. Present the staged set to the user, including any items that require human judgement
6. On confirmation, perform the writes; library publish remains a separate confirmed step
7. Record file key, component node ids, originating commit range or change manifest, and reviewer in the closed-loop ledger

## Output Expectations

- staged change set with per-component impact
- explicit list of items needing human judgement
- closed-loop ledger entry per applied write
- publish status: not published unless explicitly confirmed

## Use together with

- `figma-design-system-rules-sync`
- `figma-drift-audit`
