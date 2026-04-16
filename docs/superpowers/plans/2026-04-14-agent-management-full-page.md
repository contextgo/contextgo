# Agent Management Full-Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the drawer-based Agent management flow with a route-based full-page workspace for list, create, and detail views, including package-oriented detail tabs for `Skills`, `Hooks`, `Schedules`, `Commands`, `AGENTS.md`, and `Docs`.

**Architecture:** Keep the existing settings shell and settings-side navigation, but refactor `/settings/agent` into a small routed workspace. Move assistant selection out of local drawer state and into URL state, add a normalized renderer view model for assistant package surfaces, and render detail tabs as workbench pages with document-browser treatment for `AGENTS.md` and `Docs`.

**Tech Stack:** TypeScript, React, React Router, Electron IPC bridge, Arco Design, Vitest 4, i18next

---

## Planned File Structure

To avoid adding more flat files into `src/renderer/pages/settings/AgentSettings/`, split the new UI into a dedicated workspace module:

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/index.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/AssistantWorkspace.module.css`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/constants.ts`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/types.ts`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/viewModel.ts`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/list/AgentListPage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentDetailPage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentBasicsPanel.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/SkillsTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/HooksTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/SchedulesTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/CommandsTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/AgentsEntryTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/DocsTab.tsx`

Keep the existing modal helper components only where they still make sense, such as `AddSkillsModal`, but stop using `AssistantEditDrawer` as the main detail surface.

### Task 1: Lock the new routing behavior in tests

**Files:**

- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Create: `tests/unit/renderer/agent/AgentWorkspaceRoutes.dom.test.tsx`

- [ ] Add failing route tests for:
  - `/settings/agent`
  - `/settings/agent/new`
  - `/settings/agent/:assistantId`
  - `/settings/agent/:assistantId/:tabId`
- [ ] Add a focused workspace-route test that verifies `/settings/agent/:assistantId` redirects to the resolved default tab instead of rendering an empty shell.
- [ ] Run: `bun run test -- tests/unit/renderer/layout/Router.dom.test.tsx tests/unit/renderer/agent/AgentWorkspaceRoutes.dom.test.tsx`
      Expected: route assertions fail before implementation because nested Agent workspace routes do not exist yet.

### Task 2: Replace the page entry with a routed Agent workspace shell

**Files:**

- Modify: `src/renderer/pages/settings/AgentSettings/index.tsx`
- Modify: `src/renderer/components/layout/Router.tsx`
- Modify: `src/renderer/components/layout/routerLocation.ts`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/index.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/constants.ts`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/types.ts`

- [ ] Add route constants and tab metadata for the canonical tabs:

```ts
export const AGENT_DETAIL_TABS = ['skills', 'hooks', 'schedules', 'commands', 'agents', 'docs'] as const;
export type AgentDetailTabId = (typeof AGENT_DETAIL_TABS)[number];
```

- [ ] Update the main router so `/settings/agent/*` loads the Agent workspace instead of only the legacy list page:

```tsx
<Route path='/settings/agent/*' element={withRouteFallback(loadAgentSettings, '/settings/agent/*')} />
<Route path='/agents' element={<Navigate to='/settings/agent' replace />} />
```

- [ ] Expand route preloading and stable-route matching so `/settings/agent/new` and `/settings/agent/:assistantId/...` are treated as part of the same Agent workspace surface.
- [ ] Keep the settings shell unchanged: the new workspace still renders inside `SettingsPageWrapper`.
- [ ] Run: `bun run test -- tests/unit/renderer/layout/Router.dom.test.tsx tests/unit/renderer/agent/AgentWorkspaceRoutes.dom.test.tsx`
      Expected: route tests pass after the router shell and route-matching logic are updated.

### Task 3: Build the full-page Agent list and create pages

**Files:**

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/list/AgentListPage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/AssistantWorkspace.module.css`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantListPanel.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/index.tsx`
- Modify: `src/renderer/hooks/assistant/useAssistantEditor.ts`
- Create: `tests/unit/renderer/agent/AgentListPage.dom.test.tsx`
- Create: `tests/unit/renderer/agent/AgentCreatePage.dom.test.tsx`

- [ ] Extract the current list browsing concerns out of `AssistantManagement` and render them as a dedicated page component with:
  - header
  - create action
  - product-agent list
  - system-agent summary linking to `/settings/system-runs`
- [ ] Change list click behavior from drawer-open to route navigation:

```ts
navigate(`/settings/agent/${assistant.id}`);
```

- [ ] Move create and duplicate initialization into a full-page create surface backed by the existing editor state, for example:

```ts
const duplicateId = searchParams.get('duplicate');
const isDuplicate = Boolean(duplicateId);
```

- [ ] On successful save of a newly created assistant, navigate to the resolved detail route instead of closing a drawer.
- [ ] Keep existing `AddSkillsModal` and related helper flows reusable from the create page where they still provide value.
- [ ] Run: `bun run test -- tests/unit/renderer/agent/AssistantListPanel.dom.test.tsx tests/unit/renderer/agent/AgentListPage.dom.test.tsx tests/unit/renderer/agent/AgentCreatePage.dom.test.tsx`
      Expected: the old list-panel test is updated to assert route navigation, and the new full-page list/create tests pass.

### Task 4: Add a normalized assistant workspace view model and default-tab resolution

**Files:**

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/viewModel.ts`
- Modify: `src/renderer/hooks/assistant/useAssistantEditor.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils.ts`
- Create: `tests/unit/renderer/agent/agentWorkspaceViewModel.test.ts`

- [ ] Create helpers that normalize assistant metadata, editability, capability presence, and doc/package surfaces into one renderer-friendly shape:

```ts
type AgentWorkspaceModel = {
  assistant: AssistantListItem;
  availableTabs: AgentDetailTabId[];
  defaultTab: AgentDetailTabId | null;
  isEditable: boolean;
  hasPackageContract: boolean;
  hasDocs: boolean;
};
```

- [ ] Implement the agreed default-tab priority:

```ts
const DEFAULT_TAB_PRIORITY: AgentDetailTabId[] = ['skills', 'hooks', 'schedules', 'commands', 'agents', 'docs'];
```

- [ ] Reuse existing assistant and package helpers where possible rather than re-deriving package ownership in page components.
- [ ] Include the custom-assistant fallback rule: when no package tab is populated, route to the first addable operational tab and allow the basics panel to auto-open.
- [ ] Run: `bun run test -- tests/unit/renderer/agent/agentWorkspaceViewModel.test.ts`
      Expected: pure view-model tests cover default-tab selection, tab visibility, and editability states.

### Task 5: Implement the detail page shell and inline basics inspector

**Files:**

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentDetailPage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentBasicsPanel.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantEditDrawer.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/DeleteAssistantModal.tsx`
- Create: `tests/unit/renderer/agent/AgentDetailPage.dom.test.tsx`

- [ ] Build the detail page header with:
  - back action
  - avatar
  - assistant name and description
  - source badges
  - runtime summary
  - action buttons for `Edit Basics`, `Duplicate`, `Enable / Disable`, and `Delete` when allowed
- [ ] Replace full-detail drawer usage with an inline page panel for assistant basics. Reuse the existing editor fields and permission rules, but render them inside the page shell rather than in a floating drawer.
- [ ] Redirect `/settings/agent/:assistantId` to the resolved default tab using `Navigate`.
- [ ] Preserve delete confirmation as a modal if desired, because the user objection is to detail rendering, not to confirmation affordances.
- [ ] Run: `bun run test -- tests/unit/renderer/agent/AgentDetailPage.dom.test.tsx`
      Expected: detail-page tests cover header actions, basics-panel toggling, and default-tab redirects.

### Task 6: Implement the package-surface tabs as workbench layouts

**Files:**

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/SkillsTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/HooksTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/SchedulesTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/CommandsTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/AgentsEntryTab.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/DocsTab.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AssistantManagement/AddSkillsModal.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/HookRoutingConfigModal.tsx`
- Create: `tests/unit/renderer/agent/AgentDetailTabs.dom.test.tsx`

- [ ] Give `Skills`, `Hooks`, `Schedules`, and `Commands` a shared workbench pattern:

```tsx
<div className={styles.workbench}>
  <aside className={styles.indexPane}>{/* list */}</aside>
  <section className={styles.detailPane}>{/* selected item */}</section>
</div>
```

- [ ] Reuse current assistant editor state for skill and hook mutations so the first slice does not need a second mutation layer.
- [ ] Implement `AGENTS.md` as a contract page with:
  - summary strip
  - rendered markdown body
  - heading outline when available
- [ ] Implement `Docs` as a doc-tree plus reader surface with query-state selection:

```ts
const selectedDoc = searchParams.get('doc') ?? defaultDocPath;
```

- [ ] Keep empty states explicit:
  - hide tabs that truly do not apply
  - show add/configure empty states for editable operational tabs
- [ ] Run: `bun run test -- tests/unit/renderer/agent/AgentDetailTabs.dom.test.tsx`
      Expected: tab tests cover workbench rendering, empty-state logic, `AGENTS.md` contract rendering, and docs-tree selection.

### Task 7: Update i18n and end-to-end renderer coverage

**Files:**

- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/settings.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/settings.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/settings.json`
- Modify: `src/renderer/services/i18n/i18n-keys.d.ts`
- Modify: `tests/unit/renderer/agent/AssistantListPanel.dom.test.tsx`
- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`

- [ ] Add all new page, tab, empty-state, and action labels behind i18n keys. Do not hardcode new user-facing text in renderer components.
- [ ] Refresh i18n type coverage after locale updates.
- [ ] Run focused renderer verification:
  - `bun run test -- tests/unit/renderer/agent/AssistantListPanel.dom.test.tsx tests/unit/renderer/agent/AgentWorkspaceRoutes.dom.test.tsx tests/unit/renderer/agent/AgentListPage.dom.test.tsx tests/unit/renderer/agent/AgentCreatePage.dom.test.tsx tests/unit/renderer/agent/AgentDetailPage.dom.test.tsx tests/unit/renderer/agent/AgentDetailTabs.dom.test.tsx tests/unit/renderer/layout/Router.dom.test.tsx`
  - `bun run i18n:types`
  - `bunx tsc --noEmit`
- [ ] Record any deliberate follow-ups that are left out of this slice, especially:
  - richer schedule editing
  - command mutation UI
  - package import or remote package browsing
  - deeper docs-search or full-text indexing
