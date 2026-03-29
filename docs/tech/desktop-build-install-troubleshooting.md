# Desktop Build / Install Troubleshooting

This document explains why a local desktop build can appear to "finish" while the app UI does not actually change, and defines the standard verification workflow for `ContextGo.app`.

## Confirmed Root Causes

### 1. `--pack-only` does not generate a fresh `.app`

The biggest source of confusion is `scripts/build-with-builder.js`.

Inside [`scripts/build-with-builder.js`](/Users/bytedance/project/AionUi/scripts/build-with-builder.js), `--pack-only` only runs the electron-vite bundle phase and then returns early:

```js
if (packOnly) {
  console.log('✅ Package completed! (skipped distributable creation)');
  return;
}
```

That means:

- `out/main/`, `out/renderer/`, `out/preload/` may update
- but `electron-builder` is skipped
- so `out/mac-arm64/ContextGo.app` is not rebuilt
- and `/Applications/ContextGo.app` obviously cannot become newer

Practical consequence:

- A command like `node scripts/build-with-builder.js auto --mac --arm64 --pack-only`
- can look successful
- but it does **not** produce a fresh desktop `.app` bundle for installation

### 2. Building is not the same as installing

Even when `out/mac-arm64/ContextGo.app` is rebuilt successfully, the installed app under `/Applications/ContextGo.app` does not change automatically.

You must explicitly replace it:

```bash
rm -rf /Applications/ContextGo.app
ditto out/mac-arm64/ContextGo.app /Applications/ContextGo.app
```

If this step is skipped, the user still opens the old installed bundle.

### 3. Opening the app is not proof that the installed bundle changed

Finder, Dock, Spotlight, or an already-running process can make it look like "the new build was opened", while the actual running binary is still the previous installed bundle or an already-running process.

The only reliable check is:

```bash
stat -f '%Sm %N' out/mac-arm64/ContextGo.app /Applications/ContextGo.app
pgrep -fl '/Applications/ContextGo.app/Contents/MacOS/ContextGo|ContextGo.app'
```

What to verify:

- `out/mac-arm64/ContextGo.app` timestamp is new
- `/Applications/ContextGo.app` timestamp matches it
- running process path points to `/Applications/ContextGo.app/...`

### 4. Replacing the app without fully relaunching can preserve old runtime state

If `ContextGo` is still running while testing, you may still be observing old in-memory UI code or a not-fully-restarted app session.

Safe workflow:

```bash
osascript -e 'quit app "ContextGo"'
rm -rf /Applications/ContextGo.app
ditto out/mac-arm64/ContextGo.app /Applications/ContextGo.app
open /Applications/ContextGo.app
```

### 5. Source changes may exist in a different workspace / branch than expected

Another previously confirmed source of confusion was not the packager itself, but code context:

- feature edits may exist in a dirty worktree
- the user may expect `main`
- the running build may have been produced from code that was not the currently expected source state

Always verify before packaging:

```bash
git branch --show-current
git status --short
git remote -v
```

For this repository, the expected state during the latest debugging session was:

- branch: `main`
- remote: `origin https://github.com/contextgo/contextgo.git`

### 6. A "white screen" that shows raw JS text is often not the top-level renderer failing

One repeated failure mode looked like a white screen at first glance, but the window was actually rendering raw bundled JavaScript text such as a syntax highlighter asset (`zenscript-*.js`).

That symptom usually means:

- the main Electron window still loaded `out/renderer/index.html`
- but a nested preview surface such as a `webview` or `iframe` navigated to a JS/CSS/JSON resource URL
- and that resource was displayed as a document

This is materially different from:

- `did-fail-load` on the top-level window
- missing `index.html`
- a broken desktop install

Practical rule:

- if the UI shows raw asset text, inspect embedded preview navigation first
- do not immediately conclude that the desktop bundle failed to install

### 7. Persisted preview state can resurrect a broken UI path across relaunches

Another repeated confusion source was persisted preview state.

If a broken HTML preview tab is stored in `localStorage`, restarting the app can restore the bad state and make the issue look like a fresh startup failure.

Practical consequence:

- a source fix may exist
- the app may even be correctly rebuilt and reinstalled
- but the restored renderer state can still reproduce the same broken preview flow on launch

This was specifically mitigated by excluding `html` preview tabs from persistence in:

- [`src/renderer/pages/conversation/Preview/context/PreviewContext.tsx`](/Users/bytedance/project/AionUi/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx)

and by guarding suspicious embedded document navigations in:

- [`src/renderer/pages/conversation/Preview/components/renderers/HTMLRenderer.tsx`](/Users/bytedance/project/AionUi/src/renderer/pages/conversation/Preview/components/renderers/HTMLRenderer.tsx)
- [`src/renderer/components/media/WebviewHost.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/media/WebviewHost.tsx)
- [`src/renderer/components/settings/SettingsModal/contents/ExtensionSettingsTabContent.tsx`](/Users/bytedance/project/AionUi/src/renderer/components/settings/SettingsModal/contents/ExtensionSettingsTabContent.tsx)
- [`src/renderer/pages/settings/ExtensionSettingsPage.tsx`](/Users/bytedance/project/AionUi/src/renderer/pages/settings/ExtensionSettingsPage.tsx)

The shared URL/path guard lives in:

- [`src/renderer/utils/ui/documentNavigationGuard.ts`](/Users/bytedance/project/AionUi/src/renderer/utils/ui/documentNavigationGuard.ts)

### 8. Bulk `security` keychain inspection can create the very popup storm being investigated

Another confirmed failure mode came from macOS keychain triage itself.

Commands such as:

```bash
security dump-keychain -d login.keychain-db
```

can enumerate ACL-protected entries in the login keychain and cause `SecurityAgent` to display repeated permission dialogs for unrelated items such as:

- Docker credential entries
- Git credential helper entries
- other previously authorized CLI tools

This can make the machine look like it is under active credential probing even when the immediate trigger is the investigator's own command.

Practical rule:

- do not use `security dump-keychain` as a first-pass debugging command on a user machine
- do not run broad `security` enumeration just to "see what is in the keychain"
- if a keychain popup starts during investigation, first check whether the current shell / agent already launched `/usr/bin/security`

During a confirmed incident on 2026-03-28, the popup source was traced to Codex-triggered `security dump-keychain` commands rather than `ContextGo.app` itself.

## What Was Actually Happening In Previous Failed Attempts

The repeated "build succeeded but UI did not change" symptom came from a combination of the issues above:

1. Some builds used `--pack-only`, which skipped generation of a fresh `.app`.
2. In earlier rounds, there was uncertainty about whether the code being packaged was from the expected `main` worktree state.
3. Even after valid builds, the installed app was not always the newly rebuilt bundle until it was explicitly copied to `/Applications/ContextGo.app`.
4. Opening the app afterward was treated as proof of deployment, but without comparing timestamps or process paths.

So the real failure mode was not "Electron ignored the new UI".

It was:

1. build command sometimes did not produce a new `.app`
2. install step was sometimes missing or not verified
3. runtime verification was too weak

In a later debugging round, there was a second failure class on top of the install confusion:

1. the installed app was finally current
2. the top-level renderer still loaded successfully
3. but a nested HTML preview / `webview` navigated to a bundled JS resource page
4. persisted preview state made the bad route recur after relaunch

That combination made the symptom look like "the app is still opening an old broken build", even when the actual installed bundle was already correct.

## Standard Desktop Release Workflow

Use this exact sequence for local desktop verification:

```bash
# 1. Confirm source context
git branch --show-current
git status --short

# 2. Full desktop build
node scripts/build-with-builder.js auto --mac --arm64

# 3. Replace installed app
osascript -e 'quit app "ContextGo"'
rm -rf /Applications/ContextGo.app
ditto out/mac-arm64/ContextGo.app /Applications/ContextGo.app

# 4. Verify bundle timestamps
stat -f '%Sm %N' out/mac-arm64/ContextGo.app /Applications/ContextGo.app

# 5. Launch installed app
open /Applications/ContextGo.app

# 6. Verify running process path
pgrep -fl '/Applications/ContextGo.app/Contents/MacOS/ContextGo|ContextGo.app'
```

If the symptom is "white screen" or "window shows raw code/text", add these checks before changing packaging assumptions:

```bash
# 7. Inspect the current app log
tail -n 200 ~/Library/Logs/ContextGo/$(date +%F).log

# 8. Confirm whether the top-level renderer actually finished loading
rg -n "Loading renderer file|Renderer did-finish-load|did-fail-load|Window ready-to-show" \
  ~/Library/Logs/ContextGo/$(date +%F).log
```

Interpretation:

- if `Renderer did-finish-load` and `Window ready-to-show` are present, the top-level window likely loaded
- if the user still sees raw asset text, debug preview / `webview` routing before touching the install workflow again

## Keychain Popup Triage

If the user reports repeated macOS `Security` dialogs asking to access many keychain items, use this order:

```bash
# 1. Capture current candidate processes
ps -axo pid,ppid,pgid,etime,stat,command | egrep '/usr/bin/security|SecurityAgent|securityd|git-credential-osxkeychain|docker-credential-osxkeychain|codesign|notarytool|ContextGo|node|bun|zsh|bash'

# 2. Check for live security-related processes
pgrep -af 'security dump-keychain|^security |SecurityAgent|git-credential-osxkeychain|docker-credential-osxkeychain'

# 3. Read recent unified logs instead of querying the keychain directly
/usr/bin/log show --style compact --last 10m --predicate '(process == "SecurityAgent") || (process == "securityd") || (process == "security") || (eventMessage CONTAINS[c] "keychain") || (eventMessage CONTAINS[c] "ACL") || (eventMessage CONTAINS[c] "allow") || (eventMessage CONTAINS[c] "deny")'

# 4. Inspect app logs
tail -n 200 ~/Library/Logs/ContextGo/$(date +%F).log

# 5. Inspect likely credential-helper configuration without touching the keychain payload
git config --global --get-all credential.helper
git config --system --get-all credential.helper
cat ~/.docker/config.json
```

Interpretation:

- if unified logs say `user did not approve 'allow' for /usr/bin/security(...)`, the immediate popup source is a `security` CLI invocation, not automatically the desktop app
- if ACL text references `docker-credential-osxkeychain` or `git-credential-osxkeychain`, the prompts are often for existing Docker / Git secrets, not proof of a new secret being created
- if a `security dump-keychain` process is live, stop that process before drawing further conclusions

Avoid this during first-pass triage:

```bash
security dump-keychain -d login.keychain-db
```

Use direct `security` queries only as a last resort, after warning the user that macOS may display more prompts.

## Rules Going Forward

- Do not use `--pack-only` when the goal is to test a fresh desktop `.app`.
- Do not treat a successful bundling log as proof that the installed app changed.
- Do not treat "Finder opened" as proof that the installed app bundle is the new one.
- Always compare the timestamps of `out/mac-arm64/ContextGo.app` and `/Applications/ContextGo.app`.
- Always verify the running process path after launch.
- If the visible window contains raw bundled asset text, treat it as a preview / nested-document triage case first, not automatically as a top-level renderer failure.
- If the issue survives relaunch, inspect persisted renderer state and preview-tab restoration before assuming the packaging step failed again.
- If UI still looks wrong after timestamps match, debug it as a source/style/runtime issue, not as an install issue.
- If the user reports keychain popup storms, do not run bulk login-keychain enumeration during initial triage.
- Treat `/usr/bin/security` plus unified-log ACL evidence as a concrete lead; do not assume the foreground Electron app is the requester without checking.

## Agent Triage Checklist

When a future agent is told "the app is still blank", "the build did not take effect", or "I only see code/text in the window", use this order:

1. Confirm the code context: current branch, dirty worktree, expected remote.
2. Confirm a real desktop `.app` was rebuilt, not just `out/main` / `out/renderer`.
3. Replace `/Applications/ContextGo.app` and verify timestamps plus running process path.
4. Read the app log and determine whether the top-level renderer finished loading.
5. If the window shows raw asset text, inspect preview persistence and nested `webview` navigation.
6. Add or update a regression test before closing the issue if the failure came from persisted state or route restoration.

When a future agent is told "macOS keeps asking for many keychain passwords" or "SecurityAgent keeps popping up", use this order:

1. Check whether a live `/usr/bin/security` process or `security dump-keychain` command is already running.
2. Read unified logs for `securityd` / `SecurityAgent` to identify the requesting binary and ACL description.
3. Confirm whether the affected items match normal helpers such as Docker or Git credential helpers.
4. Stop the triggering process before continuing triage.
5. Only consider direct keychain inspection after warning the user that further prompts may appear.

## Important Current Conclusion

If these two timestamps are identical:

```bash
stat -f '%Sm %N' out/mac-arm64/ContextGo.app /Applications/ContextGo.app
```

and the running process is:

```bash
/Applications/ContextGo.app/Contents/MacOS/ContextGo
```

then a still-visible UI bug is almost certainly **not** caused by "the new build failed to install".

At that point, the remaining issue should be investigated in source code, CSS specificity, route rendering, or runtime component state.
