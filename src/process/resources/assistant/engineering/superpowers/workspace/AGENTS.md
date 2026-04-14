# Workspace Instructions

This workspace was initialized for ContextGo's built-in **Superpowers Harness** assistant.

Use this file as the canonical project instruction entry point for future turns.

## Operating Model

- use the workspace as the durable home for engineering artifacts instead of keeping critical context in chat only
- drive work through `spec -> plan -> TDD -> review -> verification`
- keep project decisions, constraints, and rollout notes explicit

## Suggested Workspace Docs

- `docs/README.md` - current product context, source links, and working agreements
- `docs/specs/` - reviewed design specs and scope decisions before implementation starts
- `docs/plans/` - executable implementation plans and rollout checklists
- `docs/reviews/` - review findings, follow-up actions, and verification notes
- `docs/testing.md` - project-specific testing strategy, commands, and quality gates

## Installed Assistant Surfaces

- `.contextgo/skills`
- `.contextgo/commands.json`
- `.contextgo/hooks/`
- `.contextgo/hooks.json`
- `.contextgo/schedules.json`
- runtime-native skill directories are projections only

## Project-Specific Instructions

Fill in:

- the project purpose and current priorities
- constraints or guardrails that future turns must honor
- where long-lived specs, plans, and deliverables should be written
