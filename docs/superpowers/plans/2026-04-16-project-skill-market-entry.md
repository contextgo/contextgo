# Project Skill Market Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated conversation-header Skill Market entry that installs skills into the active workspace's `.contextgo/skills` directory.

**Architecture:** Reuse the existing Skill Market search/install surface, but split installation targets between global-user flows and workspace-local flows. Add a project-scoped modal in the conversation area and a new main-process bridge for workspace installs. Keep `.contextgo/skills` as the source of truth and runtime-native directories as projections only.

**Tech Stack:** React, Arco Design, Electron IPC bridge, Vitest, i18next, TypeScript

---

### Task 1: Add workspace install coverage first

**Files:**

- Modify: `tests/unit/process/bridge/skillMarketService.test.ts`
- Modify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Modify: `tests/unit/renderer/schedule/ProjectAutomationModal.dom.test.tsx`

- [ ] Add a failing main-process test that verifies Skill Market install can target a caller-provided workspace `.contextgo/skills` directory.
- [ ] Add a failing renderer test that expects a dedicated Skill Market action in the conversation header.
- [ ] Add a failing renderer test that exercises the project modal install flow and refresh behavior.

### Task 2: Implement workspace-targeted install path

**Files:**

- Modify: `src/process/bridge/services/skillmarket/SkillMarketService.ts`
- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/fsBridge.ts`

- [ ] Extend Skill Market install params to accept an explicit target skills directory.
- [ ] Add a new workspace install IPC bridge that writes into `<workspace>/.contextgo/skills`.
- [ ] Keep the existing global install path unchanged for settings flows.

### Task 3: Add project Skill Market modal and header entry

**Files:**

- Modify: `src/renderer/pages/conversation/components/ChatConversation.tsx`
- Modify: `src/renderer/pages/schedule/components/ProjectAutomationModal.tsx`
- Create or modify: `src/renderer/pages/conversation/components/ProjectSkillMarketModal.tsx`

- [ ] Add a new top-right conversation header entry for project Skill Market.
- [ ] Implement a project-scoped modal that reuses remote catalog browsing and installs into the current workspace.
- [ ] Refresh project skills/capability state after successful install.

### Task 4: Wire i18n and final verification

**Files:**

- Modify: `src/renderer/services/i18n/locales/en-US/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/conversation.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/conversation.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/conversation.json`

- [ ] Add all new conversation-surface strings to every supported locale.
- [ ] Regenerate i18n key types.
- [ ] Run targeted tests, then typecheck, lint, and the final verification commands for the touched area.
