---
title: Troubleshooting
slug: /manage/troubleshooting
description: Start troubleshooting from user-facing symptoms instead of internal implementation details.
---

# Troubleshooting

Troubleshooting should begin from symptoms users can observe, not from internal subsystem names.

## A safer troubleshooting order

Do not start by asking which subsystem is broken.

The steadier order is:

1. identify the user-visible symptom
2. locate which product layer the symptom belongs to
3. only then move into configuration or implementation details

That narrows the problem much faster.

## Common entry points include:

- sign-in does not complete
- a device does not appear or looks offline
- a runtime shows installed but still cannot work
- mobile cannot continue a desktop task
- publication behavior does not match expectation

## 1. Sign-in does not complete

Check first:

- whether this is the correct account
- whether sign-in actually finished
- whether the remote surface and target host belong to the same identity chain

If this layer is wrong, device discovery and remote access results will be misleading.

## 2. The device does not appear or looks offline

Check first:

- whether the host is really online
- whether the device finished binding
- whether this account should be able to see that device

"Visible" and "usable" are not the same thing.

## 3. The runtime shows Installed but still cannot work

Check whether these states were mixed up:

- Installed
- Signed In / Configured
- Ready

Many failures are not installation failures. They are readiness or environment failures.

## 4. Web or mobile cannot continue a desktop task

Do not treat this as a client bug first.

Check first:

- whether the host still holds the task environment
- whether the host-side work is still alive
- whether the remote surface is connected to the correct host

The client is not a new execution authority.

## 5. Published behavior does not match expectation

Check first:

- whether the target audience is defined correctly
- whether group, topic, or thread routing is reaching the intended path
- whether the correct capability is bound to that entry point

Many publish problems are modeling problems rather than protocol failures.

## Common troubleshooting mistakes

- starting from internal module names too early
- treating "visible" as "executable"
- treating "installed" as "ready"
- treating "channel connected" as "publish model fully defined"

## Next

- [Account And Devices](/manage/account-and-devices)
- [Runtime Center](/agents/runtime-center)
- [Remote Access Overview](/remote/remote-access-overview)
- [Publish Overview](/publish/publish-overview)
