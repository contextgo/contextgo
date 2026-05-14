---
title: Installed, Signed In, Ready
slug: /agents/installed-signed-in-ready
description: A runtime being installed is not the same as being signed in, and neither is the same as being truly ready.
---

# Installed, Signed In, Ready

These three states are easy to confuse:

- Installed
- Signed In
- Ready

## Why they must stay separate

If these states collapse into one vague "connected" label, users almost always misread the situation:

- "It is installed, so why can it not run?"
- "I signed in, so why does the task still fail?"
- "It looked ready in one project, so why not in this one?"

These states answer different questions.

## Installed

Installed only means the runtime exists on the machine.

It does **not** necessarily mean:

- it can authenticate
- it can access the needed tools
- it can run in the current project

## Signed In

Signed in means the runtime or provider identity is configured.

That still does not always mean the runtime is ready for real work.

## Ready

Ready means the runtime can actually start work in the current environment.

For users, this is the most important state.

Ready is closer to:

- the runtime exists
- credentials or config exist
- the current host environment is healthy
- the current workspace can actually start work

## A safer verification order

Check in this order every time:

1. Installed
2. Signed In / Configured
3. Ready

Only the third state should be treated as truly executable.

## Common failure points

- the CLI exists, but host dependencies are incomplete
- sign-in happened once, but the current workspace is not using the right credentials
- configuration looks present, but real task execution still fails

## Next

- [Runtime Center](/agents/runtime-center)
- [Coding And Builder Workflow](/use-cases/coding-and-builder-workflow)
- [Troubleshooting](/manage/troubleshooting)
