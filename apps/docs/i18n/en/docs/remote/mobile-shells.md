---
title: Mobile Shells
slug: /remote/mobile-shells
description: iPhone, Android, and HarmonyOS shells reuse the remote model instead of replacing the desktop host.
---

# Mobile Shells

Mobile in ContextGo should not be understood as a full independent host product.

## Core definition

iPhone, Android, and HarmonyOS should all follow the same remote model:

- the desktop host keeps execution authority
- the phone is for checking, controlling, continuing work, and uploading files
- packaging may differ, but the product model should not split

![ContextGo mobile remote control entry](/brand/remote/mobile-remote-control.png)

Mobile fits best as a remote control and continuation surface rather than as a replacement long-running host.

## More concretely

Mobile is better understood as:

- an entry point into current host-side work
- a way to check progress and continue the next step
- a compact control surface for one clear action

not as:

- a replacement host
- the long-running owner of runtimes and connectors

## What mobile is good for

- checking the current task state
- continuing with one small next step
- uploading a file back to the host
- reading results and responding quickly

## What still fits the host better

- heavy file operations
- runtime-intensive work
- multi-window work
- local development or local automation flows

## How file flow should work

The current model is:

1. the user picks a local file on the phone
2. the file uploads through the existing path to the host
3. the host stores and processes it
4. later work continues against the host-side copy

So the file may start on the phone, but the processing authority still belongs to the host.

## How to think about platform distribution

The iPhone, Android, and HarmonyOS shells can differ in packaging and distribution, but the product model should stay aligned.

Differences should mostly be:

- packaging and signing
- account and platform integration
- permission requirements
- store or direct-download distribution

not three different product definitions.

For public distribution thinking today:

- iOS fits TestFlight best
- Android can start from signed APK distribution
- HarmonyOS can start from signed package distribution before broader channel rollout

## Next

- For the full remote model: [Remote & Devices](/remote)
- For host authority: [Desktop Host](/remote/desktop-host)
- For the real usage path: [Personal Remote Workbench](/use-cases/personal-remote-workbench)
