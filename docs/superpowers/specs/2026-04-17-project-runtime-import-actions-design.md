# Project Runtime Import Actions Design

## Goal

Extend the existing project-scoped runtime boundary so a ContextGo-managed project can:

- import the user's current global runtime configuration into project-owned override files
- re-import the latest global runtime configuration into those project-owned override files
- reset the project back to global runtime behavior

This work applies to the project-level `Runtime` tab inside the workspace automation surface.

## Product Intent

ContextGo should not take ownership of the user's global CLI setup.

The product model is:

- the user may already have global runtime configuration for Codex, Claude Code, Gemini CLI, or OpenCode
- ContextGo may also provide a model-center-backed configuration for a specific managed project
- project runtime state must be isolated from global runtime state
- one project choosing a ContextGo-managed model source must not affect any other project

Therefore, project runtime actions must operate by creating or refreshing project-owned copies, not by mutating the user's global files.

## Scope

This design covers:

- project-level runtime actions in the `Runtime` tab
- main-process import and reset logic
- project-owned runtime file materialization under `.contextgo/`
- renderer state that reflects current mode and effective source

This design does not cover:

- full Gemini import parity
- model-center secret lifecycle beyond existing project runtime policy fields
- per-runtime advanced preference editing UX

## Non-Goals

- do not modify or delete the user's global runtime files
- do not create runtime-specific policy controls per assistant or per conversation
- do not introduce passthrough mode where a project directly reads global config while claiming to be isolated

## Runtime Model

Project runtime state remains rooted under `.contextgo/`.

Canonical project-owned files:

```text
.contextgo/
  runtime.json
  codex/
    config.toml
    auth.json
  claude/
    settings.json
  gemini/
    settings.json
  opencode/
    opencode.json
    auth.json
```

`runtime.json` remains the policy source of truth. Runtime-specific files are materialized project overrides.

## Mode Semantics

### `project_managed`

- ContextGo owns the project runtime configuration.
- Runtime-specific files under `.contextgo/<runtime>/...` are generated from ContextGo-managed values.
- When the runtime starts inside that project, it reads project-owned config only.

### `import_local_runtime`

- ContextGo imports the user's current global runtime config into project-owned files.
- After import completes, the runtime still reads only project-owned files.
- The imported project copy is now the source for that project until the user re-imports or resets.

### `auto`

- Keep current phase-1 behavior for resolution semantics.
- For this feature, `auto` does not add a separate action.
- The Runtime tab may still let the user switch back to `auto`, but import-oriented actions target explicit project state.

## User Actions

The `Runtime` tab should expose these actions:

### `Use ContextGo model center`

- switches mode to `project_managed`
- materializes project-owned runtime files for the current backend using ContextGo-managed values
- does not mutate global config

### `Import current global config`

- available when a workspace is bound
- reads the user's current global runtime config for the selected backend
- copies supported files into `.contextgo/<runtime>/...`
- updates `runtime.json` to `import_local_runtime`
- records `importedFrom` and `lastImportedAt`

### `Re-import global config`

- same file-copy behavior as import
- available when project-owned runtime files already exist or when mode is `import_local_runtime`
- overwrites the existing project-owned copy

### `Reset to global`

- clears project-owned override files for the selected backend
- updates `runtime.json` so the project is no longer using imported override state
- after reset, runtime resolution falls back to the global path model for that project

## Safety Rules

Import and reset must follow these guarantees:

- read global files, never edit them
- write only under the current project's `.contextgo/`
- never delete global files
- never write secrets into unrelated projects
- if import fails halfway, do not leave partially updated policy metadata claiming success

## Backend Rollout

### Phase 2A

Implement real import and reset behavior for:

- Codex
- Claude Code
- OpenCode

For Gemini:

- allow mode switching in UI
- show clear status text that import actions are not yet implemented
- do not claim import success

## Import Mapping

### Codex

Read:

- `~/.codex/config.toml`
- `~/.codex/auth.json`

Write:

- `.contextgo/codex/config.toml`
- `.contextgo/codex/auth.json`

### Claude Code

Read:

- `~/.claude/settings.json`

Write:

- `.contextgo/claude/settings.json`

### OpenCode

Read:

- `~/.config/opencode/opencode.json`
- `~/.local/share/opencode/auth.json`

Write:

- `.contextgo/opencode/opencode.json`
- `.contextgo/opencode/auth.json`

### Gemini

Not imported in this phase.

## Main-Process Design

Add a dedicated runtime action service layer rather than keeping import logic inside renderer.

Recommended responsibilities:

- `runtimeImporters.ts`
  - implement backend-specific file copy/import logic
- `ProjectRuntimeService.ts`
  - expose action-oriented methods such as:
    - `importCurrentGlobalRuntime(workspace, backend)`
    - `resetProjectRuntimeOverride(workspace, backend)`
    - `materializeProjectManagedRuntime(workspace, backend)`
- bridge surface
  - invoke those methods from renderer
  - return fresh runtime policy and file locations after each action

## Renderer Design

Keep the feature in `ProjectAutomationModal > Runtime`.

The tab should show:

- current mode
- current effective source
- policy file path
- current backend project config root
- action buttons

Action button availability:

- `Use ContextGo model center`
  - always available when workspace exists
- `Import current global config`
  - available for Codex, Claude, OpenCode
- `Re-import global config`
  - available after an imported project copy exists
- `Reset to global`
  - available when project-owned override state exists for the backend

The renderer should stop directly editing `runtime.json` for these actions and instead call bridge commands.

Direct file editing in the tab remains acceptable for manual inspection only if it does not bypass the action flow.

## Error Handling

If import source files are missing:

- do not write success metadata
- show a backend-specific error explaining which expected file was not found

If reset is requested but no project-owned override exists:

- treat as a no-op success
- refresh UI state

If project file writes fail:

- leave existing project runtime files untouched where possible
- do not switch mode to imported unless the copy succeeded

## Testing

Add tests for:

- importer path mapping per supported backend
- import updates `runtime.json` metadata only after file copy succeeds
- reset removes project-owned override files without touching global paths
- Runtime tab shows action buttons by backend support
- Runtime tab refreshes mode and effective source after import/re-import/reset

## Open Questions Resolved

### Should ContextGo mutate the user's global runtime environment?

No.

The feature operates by copying global runtime state into the current project or by generating project-owned runtime state from the model center.

### Should project runtime override be patch-based or complete?

Complete override.

Once a project uses imported or ContextGo-managed runtime state, that project should read only project-owned runtime files for the supported backend.
