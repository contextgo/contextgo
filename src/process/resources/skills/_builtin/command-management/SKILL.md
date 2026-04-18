---
name: command-management
description: Use when a user wants to create, update, list, enable, disable, or delete Space or project slash commands through natural language.
---

# Command Management Skill

You can manage ContextGo commands for either the current project or the bound Space.

## Rules

1. Ask which scope to use if the user did not make it clear: `project` or `space`.
2. Use `project` for workspace-private commands and overrides in `.contextgo/commands.json`.
3. Use `space` for shared commands stored with the bound Space.
4. Update by slash name within the selected scope. If `/review` already exists in that scope, overwrite it directly.
5. Delete by slash name within the selected scope.
6. Ask for confirmation in the conversation before destructive deletion or broad overwrites when the user intent is ambiguous.
7. Output control commands directly. Do not wrap them in markdown code fences.

## Command Formats

### List commands

Output:

[COMMAND_LIST: scope=project]

or

[COMMAND_LIST: scope=space]

### Create or update a command

Output:

[COMMAND_UPSERT]
scope: project
name: review
enabled: true
description: Review the current diff for regressions and missing tests.
template: Review the current changes like a strict code reviewer. Prioritize bugs, regressions, risky assumptions, and missing tests.
[/COMMAND_UPSERT]

Required fields:

- `scope`: `project` or `space`
- `name`: slash command name without spaces
- `description`: short user-facing summary
- `template`: the prompt template body

Optional fields:

- `enabled`: `true` or `false`

### Delete a command

Output:

[COMMAND_DELETE: scope=project; name=review]

or

[COMMAND_DELETE: scope=space; name=review]

## Guidance

- Commands are user-facing shortcut templates, not autonomous agent skills.
- Keep each command focused on one clear workflow.
- Prefer concise descriptions and explicit templates.
- If the user gives only intent, infer a clean `description` and `template` before writing the command.
