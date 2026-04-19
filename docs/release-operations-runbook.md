# Release Operations Runbook

This document records the practical release workflow for ContextGo, the slow points observed during `v1.0.0`, and the operational rules to follow before triggering the next public release.

Use this together with:

- `docs/tech/release-distribution-standards.md`
- `docs/tech/checklist.md`
- `.github/workflows/build-and-release.yml`
- `.github/workflows/_build-reusable.yml`

## What This Runbook Covers

- how to trigger a formal public release
- what the workflow waits for before creating a tag and GitHub Release
- what slowed down `v1.0.0`
- which bottlenecks were fixed
- which bottlenecks still remain

## Current Public Release Path

The canonical public release path is:

1. Keep `package.json` on the target release version
2. Push release-related workflow or product changes to `main`
3. Trigger `.github/workflows/build-and-release.yml` through `workflow_dispatch`
4. Let the workflow build all required platform artifacts
5. Let the workflow create the public tag from `main`
6. Let the workflow publish the GitHub Release into `contextgo/contextgo-releases`
7. Let the website consume the published release metadata and assets

Stable operational rule:

- do not manually push the public tag first when the intention is to use the formal maintainer release flow from `main`

## What Happened In `v1.0.0`

`v1.0.0` was successfully published on `2026-04-19`.

The successful release run was:

- GitHub Actions run: `24619631941`
- source commit: `eeb6954208751b540f20c0339b09a2881f524ce5`

The workflow completed these phases:

- build matrix preparation
- release context validation
- Android build
- code quality checks
- Windows build
- macOS build
- Linux build
- build summary
- tag creation from `main`
- release creation in `contextgo/contextgo-releases`
- public site content sync

The public tag created by the workflow was:

- `v1.0.0`

## Why The First Attempt Was Slow

The first release attempt did not fail in the packaging stage. It became operationally stuck in the Linux artifact upload stage.

The key reason was:

- Linux produced two large `.deb` installers
  - `ContextGo-1.0.0-linux-amd64.deb`
  - `ContextGo-1.0.0-linux-arm64.deb`
- `actions/upload-artifact` was still recompressing already-compressed release installers
- the workflow could not create the tag or release until the full desktop matrix finished

That meant the release looked "stuck", even though the build had already succeeded and the workflow was blocked on artifact handling.

## Fixes Applied During `v1.0.0`

These fixes are already merged into `main` and were part of the final successful run.

### 1. Android SDK setup hardened on self-hosted Linux

Commit:

- `c6ef070b` `fix(ci): harden android sdk setup on self-hosted runners`

Effect:

- avoids failing the Android job when `android-actions/setup-android` behaves poorly on self-hosted runners
- adds an explicit Android SDK verification step

### 2. Android signing keystore moved to a stable workspace path

Commit:

- `03a7afd7` `fix(ci): persist android signing keystore in workspace`

Effect:

- avoids Gradle signing failures caused by temporary-path keystore loss

### 3. Linux dependency installation no longer assumes passwordless sudo

Commit:

- `36e63425` `fix(ci): skip linux apt install when deps already exist`

Effect:

- avoids failing on self-hosted Linux runners that already have required Debian packages installed
- only attempts `sudo -n` when something is truly missing

### 4. Linux Electron download cache is prewarmed correctly

Commit:

- `86f78664` `perf(ci): prewarm electron cache on linux runners`

Effect:

- preloads the exact Linux Electron binary into the cache path that Electron actually uses
- reduces the long `bun install` wait on Linux self-hosted runners

### 5. Release artifact upload no longer recompresses installers

Commit:

- `eeb69542` `perf(ci): disable artifact recompression for release builds`

Effect:

- sets `compression-level: 0` on `actions/upload-artifact`
- avoids wasting time recompressing `.deb`, `.dmg`, `.exe`, and similar installer outputs
- was the final fix that let `v1.0.0` complete cleanly

## What Was Still Slow Even After The Fixes

The successful `v1.0.0` run still took meaningful time because a formal release waits for the full multi-platform matrix.

Observed durations from the successful run:

- Android shell: about `2m`
- code quality: about `5m`
- Windows build: about `21m`
- macOS build: about `27m`
- Linux build: about `28m`
- release creation: about `1m`

Important operational truth:

- the release tag and GitHub Release are not created until the desktop build matrix succeeds
- even if Linux finishes first, Windows or macOS can still hold the release open

## Will Future Releases Still Be This Slow

Not as bad as the first failed attempts, but still not "fast".

Realistic expectation for a full public release that includes:

- Android
- Windows
- macOS
- Linux
- tag creation
- release creation

is still roughly:

- `25` to `40` minutes end to end

That is normal for the current release model because:

- Electron desktop packaging is heavy
- Windows packaging is still expensive
- macOS DMG and signing/notarization-related work is expensive
- Linux still has to build and upload large installers
- the release workflow also performs public content export and sync

So the right answer is:

- future releases should be more reliable than the early `v1.0.0` attempts
- but they will still be meaningfully slow as long as we keep the full multi-platform release matrix in one formal release workflow

## Remaining Slow Points

These are the main remaining slow points after the current fixes.

### 1. Windows `electron-builder`

This is still one of the biggest contributors to total duration.

Why it remains slow:

- installer generation is heavy
- Windows packaging still uploads both installer and zip artifacts

### 2. macOS packaging

This remains slow because:

- Electron packaging is heavy
- DMG creation is heavy
- macOS release work generally has more filesystem and signing overhead

### 3. Linux packaging

Linux is now healthier, but still not light.

Why it remains slow:

- dual-architecture `.deb` generation
- large final artifact sizes

### 4. Release-content export and sync

The `Create Release` job still installs website dependencies and exports public content.

This is not the largest delay, but it still adds time and should be counted as part of release latency.

## Operational Guidance For The Next Release

Before triggering the next public release:

1. Confirm `package.json` is already on the exact intended public version
2. Confirm all release workflow fixes are pushed to `main`
3. Trigger `Build and Release` from `main`
4. Only enable mobile jobs that are intentionally part of the current release
5. Expect the release to remain in progress until all desktop jobs complete
6. Do not assume "Android finished" means the release is close to done
7. Check `Create Tag from Branch` and `Create Release` before claiming success

Completion criteria:

- source tag exists in the source repository
- public release exists in `contextgo/contextgo-releases`
- release assets are present
- the download page reflects the new release metadata

## When To Suspect A Real Problem Instead Of Normal Slowness

Treat the run as suspicious when:

- Linux remains in `Upload build artifacts` for an unusually long time again
- Windows or macOS stops changing steps for a long time and runner-side packaging processes disappear
- `Create Tag from Branch` never starts after all build jobs are green
- `Create Release` starts but assets do not appear in `contextgo-releases`

## Next Useful Optimizations

If release time needs to come down further, prioritize these:

- keep self-hosted runner caches warm between releases
- add or improve dependency caching for the website-export step in `Create Release`
- review whether every formal release really needs every platform every time
- split "full public release" from lighter internal validation runs
- review whether Windows zip artifacts are still necessary for every stable public release

Do not start by removing validation or release gates blindly. The current bigger problem was operational waste in artifact handling, not that the workflow had too many correctness checks.
