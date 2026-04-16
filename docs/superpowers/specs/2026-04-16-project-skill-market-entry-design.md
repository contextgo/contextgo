# Project Skill Market Entry Design

## Goal

Expose a dedicated Skill Market entry in the main conversation header so users can discover and install skills directly into the active project's `.contextgo/skills` directory without detouring through settings or assistant-edit flows.

## Product Decision

The conversation header currently exposes two adjacent project-shaping actions:

- publish the current conversation as an Agent
- open the project automation surface

Skill Market should become a third first-class action in the same area. This is intentionally distinct from the existing automation button because discovery and installation are different user intents from inspecting current automation state.

## Chosen Approach

Add a project-scoped `Skill Market` button to the conversation header. Clicking it opens a new modal focused on remote discovery and project-local installation. The modal reuses the existing Skill Market catalog/search/install UI patterns, but the install target changes from the user skill directory to the active workspace's `.contextgo/skills`.

This keeps the product story coherent:

- users install capabilities into the current project
- `.contextgo/skills` remains the source of truth
- runtime-native directories remain projections only
- the project continues to align with ContextGo's Obsidian-backed workspace/vault model

## Rejected Alternatives

### Reuse the existing automation modal only

Rejected because the user explicitly wants a distinct top-right entry and a discovery-first experience. Burying Skill Market under the automation modal keeps the capability discoverable only after an extra click and mixes inspection with acquisition.

### Navigate to the settings Skill Hub page

Rejected because it breaks conversation-level flow and turns a project-scoped action into a settings detour. The project use case should stay in-place.

## Architecture

### Renderer

- Add a new conversation-header button component beside publish/automation.
- Add a project-scoped modal component near the existing conversation/project automation UI.
- Reuse Skill Market list/search/filter/install patterns from settings/assistant flows where possible.
- Refresh project capability state after successful install.

### Main process

- Extend Skill Market install support to allow an explicit destination skills directory.
- Add a workspace-targeted IPC bridge that installs into `<workspace>/.contextgo/skills`.
- Keep the existing global-user Skill Market install bridge unchanged for settings flows.

### Workspace model

- Installed project skills live under `<workspace>/.contextgo/skills/<skill-name>`.
- Existing project capability discovery already reads `.contextgo/skills`; the new flow should feed that surface directly.
- Runtime-native directories such as `.claude/skills` and `.codex/skills` remain projection outputs only.

## UX Details

- The header action should only appear when the conversation supports workspace automation semantics.
- Opening the modal should not navigate away from the current conversation.
- The modal should make the install target explicit as the current project's automation directory.
- Successful installs should show immediate feedback and update the visible project skill list.

## Testing

- Renderer test for header button visibility and modal open behavior.
- Renderer test for modal install flow and post-install refresh.
- Main-process test for workspace-targeted Skill Market install behavior.

## Risks

- Duplicating too much Skill Market UI between settings and conversation surfaces.
- Accidentally installing into the global user skills directory instead of the workspace directory.
- Breaking the `.contextgo` source-of-truth rule by writing directly into runtime-native skill directories.

## Scope Boundaries

This change does not redesign the full automation modal, replace the settings Skill Hub, or change runtime projection behavior. It only adds a project-first entry and a project-targeted installation path.
