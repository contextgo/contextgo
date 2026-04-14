# Publish Object Catalog Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make publish-object catalog references explicit across bridge and renderer so publication, audience, and active-session flows all point at the same stable catalog object id.

**Architecture:** This phase formalizes catalog resolution as shared IM-domain logic instead of repeating matching heuristics in `channelBridge` and renderer view models. The bridge will project `publishObjectCatalogEntryId` onto audiences and active sessions, then renderer code will consume that stable reference instead of reconstructing object identity from bindings and scope keys.

**Tech Stack:** TypeScript, Vitest, Electron main-process bridge/services, React renderer.

---

### Task 1: Shared Catalog Reference Resolver

**Files:**

- Modify: `src/process/channels/types.ts`
- Modify: `src/process/channels/utils/imObjects.ts`
- Modify: `src/process/channels/utils/index.ts`
- Test: `tests/unit/process/projectChannelPublicationCatalog.test.ts`

- [ ] **Step 1: Write the failing resolver test**

```ts
it('resolves a publish-object catalog entry from exact identity, audience identity, and legacy alias candidates', async () => {
  // Expect one shared resolver path to find the topic catalog entry even when the binding still carries a legacy scopeKey.
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: FAIL because shared catalog-resolution helpers and explicit catalog reference fields do not exist yet.

- [ ] **Step 3: Add the shared resolver and explicit reference fields**

Implement:

- `publishObjectCatalogEntryId?: string` on `IChannelAudienceEntry`
- `publishObjectCatalogEntryId?: string` on `IChannelActiveSessionEntry`
- shared catalog helpers in `src/process/channels/utils/imObjects.ts` for:
  - exact catalog entry identity lookup
  - audience-derived identity lookup
  - alias-based fallback lookup for legacy `scopeKey` / remote ids
- exports from `src/process/channels/utils/index.ts`

- [ ] **Step 4: Run the resolver test to verify it passes**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/channels/types.ts src/process/channels/utils/imObjects.ts src/process/channels/utils/index.ts tests/unit/process/projectChannelPublicationCatalog.test.ts
git commit -m "feat(channels): add publish object catalog references"
```

### Task 2: Bridge Projection Of Stable Catalog References

**Files:**

- Modify: `src/process/bridge/channelBridge.ts`
- Test: `tests/unit/channelBridge.test.ts`

- [ ] **Step 1: Write the failing bridge tests**

```ts
it('projects publishObjectCatalogEntryId onto audience entries and active session entries', async () => {
  // Expect both the audience list and active session catalog to point at the same stable publish-object catalog id.
});

it('aggregates object-level activeSessionPointer through the shared publish-object resolver', async () => {
  // Expect publishObjects[].activeSessionPointer to still resolve correctly when the binding only matches through legacy alias candidates.
});
```

- [ ] **Step 2: Run the targeted bridge tests to verify they fail**

Run: `bun run test tests/unit/channelBridge.test.ts`
Expected: FAIL on missing `publishObjectCatalogEntryId` projection and missing shared resolver usage.

- [ ] **Step 3: Route bridge assembly through the shared resolver**

Implement:

- audience assembly sets `publishObjectCatalogEntryId`
- active session assembly sets `publishObjectCatalogEntryId`
- object-level active-session-pointer aggregation uses the shared resolver instead of local duplicated matching logic
- keep existing `objectTitle`, `objectSubtitle`, `objectSource`, and `objectQuality` behavior intact

- [ ] **Step 4: Run bridge tests to verify they pass**

Run: `bun run test tests/unit/channelBridge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/bridge/channelBridge.ts tests/unit/channelBridge.test.ts
git commit -m "feat(channels): project stable publish object references"
```

### Task 3: Renderer Consumption Of Explicit Catalog References

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts`
- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/objectViewModel.ts`
- Test: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`

- [ ] **Step 1: Write the failing renderer test**

```tsx
it('prefers bridge-projected publishObjectCatalogEntryId over rebuilding object identity from binding metadata', async () => {
  // Expect the publication card and current-session selection to use the catalog entry even when binding metadata is still generic.
});
```

- [ ] **Step 2: Run the DOM test to verify it fails**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: FAIL because renderer code still reconstructs catalog identity from bindings/audience heuristics.

- [ ] **Step 3: Consume explicit catalog references in renderer view models**

Implement:

- object assembly prefers `publishObjectCatalogEntryId` from audiences/sessions before fallback matching
- publication object current-session resolution still prefers object-level `activeSessionPointer`
- renderer keeps the existing fallback path only for older bridge payloads

- [ ] **Step 4: Run the DOM test to verify it passes**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/objectViewModel.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
git commit -m "feat(renderer): consume stable publish object references"
```

### Task 4: Verification

**Files:**

- Modify: `docs/superpowers/plans/2026-04-15-publish-object-catalog-phase2.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
bunx tsc --noEmit
```

Expected: PASS

- [ ] **Step 2: Run formatting on touched files**

Run:

```bash
bunx oxfmt --check src/process/channels/types.ts src/process/channels/utils/imObjects.ts src/process/channels/utils/index.ts src/process/bridge/channelBridge.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/objectViewModel.ts tests/unit/process/projectChannelPublicationCatalog.test.ts tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx docs/superpowers/plans/2026-04-15-publish-object-catalog-phase2.md
```

Expected: PASS

- [ ] **Step 3: Commit the plan update if it changed during execution**

```bash
git add docs/superpowers/plans/2026-04-15-publish-object-catalog-phase2.md
git commit -m "docs(channels): record publish object catalog phase 2 plan"
```
