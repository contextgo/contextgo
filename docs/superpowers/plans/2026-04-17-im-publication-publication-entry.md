# IM Publication Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class publication entry to the IM publication snapshot so renderer publication listing can consume explicit `Agent -> ChannelAccount -> PublishObject -> current Project Session` records.

**Architecture:** Keep durable publication persistence binding-backed for now, but add an explicit `IChannelPublicationEntry` projection in the process domain and bridge snapshot. Update renderer publication listing to prefer that projection while leaving add/edit flows on the existing binding and audience inputs.

**Tech Stack:** TypeScript, Electron IPC bridge, React, Vitest 4

---

### Task 1: Lock the new bridge projection in tests

**Files:**

- Modify: `tests/unit/channelBridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('returns explicit publication entries in the publication snapshot', async () => {
  const result = await handlers.refreshPublicationSnapshot();

  expect(result.success).toBe(true);
  expect(result.data?.catalog.publications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'binding-1',
        agentProfileId: 'agent-profile-1',
        channelAccountId: 'connector-1',
        publishObject: expect.objectContaining({
          id: expect.any(String),
          nativeObjectType: 'group',
        }),
        currentSession: expect.objectContaining({
          publicationBindingId: 'binding-1',
        }),
      }),
    ])
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/unit/channelBridge.test.ts`
Expected: FAIL because `catalog.publications` is missing from the snapshot payload.

- [ ] **Step 3: Write minimal implementation**

```ts
export type IChannelPublicationEntry = {
  id: string;
  agentProfileId: string;
  channelAccountId: string;
  channelAccountName?: string;
  channelAccountPlatform?: PluginType;
  publishObject: IChannelPublishObjectCatalogEntry;
  binding: IChannelBinding;
  currentSession?: IChannelActiveSessionEntry;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};
```

```ts
function buildPublicationEntries(/* snapshot parts */): IChannelPublicationEntry[] {
  return bindings.map((binding) => ({
    id: binding.id,
    agentProfileId: binding.agentProfileId,
    channelAccountId,
    channelAccountName: connector?.name,
    channelAccountPlatform: connector?.platform,
    publishObject,
    binding,
    currentSession,
    enabled: binding.enabled,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/unit/channelBridge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/channels/types.ts src/process/bridge/channelBridge.ts tests/unit/channelBridge.test.ts
git commit -m "feat(channels): project explicit publication entries"
```

### Task 2: Switch publication listing to the new publication entry

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts`
- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx`
- Modify: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders published objects from explicit publication entries', async () => {
  mockRefreshPublicationSnapshotInvoke.mockResolvedValueOnce({
    success: true,
    data: {
      catalog: {
        ...catalogResponse.data,
        audiences: [],
        publications: [
          {
            id: 'binding-1',
            agentProfileId: 'agent-profile-1',
            channelAccountId: 'connector-1',
            channelAccountName: 'Feishu Ops',
            channelAccountPlatform: 'lark',
            enabled: true,
            createdAt: 1000,
            updatedAt: 2000,
            binding: catalogResponse.data.bindings[1],
            publishObject: catalogResponse.data.publishObjects[0],
            currentSession: sessionCatalogResponse.data[0],
          },
        ],
      },
      activeSessions: sessionCatalogResponse.data,
      refreshedAt: 2000,
    },
  });

  renderPublicationPanel();

  expect(await screen.findByText('Design Review')).toBeInTheDocument();
  expect(screen.getByText('Feishu Ops')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: FAIL because the publication page still derives cards from bindings plus audiences.

- [ ] **Step 3: Write minimal implementation**

```ts
export type BuildAgentPublicationObjectsParams = {
  publications?: IChannelPublicationEntry[];
  // existing fallback inputs remain
};
```

```ts
if (params.publications?.length) {
  return params.publications
    .filter((publication) => publication.agentProfileId === selectedAgentProfileId)
    .map((publication) => ({
      key: publication.id,
      channelAccount: channelAccount,
      object: buildPublicationObjectFromEntry(publication),
      currentSession: publication.currentSession,
    }));
}
```

```tsx
const publicationEntries = buildAgentPublicationObjects({
  publications: catalog.publications,
  channelAccounts,
  audiences,
  bindings,
  publishObjects,
  sessions: activeSessions,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
git commit -m "feat(renderer): consume publication entries in publish page"
```

### Task 3: Keep compatibility fallback explicit

**Files:**

- Modify: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts`

- [ ] **Step 1: Write the failing test**

```tsx
it('falls back to binding-derived publication objects when publication entries are absent', async () => {
  mockRefreshPublicationSnapshotInvoke.mockResolvedValueOnce({
    success: true,
    data: {
      catalog: {
        ...catalogResponse.data,
        publications: undefined,
      },
      activeSessions: sessionCatalogResponse.data,
      refreshedAt: 2000,
    },
  });

  renderPublicationPanel();

  expect(await screen.findByText('Design Review')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: FAIL if the new renderer path assumes `catalog.publications` always exists.

- [ ] **Step 3: Write minimal implementation**

```ts
if (!params.publications?.length) {
  return buildLegacyAgentPublicationObjects(params);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
git commit -m "refactor(renderer): preserve publication listing fallback"
```

### Task 4: Verify the slice end to end

**Files:**

- Modify: `docs/superpowers/specs/2026-04-17-im-publication-publication-entry-design.md`
- Modify: `docs/superpowers/plans/2026-04-17-im-publication-publication-entry.md`

- [ ] **Step 1: Run focused tests**

Run: `bun run test tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

- [ ] **Step 2: Run type check**

Run: `bunx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 3: Run formatting and lint on touched files**

Run: `bun run format docs/superpowers/specs/2026-04-17-im-publication-publication-entry-design.md docs/superpowers/plans/2026-04-17-im-publication-publication-entry.md src/process/channels/types.ts src/process/bridge/channelBridge.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: formatting completes without errors

Run: `bun run lint src/process/channels/types.ts src/process/bridge/channelBridge.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-im-publication-publication-entry-design.md docs/superpowers/plans/2026-04-17-im-publication-publication-entry.md src/process/channels/types.ts src/process/bridge/channelBridge.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
git commit -m "feat(channels): surface explicit publication entries"
```
