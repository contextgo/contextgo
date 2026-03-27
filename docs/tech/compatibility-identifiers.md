# Compatibility Identifier Decisions

## Scope

This document records the identifier migration decisions for the post-rename cleanup.
The current target is to remove the legacy `aionui` compatibility surface for the
core app identity because the product has not been released to external users yet
and local state loss is acceptable.

## Decision Table

| Area                           | Old Identifier                             | New Identifier                                   | Decision    | Reason                                                                                                                          |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Electron app id                | `com.aionui.app`                           | `io.contextgo.desktop`                           | Migrate now | No installed-user compatibility requirement; should match the ContextGo brand, reverse-domain naming, and desktop product role. |
| Deep link protocol             | `aionui://`                                | `cgo://`                                         | Migrate now | User explicitly requested `cgo://`; no need to keep dual-scheme compatibility yet.                                              |
| Desktop data symlink           | `~/.aionui`, `~/.aionui-dev`               | `~/.contextgo`, `~/.contextgo-dev`               | Migrate now | User accepted local data reset; keeping the old path would preserve obsolete branding in the most visible local state path.     |
| Desktop config symlink         | `~/.aionui-config`, `~/.aionui-config-dev` | `~/.contextgo-config`, `~/.contextgo-config-dev` | Migrate now | Same reasoning as data symlink; keeps config export/import naming aligned.                                                      |
| Config file name               | `aionui-config.txt`                        | `contextgo-config.txt`                           | Migrate now | Reduces further propagation of the legacy brand in backup/import/export paths.                                                  |
| Database file name             | `aionui.db`                                | `contextgo.db`                                   | Migrate now | Acceptable reset boundary; keeps disk artifacts aligned with the renamed app.                                                   |
| Standalone data root           | `.aionui-server`                           | `.contextgo-server`                              | Migrate now | No external compatibility requirement; should align with the new desktop data naming.                                           |
| CDP registry file              | `.aionui-cdp-registry.json`                | `.contextgo-cdp-registry.json`                   | Migrate now | Internal runtime artifact only; safe to rename without compatibility fallback.                                                  |
| Environment variable namespace | `AIONUI_*`                                 | `CONTEXTGO_*`                                    | Migrate now | Clean-break rename keeps runtime configuration, scripts, and tests aligned under one namespace.                                 |
| Extension engine key           | `engine.aionui`                            | `engine.contextgo`                               | Migrate now | The bundled extension schema should track the renamed product identity instead of preserving a legacy compatibility key.        |
| File/message marker constants  | `AIONUI_*` marker constants                | `CONTEXTGO_*` marker constants                   | Migrate now | These are internal runtime markers and file helpers; safe to rename while local compatibility requirements remain low.          |
| CSS utility class prefix       | `.aionui-*`                                | `.contextgo-*`                                   | Migrate now | Internal renderer styling hooks should not keep the old namespace once the desktop app identity is fully renamed.               |

## Explicitly Deferred

The following legacy namespaces are intentionally **not** changed in this PR:

- conversation source value `aionui`
- internal event / storage namespaces such as `aionui:*`, `aionui-...`, and `aionui....`
- auth token and cookie names such as `aionui-session`, `aionui-csrf-token`, issuer/audience values
- built-in MCP / skill identifiers such as `aionui-image-generation` and `aionui-webui-setup`
- legacy executable, icon, temp, and cache names that still appear in scripts, tests, or docs
- historical docs, examples, readmes, and copyright headers that still mention `AionUi`

These are broader protocol or plugin-ecosystem surfaces. Changing them in the same
PR would expand the review scope well beyond app identity, protocol registration,
and local persistence naming.

## Consequences

- Existing local state under legacy `aionui` paths is no longer auto-discovered.
- Existing `aionui://` links stop working after this change.
- Existing installs using the old Electron app id do not in-place upgrade to the new app id.
- The migration is intentionally clean-break oriented and matches the current project stage.
