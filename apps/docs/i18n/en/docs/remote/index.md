---
title: Remote & Devices
slug: /remote
description: Desktop host, web client, mobile shells, and Linux host modes all belong to one remote product model.
---

# Remote & Devices

ContextGo does not aim to create three unrelated products for desktop, web, and mobile.

It aims to keep one remote product model across all of them.

![ContextGo remote web client](/brand/docs/remote-web-client.png)

The image above shows the same host being reused through the web client. It looks like a browser surface, but execution still resolves back to the host.

![ContextGo remote device list](/brand/remote/host-device-list.png)

The device list makes the model even clearer: the browser shows a remote entry surface, while real availability still depends on the host being online.

## One-sentence model

Desktop is the host. Web and mobile are remote work surfaces, not separate runtime products.

## What this page solves

Users most often get confused about:

- which device is the real execution host
- what web and mobile can actually do
- whether multi-device access implies a second cloud runtime

This section exists to make those boundaries explicit.

## Stable product model

The current stable model is:

1. the host runtime is the execution authority
2. web and mobile are remote clients
3. remote access does not move the runtime into the client

## What this model solves

Real work does not happen only while you are sitting in front of the host, but the files, runtimes, and durable context still live there.

The remote model exists so that:

- the host keeps working
- you can continue from web or mobile
- uploads, controls, and follow-up actions still resolve through the same host

## What still belongs to the host

By default, these still remain on the host:

- local file access
- local runtime execution
- machine-bound connectors
- long-running active work sessions
- privileged host-side actions

## What clients are better for

Web and mobile are better for:

- checking active task state
- continuing one explicit next step
- reviewing outputs
- uploading one local file back to the host

## What not to assume

Do not treat web or mobile as:

- a full independent product
- a separate cloud runtime
- a long-running replacement for the host

## Where platform differences should appear

Platform differences may exist in:

- packaging
- signing and permissions
- system integration
- distribution

But the product definition should remain aligned.

## Next

- [Desktop Host](./desktop-host)
- [Web Client](./web-client)
- [Mobile Shells](./mobile-shells)
- [Same Experience Across Devices](./same-experience-across-devices)
