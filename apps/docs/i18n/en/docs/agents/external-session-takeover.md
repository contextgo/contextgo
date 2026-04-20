---
title: External Session Takeover
slug: /agents/external-session-takeover
description: Explain how ContextGo discovers and takes over native sessions from Gemini, Claude Code, Codex, and OpenCode, and where that differs from vendor-native CLI behavior.
---

# External Session Takeover

"External session takeover" does not mean copying an entire runtime home into the project.

What it actually means is:

- discover session signals from runtime-native locations
- import or continue those existing sessions inside ContextGo
- keep the runtime's native global state intact while moving the conversation into ContextGo's broader product workflow

## Where ContextGo discovers those sessions

The current product-visible external session providers are:

- Claude Code
- Codex
- Gemini
- OpenCode

Discovery reads runtime-native global state, not project mirrors.

Typical sources include:

- Claude Code
  - `~/.claude/projects/**/*.jsonl`
- Codex
  - `~/.codex/state_*.sqlite`
- Gemini
  - `~/.gemini/tmp/.../chats/session-*.json`
- OpenCode
  - native `opencode.db`

That means:

- ContextGo does not require you to copy history into `.contextgo/` first
- ContextGo does not create a project-owned runtime home just to enable takeover
- `.contextgo/` still stores only ContextGo-owned workspace metadata

## What happens during takeover

When you choose an external session in the product, the flow is roughly:

1. scan native runtime session storage
2. filter out sessions already managed by ContextGo
3. inspect the target workspace for `.contextgo/`, `AGENTS.md`, and project capability surfaces
4. create or restore the matching ContextGo conversation
5. import usable history and session metadata
6. bring that conversation into ContextGo's context, package, connector, and publishing layers

## How this differs from "resume session" in the official CLI

Vendor-native session resume usually answers one narrow question:

- continue the same thread inside the same runtime

ContextGo external-session takeover answers a larger product question:

- bring that native session into the ContextGo work surface
- layer Context Engine on top of it
- keep using Context Connector on the same thread
- continue with IM publishing and multi-surface delivery
- keep using Agent Packages, skills, hooks, commands, and schedules

So this is not just a resume button in a different UI.  
It is the act of bringing an external runtime thread into the ContextGo product model.

## What ContextGo does not do

To keep the boundary stable, ContextGo does **not**:

- relocate `~/.codex`, `~/.claude`, `~/.gemini`, or `~/.config/opencode` into the project
- pretend the workspace is a runtime-owned home directory
- copy native runtime config, auth, cache, plugins, sqlite data, or logs into `.contextgo/`
- treat a third-party CLI workspace layout as the product's primary model

## What extra product capability appears after takeover

### Context Engine

After takeover, the conversation is no longer just one runtime's local history.

It becomes part of ContextGo's:

- session
- project
- space
- memory
- governance

That makes it eligible for the same context distillation, promotion, governance, and cross-surface reuse as any other product-owned conversation.

### Context Connector

You can keep attaching external context from files, the web, collaboration tools, knowledge systems, and business systems to the same working thread.

### IM publishing

The same Agent can later be published to Telegram, Slack, Lark, Discord, and similar surfaces, instead of remaining only in one local desktop CLI flow.

### Agent Package capability layer

After takeover, the project still follows the ContextGo capability model:

- `AGENTS.md`
- Agent Packages
- skills
- hooks
- commands
- schedules

Runtime-native skill folders remain projections, not the source of truth.

## When takeover is the right choice

Takeover is a better fit when:

- you already have useful context in the official CLI
- you do not want to manually copy the history
- you want that existing thread inside ContextGo's context system
- you plan to keep working with connectors, automation, or IM publishing

Starting a fresh session is a better fit when:

- the native session is already too noisy or outdated
- you want a clean task boundary
- you want to restart with a different Agent Package or rule set

## Next

- For runtime detection and install behavior: [Runtime Center](./runtime-center)
- For state semantics: [Installed, Signed In, Ready](./installed-signed-in-ready)
- For the product context layer: [Context Engine](../context/context-engine)
