---
title: Context
slug: /context
description: Context is the core product layer behind connectors, memory, context packs, and long-running work.
---

# Context

The deepest long-term value in ContextGo is not a single runtime. It is the context system.

## What this page clarifies

If ContextGo is understood only as "a conversation that can call an agent", the model breaks down quickly:

- every task starts from near zero
- work does not accumulate well
- files, pages, docs, and prior decisions are hard to reuse

This section explains the layer that gives the product its long-term structure.

## What context includes

This includes:

- Context Connector
- Context Engine
- Session / Project / Space
- Memory / Profile / Context Pack

## A safer mental model

You can think of it as one chain:

1. external materials enter through connectors
2. the system stores and shapes those materials over time
3. retrieval and assembly select what matters for the current task
4. the agent receives a focused Context Pack instead of a raw pile of history

So the point of context is not "store more". It is "reliably send the right material into the current task".

## Why this matters more than one conversation

With this layer in place, the system can gradually support:

- long-term continuity
- reuse across tasks
- more stable project boundaries
- better grounded outputs
- stronger consistency across remote and publish flows

## The parts most users should understand first

Most users do not need every internal term first. They need to understand:

- how real materials enter the system
- how short-term work differs from long-term context
- why output quality depends on context assembly quality

## Recommended reading order

First understand the entry and overview:

- [Context System Overview](./context-system-overview)
- [Context Connector](./context-connector)

Then understand long-term boundaries:

- [Session, Project, Space](./session-project-space)
- [Memory, Profile, Context Pack](./memory-profile-context-pack)
