# Publish Object Catalog Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-local publish-object catalog that backfills display identity from bindings and remote identities, then route publication UI through that catalog.

**Architecture:** The implementation adds a new catalog document beside project-local publication bindings, resolves catalog entries from bindings plus remote identities in the main process, and exposes display quality to the renderer so fallback objects are explicit instead of silently formatted from technical ids.

**Tech Stack:** TypeScript, Vitest, Electron main-process services, React renderer, i18next.

---

### Task 1: Domain Types And Catalog Persistence

**Files:**

- Modify: `src/process/channels/types.ts`
- Modify: `src/process/channels/utils/imObjects.ts`
- Modify: `src/process/channels/utils/index.ts`
- Modify: `src/process/channels/core/ProjectChannelPublicationService.ts`
- Test: `tests/unit/process/projectChannelPublicationCatalog.test.ts`

- [ ] **Step 1: Write the failing catalog persistence test**

```ts
it('merges binding publish-object metadata and remote identity facts into a persisted catalog entry', async () => {
  // Expect the service to backfill publish-objects.json and prefer readable inbound titles.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: FAIL because catalog types/service methods do not exist yet.

- [ ] **Step 3: Add catalog model and persistence**

Implement:

- `IChannelPublishObjectDisplayProfile`
- `IChannelPublishObjectCatalogEntry`
- `ChannelPublishObjectDisplayQuality`
- project-local `publish-objects.json`
- merge helpers inside `ProjectChannelPublicationService`

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/channels/types.ts src/process/channels/utils/imObjects.ts src/process/channels/utils/index.ts src/process/channels/core/ProjectChannelPublicationService.ts tests/unit/process/projectChannelPublicationCatalog.test.ts
git commit -m "feat(channels): persist publish object catalog"
```

### Task 2: Bridge Catalog Resolution

**Files:**

- Modify: `src/process/bridge/channelBridge.ts`
- Test: `tests/unit/channelBridge.test.ts`

- [ ] **Step 1: Write failing bridge tests for resolved and fallback quality**

```ts
it('prefers catalog-resolved titles for binding audiences and active sessions', async () => {
  // Expect object title/subtitle/source/quality from catalog
});

it('marks unresolved topics as fallback instead of silently treating them as fully resolved', async () => {
  // Expect fallback quality fields in returned audience entry
});
```

- [ ] **Step 2: Run the targeted bridge tests to verify they fail**

Run: `bun run test tests/unit/channelBridge.test.ts -- --runInBand`
Expected: FAIL on missing catalog-resolved fields / changed expectations.

- [ ] **Step 3: Route bridge output through the catalog**

Implement:

- catalog lookup while building `IChannelAudienceEntry`
- catalog lookup while building `IChannelActiveSessionEntry`
- preservation of current objectKey/objectKind/objectTitle fields
- new display source / quality fields on bridge outputs

- [ ] **Step 4: Run bridge tests to verify they pass**

Run: `bun run test tests/unit/channelBridge.test.ts -- --runInBand`
Expected: targeted expectations PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/bridge/channelBridge.ts tests/unit/channelBridge.test.ts
git commit -m "feat(channels): resolve bridge display from publish object catalog"
```

### Task 3: Renderer Quality State

**Files:**

- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/objectViewModel.ts`
- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts`
- Modify: `src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx`
- Modify: `src/common/config/i18n-config.json`
- Modify: `src/renderer/i18n/locales/*/settings.json`
- Test: `tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`

- [ ] **Step 1: Write failing renderer test for low-confidence badge**

```tsx
it('shows a fallback-status tag for publish objects that still rely on technical fallback identity', async () => {
  // Expect explicit low-confidence UI marker
});
```

- [ ] **Step 2: Run the DOM test to verify it fails**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: FAIL because no fallback indicator is rendered yet.

- [ ] **Step 3: Implement renderer consumption of quality state**

Implement:

- view-model fields for display quality/source
- publish object option labels that prefer catalog-resolved titles
- publication card badge for fallback objects
- i18n keys for resolved/fallback status text

- [ ] **Step 4: Run DOM test plus i18n validation**

Run: `bun run test tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx`
Expected: PASS

Run: `bun run i18n:types && node scripts/check-i18n.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/settings/SettingsModal/contents/channels/publication/objectViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/agentPublicationViewModel.ts src/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel.tsx src/common/config/i18n-config.json src/renderer/i18n/locales tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx
git commit -m "feat(renderer): expose publish object display quality"
```

### Task 4: Verification

**Files:**

- Modify: `docs/superpowers/specs/2026-04-14-publish-object-catalog-phase1-design.md`
- Modify: `docs/superpowers/plans/2026-04-14-publish-object-catalog-phase1.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
bunx tsc --noEmit
bun run test tests/unit/process/projectChannelPublicationCatalog.test.ts tests/unit/channelBridge.test.ts tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx tests/unit/renderer/publicationBindingViewModel.test.ts
```

Expected: PASS for targeted catalog / bridge / renderer coverage.

- [ ] **Step 2: Run formatting and lint on touched files**

Run:

```bash
bun run lint:fix -- <touched files>
bun run format <touched files>
```

Expected: PASS

- [ ] **Step 3: Commit final polish**

```bash
git add docs/superpowers/specs/2026-04-14-publish-object-catalog-phase1-design.md docs/superpowers/plans/2026-04-14-publish-object-catalog-phase1.md
git commit -m "docs(channels): record publish object catalog phase 1 plan"
```
