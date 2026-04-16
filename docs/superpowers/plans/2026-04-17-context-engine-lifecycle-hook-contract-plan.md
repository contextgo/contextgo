# Context Engine Lifecycle Hook Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ContextTriggerRouter` the single governance lifecycle contract owner and add a formal `delegation.completed` event that can feed session governance without introducing a second event-to-job path.

**Architecture:** Keep the existing event bus, trigger router, orchestrator, and runtime service structure, but tighten ownership. Extend the event contract in `events/types.ts` and trigger types, route the new lifecycle event through `ContextTriggerRouter`, make runtime service emit the event, and reduce `ContextJobProjector` so it no longer independently evolves governance routing behavior.

**Tech Stack:** TypeScript, Vitest, main-process services, Context Engine event bus/router/orchestrator

---

### Task 1: Add Failing Contract Tests for the New Lifecycle Event and Router Ownership

**Files:**

- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Write the failing event-flow test**

```ts
it('routes delegation.completed through the lifecycle trigger contract', async () => {
  const bus = new ContextEventBus();
  const emittedJobs: ContextJob[] = [];
  const router = new ContextTriggerRouter(bus, {
    resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
  } as never);

  router.register();
  bus.on('context.job.queued', async (event) => {
    emittedJobs.push(event.payload.job);
  });

  await bus.emit('delegation.completed', {
    spaceId: 'space-1',
    threadId: 'thread-1',
    projectSlug: 'workspace-abcd1234',
    occurredAt: '2026-04-17T01:00:00.000Z',
    sourceSummary: 'Planner delegate completed release validation synthesis.',
    delegationSummary: 'Planner delegate completed release validation synthesis.',
    snapshot: {
      userTurns: 3,
      assistantReplies: 2,
      interruptions: 0,
      recentSignals: [],
    },
  });

  expect(emittedJobs).toHaveLength(1);
  expect(emittedJobs[0]).toEqual(
    expect.objectContaining({
      type: 'session_compaction',
      source: 'lifecycle',
      governanceIdentity: 'session_steward',
    })
  );
});
```

- [ ] **Step 2: Write the failing runtime-service test**

```ts
it('emits delegation.completed with the governance lifecycle envelope', async () => {
  const observedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const bus = {
    emit: vi.fn(async (type: string, payload: Record<string, unknown>) => {
      observedEvents.push({ type, payload });
    }),
  };
  const service = new ContextRuntimeService(
    mockContextService as any,
    bus as any,
    mockVaultSyncService as any,
    undefined,
    mockProjectContextMirrorService as any,
    mockSpaceService as any
  );

  await service.captureDelegationCompletion({
    conversation: makeConversation(),
    delegationSummary: 'Planner delegate completed release validation synthesis.',
    snapshot: {
      userTurns: 3,
      assistantReplies: 2,
      interruptions: 0,
      recentSignals: [],
    },
  });

  expect(observedEvents).toContainEqual(
    expect.objectContaining({
      type: 'delegation.completed',
      payload: expect.objectContaining({
        spaceId: 'space-1',
        threadId: 'conv-1',
        projectSlug: PROJECT_SLUG,
        delegationSummary: 'Planner delegate completed release validation synthesis.',
      }),
    })
  );
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts`
Expected: FAIL because `delegation.completed` is not in the event contract yet and runtime service has no lifecycle-emission helper for it.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "test(context): cover lifecycle hook contract routing"
```

### Task 2: Implement the Formal Lifecycle Contract in Event Types, Triggers, and Router

**Files:**

- Modify: `src/process/services/context/events/types.ts`
- Modify: `src/process/services/context/events/triggers/types.ts`
- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/context/events/triggers/builtinTriggers.ts`
- Modify: `src/process/services/context/events/ContextTriggerRouter.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the minimal event-type additions**

```ts
type GovernanceLifecycleEnvelope = {
  spaceId: string;
  threadId: string;
  projectSlug?: string;
  occurredAt: string;
  sourceSummary?: string;
};

'delegation.completed': GovernanceLifecycleEnvelope & {
  delegationSummary: string;
  snapshot: SessionCompactionSnapshot;
};
```

- [ ] **Step 2: Add the builtin lifecycle trigger**

```ts
{
  id: 'lifecycle.delegation-completed',
  kind: 'lifecycle',
  source: 'lifecycle',
  builder: 'session_compaction',
  jobType: 'session_compaction',
  scopeKind: 'conversation',
  event: 'delegation.completed',
  label: 'Delegation completed',
  defaultPriority: 'medium',
  defaultReason: 'Capture delegated execution evidence before session context drifts.',
}
```

- [ ] **Step 3: Route the new event through `ContextTriggerRouter`**

```ts
this.bus.on('delegation.completed', async (event) => {
  if (!event.payload.spaceId || !event.payload.threadId || !event.payload.snapshot) {
    return;
  }

  await this.dispatchTrigger({
    triggerId: 'lifecycle.delegation-completed',
    spaceId: event.payload.spaceId,
    threadId: event.payload.threadId,
    projectSlug: event.payload.projectSlug,
    snapshot: event.payload.snapshot,
    reason: event.payload.sourceSummary ?? event.payload.delegationSummary,
    firedAt: event.payload.occurredAt,
    triggerEvent: 'delegation.completed',
    triggerLabel: 'Delegation completed',
  });
});
```

- [ ] **Step 4: Run event-flow tests to verify they pass**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`
Expected: PASS with the new lifecycle event routed as a `session_compaction` governance job.

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/events/types.ts src/process/services/context/events/triggers/types.ts src/process/services/context/contextDomain.ts src/process/services/context/events/triggers/builtinTriggers.ts src/process/services/context/events/ContextTriggerRouter.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "feat(context): formalize lifecycle hook contract"
```

### Task 3: Emit the New Lifecycle Event from Runtime Service

**Files:**

- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Add the runtime helper that emits the lifecycle event**

```ts
async captureDelegationCompletion(input: {
  conversation: TChatConversation;
  delegationSummary: string;
  snapshot: SessionCompactionSnapshot;
}): Promise<void> {
  const spaceId = this.getConversationSpaceId(input.conversation);
  if (!spaceId || !this.eventBus) {
    return;
  }

  await this.eventBus.emit('delegation.completed', {
    spaceId,
    threadId: input.conversation.id,
    projectSlug: createWorkspaceProjectSlug(input.conversation.extra?.workspace),
    occurredAt: new Date().toISOString(),
    sourceSummary: input.delegationSummary,
    delegationSummary: input.delegationSummary,
    snapshot: input.snapshot,
  });
}
```

- [ ] **Step 2: Keep existing event emission behavior unchanged**

```ts
await this.eventBus?.emit('context.window.prepared', ...);
await this.eventBus?.emit('session.turn.completed', ...);
await this.eventBus?.emit('session.interrupted', ...);
```

The new helper must be additive, not a rewrite of unrelated runtime hooks.

- [ ] **Step 3: Run runtime-service tests to verify they pass**

Run: `bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts`
Expected: PASS with the new `delegation.completed` envelope assertion and no regressions in existing preparation/turn tests.

- [ ] **Step 4: Commit**

```bash
git add src/process/services/context/ContextRuntimeService.ts tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "feat(context): emit delegation lifecycle events"
```

### Task 4: Remove the Duplicate Governance Projection Path and Verify End-to-End Safety

**Files:**

- Modify: `src/process/services/context/events/handlers/ContextJobProjector.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Reduce `ContextJobProjector` to a compatibility shell**

```ts
export function registerContextJobProjector(
  _bus: ContextEventBus,
  _orchestrator: ContextJobOrchestrator = new ContextJobOrchestrator()
): void {
  // Governance job projection now lives in ContextTriggerRouter.
}
```

If there is still a caller that expects this registration function to exist, preserve the export and signature but stop duplicating event-to-job behavior there.

- [ ] **Step 2: Add a regression test proving router-based projection still covers the flow**

```ts
it('keeps governance routing on the trigger router after projector reduction', async () => {
  const bus = new ContextEventBus();
  const emittedJobs: ContextJob[] = [];
  const router = new ContextTriggerRouter(bus, {
    resolve: vi.fn(async () => ({ kind: 'space-vault-root', spaceId: 'space-1', vaultRoot: '/vault/space-1' })),
  } as never);

  router.register();
  registerContextJobProjector(bus);
  bus.on('context.job.queued', async (event) => emittedJobs.push(event.payload.job));

  await bus.emit('session.interrupted', {
    spaceId: 'space-1',
    threadId: 'thread-1',
    projectSlug: 'workspace-abcd1234',
    interruptedAt: Date.parse('2026-04-08T00:00:00.000Z'),
    snapshot: {
      userTurns: 1,
      assistantReplies: 0,
      interruptions: 1,
      recentSignals: [],
    },
  });

  expect(emittedJobs).toHaveLength(1);
  expect(emittedJobs[0]?.source).toBe('lifecycle');
});
```

- [ ] **Step 3: Run focused verification**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts`
Expected: PASS

Run: `bunx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Run broad verification**

Run: `bun run test -- tests/unit/extensionsBridge.test.ts`
Expected: PASS

Run: `bun run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/events/handlers/ContextJobProjector.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "refactor(context): unify governance event routing"
```
