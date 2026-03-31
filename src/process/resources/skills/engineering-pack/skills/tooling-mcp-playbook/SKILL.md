---
name: tooling-mcp-playbook
description: Recommend high-signal MCP and tooling combinations for engineering tasks. Use when the user asks how to wire documentation, code search, memory, research, or deployment tooling into an AI coding workflow.
---

# Tooling and MCP Playbook

Prefer a small, high-signal tool stack.

Recommended core MCP set:

- `github` for repo and PR context
- `context7` for live documentation lookup
- `memory` for lightweight cross-session recall
- `sequential-thinking` for explicit decomposition

Add only when needed:

- `exa-web-search` or `firecrawl` for research-heavy work
- `supabase` for database-centric repos
- `vercel` or `railway` for deployment workflows
- `insaits` for security-sensitive environments

In ContextGo, map "plugin-style capability" requests to builtin assistants, builtin skills, hooks, and MCP server templates before inventing a new abstraction.
