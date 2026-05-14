---
title: Desktop Host
slug: /remote/desktop-host
description: The desktop host remains the execution authority for files, runtimes, tools, and long-running jobs.
---

# Desktop Host

In the ContextGo remote model, the desktop host is not a secondary detail. It is the execution authority.

## What it is responsible for

The desktop host is normally responsible for:

- files and working directories
- runtimes
- tools
- long-running jobs
- machine-local capabilities
- privileged actions that depend on host authority

## Why users need to understand this

It directly affects:

- why the phone cannot fully replace the desktop
- why host availability is so important
- why remote access and execution are not the same thing
- why some actions still depend on host-side authority

## What host availability really means

When you connect from web or mobile, host availability is not just "the machine is awake."

It also means:

- the runtime environment still exists there
- the required files and tools are reachable
- current work can continue from that machine

If the host goes offline, the client does not become the new execution environment.

## What should stay on the host

These categories should remain host-side by default:

- local code work
- tasks that depend on local CLI or SDK environments
- large file processing
- long-running workflows
- machine-bound connectors or system permissions

## Practical implication

The safer usage pattern is:

1. start the real task on the host
2. keep the host stable and available
3. then connect from web or mobile

## Common misunderstanding

- "If I can see it from the phone, the phone is now the host."
- "If the remote client opens, the local environment no longer matters."
- "If the client can trigger an action, it must also be executing locally."

All three are wrong.

## Next

- For the full remote model: [Remote & Devices](/remote)
- For mobile role boundaries: [Mobile Shells](/remote/mobile-shells)
- For the real usage path: [Personal Remote Workbench](/use-cases/personal-remote-workbench)
