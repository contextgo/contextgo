---
title: Agents & Capabilities
slug: /agents
description: Understand how agents, runtimes, packages, skills, and automation fit together.
---

# Agents & Capabilities

This section explains how the system gains capability and how those capability layers fit together.

## What this page solves

Users often mix up:

- agent
- assistant
- runtime
- agent package
- skills
- hooks / commands / schedules

If those concepts are blurred, it becomes hard to tell:

- where current capability comes from
- which part is the execution backend
- whether a problem belongs in Runtime Center or in the package / automation layer

## A more stable way to think about it

Split them into three layers.

### 1. Execution layer

The runtime executes work.

It answers:

- which backend runs the task
- whether it is installed, signed in, and ready
- whether the current host can actually execute

### 2. Capability layer

Agent packages, skills, hooks, commands, and schedules extend the system.

They answer:

- what rules and capabilities the system has
- how those capabilities enter the workspace
- which parts are interactive versus automated

### 3. Usage layer

Assistants and agents are closer to what the user experiences as an entry point.

They describe how work is used, not only how capability is packaged underneath.

## Why runtime is not the whole product

A common mistake is to treat runtime choice as the full product model.

That is not accurate in ContextGo because:

- runtimes can change
- packages can change
- skills and automation can grow over time
- remote access and publication still belong to the overall product model

## The two most important pages for new users

If you are still getting started, begin with:

- [Runtime Center](./runtime-center)
- [Installed, Signed In, Ready](./installed-signed-in-ready)

That is the most common place where a setup looks complete but still is not actually usable.

## Practical recommendation

Do not try to enable every capability on day one.

The safer order is:

1. make one runtime truly ready
2. decide which capability your current workflow really needs
3. then add skills, commands, hooks, or schedules gradually

## Next

- For execution status: [Runtime Center](./runtime-center)
- For state differences: [Installed, Signed In, Ready](./installed-signed-in-ready)
- For a real builder workflow: [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
