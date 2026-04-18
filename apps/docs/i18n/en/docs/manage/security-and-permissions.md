---
title: Security And Permissions
slug: /manage/security-and-permissions
description: ContextGo uses a local-first trust model, so host permissions, remote access, and runtime authority must stay explicit.
---

# Security And Permissions

Because ContextGo is a local-first work system, permission boundaries matter.

## The three most important boundaries

- host permissions
- remote access permissions
- runtime execution permissions

## Why users need this page

These boundaries directly shape questions like:

- who can touch my files
- what web and mobile can really do
- which actions still depend on host-side authority
- whether publication expands the trust boundary

## 1. Host permissions

The desktop host is the execution authority.

That means:

- the system can only reach what the host can reach
- local files, tools, and runtime environments matter
- client surfaces should not silently bypass host authority

## 2. Remote access permissions

The key question in remote access is not only "does the page open."

It is:

- who can connect to this host
- what they can see
- what actions they can trigger

The safer default is:

- clients are for checking, continuing, uploading, and small-step control
- not every host-side authority is automatically granted to every client surface

## 3. Runtime execution permissions

Runtimes execute work, but they still depend on the host environment.

So users need to distinguish:

- whether the runtime is installed
- whether auth or config is complete
- whether it is actually ready
- whether the requested action exceeds the permission boundary on this machine

## What this means in practice

When using ContextGo in public-facing or team-facing environments, be explicit about:

- which host executes the task
- which files enter the system
- which client surfaces can continue work
- which external channels are already connected

## Safer operating habits

- do not keep unnecessary high-permission paths open
- do not expand remote or publication capability before the host boundary is clear
- do not confuse "can trigger an action" with "should be granted by default"

## Next

- For host authority: [Desktop Host](/remote/desktop-host)
- For device boundaries: [Account And Devices](/manage/account-and-devices)
- For external service boundaries: [Publish](/publish)
