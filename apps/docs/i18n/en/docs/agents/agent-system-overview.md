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
