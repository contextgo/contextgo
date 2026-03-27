# Compatibility Identifier Decisions

## Scope

This document records the identifier migration decisions for the post-rename cleanup.
The current target is to remove the legacy `aionui` compatibility surface for the
core app identity because the product has not been released to external users yet
and local state loss is acceptable.

## Decision Table

| Area                           | Old Identifier                                                         | New Identifier                                                                     | Decision    | Reason                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron app id                | `com.aionui.app`                                                       | `io.contextgo.desktop`                                                             | Migrate now | No installed-user compatibility requirement; should match the ContextGo brand, reverse-domain naming, and desktop product role.                       |
| Deep link protocol             | `aionui://`                                                            | `cgo://`                                                                           | Migrate now | User explicitly requested `cgo://`; no need to keep dual-scheme compatibility yet.                                                                    |
| Desktop data symlink           | `~/.aionui`, `~/.aionui-dev`                                           | `~/.contextgo`, `~/.contextgo-dev`                                                 | Migrate now | User accepted local data reset; keeping the old path would preserve obsolete branding in the most visible local state path.                           |
| Desktop config symlink         | `~/.aionui-config`, `~/.aionui-config-dev`                             | `~/.contextgo-config`, `~/.contextgo-config-dev`                                   | Migrate now | Same reasoning as data symlink; keeps config export/import naming aligned.                                                                            |
| Config file name               | `aionui-config.txt`                                                    | `contextgo-config.txt`                                                             | Migrate now | Reduces further propagation of the legacy brand in backup/import/export paths.                                                                        |
| Database file name             | `aionui.db`                                                            | `contextgo.db`                                                                     | Migrate now | Acceptable reset boundary; keeps disk artifacts aligned with the renamed app.                                                                         |
| Standalone data root           | `.aionui-server`                                                       | `.contextgo-server`                                                                | Migrate now | No external compatibility requirement; should align with the new desktop data naming.                                                                 |
| CDP registry file              | `.aionui-cdp-registry.json`                                            | `.contextgo-cdp-registry.json`                                                     | Migrate now | Internal runtime artifact only; safe to rename without compatibility fallback.                                                                        |
| Environment variable namespace | `AIONUI_*`                                                             | `CONTEXTGO_*`                                                                      | Migrate now | Clean-break rename keeps runtime configuration, scripts, and tests aligned under one namespace.                                                       |
| Extension engine key           | `engine.aionui`                                                        | `engine.contextgo`                                                                 | Migrate now | The bundled extension schema should track the renamed product identity instead of preserving a legacy compatibility key.                              |
| File/message marker constants  | `AIONUI_*` marker constants                                            | `CONTEXTGO_*` marker constants                                                     | Migrate now | These are internal runtime markers and file helpers; safe to rename while local compatibility requirements remain low.                                |
| CSS utility class prefix       | `.aionui-*`                                                            | `.contextgo-*`                                                                     | Migrate now | Internal renderer styling hooks should not keep the old namespace once the desktop app identity is fully renamed.                                     |
| Conversation source value      | `aionui`                                                               | `contextgo`                                                                        | Migrate now | Internal conversation ownership/source tagging should match the renamed desktop product and avoid mixed runtime semantics.                            |
| Event and storage namespaces   | `aionui:*`, `aionui-...`, `aionui_...`                                 | `contextgo:*`, `contextgo-...`, `contextgo_...`                                    | Migrate now | Internal browser-side event buses and persisted UI state do not need compatibility shims at the current project stage.                                |
| Auth cookie/token namespaces   | `aionui-session`, `aionui-csrf-token`, `aionui-webui`, issuer `aionui` | `contextgo-session`, `contextgo-csrf-token`, `contextgo-webui`, issuer `contextgo` | Migrate now | Login/session identifiers are internal WebUI runtime state; invalidating old sessions is acceptable under the current clean-break migration strategy. |
| Built-in MCP server name       | `aionui-image-generation`                                              | `contextgo-image-generation`                                                       | Migrate now | Built-in MCP names are internal app-managed identifiers; the current branch keeps a legacy alias so stored configs can still normalize cleanly.       |
| Built-in MCP tool IDs          | `aionui_image_generation`, `aionui_web_fetch`                          | `contextgo_image_generation`, `contextgo_web_fetch`                                | Migrate now | Tool identifiers are bundled runtime surfaces, not public compatibility contracts at the current release stage.                                       |
| Built-in skill bundle id       | `aionui-builtin-skills`                                                | `contextgo-builtin-skills`                                                         | Migrate now | The internal Gemini extension bundle should follow the same product namespace as the rest of the built-in skill runtime.                              |
| Built-in WebUI skill id        | `aionui-webui-setup`                                                   | `contextgo-webui-setup`                                                            | Migrate now | Assistant preset skill wiring should point at the renamed ContextGo setup skill instead of preserving the legacy bundle identifier.                   |
| Built-in WebUI skill reference | `references/aionui-webui.md`                                           | `references/contextgo-webui.md`                                                    | Migrate now | The bundled skill documentation path should stay aligned with the skill identifier it ships with.                                                     |

## Explicitly Deferred

The following legacy namespaces are intentionally **not** changed in this PR series:

- legacy executable, icon, temp, and cache names that still appear in scripts, tests, or docs
- historical docs, examples, readmes, and copyright headers that still mention `AionUi`

These are broader packaging, runtime-artifact, or documentation surfaces. Changing
them in the same stacked cleanup would expand the review scope beyond app identity,
local persistence, auth/session namespaces, and built-in MCP/skill identifiers.

## Consequences

- Existing local state under legacy `aionui` paths is no longer auto-discovered.
- Existing `aionui://` links stop working after this change.
- Existing installs using the old Electron app id do not in-place upgrade to the new app id.
- Existing WebUI login sessions and CSRF cookies using the old `aionui` auth namespace are invalidated and require re-login.
- Existing stored MCP configs using `aionui-image-generation` continue to resolve via the built-in legacy alias.
- The migration is intentionally clean-break oriented and matches the current project stage.
