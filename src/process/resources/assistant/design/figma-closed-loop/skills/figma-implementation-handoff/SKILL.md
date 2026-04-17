---
name: figma-implementation-handoff
description: Generate implementation suggestions or scoped code-change drafts from a Figma node, frame, or page with explicit assumptions, missing-token callouts, and a reviewable handoff record.
---

# Figma Implementation Handoff

Use this skill when the request is to translate a Figma node, frame, or page into a code-side implementation suggestion or a scoped code-change draft.

## Use when

- a Figma node represents a finalized design that should land in code
- the design team has asked for an implementation pass on a known frame or page
- a small, scoped code-change draft is needed for review before implementation

## Do not use when

- the Figma source still has unresolved divergent tokens (run `figma-drift-audit` first)
- the request is exploratory critique or judgement only — fall back to `design-director`
- the Figma URL, file key, or node id is missing or invalid

## Hard Constraints

- never apply code changes that go beyond the explicitly scoped node or frame
- always validate the Figma URL, file key, and node id before doing anything
- always list every token that the Figma node references but the code side cannot resolve
- always produce a reviewable handoff record before applying any code change

## Preconditions

- Figma MCP self-check passes
- the user provides a Figma URL, file key, or node id
- the target code path is identifiable

## Workflow

1. Validate the Figma URL, file key, and node id
2. Fetch the structural and token information through Figma MCP
3. Map the design intent to existing code patterns and components
4. Surface every assumption, missing token, and missing component
5. Produce either an implementation suggestion (text plan) or a scoped code-change draft (diff or patch)
6. Record file key, node id, code path, suggested change scope, and reviewer in the closed-loop ledger
7. Return: the handoff record plus the next step (apply, escalate, or hold for design review)

## Output Expectations

- explicit assumptions and missing-token list
- scoped code-change draft or implementation suggestion
- closed-loop ledger entry for the handoff
- clear next step (apply, escalate, hold)

## Use together with

- `figma-drift-audit`
- `figma-library-sync`
