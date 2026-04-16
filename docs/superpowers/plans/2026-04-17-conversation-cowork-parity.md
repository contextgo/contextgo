# Conversation Cowork Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the renderer-side parity slice for `conversation-cowork` by making browser preview discoverable, surfacing upload-aware sendbox state, and adding a workspace `files / changes` view.

**Architecture:** Keep the host foundation from PR1 unchanged, then extend the existing conversation renderer modules with one small git-status bridge. Reuse current preview/diff infrastructure and keep the workspace changes view read-only.

**Tech Stack:** React, React Router, Electron bridge IPC, TypeScript, Vitest, i18next

---

### Task 1: Browser action discoverability

**Files:**

- Modify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Modify: `src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx`

- [ ] Change the conversation header test so browser action is expected for a space-backed conversation without a bound browser context.
- [ ] Run the focused chat conversation test and confirm it fails.
- [ ] Update the header addon gating so browser action renders whenever the conversation can bind a browser context.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Upload-aware sendbox state and workspace reference labels

**Files:**

- Modify: `tests/unit/renderer/chat/sendboxLayoutMode.dom.test.tsx`
- Modify: `tests/unit/messageFiles.test.ts`
- Modify: `src/renderer/components/chat/sendbox.tsx`
- Modify: `src/renderer/components/media/FileAttachButton.tsx`
- Modify: `src/renderer/hooks/file/useDragUpload.ts`
- Modify: `src/renderer/hooks/file/usePasteService.ts`
- Create: `src/renderer/utils/file/workspaceReferences.ts`
- Modify: `src/renderer/pages/conversation/platforms/gemini/GeminiSendBox.tsx`
- Modify: `src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx`
- Modify: `src/renderer/pages/conversation/platforms/codex/CodexSendBox.tsx`

- [ ] Add a failing sendbox test that expects pending uploads to disable send and show upload-state messaging.
- [ ] Add a failing utility test for workspace reference label formatting.
- [ ] Add shared pending-upload callbacks for drag, paste, and local-device upload paths.
- [ ] Surface pending upload state in `SendBox`.
- [ ] Render selected workspace items as `@workspace/...` references in platform sendboxes.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Workspace files/changes split with diff preview

**Files:**

- Create: `tests/unit/renderer/workspace/WorkspaceChanges.dom.test.tsx`
- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/fsBridge.ts`
- Modify: `src/renderer/services/i18n/locales/en-US/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/conversation.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/conversation.json`
- Create: `src/renderer/pages/conversation/Workspace/Changes/index.tsx`
- Create: `src/renderer/pages/conversation/Workspace/Changes/useWorkspaceChanges.ts`
- Modify: `src/renderer/pages/conversation/Workspace/components/WorkspaceToolbar.tsx`
- Modify: `src/renderer/pages/conversation/Workspace/index.tsx`

- [ ] Add a failing workspace changes test that expects a `changes` view and diff preview dispatch.
- [ ] Add minimal git changes + diff bridge providers.
- [ ] Add workspace tab switching and the read-only changes list UI.
- [ ] Reuse preview diff rendering when a change row is opened.
- [ ] Run the focused workspace test and confirm it passes.

### Task 4: i18n and regression verification

**Files:**

- Modify: `src/renderer/services/i18n/i18n-keys.d.ts` (generated)

- [ ] Run `bun run i18n:types`.
- [ ] Run `node scripts/check-i18n.js`.
- [ ] Run focused chat/workspace/sendbox tests.
- [ ] Run `bunx tsc --noEmit --pretty false`.
