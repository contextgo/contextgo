# Mobile Shell Cross-Platform Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `mobile-shell/` Android and HarmonyOS behavior with the iOS shell baseline for runtime detection, Official Remote routing, login callback recovery, startup readiness, and device-local upload support.

**Architecture:** Keep the product boundary unchanged: mobile shells remain thin native containers around the host WebUI. Normalize the shared shell contract first, then patch Android and HarmonyOS shell entrypoints so the shared renderer can rely on one mobile-shell runtime signal and one Official Remote routing rule. Add focused tests around shared detection and target normalization rather than broad UI rewrites.

**Tech Stack:** TypeScript, React renderer, Vitest, Android WebView/Kotlin, HarmonyOS ArkTS `Web`, Bun, Xcode/Gradle/Hvigor shell builds

---

### Task 1: Lock Shared Shell Detection Contract

**Files:**

- Modify: `src/renderer/utils/platform.ts`
- Test: `tests/unit/renderer/platform.mobileShell.test.ts`

- [ ] **Step 1: Write the failing detection test**

Create `tests/unit/renderer/platform.mobileShell.test.ts` with cases for:

- Android/iOS/Harmony shell UA strings containing `ContextGoMobileShell/1.0`
- ordinary mobile Safari / Chrome UAs without the token
- undefined `navigator`

- [ ] **Step 2: Run the failing test**

Run: `bunx vitest run tests/unit/renderer/platform.mobileShell.test.ts`

Expected: the new test file fails before implementation or does not exist yet.

- [ ] **Step 3: Update shared runtime detection**

Adjust `src/renderer/utils/platform.ts` so comments and logic describe a cross-platform mobile-shell runtime instead of an iOS-only WKWebView assumption. Keep the detection gate strict to the shell token and avoid false positives for ordinary browsers.

- [ ] **Step 4: Re-run the test**

Run: `bunx vitest run tests/unit/renderer/platform.mobileShell.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/renderer/utils/platform.ts tests/unit/renderer/platform.mobileShell.test.ts
git commit -m "test(renderer): cover mobile shell runtime detection"
```

### Task 2: Align Android Shell Routing And Login Recovery

**Files:**

- Modify: `mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt`
- Modify: `mobile-shell/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile-shell/android/app/src/main/res/values/strings.xml`
- Test: `tests/unit/mobile-shell/android/shellTargetResolver.test.ts`

- [ ] **Step 1: Extract or isolate Android target normalization logic behind tests**

Add a unit-testable resolver surface for:

- Official Remote host normalization to `/remote/devices`
- custom host normalization to `/login`
- wrapped `contextgo-remote://?target=...` callback handling
- callback/login recovery query parsing

- [ ] **Step 2: Run the Android resolver test in failing state**

Run: `bunx vitest run tests/unit/mobile-shell/android/shellTargetResolver.test.ts`

Expected: FAIL before the resolver contract is updated.

- [ ] **Step 3: Implement Android shell alignment**

Update `MainActivity.kt` so Android matches the iOS shell contract:

- retain `ContextGoMobileShell/1.0` UA token
- retain startup overlay readiness bridging
- recognize official callback/login error targets explicitly
- return to connection/native recovery state when hosted login fails or login callback is incomplete
- preserve device-local file picker forwarding

If the Android resolver remains embedded in `MainActivity.kt`, keep the logic compact and unit-testable. If extraction improves testability, keep it inside the Android shell scope rather than introducing unrelated shared abstractions.

- [ ] **Step 4: Re-run Android resolver tests**

Run: `bunx vitest run tests/unit/mobile-shell/android/shellTargetResolver.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify Android build still assembles**

Run: `bun run mobile-shell:android:assemble:debug`

Expected: Gradle debug assemble succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt \
  mobile-shell/android/app/src/main/AndroidManifest.xml \
  mobile-shell/android/app/src/main/res/values/strings.xml \
  tests/unit/mobile-shell/android/shellTargetResolver.test.ts
git commit -m "fix(mobile-shell): align android remote shell flows"
```

### Task 3: Upgrade HarmonyOS Shell To The Shared Contract

**Files:**

- Modify: `mobile-shell/harmony/entry/src/main/ets/pages/Index.ets`
- Modify: `mobile-shell/harmony/entry/src/main/ets/entryability/EntryAbility.ets`
- Modify: `mobile-shell/harmony/entry/src/main/module.json5`
- Modify: `mobile-shell/harmony/README.md`
- Test: `tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts`

- [ ] **Step 1: Write failing Harmony resolver/contract tests**

Add focused tests for:

- Official Remote normalization to `/remote/devices`
- custom host normalization to `/login`
- `/qr-login` preservation
- any helper used to detect or inject the mobile-shell runtime token / callback wrapper data

- [ ] **Step 2: Run the failing Harmony test**

Run: `bunx vitest run tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts`

Expected: FAIL before implementation.

- [ ] **Step 3: Implement Harmony shell contract**

Update `Index.ets` and related ability/module wiring so Harmony:

- defaults to `https://remote.contextgo.io/remote/devices`
- exposes a `ContextGoMobileShell/1.0` runtime marker to the hosted WebUI
- mirrors the startup-ready observation used by Android/iOS
- supports deep-link or callback re-entry for remote login completion
- forwards file input uploads from the device into the hosted WebUI flow

Keep the native UI lightweight. Do not port the iOS native home/device-list experience.

- [ ] **Step 4: Re-run Harmony contract tests**

Run: `bunx vitest run tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify Harmony build if toolchain is available**

Run:

```bash
cd mobile-shell/harmony
DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk" hvigorw assembleApp --debug --stacktrace
```

Expected: assemble succeeds, or if the toolchain is unavailable in this environment, record that explicitly.

- [ ] **Step 6: Commit**

Run:

```bash
git add mobile-shell/harmony/entry/src/main/ets/pages/Index.ets \
  mobile-shell/harmony/entry/src/main/ets/entryability/EntryAbility.ets \
  mobile-shell/harmony/entry/src/main/module.json5 \
  mobile-shell/harmony/README.md \
  tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts
git commit -m "fix(mobile-shell): align harmony remote shell flows"
```

### Task 4: Verify Shared Renderer Behavior Still Matches The Shell Contract

**Files:**

- Modify: any affected renderer files only if required by the runtime contract
- Test: targeted existing renderer tests plus any new shell/runtime tests

- [ ] **Step 1: Re-run targeted renderer tests affected by shell detection**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/platform.mobileShell.test.ts \
  tests/unit/mobile-shell/android/shellTargetResolver.test.ts \
  tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript verification**

Run: `bunx tsc --noEmit`

Expected: exit code `0`.

- [ ] **Step 3: Run formatter check on changed files**

Run:

```bash
bunx oxfmt --check src/renderer/utils/platform.ts \
  mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt \
  mobile-shell/android/app/src/main/AndroidManifest.xml \
  mobile-shell/android/app/src/main/res/values/strings.xml \
  mobile-shell/harmony/entry/src/main/ets/pages/Index.ets \
  mobile-shell/harmony/entry/src/main/ets/entryability/EntryAbility.ets \
  mobile-shell/harmony/entry/src/main/module.json5 \
  tests/unit/renderer/platform.mobileShell.test.ts \
  tests/unit/mobile-shell/android/shellTargetResolver.test.ts \
  tests/unit/mobile-shell/harmony/harmonyTargetResolver.test.ts
```

Expected: all matched files use the correct format.

- [ ] **Step 4: Record the full-suite baseline status**

Run: `bun run test`

Expected: likely reproduces the pre-existing Vitest hang seen before implementation. Record this as a baseline repository issue unless behavior changes.

- [ ] **Step 5: Commit the final integrated changes**

Run:

```bash
git add .
git commit -m "fix(mobile-shell): align android and harmony remote shells"
```

### Task 5: Push And Open PR

**Files:**

- Modify: none

- [ ] **Step 1: Confirm branch diff**

Run:

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --stat
```

- [ ] **Step 2: Push the branch**

Run: `git push -u origin feat/mobile-shell-cross-platform-alignment`

- [ ] **Step 3: Create or link an issue**

Use `gh issue create` if no issue number was provided in the user request.

- [ ] **Step 4: Create the PR**

Run `gh pr create` with:

- title based on the final integrated commit
- summary covering shared runtime detection, Android shell alignment, and Harmony shell upgrades
- test plan including targeted Vitest runs, `bunx tsc --noEmit`, Android assemble, and Harmony assemble if available
- explicit note that repository-wide `bun run test` hangs on the baseline in this environment
