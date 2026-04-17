# Context Engine Ingestion And Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#123` and `#126` by making current raw-ingest entry points use one explicit source-aware lifecycle and by making the current `retrieve -> assemble -> ContextPack` path use one explicit assembly contract, without changing the already-merged three-identity, dual-loop governance runtime.

**Architecture:** Keep the existing Context Engine runtime and service graph, but make ingestion and assembly vocabulary explicit at the package/main-process boundary. The implementation should refine current entry points (`ContextRuntimeService`, `ProjectContextMirrorService`, connector-side ingestion) and contract types (`IngestSourceInput`, `AssembleContextPackInput`) rather than inventing a parallel ingestion or assembly subsystem.

**Tech Stack:** TypeScript, Vitest, package-level Context Engine contracts, main-process context services

---

### Task 1: Formalize the source-aware ingestion lifecycle (`#123`)

**Files:**

- Modify: `packages/context-engine/src/contracts.ts`
- Modify: `packages/context-engine/src/ContextEngineService.ts`
- Modify: `src/process/services/context/ContextServiceImpl.ts`
- Modify: `src/process/services/space/ProjectContextMirrorService.ts`
- Modify: `tests/unit/context-engine/contextEngineService.test.ts`
- Modify: `tests/unit/process/services/browserActivityConnectorService.test.ts`

- [ ] **Step 1: Write the failing ingestion-lifecycle tests**

Add focused tests that assert the current system exposes a stable source-aware lifecycle:

```ts
it('returns a source-aware ingestion artifact set for raw input', async () => {
  const deps = createInMemoryContextEngineDependencies();
  const service = new ContextEngineService(deps);

  const result = await service.ingestSource({
    spaceId: 'space-1',
    kind: 'web-clip',
    title: 'RFC Notes',
    rawContentRef: 'file:///tmp/rfc-notes.md',
  });

  expect(result).toEqual(
    expect.objectContaining({
      source: expect.any(Object),
      snapshot: expect.any(Object),
      chunkIds: expect.any(Array),
      lifecycle: expect.objectContaining({
        sourceRegistered: true,
        snapshotPersisted: true,
      }),
    })
  );
});
```

```ts
it('emits stable source identity metadata for browser-activity ingestion', async () => {
  // browserActivityConnectorService test
  expect(contextService.ingestSource).toHaveBeenCalledWith(
    expect.objectContaining({
      canonicalUri: BASE_ENTRY.url,
      sourceId: expect.stringMatching(/^browser-source-/),
      artifactId: expect.stringMatching(/^browser-artifact-/),
    })
  );
});
```

- [ ] **Step 2: Run focused tests to confirm the lifecycle contract is still implicit**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/process/services/browserActivityConnectorService.test.ts
```

Expected: FAIL because the explicit lifecycle artifact/helper fields are not yet present.

- [ ] **Step 3: Implement the minimal explicit ingestion lifecycle**

Required changes:

```ts
// packages/context-engine/src/contracts.ts
export type IngestionLifecycle = {
  sourceRegistered: boolean;
  snapshotPersisted: boolean;
  chunksPrepared: boolean;
  indexReady: boolean;
};

export type IngestSourceResult = {
  source: SourceRecord;
  snapshot?: DocumentSnapshot;
  chunkIds: readonly ChunkId[];
  operations: readonly ContextOperation[];
  lifecycle: IngestionLifecycle;
};
```

And in implementation:

```ts
- populate the lifecycle shape in ContextEngineService.ingestSource()
- keep current source/document/chunk behavior unchanged
- make ProjectContextMirrorService and connector-side tests read as part of the same source-aware story
```

- [ ] **Step 4: Re-run the focused ingestion tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/process/services/browserActivityConnectorService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/contracts.ts \
  packages/context-engine/src/ContextEngineService.ts \
  src/process/services/context/ContextServiceImpl.ts \
  src/process/services/space/ProjectContextMirrorService.ts \
  tests/unit/context-engine/contextEngineService.test.ts \
  tests/unit/process/services/browserActivityConnectorService.test.ts
git commit -m "refactor(context): formalize raw ingestion lifecycle"
```

### Task 2: Make the assembly contract explicit (`#126`)

**Files:**

- Modify: `packages/context-engine/src/contracts.ts`
- Modify: `packages/context-engine/src/ContextEngineService.ts`
- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `src/process/services/space/ProjectContextMirrorService.ts`
- Modify: `tests/unit/context-engine/contextEngineService.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Write the failing assembly-contract tests**

Add tests that assert assembly inputs are explicitly grouped:

```ts
it('assembles a context pack from explicit retrieval and overlay inputs', async () => {
  const deps = createInMemoryContextEngineDependencies();
  const service = new ContextEngineService(deps);
  const retrieval = await service.retrieve({
    spaceId: 'space-1',
    query: 'debug tests',
    budgetTokens: 500,
  });

  const result = await service.assemble({
    spaceId: 'space-1',
    budgetTokens: 200,
    retrieval,
    overlays: {
      mountedSections: [],
      mountedProfiles: [],
      pinnedInstructions: [],
      threadSummary: 'Current task: debug tests.',
    },
  });

  expect(result.pack.sections.some((section) => section.kind === 'thread-state')).toBe(true);
});
```

And runtime-side:

```ts
expect(mockContextService.assemble).toHaveBeenCalledWith(
  expect.objectContaining({
    overlays: expect.objectContaining({
      mountedSections: expect.any(Array),
      mountedProfiles: expect.any(Array),
      pinnedInstructions: expect.any(Array),
    }),
  })
);
```

- [ ] **Step 2: Run focused assembly tests to confirm callers still use implicit fields**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
```

Expected: FAIL because `AssembleContextPackInput` does not yet expose a stable `overlays` group and callers still populate the old top-level fields.

- [ ] **Step 3: Implement the minimum explicit assembly contract**

Required changes:

```ts
// packages/context-engine/src/contracts.ts
export type ContextAssemblyOverlays = {
  threadSummary?: string;
  mountedSections?: ContextPack['sections'];
  mountedProfiles?: readonly ProfileSegment[];
  pinnedInstructions?: readonly string[];
};

export type AssembleContextPackInput = {
  spaceId: SpaceId;
  threadId?: ThreadId;
  retrieval: RetrieveContextResult;
  budgetTokens: number;
  overlays?: ContextAssemblyOverlays;
};
```

And in implementation:

```ts
- keep backward-compatible support in ContextEngineService / ContextRuntimeService while switching current callers to the `overlays` shape
- make ProjectContextMirrorService output clearly feed assembly overlays
```

- [ ] **Step 4: Re-run the focused assembly tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/contracts.ts \
  packages/context-engine/src/ContextEngineService.ts \
  src/process/services/context/ContextRuntimeService.ts \
  src/process/services/space/ProjectContextMirrorService.ts \
  tests/unit/context-engine/contextEngineService.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "refactor(context): make assembly contract explicit"
```

### Task 3: Keep governance runtime ownership stable while adapting current callers

**Files:**

- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `src/process/services/context/ContextServiceImpl.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Write the failing compatibility tests**

Add assertions that:

```ts
- turn preparation still ingests user/assistant sources
- governance runtime still owns steward/curator loops
- ingestion/assembly cleanup does not create a second runtime path
```

- [ ] **Step 2: Run focused compatibility tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
```

Expected: any failures caused by contract adaptation must surface here before broader verification.

- [ ] **Step 3: Implement only compatibility wiring**

Required changes:

```ts
- adapt current callers to the refined ingestion/assembly contracts
- keep governance runtime ownership in ContextRuntimeService / orchestrator / trigger router
- do not pull governance semantics down into the package/provider layer
```

- [ ] **Step 4: Re-run focused compatibility verification**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/context/ContextRuntimeService.ts \
  src/process/services/context/ContextServiceImpl.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "refactor(context): adapt runtime to ingestion assembly contracts"
```

### Task 4: Full verification, issue closure, and PR packaging

**Files:**

- Modify: `docs/superpowers/plans/2026-04-17-context-engine-ingestion-assembly.md`
- Test: `tests/unit/context-engine/contextEngineService.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Test: `tests/unit/process/services/browserActivityConnectorService.test.ts`

- [ ] **Step 1: Run final focused verification**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/process/services/browserActivityConnectorService.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 3: Update issue state and PR packaging**

Issue actions:

```md
- close `#123`
- close `#126`
- leave closing comments explaining that the PR formalizes current ingestion and assembly contracts without changing governance ownership
```

PR actions:

```md
- summarize the raw-ingest lifecycle and assembly-contract cleanup
- explicitly state that the three-identity, dual-loop runtime remains unchanged in ownership
- include final verification evidence
```

- [ ] **Step 4: Commit any plan-tracking change if needed**

```bash
git add docs/superpowers/plans/2026-04-17-context-engine-ingestion-assembly.md
git commit -m "docs(context): complete ingestion assembly execution"
```
