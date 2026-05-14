# Skills Surface

Use this document when the task touches skill selection, packaged skill behavior, or project-specific skill extension.

## What Skills Mean Here

- Packaged skills are the primary reusable workflow surface for this assistant package.
- Installed skill state lives under `.contextgo/skills`.
- Runtime-native skill directories are projections for runtime compatibility, not the source of truth.

## Open This Doc When

- choosing which packaged skills should be enabled for a workspace
- deciding whether a workflow belongs in a skill instead of a command or static instruction file
- extending the workspace with project-owned skills
- debugging why a skill is present, projected, or missing

## Authoring Guidance

- Prefer skills for reusable workflows, domain playbooks, and tool-using execution patterns.
- Keep project-specific guidance out of the package-owned skill catalog unless it should ship with the assistant.
- If a task only needs one-time project context, prefer the relevant workspace docs over inventing a new skill.
