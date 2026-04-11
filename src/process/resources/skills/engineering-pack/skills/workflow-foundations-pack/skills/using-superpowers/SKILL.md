---
name: using-superpowers
description: Use at the start of a harness-style engineering session to choose the right workflow skill before broad action.
---

# Using Superpowers

Treat the harness as a workflow router, not just a persona.

Workflow:

1. Classify the request first: design, planning, execution, debugging, review, or branch wrap-up.
2. Invoke the matching workflow skill before broad edits when one clearly applies.
3. Prefer this sequence for multi-step engineering work:
   - `brainstorming`
   - `writing-plans`
   - `executing-plans` or `subagent-driven-development`
   - `requesting-code-review`
   - `verification-loop`
   - `finishing-a-development-branch`
4. Keep project instructions, `AGENTS.md`, and explicit user requests above workflow defaults.
5. Map external workflow concepts back to ContextGo primitives: workspace automation, hooks, managed commands, builtin assistants, and skills.

Do not promise runtime capabilities that are not available. If the current runtime cannot use subagents, worktrees, or extra hook events, keep the discipline and adapt the execution path.
