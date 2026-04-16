# Conversation Cowork Parity Design

## Goal

Close the main renderer-side parity gaps for the `conversation-cowork` workbench so workspace-aware chat turns, browser preview entry, and workspace change visibility behave like first-class conversation capabilities.

## Scope

This PR groups issues `#183`, `#185`, and `#186`:

- always expose the browser/URL action for eligible conversations
- surface upload-in-flight state in the sendbox and block send while uploads are unresolved
- make workspace selections feel like explicit `@workspace` references instead of silent side data
- add a workspace `files / changes` split with diff preview for git-backed workspaces

## Non-Goals

- no WeCom or upload pipeline hardening from `#184`
- no visual redesign of `ChatLayout`
- no full mention autocomplete system for arbitrary `@` entities
- no git stage/unstage/write actions in the workspace panel

## Design

### Browser entry

The browser context button should render whenever a conversation is eligible to bind a browser context, not only when `browserContextAssetId` already exists. The button keeps the existing inline create/bind flow and still reuses the current preview + browser-context asset model.

### Sendbox parity

The sendbox already supports file attachments and workspace selections, but the state is fragmented. This PR introduces shared upload-pending state across drag, paste, and local-device upload paths, exposes that state inside the sendbox UI, and blocks send/queue/steer while uploads are still resolving.

Workspace selections stay attachment-backed, but the UI should present them as explicit `@workspace/...` references so users can see what the turn will include before sending.

### Workspace changes

The right workspace panel gains a lightweight `files / changes` tab model. `files` keeps the current tree flow. `changes` queries git status for the current workspace, lists changed files, and opens diff preview through the existing preview panel. This remains read-only in this PR.

## Architecture

- renderer: extend `SendBox`, platform sendboxes, conversation header addon rendering, and the workspace panel UI
- bridge/main: add minimal git changes + diff providers so the renderer can query workspace change state safely
- preview: reuse existing `diff` preview support instead of creating a second diff viewer path

## Acceptance Criteria

- a normal conversation with `spaceId` shows the browser button even before binding a browser context
- send actions are disabled while local uploads are still in flight
- selected workspace items are shown as explicit `@workspace` references in the composer area
- the workspace panel can switch between `files` and `changes`
- git-backed workspaces show changed files and can open a diff preview from the changes list
