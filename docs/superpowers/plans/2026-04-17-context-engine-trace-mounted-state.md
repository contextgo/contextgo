# Context Engine Trace And Mounted State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#130`, `#131`, and `#136` by making the current retrieval path structurally traceable, the current assembly path structurally traceable, and mounted context explicitly frozen per turn, all without changing the already-merged three-identity, dual-loop governance runtime.

**Architecture:** Keep the existing `retrieve -> assemble -> ContextPack` flow and the current runtime orchestration, but extend them with three new explicit concepts: a retrieval plan/trace, an assembly trace, and mounted-state metadata that distinguishes live state from frozen turn snapshots. The main-process runtime remains the owner of governance behavior; package-layer changes only make the path explainable and safer.

**Tech Stack:** TypeScript, Vitest, package-level Context Engine contracts, main-process context services, bridge/activity snapshot projection

---

### Task 1: Make retrieval structurally explainable (`#130`)

**Files:**

- Modify: `packages/context-engine/src/contracts.ts`
- Modify: `packages/context-engine/src/ContextEngineService.ts`
- Modify: `tests/unit/context-engine/contextEngineService.test.ts`

- [ ] **Step 1: Write the failing retrieval-plan tests**

Add focused tests that assert `retrieve()` returns a structured plan/trace:

```ts
it('returns a retrieval plan that records scope, collection ranking, and kept evidence', async () => {
  const dependencies = createInMemoryContextEngineDependencies({
    sources: [makeSource('source-1', 'Debug notes')],
    memories: [makeMemory({ id: 'memory-1', summary: 'Use a narrow failing test first.' })],
  });
  const service = new ContextEngineService(dependencies);

  const result = await service.retrieve({
    spaceId: SPACE_ID,
    query: 'debug failing test',
    budgetTokens: 300,
  });

  expect(result.trace).toEqual(
    expect.objectContaining({
      scope: expect.objectContaining({ spaceId: SPACE_ID }),
      selectedCollections: expect.any(Array),
      keptEvidenceIds: expect.any(Array),
    })
  );
});
```

- [ ] **Step 2: Run the focused test to verify retrieval trace is missing**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: FAIL because `RetrieveContextResult` does not yet expose a trace object.

- [ ] **Step 3: Implement the minimal retrieval plan/trace**

Required changes:

```ts
// contracts.ts
export type RetrievalPlan = {
  scope: {
    spaceId: string;
    threadId?: string;
    projectSlug?: string;
  };
  selectedCollections: readonly string[];
  keptEvidenceIds: readonly string[];
  droppedEvidenceIds: readonly string[];
};
```

And in implementation:

```ts
- extend RetrieveContextResult with `trace`
- compute the minimal selected/dropped evidence lists from the existing retrieval logic
- do not redesign retrieval ranking itself
```

- [ ] **Step 4: Re-run the focused retrieval-plan test**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/contracts.ts \
  packages/context-engine/src/ContextEngineService.ts \
  tests/unit/context-engine/contextEngineService.test.ts
git commit -m "feat(context): add retrieval plan trace"
```

### Task 2: Make assembly overlays and budget decisions traceable (`#131`)

**Files:**

- Modify: `packages/context-engine/src/contracts.ts`
- Modify: `packages/context-engine/src/ContextEngineService.ts`
- Modify: `tests/unit/context-engine/contextEngineService.test.ts`

- [ ] **Step 1: Write the failing assembly-trace tests**

Add focused tests that assert `assemble()` returns an assembly trace:

```ts
it('returns an assembly trace that records mounted overlays, instructions, and dropped sections', async () => {
  const dependencies = createInMemoryContextEngineDependencies();
  const service = new ContextEngineService(dependencies);

  const result = await service.assemble({
    spaceId: SPACE_ID,
    threadId: 'thread-1',
    retrieval: {
      memories: [],
      chunks: [],
      profiles: [],
      sources: [],
      totalEstimatedTokens: 0,
      trace: {
        scope: { spaceId: SPACE_ID, threadId: 'thread-1' },
        selectedCollections: [],
        keptEvidenceIds: [],
        droppedEvidenceIds: [],
      },
    },
    budgetTokens: 40,
    overlays: {
      threadSummary: 'Current task: debug tests.',
      mountedSections: [
        {
          kind: 'profile',
          id: 'mounted-project',
          summary: 'Project wiki says to keep diffs minimal.',
          tokenCount: 12,
          priority: 94,
        },
      ],
      pinnedInstructions: ['Prefer surgical changes.'],
    },
  });

  expect(result.trace).toEqual(
    expect.objectContaining({
      mountedSectionIds: ['mounted-project'],
      pinnedInstructionIds: ['instruction-0'],
      droppedSectionIds: expect.any(Array),
    })
  );
});
```

- [ ] **Step 2: Run the focused assembly test to verify trace is missing**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: FAIL because `AssembleContextPackResult` does not yet expose assembly trace.

- [ ] **Step 3: Implement the minimal assembly trace**

Required changes:

```ts
// contracts.ts
export type AssemblyTrace = {
  mountedSectionIds: readonly string[];
  mountedProfileIds: readonly string[];
  pinnedInstructionIds: readonly string[];
  keptSectionIds: readonly string[];
  droppedSectionIds: readonly string[];
  budgetTokens: number;
};
```

And in implementation:

```ts
- extend AssembleContextPackResult with `trace`
- record mounted overlay ids, instruction ids, kept section ids, dropped section ids
- reuse the existing budget pruning loop rather than replacing it
```

- [ ] **Step 4: Re-run the focused assembly tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/context-engine/src/contracts.ts \
  packages/context-engine/src/ContextEngineService.ts \
  tests/unit/context-engine/contextEngineService.test.ts
git commit -m "feat(context): add assembly trace"
```

### Task 3: Introduce frozen mounted-state semantics in runtime preparation (`#136`)

**Files:**

- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `src/process/services/context/ContextServiceImpl.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing mounted-state tests**

Add tests that assert runtime preparation records a frozen mounted snapshot boundary:

```ts
it('marks mounted overlays as frozen for the current turn', async () => {
  const service = new ContextRuntimeService(
    mockContextService as any,
    undefined,
    mockVaultSyncService as any,
    undefined,
    mockProjectContextMirrorService as any,
    mockSpaceService as any
  );

  await service.prepareOutgoingTurn({
    conversation: makeConversation(),
    userInput: 'Use the latest release context.',
    agentInput: 'Use the latest release context.',
    agentContent: '[User Request]\\nUse the latest release context.',
    msgId: 'msg-frozen',
  });

  expect(mockContextService.assemble).toHaveBeenCalledWith(
    expect.objectContaining({
      overlays: expect.objectContaining({
        mountedState: expect.objectContaining({
          mode: 'frozen-snapshot',
        }),
      }),
    })
  );
});
```

- [ ] **Step 2: Run the focused runtime tests to verify frozen-state metadata is missing**

Run:

```bash
bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: FAIL because the current runtime preparation does not yet mark mounted-state semantics explicitly.

- [ ] **Step 3: Implement minimal frozen mounted-state metadata**

Required changes:

```ts
- extend assembly overlay input with `mountedState`
- use `mode: 'frozen-snapshot'` for the current turn assembly
- keep the runtime orchestration and stewardship ownership unchanged
- do not invent a new storage engine or separate prompt manager
```

- [ ] **Step 4: Re-run the focused runtime tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/context/ContextRuntimeService.ts \
  src/process/services/context/ContextServiceImpl.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "feat(context): add frozen mounted state boundary"
```

### Task 4: Project trace information through the current observability surface

**Files:**

- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- Modify: `tests/unit/extensionsBridge.test.ts`

- [ ] **Step 1: Write the failing projection tests**

Add assertions that current snapshot/projection surfaces expose retrieval/assembly trace metadata:

```ts
it('projects retrieval and assembly trace metadata into the activity snapshot', async () => {
  // extensionsBridge / ActivitySnapshotBuilder coverage
  expect(snapshot.systemRuns[0]).toEqual(
    expect.objectContaining({
      retrievalTraceId: expect.any(String),
      assemblyTraceId: expect.any(String),
    })
  );
});
```

- [ ] **Step 2: Run focused bridge tests to verify trace projection is missing**

Run:

```bash
bun run test -- tests/unit/extensionsBridge.test.ts
```

Expected: FAIL because trace identifiers/metadata are not yet projected.

- [ ] **Step 3: Implement additive trace projection**

Required changes:

```ts
- keep the current activity snapshot surface
- add only the minimum trace metadata needed to make the new path observable
- avoid creating a second product-level trace UI in this PR
```

- [ ] **Step 4: Re-run focused bridge tests**

Run:

```bash
bun run test -- tests/unit/extensionsBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  tests/unit/extensionsBridge.test.ts
git commit -m "feat(context): expose retrieval and assembly trace metadata"
```

### Task 5: Full verification, issue closure, and PR packaging

**Files:**

- Modify: `docs/superpowers/plans/2026-04-17-context-engine-trace-mounted-state.md`
- Test: `tests/unit/context-engine/contextEngineService.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Test: `tests/unit/extensionsBridge.test.ts`

- [ ] **Step 1: Run final focused verification**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/extensionsBridge.test.ts
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
- close `#130`
- close `#131`
- close `#136`
- leave closing comments explaining that the PR formalizes retrieval structure, assembly traceability, and frozen mounted-state semantics without changing governance ownership
```

PR actions:

```md
- summarize retrieval plan, assembly trace, and frozen mounted-state work
- explicitly state that the three-identity, dual-loop runtime remains unchanged in ownership
- include final verification evidence
```

- [ ] **Step 4: Commit any plan-tracking change if needed**

```bash
git add docs/superpowers/plans/2026-04-17-context-engine-trace-mounted-state.md
git commit -m "docs(context): complete trace and mounted state execution"
```
