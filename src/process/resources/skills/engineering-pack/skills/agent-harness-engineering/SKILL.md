---
name: agent-harness-engineering
description: Upgrade a repository into a durable agent-first engineering surface. Use when the user wants reusable assistants, skills, hooks, repo-readable docs, or mechanical workflow checks.
---

# Agent Harness Engineering

Use this skill for repository-level capability work.

Core rules:

1. Treat `AGENTS.md` as a router, not a handbook.
2. Move durable knowledge into docs or structured resources that future agents can discover progressively.
3. Prefer product primitives over ad-hoc prompts: builtin assistants, builtin skills, builtin hooks, MCP templates, and mechanical validation.
4. Separate resource-layer work from runtime-layer work so missing events or APIs stay explicit.
5. When borrowing from another harness, map concepts instead of cloning names blindly.

Ship this kind of work as a reusable package, not a one-off answer.
