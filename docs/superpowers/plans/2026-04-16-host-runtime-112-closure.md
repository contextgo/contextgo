# Host Runtime #112 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining host-runtime naming and ownership cleanup required to close issue `#112` without breaking current IPC or Official Remote flows.

**Architecture:** Keep the merged host-runtime model intact, but remove the last active legacy seams: browser-entry startup naming, `webui.desktop.*` preference keys, and process-service ownership wording. Maintain runtime compatibility by preserving the external `webui` IPC surface while updating internal ownership language and storage keys.

**Tech Stack:** TypeScript, Electron main process services, React settings tests, Vitest, i18next

---

### Task 1: Add closure tests first

**Files:**

- Modify: `tests/unit/process/services/host/hostBrowserEntryStartup.test.ts`
- Modify: `tests/unit/process/services/host/hostBrowserEntryPreferences.test.ts`
- Modify: `tests/unit/process/bridge/webuiService.test.ts`

- [ ] Add failing tests that expect startup helpers to use host-runtime naming.
- [ ] Add failing tests that expect new writes to use `host.runtime.localAccess.*` keys.
- [ ] Keep compatibility tests proving old `webui.desktop.*` keys are still readable.

### Task 2: Implement storage and startup semantic migration

**Files:**

- Create or modify: `src/process/services/host/hostRuntimeStartup.ts`
- Modify: `src/process/services/host/hostBrowserEntryPreferences.ts`
- Modify: `src/index.ts`
- Modify: `src/common/config/storage.ts`
- Modify: `src/process/utils/configMigration.ts`

- [ ] Introduce host-runtime startup helpers and move `src/index.ts` call sites onto them.
- [ ] Migrate local-access preference reads/writes to `host.runtime.localAccess.*`.
- [ ] Preserve fallback reads from `webui.desktop.*` for existing installs.

### Task 3: Reframe service ownership language

**Files:**

- Modify: `src/process/bridge/services/WebuiService.ts`
- Modify: `src/process/bridge/webuiBridge.ts`
- Modify: `tests/unit/process/bridge/webuiService.test.ts`

- [ ] Update service comments/logging/ownership naming so runtime access is described as host-runtime access instead of desktop WebUI ownership.
- [ ] Preserve the external `webui` bridge contract for compatibility.

### Task 4: Update docs and final verification

**Files:**

- Modify: `docs/superpowers/specs/2026-04-16-host-runtime-112-closure-design.md`
- Modify: `docs/superpowers/plans/2026-04-16-host-runtime-112-closure.md`

- [ ] Run targeted tests for host runtime, bridge, and renderer visibility.
- [ ] Run `bunx tsc --noEmit --pretty false`.
- [ ] Prepare PR body with `Closes #112`.
