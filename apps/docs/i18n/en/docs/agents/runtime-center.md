---
title: Runtime Center
slug: /agents/runtime-center
description: Manage supported runtimes and understand the difference between installed, signed in, and ready.
---

# Runtime Center

ContextGo supports multiple runtimes, but the most important thing for users is not the protocol name.

It is understanding:

- what is installed
- what is signed in or configured
- what is actually ready

## Why this page matters

Many failures are not caused by weak models.  
They come from users assuming:

- installed means usable
- sign-in somewhere means the current project is ready
- a runtime working in another terminal means it is ready inside ContextGo

Runtime Center exists to separate those states clearly.

## The three key states

### Installed

This means the runtime or CLI exists on the host machine.

It answers:

- is the backend present here

It does **not** answer:

- whether authentication is complete
- whether configuration is complete
- whether the current project can actually run

### Signed In / Configured

This means the required auth or configuration exists.

It answers:

- whether credentials or required configuration are present

It still does **not** guarantee:

- that the runtime is ready for the current host and workspace

### Ready

This is the most important state.

Ready should mean:

- the runtime is installed
- auth or config is complete
- the current host and workspace can actually execute tasks now

Only Ready should be treated as truly usable.

## What to do in the first stage

The safest strategy is simple:

1. choose one runtime that matches your real work
2. make it truly ready
3. complete one real task
4. then consider a second runtime

## Common false positives

- the CLI exists, but the environment is incomplete
- login happened before, but the current workspace cannot use it correctly
- the runtime works somewhere else, but not in the current product path

## Stronger public wording

In external docs, it is usually better to emphasize:

- how to confirm state
- how to decide whether a host is ready
- which layer to troubleshoot first

not only how many runtimes the product supports.

## Next

- For overall capability structure: [Agents & Capabilities](./index)
- For state differences: [Installed, Signed In, Ready](./installed-signed-in-ready)
- For the builder workflow: [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
