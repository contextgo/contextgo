# Mobile Obsidian Real-Space Open Design

## Context

ContextGo main repo already has a concrete `Space -> Obsidian vault` opening path:

- `space.open-vault` IPC
- `SpaceServiceImpl.openSpaceVault(...)`
- Sider-level `Open Vault` action
- mobile shell fallback that deep-links into Obsidian

That means the product is already beyond a blank slate. The missing piece is not "whether ContextGo can launch Obsidian", but whether the mobile-side action can be framed as opening the **real local Space vault** on the phone, instead of a generic external jump.

This design turns the research from issue `#160` into a main-repo implementation direction and a near-term product adjustment.

## Problem

Current mobile behavior implicitly treats "open Obsidian" and "open this Space's real local vault" as the same thing.

That is not a safe assumption.

The product should distinguish:

- the user has a ready local vault for this Space on the current phone
- the user still needs to finish one-time binding inside Obsidian
- the user only has a generic external jump, not a real local Space target

Without that distinction:

- the mobile CTA is underspecified
- the product cannot explain why one device opens directly while another still needs setup
- future Android/iOS directory-binding work has no clean readiness surface to attach to

## Research Conclusions

### Stable facts

- Obsidian vaults are local folders, and Obsidian URI supports opening by `vault` and `file`.
- Android supports user-authorized directory trees through SAF with persisted permission handles.
- iOS should not assume silent writes into another app's private sandbox; short-term it should use Files / document picker style flows, and long-term can evaluate File Provider.

### Product conclusion

The target product experience should be:

1. ContextGo knows whether this phone already has the Space's real local vault.
2. If yes, ContextGo opens Obsidian directly into that vault / landing note.
3. If not, ContextGo routes the user into a setup / bind path instead of pretending the vault is already local.

## Proposed Product Model

### 1. Add mobile vault readiness semantics

For the mobile-side `Open Vault` action, the product should eventually model:

- `ready`
- `needs-bind-in-obsidian`
- `preparing`
- `error`

The current PR does not implement the full readiness state machine, but it starts using the first two product semantics in the UI layer:

- `ready`: open in Obsidian
- `needs-bind-in-obsidian`: route to Obsidian's vault chooser and explain the setup requirement

### 2. Android path

Near-term intended flow:

1. User taps `Open Space` / `Open Vault`
2. ContextGo checks for a persisted Android directory handle
3. If missing, user selects a directory tree
4. ContextGo materializes / syncs the vault into that directory
5. ContextGo opens Obsidian to that real vault

This is the closest platform path to the desired "tap space, open real vault" experience.

### 3. iOS path

Near-term intended flow:

1. User taps `Open Space` / `Open Vault`
2. If the Space is not locally prepared, ContextGo guides the user into a Files-based folder selection / one-time bind path
3. After first-time binding, later taps deep-link directly into Obsidian

Long-term, File Provider remains the stronger platform-native direction.

## Current PR Scope

This PR intentionally keeps the change incremental and product-safe:

- move Obsidian URI generation into shared helpers
- stop mobile shell from falling back to host-side `space.open-vault` IPC when no mobile-local vault target is available
- introduce mobile-specific CTA copy:
  - `Open in Obsidian`
  - `Set Up in Obsidian`
- treat missing mobile vault binding as a chooser/setup path, not as a host-open fallback
- add an Android shell bridge that can:
  - request a directory tree
  - persist the selected tree handle
  - create a `ContextGo/<space-folder>` directory
  - initialize the minimal local vault bootstrap structure
  - return a replica-shaped local readiness payload back to the WebUI

This does **not** implement:

- iOS Files-based binding persistence
- cloud-backed mobile replica readiness synchronization
- File Provider
- full connector/cloud sync execution on mobile

## Files Touched In This Direction

- `src/common/utils/obsidianVaultOpen.ts`
- `src/renderer/utils/platform.ts`
- `src/process/services/space/SpaceServiceImpl.ts`
- `src/renderer/components/layout/Sider.tsx`
- `src/renderer/services/i18n/locales/*/guid.json`
- `mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt`
- `mobile-shell/android/app/src/main/res/values/strings.xml`
- `mobile-shell/android/app/build.gradle.kts`

## Acceptance For This PR

- mobile shell uses mobile-specific Obsidian open intent derivation
- mobile shell no longer falls through to host-side vault open when no mobile-local vault binding is present
- the UI exposes product wording that matches the intended future model
- Android shell can return a persisted local setup state for a Space and prepare a minimal local vault directory
- the issue research is preserved in-repo for future Android / iOS implementation work

## Follow-ups

- implement iOS Files-based one-time binding flow
- add first-class `Space mobile vault readiness` data to cloud / device / replica surfaces
- evaluate iOS File Provider for long-term "real local vault" ergonomics
