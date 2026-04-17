# Context Engine Evaluation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#128` by turning the current Context Engine tests and runtime projections into an explicit regression/evaluation baseline that can detect drift in retrieval, profile, promotion/review, connector synthesis, and governance-job observability.

**Architecture:** Keep the current runtime and projection paths intact, but gather the most valuable quality checks into named regression fixtures and a minimal telemetry summary shape. The implementation should stay inside tests and existing runtime/projector surfaces; it must not create a second analytics subsystem or benchmark runner.

**Tech Stack:** TypeScript, Vitest, existing context-engine unit tests, runtime/projector telemetry surfaces

---

### Task 1: Create explicit regression fixture helpers for current engine behavior

**Files:**

- Modify: `tests/unit/context-engine/contextEngineService.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing regression-fixture tests**

Add named fixture-style scenarios such as:

```ts
it('keeps the release-debug retrieval baseline stable', async () => {
  const result = await service.retrieve({
    spaceId: SPACE_ID,
    query: 'debug failing tests',
    budgetTokens: 500,
  });

  expect(result.memories.map((item) => item.memory.id)).toEqual(['memory-1']);
});

it('keeps the release-compaction governance baseline stable', async () => {
  expect(artifact).toEqual(
    expect.objectContaining({
      profileKey: 'session.compaction.thread-1',
      workingSetRelativePath: expect.stringContaining('working-context.md'),
    })
  );
});
```

- [ ] **Step 2: Run the focused tests to verify the new baseline names/fixtures are absent**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: FAIL because the named regression-fixture layer does not yet exist.

- [ ] **Step 3: Implement the baseline fixture layer**

Required changes:

```ts
- reorganize current assertions into named baseline scenarios
- keep behavior assertions grounded in current production semantics
- do not create a separate benchmark harness
```

- [ ] **Step 4: Re-run focused baseline tests**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineService.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  tests/unit/context-engine/contextEngineService.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "test(context): define evaluation baseline fixtures"
```

### Task 2: Expose a minimal evaluation-oriented telemetry summary from current runtime surfaces

**Files:**

- Modify: `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
- Modify: `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `tests/unit/extensionsBridge.test.ts`

- [ ] **Step 1: Write the failing telemetry-summary tests**

Add focused tests such as:

```ts
it('projects enough job telemetry to support regression monitoring', async () => {
  expect(snapshot.systemRuns[0]).toEqual(
    expect.objectContaining({
      latestArtifactSummary: expect.any(String),
      governanceIdentity: expect.any(String),
      maintenanceKind: expect.any(String),
    })
  );
});
```

And one additional evaluation-facing summary assertion:

```ts
expect(snapshot.agents[0]).toEqual(
  expect.objectContaining({
    runType: expect.any(String),
    runtimeStatus: expect.any(String),
  })
);
```

- [ ] **Step 2: Run focused bridge tests to confirm the evaluation summary layer is not explicit enough**

Run:

```bash
bun run test -- tests/unit/extensionsBridge.test.ts
```

Expected: FAIL if the expected telemetry summary shape is still too implicit.

- [ ] **Step 3: Implement the minimum telemetry summary enrichment**

Required changes:

```ts
- keep using current runtime/projector surfaces
- expose only the minimum fields needed for regression tracking
- do not build a second analytics plane
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
  src/process/services/context/events/handlers/ContextJobRunProjector.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  src/common/adapter/ipcBridge.ts \
  tests/unit/extensionsBridge.test.ts
git commit -m "feat(context): expose evaluation baseline telemetry"
```

### Task 3: Full verification, issue closure, and PR packaging

**Files:**

- Modify: `docs/superpowers/plans/2026-04-17-context-eval-baseline.md`
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
- close `#128`
- leave closing comments explaining that the current engine now has a named regression/evaluation baseline and a minimal telemetry summary for future strategy comparisons
```

PR actions:

```md
- summarize regression fixtures plus telemetry baseline
- explicitly state that the current runtime remains the measurement source of truth
- include final verification evidence
```

- [ ] **Step 4: Commit any plan-tracking change if needed**

```bash
git add docs/superpowers/plans/2026-04-17-context-eval-baseline.md
git commit -m "docs(context): complete eval baseline execution"
```
