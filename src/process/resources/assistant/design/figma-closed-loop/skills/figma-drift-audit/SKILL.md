---
name: figma-drift-audit
description: Audit drift between code-side and Figma-side design systems across tokens, components, library version, and screens, then output a remediation plan keyed by severity and direction.
---

# Figma Drift Audit

Use this skill when the request is to detect, classify, and report drift between the code-side design system and the linked Figma design system.

## Use when

- the team needs a status read on code-vs-Figma alignment
- it has been more than a week since the last library sync
- before running `figma-library-sync` or `figma-implementation-handoff` on a high-risk surface

## Do not use when

- the request is to actively sync changes — use `figma-library-sync` or `figma-design-system-rules-sync`
- the request is judgement or critique only — fall back to `design-director`

## Drift Model

See `docs/drift-model.md` in this package for the canonical model. In short:

- surfaces: tokens, components, library version, screens
- direction: code-only, figma-only, divergent, version-skew
- severity: cosmetic, contract, system
- remediation track: auto-syncable, review-required, frozen

## Preconditions

- Figma MCP self-check passes
- the relevant Figma file keys are known (system file, library file, screen files)
- the code-side design system source is identifiable

## Workflow

1. Pull the current Figma state for tokens, components, and library version through MCP
2. Read the code-side design system source for the same surfaces
3. Compare and classify every drift item with surface, direction, severity, and remediation track
4. Respect any item already marked `frozen`; never silently move it back to `auto-syncable`
5. Build a remediation plan ordered as: auto-syncable, review-required, frozen
6. Link each remediation item to file key, node id, and code path
7. Record the audit run with timestamp, scope, and reviewer in the closed-loop ledger
8. Return: drift table, remediation plan, and the items most likely to cause user-visible inconsistencies

## Output Expectations

- structured drift table with surface, direction, severity, track
- remediation plan grouped by track
- list of items most likely to cause user-visible inconsistencies
- audit run recorded in the closed-loop ledger

## Use together with

- `figma-library-sync`
- `figma-design-system-rules-sync`
- `figma-implementation-handoff`
