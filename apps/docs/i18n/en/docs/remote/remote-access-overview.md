---
title: Remote Access Overview
slug: /remote/remote-access-overview
description: The desktop host remains the execution authority while web and mobile clients act as remote work surfaces.
---

# Remote Access Overview

The remote model in ContextGo can be summarized in one sentence:

> The desktop host keeps execution authority, while web and mobile remain access and control surfaces.

## What this page clarifies

The first confusion most users have is usually one of these:

- whether there is already a separate cloud runtime behind the scenes
- whether phone and web can fully replace the host
- whether "the page opens" already means the remote chain is complete

This page separates those ideas before they blur together.

## What a stable remote chain looks like

The safest way to understand remote access is as one end-to-end chain:

1. You enter the remote surface with one account.
2. The system discovers available devices.
3. You open one host.
4. The remote surface connects to that host's real runtime environment.
5. Your actions still execute through the host.

Remote access is therefore about continuing to use the same working system when you are away from the host machine.

## What remote access is not

It should not be understood as:

- a second cloud-native agent product
- web or mobile hosting runtimes on their own
- client surfaces taking over host files and local tools

The stable product boundary is still:

- the desktop host is the execution authority
- web and mobile are remote work surfaces
- remote actions still depend on host availability
- files chosen on mobile still enter the host-side processing chain

## What remote access is best for first

The first stable uses are usually:

- checking task state
- continuing one small step with clear intent
- reviewing results and making the next decision
- uploading one local file for the host to continue processing

This is far safer than expecting the remote client to replace the desktop from day one.

## The three things you actually need to verify

If you want to know whether remote access is truly working, verify at least these three things:

1. the host is online and healthy
2. account sign-in and device discovery are working
3. actions issued remotely really execute back on the host

"The page opens" is not enough.

## Common misunderstandings

- "If it opens in the browser, this must already be cloud execution."
- "If mobile can trigger an action, mobile must be the new host."
- "If remote sign-in works, host files and runtimes must already be available."

All three are premature conclusions.

## Next

- [Desktop Host](/remote/desktop-host)
- [Web Client](/remote/web-client)
- [Mobile Shells](/remote/mobile-shells)
- [Personal Remote Workbench](/use-cases/personal-remote-workbench)
