# Runtime Config Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open managed runtime config files inside ContextGo settings with a dedicated right-side config dock instead of the generic preview shell or the system file opener.

**Architecture:** Keep runtime detection and config-path lookup in `CustomAcpAgent`, add a settings-native dock component for multi-file config editing, and reuse existing text editor + filesystem IPC for load/save/reload flows. The dock lives in the settings surface, not in conversation preview state.

**Tech Stack:** React, Arco Design, existing settings shell CSS, existing filesystem IPC bridge, Vitest + Testing Library

---

### Task 1: Lock the new runtime config dock behavior with tests

**Files:**

- Modify: `tests/unit/renderer/RuntimeSettings.dom.test.tsx`

- [ ] Add failing tests for opening config into an in-app dock, rendering multiple config-source tabs, and saving/reloading through filesystem IPC.
- [ ] Run the targeted runtime settings test file and confirm the new expectations fail for the current external-open implementation.

### Task 2: Build the dedicated settings runtime config dock

**Files:**

- Create: `src/renderer/pages/settings/components/RuntimeConfigDock.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx`
- Modify: `src/renderer/pages/settings/components/settings.css`

- [ ] Implement dock state and open action wiring in `CustomAcpAgent`.
- [ ] Build a dock with config-source tabs, metadata, save/reload/reveal actions, and close action.
- [ ] Reuse the existing text editor and `ipcBridge.fs.readFile` / `ipcBridge.fs.writeFile` for editing flows.

### Task 3: Add i18n copy and verify regressions

**Files:**

- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: locale counterparts required by `i18n-config.json`

- [ ] Add dock-specific strings for labels, empty/error states, save/reload feedback, and unsaved markers.
- [ ] Run `bun run i18n:types` and `node scripts/check-i18n.js`.
- [ ] Run targeted runtime/settings tests and `bunx tsc --noEmit`.
