# Workspace Instructions

This workspace was initialized for ContextGo's built-in **Everything Claude Code Harness** assistant.

Use this file as the workspace entry point for durable collaboration guidance. Keep it short. Put details that only matter for specific kinds of work under `docs/`.

## Workspace Model

- `.contextgo/` is the installed workspace state for this package.
- Runtime-native directories such as `.claude/skills` or `.codex/skills` are projections only.
- `docs/` is a progressive-disclosure context surface. Load the relevant docs when the task touches that area.

## Context Routing

- Read `docs/README.md` for the workspace documentation map.
- Read `docs/skills/README.md` when the task is about packaged skills, skill selection, or project skill extension.
- Read `docs/commands/README.md` when the task is about command entry points or command migration.
- Read `docs/hooks/README.md` when the task is about hook-triggered automation or hook debugging.
- Read `docs/automation/README.md` when the task is about schedules, loops, periodic jobs, or continuous workflows.

## Project-Specific Instructions

Fill in:

- the project purpose and current priorities
- constraints or guardrails that future turns must honor
- where long-lived specs, plans, and verification notes should be written
