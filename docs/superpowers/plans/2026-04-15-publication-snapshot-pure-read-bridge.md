# Publication Snapshot Pure-Read Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `getBindingCatalog` and `getActiveSessionCatalog` pure-read bridge endpoints while keeping `refreshPublicationSnapshot` as the only bridge path that performs publish-object refresh work.

**Architecture:** Keep `readPublicationSnapshot()` as the single snapshot assembler in `channelBridge.ts`, but drive it with explicit refresh intent. The legacy read endpoints will read persisted catalog state with `refreshPublishObjects: false`, while the explicit refresh endpoint will continue to call `resolvePublishObjectCatalog()` and re-read the refreshed workspace catalog.

**Tech Stack:** TypeScript, Electron IPC bridge, Vitest 4, Bun, existing channel publication services.

---

### Task 1: Lock Pure-Read Semantics in Bridge Tests

**Files:**

- Modify: `tests/unit/channelBridge.test.ts`
- Test: `tests/unit/channelBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('reads persisted publish objects for getBindingCatalog without triggering refresh', async () => {
  resolvedPublishObjects = [
    {
      id: 'connector-lark-read::group::oc_group_read_1',
      channelAccountId: 'connector-lark-read',
      nativeObjectType: 'group',
      nativeObjectId: 'oc_group_read_1',
      displayProfile: {
        title: 'Persisted Read Group',
        source: 'official-pull',
        quality: 'resolved',
        resolvedAt: 2000,
      },
      createdAt: 1000,
      updatedAt: 2000,
    },
  ];

  const result = await handlers['getBindingCatalog']();

  expect(result.success).toBe(true);
  expect(result.data?.publishObjects).toEqual(
    expect.arrayContaining([expect.objectContaining({ nativeObjectId: 'oc_group_read_1' })])
  );
  expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
});

it('reads persisted publish objects for getActiveSessionCatalog without triggering refresh', async () => {
  resolvedPublishObjects = [
    {
      id: 'connector-lark-read::group::oc_group_read_1',
      channelAccountId: 'connector-lark-read',
      nativeObjectType: 'group',
      nativeObjectId: 'oc_group_read_1',
      displayProfile: {
        title: 'Persisted Session Group',
        source: 'official-pull',
        quality: 'resolved',
        resolvedAt: 2000,
      },
      createdAt: 1000,
      updatedAt: 2000,
    },
  ];

  const result = await handlers['getActiveSessionCatalog']();

  expect(result.success).toBe(true);
  expect(result.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ objectTitle: 'Persisted Session Group' })])
  );
  expect(publicationServiceMocks.resolvePublishObjectCatalog).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/channelBridge.test.ts`
Expected: FAIL because both legacy handlers still call `readPublicationSnapshot({ refreshPublishObjects: true })`.

- [ ] **Step 3: Keep explicit refresh covered**

```ts
it('refreshPublicationSnapshot still triggers publish object refresh', async () => {
  const result = await handlers['refreshPublicationSnapshot']();

  expect(result.success).toBe(true);
  expect(publicationServiceMocks.resolvePublishObjectCatalog).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run targeted bridge tests again**

Run: `bun run test -- tests/unit/channelBridge.test.ts`
Expected: still FAIL only on the new pure-read assertions.

- [ ] **Step 5: Commit checkpoint**

```bash
git add tests/unit/channelBridge.test.ts
git commit -m "test(channel): lock pure-read publication catalog semantics"
```

### Task 2: Switch Legacy Bridge Endpoints to Pure Reads

**Files:**

- Modify: `src/process/bridge/channelBridge.ts`
- Test: `tests/unit/channelBridge.test.ts`

- [ ] **Step 1: Write the minimal implementation**

```ts
channel.getActiveSessionCatalog.provider(async () => {
  try {
    const snapshot = await readPublicationSnapshot({ refreshPublishObjects: false });
    return {
      success: true,
      data: snapshot.activeSessions,
    };
  } catch (error) {
    console.error('[ChannelBridge] getActiveSessionCatalog error:', error);
    return { success: false, msg: getErrorMessage(error) };
  }
});

channel.getBindingCatalog.provider(async (params?: { channelAccountId?: string; connectorId?: string }) => {
  try {
    const channelAccountId = params?.channelAccountId ?? params?.connectorId;
    const snapshot = await readPublicationSnapshot({
      channelAccountId,
      refreshPublishObjects: false,
    });
    return {
      success: true,
      data: snapshot.catalog,
    };
  } catch (error) {
    console.error('[ChannelBridge] getBindingCatalog error:', error);
    return { success: false, msg: getErrorMessage(error) };
  }
});
```

- [ ] **Step 2: Run bridge tests to verify they pass**

Run: `bun run test -- tests/unit/channelBridge.test.ts`
Expected: PASS, including the new pure-read assertions and the existing explicit refresh assertion.

- [ ] **Step 3: Run renderer regressions that depend on explicit refresh**

Run: `bun run test -- tests/unit/renderer/settings/PublicationBindingPanel.dom.test.tsx tests/unit/renderer/settings/SessionContinuationPanel.dom.test.tsx`
Expected: PASS, proving the renderer is still using `refreshPublicationSnapshot`.

- [ ] **Step 4: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS with exit code `0`.

- [ ] **Step 5: Run full-suite sanity check**

Run: `bun run test`
Expected: no new failures from this work; only the pre-existing baseline failures in `tests/unit/renderer/chat/ChatConversation.dom.test.tsx` and `tests/unit/release/publicContentBuilder.test.ts`.

- [ ] **Step 6: Commit checkpoint**

```bash
git add src/process/bridge/channelBridge.ts tests/unit/channelBridge.test.ts
git commit -m "refactor(channel): keep legacy publication reads pure"
```
