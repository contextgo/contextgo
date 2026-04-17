---
name: figma-file-bootstrap
description: Bootstrap a new Figma file from project context with stated intent, ownership, branching policy, and a recorded link back to the originating ContextGo workspace.
---

# Figma File Bootstrap

Use this skill when the team needs a new Figma file scaffolded from project context, not when an existing file should be updated.

## Use when

- the project does not yet have a Figma file for the surface in question
- a new exploration, redesign, or system fork needs its own Figma file boundary
- the request explicitly asks to create a new Figma file linked to this workspace

## Do not use when

- the target file already exists, even partially — use `figma-screen-generate` or `figma-library-sync` instead
- the request is critique or absorption only — fall back to `design-director`

## Preconditions

- Figma MCP is connected and the credential has write permission on the target team
- the user has approved creating a new file in the named team or project

## Workflow

1. Restate the goal of the new file: which product surface, which audience, which lifecycle phase
2. Identify the owners, reviewers, and naming convention to apply
3. Confirm the target Figma team and project, plus the branching policy
4. Run the Figma MCP self-check (`docs/mcp-setup.md`)
5. Create the file scaffold with at minimum:
   - a cover frame stating intent and owners
   - a structure frame listing the planned surfaces or screens
   - a tokens / system reference frame if a design system is in use
6. Record file key, parent project, intent statement, and originating workspace path in the closed-loop ledger
7. Return: the new file URL, file key, intent statement, and the next recommended workflow

## Output Expectations

- file key and URL of the new Figma file
- intent and ownership recorded in the closed-loop ledger
- next-step recommendation, usually `figma-screen-generate` or `figma-design-system-rules-sync`

## Use together with

- `figma-screen-generate`
- `figma-design-system-rules-sync`
