---
title: Account And Devices
slug: /manage/account-and-devices
description: Understand sign-in, device binding, host availability, and how your account relates to the devices you use.
---

# Account And Devices

In ContextGo, the account mainly exists for:

- sign-in
- device binding
- device discovery
- unified remote identity across surfaces

It is not meant to replace the desktop host as the execution authority.

## What this page clarifies

Account, device, host, and session are easy to blur together.

When they are mixed up, users misread the situation:

- sign-in succeeds, but work still does not run
- the account is correct, but the device does not appear
- mobile opens correctly, but the host still has to stay online

## Separate the four concepts

The safer model is to split them into four layers.

### 1. Account

The account is the identity layer.

It is mainly for:

- sign-in
- remote identity
- device discovery and binding
- recognizing the same user across surfaces

### 2. Device

A device is a concrete endpoint that can be discovered and opened.

Examples include:

- a desktop host
- a device acting as a remote client
- a Linux machine that may act as a host runtime later

### 3. Host

The host is the device currently acting as the execution authority.

One account may see many devices, but not all of them are the current execution host.

### 4. Session / Task

Real work state still lives in the session, task, and host environment.

The account unifies identity. It does not extract execution away from the host.

## What this means for users

If you move across devices, verify these in order:

1. you are signed into the correct account
2. the host device is actually online
3. you opened the correct target device
4. the task is still continuing on that host

## Common misunderstandings

- "If the account is the same, any device can automatically take over."
- "If a machine appears in the list, it must already be ready to work."
- "The account system itself is the cloud execution environment."

None of those match the current model.

## A safer first-stage setup

- start with one stable desktop host
- use one account to get device discovery working end to end
- verify that another surface can continue the same task
- only then expand to more devices and more entry points

## Next

- [Remote Access Overview](/remote/remote-access-overview)
- [Desktop Host](/remote/desktop-host)
- [Security And Permissions](/manage/security-and-permissions)
- [Quick Start](/start-here/quick-start)
