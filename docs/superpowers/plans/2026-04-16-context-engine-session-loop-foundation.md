# Context Engine Session Loop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working Phase 1 session loop that writes split session artifacts into the vault, tags session jobs with `Session Steward` governance identity, and makes runtime injection consume a real session working-context surface instead of a log-style summary.

**Architecture:** Keep the first slice intentionally narrow. Reuse the existing `ContextEventBus`, `ContextTriggerRouter`, `ContextJobRunner`, `ContextRuntimeService`, and `SpaceVaultContextSyncService`, but reshape the session path into three vault-backed artifacts: timeline, working context, and checkpoints. Preserve current compaction and promotion flow where possible, and add governance identity metadata and new session artifact writers instead of introducing new top-level subsystems.

**Tech Stack:** TypeScript, Electron main-process services, Obsidian vault sync, Vitest 4

---

## Scope Decomposition

The accepted specs cover multiple independent subsystems:

- Session loop foundation
- Project curator writeback and proposal flow
- Space curator distillation and connector digestion
- Runtime console

This plan covers **only the first subsystem**:

- `Session Loop + Session Steward foundation`

Follow-up plans should cover:

- `Project Curator` execution and append-first `AGENTS.md` / `skills` proposal flow
- `Space Curator` execution, profile distillation, and connector digestion
- runtime console panels and control surface

## Planned File Structure

### Files To Modify In This Plan

- `src/process/services/context/contextDomain.ts`
  - Add governance identity metadata and session artifact target metadata for session jobs.
- `src/process/services/context/ContextJobOrchestrator.ts`
  - Stamp `session_compaction` jobs as `Session Steward` work and carry explicit session artifact targets.
- `src/process/services/context/events/types.ts`
  - Keep event payloads compatible while allowing session-loop tests to assert governance metadata and richer session artifacts.
- `src/process/services/space/SpaceVaultContextSyncService.ts`
  - Split session context output into timeline, working-context, and checkpoints while preserving backward-compatible wrappers during migration.
- `src/process/services/context/ContextRuntimeService.ts`
  - Append session timeline facts on turn start, turn completion, and manual stop; switch mounted session context reads to the working-context surface.
- `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
  - Rewrite session working context and emit checkpoint documents as `Session Steward` output.

### Test Files To Modify

- `tests/unit/context-engine/contextJobOrchestrator.test.ts`
- `tests/unit/context-engine/contextRuntimeService.test.ts`
- `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

### Explicitly Out Of Scope For This Plan

- `Project Curator` docs / `AGENTS.md` / `skills` proposal execution
- `Space Curator` profile and connector digestion execution
- runtime console UI

---

### Task 1: Stamp session jobs with Session Steward identity and explicit artifact targets

**Files:**

- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/context/ContextJobOrchestrator.ts`
- Test: `tests/unit/context-engine/contextJobOrchestrator.test.ts`

- [ ] **Step 1: Write the failing orchestrator tests for session-governance metadata**

```ts
it('creates session compaction jobs as Session Steward work', () => {
  const orchestrator = new ContextJobOrchestrator();

  const job = orchestrator.createSessionCompactionJob({
    spaceId: 'space-1',
    threadId: 'thread-1',
    snapshot: {
      userTurns: 2,
      assistantReplies: 2,
      interruptions: 0,
      recentSignals: [],
    },
    source: 'hook',
  });

  expect(job).toEqual(
    expect.objectContaining({
      type: 'session_compaction',
      governanceIdentity: 'session_steward',
      payload: expect.objectContaining({
        artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      }),
    })
  );
});
```

- [ ] **Step 2: Run the orchestrator test to verify the current job shape is missing governance metadata**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts`

Expected: FAIL because `ContextJob` does not yet expose `governanceIdentity`, and `createSessionCompactionJob()` does not yet populate `artifactTargets`.

- [ ] **Step 3: Add governance identity and session artifact target metadata to the context job model**

```ts
export type ContextGovernanceIdentity =
  | 'session_steward'
  | 'project_curator'
  | 'space_curator';

export type ContextArtifactTarget =
  | 'session_timeline'
  | 'session_working_context'
  | 'session_checkpoint'
  | 'project_doc'
  | 'project_rules'
  | 'project_skill'
  | 'space_digest'
  | 'profile_memory';

export type ContextJob = {
  id: string;
  type: ContextJobType;
  status: ContextJobStatus;
  priority: ContextJobPriority;
  governanceIdentity: ContextGovernanceIdentity;
  spaceId: string;
  threadId?: string;
  projectSlug?: string;
  source: ContextJobSource;
  trigger?: ContextJobTrigger;
  executionBoundary?: ContextExecutionBoundary;
  reason: string;
  payload: Readonly<Record<string, unknown>>;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};
```

```ts
return this.createTriggeredJob({
  type: 'session_compaction',
  status: 'queued',
  priority: decision.priority,
  governanceIdentity: 'session_steward',
  spaceId: input.spaceId,
  threadId: input.threadId,
  projectSlug: input.projectSlug,
  source: input.source,
  executionBoundary: input.executionBoundary,
  triggerEvent: input.triggerEvent,
  triggerLabel: input.triggerLabel,
  triggeredAt: input.triggeredAt,
  reason: decision.reason,
  payload: {
    snapshot: input.snapshot,
    artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
  },
});
```

- [ ] **Step 4: Re-run the orchestrator test and the event-flow test to verify the richer job shape still works**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: PASS with `session_compaction` jobs tagged as `session_steward` and the event flow still queueing jobs successfully.

- [ ] **Step 5: Commit the protocol-shaping changes**

```bash
git add \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/ContextJobOrchestrator.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts
git commit -m "feat(context): tag session jobs with steward metadata"
```

### Task 2: Split vault-backed session artifacts into timeline, working-context, and checkpoints

**Files:**

- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Test: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

- [ ] **Step 1: Write the failing vault-sync tests for split session artifacts**

```ts
it('appends session timeline events into a dedicated session timeline file', async () => {
  await service.ensureConversationContext({ conversation: conversation as any });

  await service.appendSessionTimelineEvent({
    conversation: conversation as any,
    timestamp: '2026-04-23T13:00:00.000Z',
    title: 'User query',
    body: '用户发起 query: aaaa',
  });

  const timelinePath = path.join(vaultPath, 'Projects', projectDir, '_context', 'sessions', 'conv-1', 'timeline.md');
  const timelineContent = await fs.readFile(timelinePath, 'utf8');
  expect(timelineContent).toContain('[2026-04-23 13:00:00]');
  expect(timelineContent).toContain('用户发起 query: aaaa');
});

it('writes and reads the session working-context file separately from the timeline', async () => {
  await service.ensureConversationContext({ conversation: conversation as any });

  await service.writeSessionWorkingContext({
    conversation: conversation as any,
    timestamp: '2026-04-23T13:10:00.000Z',
    currentTask: '整理发布前的回归检查',
    stableStrategies: ['先缩小改动面，再补验证。'],
    failureModes: ['长对话容易把约束冲掉。'],
    pendingConstraints: ['没有审批前不能扩大发布范围。'],
    signalKinds: ['context_window_prepared'],
    pressure: 42,
    sourceProfileKey: 'session.compaction.conv-1',
  });

  const mounted = await service.readSessionWorkingContextSection({ conversation: conversation as any });
  expect(mounted?.id).toBe('session-working-context:conv-1');
  expect(mounted?.summary).toContain('整理发布前的回归检查');
  expect(mounted?.summary).toContain('先缩小改动面，再补验证。');
});
```

- [ ] **Step 2: Run the vault-sync tests to verify the split session surfaces do not exist yet**

Run: `bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: FAIL because `appendSessionTimelineEvent()`, `writeSessionWorkingContext()`, and `readSessionWorkingContextSection()` do not exist yet, and the service still only writes the older working-set document.

- [ ] **Step 3: Add dedicated timeline, working-context, and checkpoint writers while keeping a compatibility wrapper**

```ts
const SESSION_CONTEXT_ROOT_DIR = path.posix.join(PROJECT_CONTEXT_DIR_NAME, '_context', 'sessions');
const SESSION_TIMELINE_FILE_NAME = 'timeline.md';
const SESSION_WORKING_CONTEXT_FILE_NAME = 'working-context.md';
const SESSION_CHECKPOINTS_DIR_NAME = 'checkpoints';

function getSessionContextRootRelativePath(projectFolderName: string, conversationId: string): string {
  return path.posix.join(SESSION_CONTEXT_ROOT_DIR, sanitizePathSegment(conversationId));
}

function getSessionTimelineRelativePath(projectFolderName: string, conversationId: string): string {
  return path.posix.join(
    getSessionContextRootRelativePath(projectFolderName, conversationId),
    SESSION_TIMELINE_FILE_NAME
  );
}

function getSessionWorkingContextRelativePath(projectFolderName: string, conversationId: string): string {
  return path.posix.join(
    getSessionContextRootRelativePath(projectFolderName, conversationId),
    SESSION_WORKING_CONTEXT_FILE_NAME
  );
}
```

```ts
async appendSessionTimelineEvent(input: SessionTimelineEventInput): Promise<void> {
  const context = await this.ensureConversationProjectContext(input.conversation);
  if (!context) {
    return;
  }

  const relativePath = getSessionTimelineRelativePath(context.project.folderName, input.conversation.id);
  const absolutePath = path.join(context.vaultPath, relativePath);
  const heading = formatTimelineHeading(input.timestamp);
  const nextBlock = `${heading}\n${input.title}: ${input.body}\n\n`;
  await this.appendVaultFile(absolutePath, nextBlock);
}

async writeSessionWorkingContext(input: SessionWorkingSetWriteInput): Promise<MountedContextSection | undefined> {
  return this.writeSessionWorkingSet(input);
}

async readSessionWorkingContextSection(input: SessionContextReadInput): Promise<MountedContextSection | undefined> {
  return this.readSessionWorkingSetSection(input);
}
```

- [ ] **Step 4: Add a dedicated checkpoint writer so later session compaction work can stop overloading generic checkpoint notes**

```ts
async appendSessionCheckpoint(input: SessionCheckpointWriteInput): Promise<SessionCheckpointArtifact | undefined> {
  const context = await this.ensureConversationProjectContext(input.conversation);
  if (!context) {
    return undefined;
  }

  const fileName = `${formatCheckpointTimestamp(input.timestamp)}-${sanitizePathSegment(input.kind)}.md`;
  const relativePath = path.posix.join(
    getSessionContextRootRelativePath(context.project.folderName, input.conversation.id),
    SESSION_CHECKPOINTS_DIR_NAME,
    fileName
  );

  const content = [
    `# ${input.title}`,
    '',
    `- Kind: \`${input.kind}\``,
    `- Timestamp: ${input.timestamp}`,
    '',
    input.summary,
    '',
    input.detail ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  await this.writeVaultFile(path.join(context.vaultPath, relativePath), content);
  return { title: input.title, relativePath, summary: input.summary };
}
```

- [ ] **Step 5: Re-run the vault-sync test suite and commit the split session-surface work**

Run: `bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: PASS with the new split files living under `Projects/<project>/_context/sessions/<conversation>/`.

```bash
git add \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
git commit -m "feat(context): split vault session artifacts"
```

### Task 3: Make ContextRuntimeService append timeline facts and mount the session working-context surface

**Files:**

- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Test: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Write the failing runtime-service tests for session timeline appends and working-context reads**

```ts
it('appends a timeline fact when a user turn is prepared', async () => {
  const service = new ContextRuntimeService(
    mockContextService as any,
    undefined,
    {
      ...mockVaultSyncService,
      appendSessionTimelineEvent: vi.fn(async () => undefined),
      readSessionWorkingContextSection: vi.fn(async () => undefined),
    } as any,
    undefined,
    mockProjectContextMirrorService as any,
    mockSpaceService as any
  );

  await service.prepareOutgoingTurn({
    conversation: makeConversation() as any,
    userInput: 'Ship the release safely.',
    agentInput: '[User Request]\nShip the release safely.',
    agentContent: '[User Request]\nShip the release safely.',
  });

  expect(mockVaultSyncService.appendSessionTimelineEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'User query',
      body: 'Ship the release safely.',
    })
  );
});

it('reads the mounted session working context from the new working-context surface', async () => {
  mockVaultSyncService.readSessionWorkingContextSection.mockResolvedValue({
    id: 'session-working-context:conv-1',
    kind: 'profile',
    summary: '当前任务：先缩小改动面，再补验证。',
    priority: 98,
    tokenCount: 18,
  });

  const service = new ContextRuntimeService(
    mockContextService as any,
    undefined,
    mockVaultSyncService as any,
    undefined,
    mockProjectContextMirrorService as any,
    mockSpaceService as any
  );

  await service.prepareOutgoingTurn({
    conversation: makeConversation() as any,
    userInput: 'Ship the release safely.',
    agentInput: '[User Request]\nShip the release safely.',
    agentContent: '[User Request]\nShip the release safely.',
  });

  expect(mockVaultSyncService.readSessionWorkingContextSection).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the runtime-service tests and verify they fail against the current working-set API**

Run: `bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts`

Expected: FAIL because `ContextRuntimeService` still calls `readSessionWorkingSetSection()` and never appends explicit session timeline events.

- [ ] **Step 3: Wire user-turn, assistant-turn, and stopped-session facts into the timeline writer**

```ts
await this.vaultSyncService.appendSessionTimelineEvent({
  conversation: input.conversation,
  timestamp: new Date(preparedAt).toISOString(),
  title: 'User query',
  body: input.userInput,
});
```

```ts
await this.vaultSyncService.appendSessionTimelineEvent({
  conversation,
  timestamp: new Date(completedAt).toISOString(),
  title: 'Turn reply',
  body: text,
});
```

```ts
await this.vaultSyncService.appendSessionTimelineEvent({
  conversation,
  timestamp: new Date(stoppedAt).toISOString(),
  title: 'User interruption',
  body: reason,
});
```

- [ ] **Step 4: Swap the mounted session read path to the explicit working-context API**

```ts
const sessionWorkingContextSection = await this.vaultSyncService.readSessionWorkingContextSection({
  conversation: input.conversation,
});

const assembled = await this.contextService.assemble({
  spaceId,
  threadId: input.conversation.id,
  retrieval,
  budgetTokens: CONTEXT_BUDGET_TOKENS,
  threadSummary: buildThreadSummary([...recentMessages].toReversed()),
  mountedSections: [
    ...(sessionWorkingContextSection ? [sessionWorkingContextSection] : []),
    ...this.projectContextMirrorService.buildMountedSections(projectSnapshot),
  ],
  mountedProfiles: await this.getSessionCompactionMountedProfiles(spaceId, input.conversation.id),
  pinnedInstructions: ['Prefer space-consistent answers and reuse approved workflows when relevant.'],
});
```

- [ ] **Step 5: Re-run the runtime-service tests and commit the session-fact wiring**

Run: `bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts`

Expected: PASS with timeline facts appended at turn boundaries and the mounted session surface read from `readSessionWorkingContextSection()`.

```bash
git add \
  src/process/services/context/ContextRuntimeService.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "feat(context): append session timeline facts"
```

### Task 4: Turn SessionCompactionJobHandler into the first concrete Session Steward executor

**Files:**

- Modify: `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing event-flow test for Session Steward outputs**

```ts
it('writes session working-context and checkpoint artifacts for session compaction jobs', async () => {
  const vaultSyncService = {
    writeSessionWorkingContext: vi.fn(async () => ({
      id: 'session-working-context:thread-1',
      kind: 'profile',
      summary: 'Current task: Ship the release safely.',
      priority: 98,
      tokenCount: 24,
    })),
    appendSessionCheckpoint: vi.fn(async () => ({
      title: 'Session checkpoint',
      relativePath: 'Projects/workspace/_context/sessions/thread-1/checkpoints/2026-04-08-session-compaction.md',
      summary: 'Current task: Ship the release safely.',
    })),
    appendContextCheckpoint: vi.fn(async () => undefined),
  };

  const handler = new SessionCompactionJobHandler(contextService as any, vaultSyncService as any);
  const artifact = await handler.run(makeJob());

  expect(vaultSyncService.writeSessionWorkingContext).toHaveBeenCalledWith(
    expect.objectContaining({
      currentTask: 'Ship the release safely.',
      stableStrategies: expect.arrayContaining(['Keep the patch minimal.']),
    })
  );
  expect(vaultSyncService.appendSessionCheckpoint).toHaveBeenCalled();
  expect(artifact).toEqual(
    expect.objectContaining({
      threadId: 'thread-1',
      summary: expect.stringContaining('Ship the release safely.'),
      workingSetRelativePath: expect.stringContaining('_context/sessions/thread-1'),
    })
  );
});
```

- [ ] **Step 2: Run the event-flow test to verify the handler still writes only the older working-set artifact**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: FAIL because `SessionCompactionJobHandler` still targets `writeSessionWorkingSet()` and generic context checkpoints instead of the new split session surfaces.

- [ ] **Step 3: Rewrite SessionCompactionJobHandler around working-context and checkpoint artifacts**

```ts
const workingContextArtifact = await this.vaultSyncService.writeSessionWorkingContext({
  conversation: conversation as any,
  timestamp: job.completedAt || new Date().toISOString(),
  currentTask,
  stableStrategies,
  failureModes,
  pendingConstraints,
  signalKinds,
  pressure: decision.pressure,
  sourceProfileKey: profile.key,
});

const checkpointArtifact = await this.vaultSyncService.appendSessionCheckpoint({
  conversation: conversation as any,
  timestamp: job.completedAt || new Date().toISOString(),
  kind: 'session-compaction',
  title: 'Session checkpoint',
  summary: profile.summary,
  detail,
});
```

```ts
return {
  threadId: job.threadId,
  profileId: profile.id,
  profileKey: profile.key,
  summary: profile.summary,
  detail,
  noteTitle: checkpointArtifact?.title,
  relativePath: checkpointArtifact?.relativePath,
  workingSetTitle: 'Session working context',
  workingSetRelativePath: workingContextArtifact?.relativePath,
  currentTask,
  stableStrategies,
  failureModes,
  pendingConstraints,
  signalKinds,
  candidateCount: candidates.length,
  pendingReviewCount: pendingCandidates.length,
  promotedCount: promotedCandidates.length,
  pressure: decision.pressure,
  promotionCandidate,
};
```

- [ ] **Step 4: Re-run the event-flow and vault-sync suites to verify Session Steward writes the new session artifacts cleanly**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: PASS with session compaction producing a rewritten working-context document plus a stable checkpoint artifact.

- [ ] **Step 5: Commit the first concrete Session Steward execution slice**

```bash
git add \
  src/process/services/context/jobs/SessionCompactionJobHandler.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "feat(context): make session compaction write steward artifacts"
```

### Task 5: Run focused verification for the Phase 1 session loop slice

**Files:**

- Modify: `docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md`
- Modify: `docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md`

- [ ] **Step 1: Update the accepted specs with a short implementation-status note for Phase 1**

```md
## Phase 1 status

- Session loop foundation implemented
- Session Steward metadata and split session vault artifacts landed
- Project Curator, Space Curator, and runtime console remain follow-up phases
```

- [ ] **Step 2: Run the full targeted context-engine verification suite**

Run:

```bash
bun run test -- \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: PASS for the focused session-loop foundation scenarios.

- [ ] **Step 3: Run the repository typecheck and context-engine test bundle**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine
```

Expected:

- `bunx tsc --noEmit` exits with code `0`
- context-engine tests pass with the new session artifact surfaces

- [ ] **Step 4: Run formatting and lint autofix before the final commit**

Run:

```bash
bun run lint:fix
bun run format
```

Expected: commands exit successfully without introducing new context-engine test regressions.

- [ ] **Step 5: Commit the finished Phase 1 implementation batch**

```bash
git add \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/ContextJobOrchestrator.ts \
  src/process/services/context/ContextRuntimeService.ts \
  src/process/services/context/jobs/SessionCompactionJobHandler.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts \
  docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md \
  docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md
git commit -m "feat(context): land session loop foundation"
```

## Follow-On Plans

After this plan lands, write separate plans for:

1. `Project Curator` docs / `AGENTS.md` / `skills` append-first evolution
2. `Space Curator` profile distillation, connector digestion, and temporal memory expiration
3. Context Engine runtime console panels and controls
