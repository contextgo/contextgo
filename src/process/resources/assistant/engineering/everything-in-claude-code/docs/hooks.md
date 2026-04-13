# ECC Hook Payload Notes

This document records the absorbed hook payload kept under:

- `src/process/resources/assistant/engineering/everything-in-claude-code/hooks`

The `hooks/` directory should be treated as package payload, not as the package's primary documentation surface.

## How The Absorbed Hooks Work

```
User request -> Claude picks a tool -> PreToolUse hook runs -> Tool executes -> PostToolUse hook runs
```

- `PreToolUse` hooks run before tool execution
  - they may block with exit code `2` or warn through stderr
- `PostToolUse` hooks run after a tool completes
  - they can analyze output but do not block
- lifecycle hooks such as `Stop`, `SessionStart`, `SessionEnd`, and `PreCompact`
  - handle persistence, reminders, and background automation

## Hooks In The Absorbed ECC Payload

### PreToolUse hooks

- dev server blocker
  - blocks `npm run dev` style commands outside tmux to preserve usable logs
- tmux reminder
  - warns when long-running commands should probably run inside tmux
- git push reminder
  - reminds the user to review changes before `git push`
- pre-commit quality check
  - checks staged files, commit message shape, and common debug or secret issues
- doc file warning
  - warns about non-standard `.md` or `.txt` creation outside approved surfaces
- strategic compact
  - suggests manual compacting at logical intervals
- InsAIts security monitor
  - optional, high-signal scan controlled by `ECC_ENABLE_INSAITS=1`

### PostToolUse hooks

- PR logger
- build analysis
- quality gate
- Prettier format
- TypeScript check
- console.log warning

### Lifecycle hooks

- session start
- pre-compact
- console.log audit
- session summary
- pattern extraction
- cost tracker
- desktop notify
- session end marker

## ContextGo Translation Boundary

Inside ContextGo, these hooks are absorbed source material rather than runtime-owned package state.

That means:

- the package may keep `hooks/` as legacy payload
- ContextGo owns the actual workspace automation surfaces under `.contextgo/`
- non-skill payload should not be projected into `.claude/` or `.codex/` as if the runtime owns it

## Current Product Status

For this package today:

- skills are package-local and can be installed into `.contextgo/skills`
- commands are translated into `.contextgo/commands.json`
- schedules are seeded into `.contextgo/schedules.json`
- bundled ECC hooks are retained as absorbed package material, but are not currently seeded as a default package-owned hook set for every workspace

## Authoring Rule

When evolving absorbed ECC hook material:

- keep package-level explanation in `docs/`
- keep `hooks/` focused on payload and manifests
- translate runtime-specific assumptions into ContextGo-native workspace automation where possible
