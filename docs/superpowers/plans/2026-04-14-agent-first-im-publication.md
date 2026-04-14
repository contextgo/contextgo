# Agent-First IM Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/settings/agent-publish` so the page starts from the selected Agent, lists only that Agent’s published IM objects, and uses an add-publication flow instead of a channel-first operations console.

**Architecture:** Keep the existing conversation-header publish entry and bridge payloads, but refactor the renderer publication panel into an Agent-first composition. Build derived view models from the current catalog so the UI can render publish-object cards and drive publication creation without exposing technical routing identifiers as the primary interaction.

**Tech Stack:** TypeScript, React, Electron IPC bridge, Vitest 4, i18next

---

### Task 1: Lock the new Agent-first publication behavior in renderer tests

**Files:**

- Modify: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
- Modify: `tests/unit/renderer/settings/ChannelModalContent.dom.test.tsx`

- [ ] Cover Agent summary, published-object listing, add-publication flow, and publication-intent preselection with failing tests.
- [ ] Update sessions-page copy expectations so the settings shell describes Agent-first publication instead of channel-first long-term rules.

### Task 2: Add a focused view-model layer for Agent-first publication rendering

**Files:**

- Create: `src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts`

- [ ] Add helpers that derive Agent-scoped publication entries from the current binding catalog, including channel-account labels, publish-object labels, and active-session summaries.
- [ ] Preserve support for discovered publish objects and existing durable bindings, while keeping technical identifiers secondary.

### Task 3: Refactor the publication panel into an Agent-first page

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx`

- [ ] Replace the channel-first page structure with:
  - Agent summary header
  - published-object list for the selected Agent
  - collapsed add-publication flow
- [ ] Keep `publicationIntent` restore logic and use it to preselect the Agent.
- [ ] Reuse existing bridge calls for save and delete.
- [ ] Keep a secondary manual-target path only as a fallback, not the primary path.

### Task 4: Update settings copy for the new publication mental model

**Files:**

- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/settings.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/settings.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/settings.json`
- Modify: `src/renderer/services/i18n/i18n-keys.d.ts`

- [ ] Add or rewrite publication-page strings so they describe Agent-first publishing and publish objects.
- [ ] Keep all new copy behind i18n keys and regenerate i18n key types after the JSON updates.

### Task 5: Verify the implementation slice

**Files:**

- Verify: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
- Verify: `tests/unit/renderer/settings/ChannelModalContent.dom.test.tsx`

- [ ] Run the focused Vitest renderer tests for the publication page.
- [ ] Run `bun run i18n:types` and `node scripts/check-i18n.js`.
- [ ] Record any remaining follow-up gaps, especially for per-publication policy persistence or platform-side object enumeration.
