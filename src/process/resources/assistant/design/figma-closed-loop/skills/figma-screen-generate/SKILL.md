---
name: figma-screen-generate
description: Push a code-side page or screen structure into a Figma file as a frame or screen draft, with explicit node ids and traceability back to the originating code path.
---

# Figma Screen Generate

Use this skill when the workspace already has the structural definition of a page or screen in code and that structure should land in Figma as a frame or screen draft.

## Use when

- a page or screen exists in code and the team wants the equivalent Figma frame
- a redesign is being explored and the current code-side structure is the starting point
- a Figma frame should mirror the production layout for QA or design review

## Do not use when

- the target Figma file does not exist yet — use `figma-file-bootstrap` first
- the goal is library updates or component variants — use `figma-library-sync`
- the request is absorption only — fall back to `design-director`

## Preconditions

- target Figma file key is known and write permission is granted
- the originating code path is identified
- Figma MCP self-check passes

## Workflow

1. Inspect the source code path: layout structure, components used, tokens referenced
2. Choose the destination file key and parent frame
3. Map the structural layout to Figma frames using existing components and tokens
4. Surface mapping gaps, for example a code component that has no Figma equivalent
5. Create the frame draft via Figma MCP
6. Record file key, new node ids, originating code path, and any structural compromises in the closed-loop ledger
7. Return: the destination URL, new node ids, and a list of items the design team should review

## Output Expectations

- new node ids for every frame created
- mapping notes that explain any structural compromise
- closed-loop ledger entry per write

## Use together with

- `figma-design-system-rules-sync`
- `figma-library-sync`
- `figma-implementation-handoff`
