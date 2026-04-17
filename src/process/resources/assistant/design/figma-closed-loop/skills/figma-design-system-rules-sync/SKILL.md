---
name: figma-design-system-rules-sync
description: Project DESIGN.md, token files, and theme variables into Figma design system rules with minimal-diff strategy and explicit conflict surfacing.
---

# Figma Design System Rules Sync

Use this skill when the canonical design system source on the code side has changed and the corresponding Figma design system rules should be updated.

## Use when

- DESIGN.md, tokens, or theme variables changed in the workspace
- the Figma file uses tokens or rules that should track the code-side definition
- the team is establishing the rules surface in Figma for the first time

## Do not use when

- only component shape or variant changed — use `figma-library-sync`
- a single page layout needs to be pushed — use `figma-screen-generate`
- the request is screenshot critique or judgement only — fall back to `design-director`

## Hard Constraints

- never sync more than 20 percent of the existing token set in one pass without explicit confirmation
- never silently overwrite a Figma rule that diverges from the code-side definition; surface and require confirmation
- if a code-side token has no Figma counterpart, propose an additive change rather than a forced rewrite

## Preconditions

- Figma file key for the system surface is known
- Figma MCP self-check passes
- the code-side design system source is identifiable (DESIGN.md path, token files, theme variables)

## Workflow

1. Read the code-side design system: DESIGN.md, token files, theme variables
2. Pull the current Figma rules state through MCP
3. Diff and classify each rule as: identical, additive, divergent, removed-on-code-side
4. Build a minimal sync proposal that respects the 20 percent ceiling
5. Surface every divergent and removed item to the user; do not auto-apply
6. On confirmation, perform the writes
7. Record file key, rule node ids, originating source paths, and reviewer in the closed-loop ledger
8. Return: a clear list of synced rules, divergent rules left untouched, and rules deliberately not synced

## Output Expectations

- minimal sync proposal honoring the 20 percent ceiling
- explicit divergent and skipped rule list
- closed-loop ledger entry per applied write

## Use together with

- `figma-library-sync`
- `figma-drift-audit`
