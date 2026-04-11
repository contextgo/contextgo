# ContextGo - Project Guide

## Code Conventions

### File & Directory Structure

- **Directory size limit**: A single directory must not exceed **10** direct children (files + subdirectories). Split by responsibility when approaching this limit.

See [docs/conventions/file-structure.md](docs/conventions/file-structure.md) for complete rules on directory naming, page module layout, and shared vs private code placement. Agents working in this repository must also read and follow the `architecture` skill (`.claude/skills/architecture/SKILL.md`) when creating files, modules, or making structure decisions.

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: camelCase with `use` prefix (`useTheme.ts`)
- **Constants files**: camelCase (`constants.ts`) — values inside use UPPER_SNAKE_CASE
- **Type files**: camelCase (`types.ts`)
- **Style files**: kebab-case or `ComponentName.module.css`
- **Unused params**: prefix with `_`

### UI Library & Icons

- **Components**: `@arco-design/web-react` — no raw interactive HTML (`<button>`, `<input>`, `<select>`, etc.)
- **Icons**: `@icon-park/react`
- **Icon alignment**: renderer entry must keep `@icon-park/react/styles/index.css` imported globally; for icon+text rows, menu items, and icon buttons, use the shared classes in `src/renderer/styles/icon.css` (`app-icon`, `app-icon-slot`, `app-icon-row`, `app-icon-button`) instead of per-component `marginTop` / inline `lineHeight` fixes

### CSS

- Prefer **UnoCSS utility classes**; complex styles use **CSS Modules** (`ComponentName.module.css`)
- Colors must use **semantic tokens** from `uno.config.ts` or CSS variables — no hardcoded values
- Arco overrides go in the component's CSS Module via `:global()` — no global override files
- Global styles only in `src/renderer/styles/`

See [docs/conventions/file-structure.md](docs/conventions/file-structure.md) for full CSS and UI library rules.

### TypeScript

- Strict mode enabled — no `any`, no implicit returns
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Prefer `type` over `interface` (per Oxlint config)
- English for code comments; JSDoc for public functions

### Architecture

Three process types — never mix their APIs:

- `src/process/` — main process, no DOM APIs
- `src/renderer/` — renderer, no Node.js APIs
- `src/process/worker/` — fork workers, no Electron APIs

Cross-process communication must go through the IPC bridge (`src/preload.ts`).
See [docs/tech/architecture.md](docs/tech/architecture.md) for details.

### Context Engine Index

When changing the Context Engine, session/project/space memory modeling, vault sync, context jobs, event-driven context flows, or connector digestion, read these first:

- [docs/tech/context-engine-event-architecture.md](docs/tech/context-engine-event-architecture.md)
- [packages/context-engine/docs/domain-model.md](packages/context-engine/docs/domain-model.md)
- [packages/context-engine/docs/reference-landscape.md](packages/context-engine/docs/reference-landscape.md)

Current implementation anchor points:

- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/services/context/ContextJobOrchestrator.ts`
- `src/process/services/context/contextDomain.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`

### Space Product Boundary

When changing `Space`, canvas/doc editing, collaboration surfaces, members/roles, or context governance:

- treat `Space` as a first-class ContextGo product object, not as a thin wrapper around any external product
- do not expose third-party product names such as `AFFiNE` in user-facing UI copy, navigation labels, product concepts, or default empty states
- third-party editor/canvas code may be absorbed as implementation detail, but the product surface must stay branded and modeled as ContextGo
- avoid adding new bridge/iframe/embed-first product flows as the primary long-term path for Space
- prefer native ContextGo surface names such as `Space Canvas`, `Space Docs`, `Space Context`, and `Members`
- keep content-surface capabilities separate from context-governance capabilities:
  - content editing/collaboration may borrow external implementation ideas
  - memory, roles, permissions, agent execution, approval, and context assembly remain ContextGo-owned

Read these before changing the model:

- [docs/tech/space-model.md](docs/tech/space-model.md)
- [packages/context-engine/docs/affine-space-provider.md](packages/context-engine/docs/affine-space-provider.md)
- [packages/context-engine/docs/reference-landscape.md](packages/context-engine/docs/reference-landscape.md)

### Mobile / Remote Access Product Model

When changing mobile access, WebUI/browser runtime behavior, remote login, upload flows, or shell packaging, treat the following as the default product model:

- desktop remains the real execution host
- mobile acts as a remote use-side / control-side client
- mobile shells should reuse the existing WebUI / server runtime instead of replacing the desktop host
- mobile-local file selection should upload into the desktop host through the WebUI upload flow, then continue processing on the host side

Read these before changing the model:

- [docs/tech/mobile-remote-control.md](docs/tech/mobile-remote-control.md)
- [docs/tech/mobile-shell-readiness.md](docs/tech/mobile-shell-readiness.md)
- [docs/tech/mobile-shell-cmd.md](docs/tech/mobile-shell-cmd.md)

### Release / Distribution Model

When changing tags, GitHub Actions release workflows, signing, store assumptions, or future website download-page logic, treat the following as the default release model:

- one repository remains the source of truth for desktop, WebUI, `mobile-shell/`, and future website code
- Git tags plus GitHub Releases remain the canonical product-release source of truth
- macOS direct-download release is first-class and does not depend on Mac App Store submission
- Android and HarmonyOS may use direct-download distribution before store publication
- iOS should default to TestFlight or App Store workflows, not public direct IPA download
- future website deployment should stay separate from product tag creation

Read these before changing release behavior:

- [docs/tech/checklist.md](docs/tech/checklist.md)
- [docs/tech/release-distribution-standards.md](docs/tech/release-distribution-standards.md)
- [docs/tech/mobile-remote-control.md](docs/tech/mobile-remote-control.md)
- [docs/tech/mobile-shell-readiness.md](docs/tech/mobile-shell-readiness.md)

## Testing

**Framework**: Vitest 4 (`vitest.config.ts`). Run `bun run test` before every commit. Coverage target ≥ 80%.

See the `testing` skill (`.claude/skills/testing/SKILL.md`) for complete workflow, quality rules, and checklist.

## Code Quality

**During development** — auto-fix as you edit:

```bash
bun run lint:fix       # auto-fix lint issues in .ts / .tsx (oxlint)
bun run format         # auto-format .ts / .tsx / .css / .json / .md (oxfmt)
bunx tsc --noEmit      # verify no type errors
```

**Before every PR** — run the full CI check locally to catch everything CI catches (end-of-file, trailing whitespace, all file types):

```bash
# One-time setup
npm install -g @j178/prek

# Replicate exact CI check (read-only — does not auto-fix)
prek run --from-ref origin/main --to-ref HEAD
```

> Note: `prek` uses `lint` (check only) and `format:check` (check only) — it will fail if there are issues but won't fix them.
> If prek reports formatting or lint issues, run the auto-fix commands above first, then re-run prek to verify.

Common Oxfmt rules (Prettier-compatible, avoid a fix pass):

- Single-element arrays that fit on one line → inline: `[{ id: 'a', value: 'b' }]`
- Trailing commas required in multi-line arrays/objects
- Single quotes for strings

## Desktop Verification

When the task involves the packaged macOS app, do not assume "build log succeeded" means the user is running the new UI.

- For local desktop verification, follow `docs/tech/desktop-build-install-troubleshooting.md`.
- Treat "Finder opened" or "the app launched" as insufficient evidence that `/Applications/ContextGo.app` was updated.
- Verify the source context first: branch, worktree status, and expected remote.
- Rebuild the desktop app, replace `/Applications/ContextGo.app`, relaunch it, and verify the running process path.
- If the user reports a "white screen" but the window shows raw JS/CSS/JSON text, do **not** assume the top-level renderer entry failed. First inspect nested preview / `webview` navigation and persisted preview state.
- After fixing a packaged-app bug, verify both source-level checks and runtime behavior: `bunx tsc --noEmit`, relevant tests, full desktop build, install, relaunch, and an actual UI check.
- When investigating macOS `Security` / keychain permission popups, do **not** start with `security dump-keychain` or other bulk login-keychain enumeration commands. They can themselves trigger repeated permission dialogs across unrelated secrets and contaminate the incident.
- For keychain-popup triage, prefer process inspection, unified logs, app logs, shell history, and targeted config checks first. Only run direct `security` queries with the narrowest possible scope after warning the user that prompts may appear.

## Git Conventions

Commit format: `<type>(<scope>): <subject>` in English. Types: feat, fix, refactor, chore, docs, test, style, perf. **NEVER add AI signatures** (Co-Authored-By, Generated with, etc.).

For pull request creation, see the `pr` skill (`.claude/skills/pr/SKILL.md`).

## Skills Index

Detailed rules and guidelines are organized into Skills for better modularity:

| Skill            | Purpose                                                                            | Triggers                                                           |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **architecture** | File & directory structure conventions for all process types                       | Creating files, adding modules, architectural decisions            |
| **i18n**         | Internationalization workflow and standards                                        | Adding user-facing text, creating components with user-facing text |
| **testing**      | Testing workflow and quality standards                                             | Writing tests, adding features, before claiming completion         |
| **pr**           | Pull request workflow: ensure issue exists, push branch, open PR                   | Creating pull requests, after committing, `/oss-pr`                |
| **pr-review**    | Local PR code review with full project context, no truncation limits               | Reviewing a PR, user says "review PR", `/pr-review`                |
| **pr-fix**       | Fix all issues from a pr-review report, create a follow-up PR, and verify each fix | After pr-review, user says "fix all issues", `/pr-fix`             |

> Skills are located in `.claude/skills/` and contain project conventions that apply to **all** agents and contributors. Every agent working in this repository must read and follow the relevant skill files when the task matches their scope.

## Internationalization

All user-facing text must use i18n keys — never hardcode strings. Languages and modules are defined in `src/common/config/i18n-config.json`.

See the `i18n` skill (`.claude/skills/i18n/SKILL.md`) for complete workflow, key naming, and validation steps.
