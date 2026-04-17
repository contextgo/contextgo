# Context Engine Language Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#124` and `#133` by stabilizing the current Context Engine object language in code and by separating `Context Engine core` responsibilities from `Memory Provider` responsibilities without changing the already-merged three-identity, dual-loop governance runtime.

**Architecture:** Keep the current runtime and governance loop behavior intact, but refactor the package/domain/contracts layer so existing objects and services are grouped into a stable vocabulary and enforceable boundaries. Introduce the minimum new compatibility wrapper necessary to separate provider/storage capabilities from semantic engine behavior, then adapt `ContextServiceImpl` and its tests to the clarified boundary without a large migration wave.

**Tech Stack:** TypeScript, Vitest, package-level domain/contracts in `packages/context-engine`, main-process context services

---

### Task 1: Stabilize the package-level object language (`#124`)

**Files:**

- Modify: `packages/context-engine/src/domain.ts`
- Modify: `packages/context-engine/src/index.ts`
- Modify: `packages/context-engine/docs/domain-model.md`
- Test: `tests/unit/context-engine/contextEngineService.test.ts`

- [ ] **Step 1: Write the failing domain-language test**

Add or extend a package-facing test that asserts the stable exported language families are readable and complete:

```ts
it('exports the current core context object families as stable package language', async () => {
  const mod = await import('../../../packages/context-engine/src/index');

  expect(mod.CONTEXT_ENGINE_MODULE.packageName).toBe('@contextgo/context-engine');
  expect(mod).toHaveProperty('ContextEngineService');
  expect(mod).toHaveProperty('CONTEXT_ENTITY_FAMILIES');
  expect(mod.CONTEXT_ENTITY_FAMILIES).toEqual({
    raw: ['SourceRecord', 'DocumentSnapshot'],
    retrieval: ['ChunkRecord'],
    semantic: ['MemoryEntry', 'MemoryCandidateEntry', 'ProfileSegment'],
    assembly: ['ContextPack'],
  });
});
```

- [ ] **Step 2: Run the focused test to verify the language helper is missing**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: FAIL because the grouped language export does not exist yet.

- [ ] **Step 3: Implement the minimal domain-language stabilization**

Required changes:

```ts
// packages/context-engine/src/domain.ts
export const CONTEXT_ENTITY_FAMILIES = {
  raw: ['SourceRecord', 'DocumentSnapshot'],
  retrieval: ['ChunkRecord'],
  semantic: ['MemoryEntry', 'MemoryCandidateEntry', 'ProfileSegment'],
  assembly: ['ContextPack'],
} as const;
```

Also:

```ts
- reorganize comments in domain.ts so the existing records read as a stable language source
- export the helper from index.ts
- update the docs page so it mirrors the same layered vocabulary
```

- [ ] **Step 4: Re-run the focused package-language test**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/domain.ts \
  packages/context-engine/src/index.ts \
  packages/context-engine/docs/domain-model.md \
  tests/unit/context-engine/contextEngineService.test.ts
git commit -m "refactor(context): stabilize package object language"
```

### Task 2: Split engine contracts from provider contracts (`#133`)

**Files:**

- Modify: `packages/context-engine/src/contracts.ts`
- Modify: `packages/context-engine/src/ContextEngineService.ts`
- Modify: `packages/context-engine/src/index.ts`
- Test: `tests/unit/context-engine/contextEngineService.test.ts`
- Test: `tests/unit/context-engine/sqliteContextStores.test.ts`

- [ ] **Step 1: Write the failing boundary tests**

Add or extend tests that assert the package now distinguishes engine-facing and provider-facing contracts:

```ts
it('exports separate provider-facing dependencies from core engine contracts', async () => {
  const mod = await import('../../../packages/context-engine/src/index');

  expect(mod).toHaveProperty('ContextEngineProviderDependencies');
  expect(mod).toHaveProperty('ContextEnginePolicyDependencies');
});

it('keeps sqlite stores usable through the provider-facing dependency contract', async () => {
  const deps = createSqliteContextEngineDependencies();
  expect(deps).toHaveProperty('provider');
  expect(deps).toHaveProperty('policies');
});
```

- [ ] **Step 2: Run tests to verify the new contract split is absent**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/sqliteContextStores.test.ts
```

Expected: FAIL because the contract split does not exist yet.

- [ ] **Step 3: Implement the minimum contract split**

Required changes:

```ts
// packages/context-engine/src/contracts.ts
export type ContextEngineProviderDependencies = {
  sources: ContextSourceStore;
  documents: DocumentSnapshotStore;
  chunks: ChunkStore;
  memories: MemoryStore;
  candidates: MemoryCandidateStore;
  profiles: ProfileStore;
  operations: OperationLogStore;
  vectorIndex?: VectorIndexProvider;
};

export type ContextEnginePolicyDependencies = {
  policies: ContextEnginePolicySet;
};

export type ContextEngineDependencies = ContextEngineProviderDependencies & ContextEnginePolicyDependencies;
```

Also:

```ts
- update ContextEngineService to keep consuming the combined dependency object
- make the split legible in names and comments without changing runtime behavior
- export the new types from index.ts
```

- [ ] **Step 4: Re-run the contract-split tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/sqliteContextStores.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/contracts.ts \
  packages/context-engine/src/ContextEngineService.ts \
  packages/context-engine/src/index.ts \
  tests/unit/context-engine/contextEngineService.test.ts \
  tests/unit/context-engine/sqliteContextStores.test.ts
git commit -m "refactor(context): split engine and provider contracts"
```

### Task 3: Adapt `ContextServiceImpl` to the clarified boundary without changing runtime ownership

**Files:**

- Modify: `src/process/services/context/ContextServiceImpl.ts`
- Modify: `tests/unit/context-engine/contextServicePromotion.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Add assertions that `ContextServiceImpl` can still act as the concrete adapter on top of the clarified package contracts:

```ts
it('constructs ContextServiceImpl from provider-backed dependencies without re-owning runtime governance', async () => {
  const deps = createInMemoryContextEngineDependencies();
  const service = new ContextServiceImpl(deps);

  const retrieval = await service.retrieve({
    spaceId: 'space-1',
    query: 'release',
    budgetTokens: 120,
  });

  expect(retrieval).toEqual(
    expect.objectContaining({
      memories: expect.any(Array),
      profiles: expect.any(Array),
    })
  );
});
```

- [ ] **Step 2: Run focused tests to verify any construction/typing breakage**

Run:

```bash
bun run test -- tests/unit/context-engine/contextServicePromotion.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: either type or behavior failures that reveal where `ContextServiceImpl` still conflates runtime ownership and package/provider wiring.

- [ ] **Step 3: Implement the adapter-side cleanup**

Required changes:

```ts
- keep ContextServiceImpl as the concrete main-process adapter for the package-layer engine
- make its dependency construction and naming reflect the new provider/engine split
- do not move governance runtime logic out of ContextRuntimeService / ContextTriggerRouter / orchestrator files
```

- [ ] **Step 4: Re-run the focused integration tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextServicePromotion.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/context/ContextServiceImpl.ts \
  tests/unit/context-engine/contextServicePromotion.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "refactor(context): adapt context service to boundary split"
```

### Task 4: Close the loop with compatibility verification and tracker updates

**Files:**

- Modify: `docs/superpowers/plans/2026-04-17-context-engine-language-boundary.md`
- Test: `tests/unit/context-engine/contextEngineService.test.ts`
- Test: `tests/unit/context-engine/sqliteContextStores.test.ts`
- Test: `tests/unit/context-engine/contextServicePromotion.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Run the final focused verification**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/sqliteContextStores.test.ts tests/unit/context-engine/contextServicePromotion.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full repository test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 3: Update issue state and PR packaging**

Issue actions:

```md
- close `#124`
- close `#133`
- leave closing comments that the PR stabilizes the current object language and the core/provider boundary without changing runtime governance ownership
```

PR actions:

```md
- describe the four tasks as one boundary-setting PR
- explicitly mention that three-agent and dual-loop governance remain the runtime owner
- include final verification evidence
```

- [ ] **Step 4: Commit any final plan-tracking change if needed**

```bash
git add docs/superpowers/plans/2026-04-17-context-engine-language-boundary.md
git commit -m "docs(context): complete language boundary execution"
```
