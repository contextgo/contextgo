---
title: Agent System Overview
slug: /agents/agent-system-overview
description: Understand how agents, runtimes, packages, and capabilities fit together inside ContextGo.
---

# Agent System Overview

Users should not have to think about ContextGo as a pile of disconnected runtime concepts.

The better model is:

- an agent is an execution role
- a runtime is the execution backend
- an agent package is a reusable capability bundle
- skills, hooks, commands, and schedules are layered capabilities

## What Harness Agent means here

In narrower agent language, the thing ContextGo is trying to strengthen is not "one more model." It is the harness around the agent.

That boundary is closer to this:

- the model keeps reasoning and calling tools
- the runtime keeps executing
- the harness keeps the work inside a stable project boundary

That harness is usually formed by a few durable objects:

- `project`
- `AGENTS.md`
- `docs/`
- `skills`
- `hooks / commands / schedules`

The value of those objects is not to pile on more rules. It is to make long-running agent work stay:

- aligned to the goal
- explicit about constraints
- governable in intermediate state
- grounded in the real project

## Why an agent should not be reduced to a chat persona

If an agent is understood only as "the thing that replies," several important boundaries disappear:

- why it can keep working inside a project
- how one session connects to the next
- why different runtimes can still belong to one work system

ContextGo is not trying to define an agent as only a talking surface. It is trying to define an agent as an execution role that can keep carrying responsibility inside real work.

## Why this matters

This separation is what lets ContextGo behave like a work system instead of a single-agent wrapper.

It means:

- the runtime can change without redefining the whole workflow
- capabilities can be added without rebuilding the assistant from zero
- the same work surface can support different execution backends

## Related Docs

- [Agent Packages](/agents/agent-packages)
- [Skill Market](/agents/skill-market)
- [Runtime Center](/agents/runtime-center)
