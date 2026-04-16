# Space Curator Distillation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first working `Space Curator` slice that writes richer space-level distillation artifacts, emits profile-memory outputs, and makes connector digestion produce source-aware digest notes through typed context jobs.

**Architecture:** Build on the accepted dual-loop and governance-runtime specs plus the already-landed `Session Steward` and initial `Project Curator` slices. Keep space-level context in vault-backed system notes and keep profile memory as engine-held projection, but make both outputs observable through `Space Curator` job artifacts. Reuse the existing `space_memory_distillation` and `connector_digest` job types instead of introducing new top-level workflow concepts in this slice.

**Tech Stack:** TypeScript, Electron main-process services, Obsidian vault sync, Vitest 4

---

## Implementation Status

- Task 1 complete
- Task 2 complete
- Task 3 complete
- Task 4 complete

## Scope Decomposition

This plan covers only the first `Space Curator` slice.

It includes:

- explicit artifact targets for space-governance jobs
- vault-backed space digest and profile-memory outputs
- richer connector digest note content
- manual and timer trigger semantics for space-governance work

It excludes:

- runtime console UI
- direct connector ingestion redesign
- full temporal expiration automation
- full cross-project pattern synthesis taxonomy

## Planned File Structure

### Files To Modify In This Plan

- `src/process/services/context/contextDomain.ts`
  - Extend space-governance artifact payloads so a single job can report both digest and profile-memory outputs.
- `src/process/services/context/ContextJobOrchestrator.ts`
  - Add explicit `Space Curator` artifact targets for `space_memory_distillation` and `connector_digest`.
- `src/process/services/context/events/triggers/builtinTriggers.ts`
  - Tighten manual and timer copy for `Space Curator` jobs.
- `src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts`
  - Write both a space digest entry and a profile-memory projection.
- `src/process/services/context/jobs/ConnectorDigestJobHandler.ts`
  - Write richer connector digest content driven by connector payload metadata.
- `src/process/services/space/SpaceVaultContextSyncService.ts`
  - Add `writeProfileMemoryDistillation()` and richer connector digest / space memory builders.

### Test Files To Modify

- `tests/unit/context-engine/contextJobOrchestrator.test.ts`
- `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- `tests/unit/context-engine/contextScheduleService.test.ts`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

### New Files To Create

- `src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts`
  - Focused formatter for profile-memory and connector-digest note bodies.
- `tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts`

---

### Task 1: Stamp space-governance jobs with explicit Space Curator artifact targets

**Files:**

- Modify: `src/process/services/context/ContextJobOrchestrator.ts`
- Test: `tests/unit/context-engine/contextJobOrchestrator.test.ts`

- [ ] **Step 1: Write the failing orchestrator tests for space-governance artifact targets**

```ts
it('creates space memory distillation jobs as Space Curator work with digest and profile targets', () => {
  const job = createPlannedContextJob({
    type: 'space_memory_distillation',
    priority: 'high',
    spaceId: 'space-1',
    source: 'timer',
    triggerEvent: 'timer.space_memory_distillation',
    reason: 'Distill shared space memory from recent project activity.',
    payload: { summary: 'Distill shared space memory from recent project activity.' },
  });

  expect(job).toEqual(
    expect.objectContaining({
      governanceIdentity: 'space_curator',
      payload: expect.objectContaining({
        artifactTargets: ['space_digest', 'profile_memory'],
      }),
    })
  );
});

it('creates connector digest jobs as Space Curator work with digest targets', () => {
  const job = createPlannedContextJob({
    type: 'connector_digest',
    priority: 'medium',
    spaceId: 'space-1',
    source: 'connector',
    triggerEvent: 'connector.source.ingested',
    reason: 'Digest newly ingested connector content into reusable context.',
    payload: { summary: 'Digest newly ingested connector content into reusable context.' },
  });

  expect(job).toEqual(
    expect.objectContaining({
      governanceIdentity: 'space_curator',
      payload: expect.objectContaining({
        artifactTargets: ['space_digest'],
      }),
    })
  );
});
```

- [ ] **Step 2: Run the orchestrator tests to verify space jobs do not yet carry the richer artifact targets**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts`

Expected: FAIL because space jobs currently default to `space_curator` identity but do not expose explicit `artifactTargets`.

- [ ] **Step 3: Add explicit artifact target metadata for space-governance jobs**

```ts
payload: {
  ...input.payload,
  artifactTargets:
    input.type === 'space_memory_distillation'
      ? ['space_digest', 'profile_memory']
      : input.type === 'connector_digest'
        ? ['space_digest']
        : input.type === 'project_capability_curation'
          ? ['project_doc', 'project_rules', 'project_skill']
          : (input.payload as { artifactTargets?: string[] } | undefined)?.artifactTargets,
},
```

- [ ] **Step 4: Re-run the orchestrator tests to verify space jobs now advertise their targets**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts`

Expected: PASS with space-governance jobs carrying `space_digest` and `profile_memory` targets.

- [ ] **Step 5: Commit the space-job metadata changes**

```bash
git add \
  src/process/services/context/ContextJobOrchestrator.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts
git commit -m "feat(context): tag space curator job targets"
```

### Task 2: Add formatters and vault writers for space profile-memory and richer connector digests

**Files:**

- Create: `src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts`
- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Test: `tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts`
- Test: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

- [ ] **Step 1: Write the failing formatter and vault-sync tests for space profile-memory output**

```ts
it('formats profile-memory distillation notes with stable profile bullets', () => {
  const content = formatSpaceCuratorProfileMemory({
    title: 'Profile Memory',
    summary: 'Team prefers minimal diffs and explicit validation.',
    bullets: ['Observed across 3 project summaries.', 'Stable preference for staged verification.'],
    detail: 'Carry this preference into future project contexts.',
  });

  expect(content).toContain('# Profile Memory');
  expect(content).toContain('Observed across 3 project summaries.');
  expect(content).toContain('Carry this preference into future project contexts.');
});

it('writes profile memory distillation into the context-engine system directory', async () => {
  const artifact = await service.writeProfileMemoryDistillation({
    spaceId: 'space-1',
    summary: 'Team prefers minimal diffs and explicit validation.',
    detail: 'Carry this preference into future project contexts.',
    bullets: ['Observed across 3 project summaries.'],
    timestamp: '2026-04-16T09:00:00.000Z',
  });

  expect(artifact).toEqual(
    expect.objectContaining({
      relativePath: expect.stringContaining('System/Context Engine'),
      summary: 'Team prefers minimal diffs and explicit validation.',
      spaceId: 'space-1',
    })
  );
});
```

- [ ] **Step 2: Run the formatter and vault-sync tests to verify the profile-memory surface does not exist yet**

Run: `bun run test -- tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: FAIL because neither `formatSpaceCuratorProfileMemory()` nor `writeProfileMemoryDistillation()` exists.

- [ ] **Step 3: Create focused formatters for profile-memory and connector-digest note bodies**

```ts
export function formatSpaceCuratorProfileMemory(input: {
  title: string;
  summary: string;
  bullets: readonly string[];
  detail?: string;
}): string {
  return [
    '<!-- contextgo-generated -->',
    '',
    `# ${input.title}`,
    '',
    `- Summary: ${input.summary}`,
    '',
    '## Stable Signals',
    '',
    ...(input.bullets.length > 0 ? input.bullets.map((item) => `- ${item}`) : ['- No stable signals yet.']),
    '',
    input.detail ? ['## Detail', '', input.detail, ''].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatConnectorDigestEntry(input: {
  title: string;
  summary: string;
  bullets: readonly string[];
  detail?: string;
}): string {
  return [
    `### ${input.title}`,
    '',
    `- ${input.summary}`,
    ...input.bullets.map((item) => `- ${item}`),
    input.detail ? ['', input.detail] : [],
  ]
    .flat()
    .join('\n');
}
```

- [ ] **Step 4: Add `writeProfileMemoryDistillation()` and use the new formatters in vault sync**

```ts
async writeProfileMemoryDistillation(input: {
  spaceId: string;
  summary: string;
  detail?: string;
  bullets: readonly string[];
  timestamp: string;
}): Promise<{ title: string; relativePath: string; summary: string; spaceId: string } | undefined> {
  const space = await this.spaceService.getSpace(input.spaceId);
  const providerRef = space?.providerRef;
  if (!space || !isSpaceVaultProviderRef(providerRef)) {
    return undefined;
  }

  await this.ensureBaseStructure(providerRef.vaultPath);
  const relativePath = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Profile Memory.md');
  const absolutePath = path.join(providerRef.vaultPath, relativePath);
  const body = formatSpaceCuratorProfileMemory({
    title: 'Profile Memory',
    summary: input.summary,
    bullets: input.bullets,
    detail: input.detail,
  });
  await ensureFile(absolutePath, body);
  return { title: 'Profile Memory', relativePath, summary: input.summary, spaceId: input.spaceId };
}
```

- [ ] **Step 5: Re-run the formatter and vault-sync tests and commit the new space-writer surfaces**

Run: `bun run test -- tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: PASS with profile-memory notes and richer connector-digest formatting available.

```bash
git add \
  src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
git commit -m "feat(context): add space curator distillation artifacts"
```

### Task 3: Make Space Curator jobs write both digest and profile-memory artifacts

**Files:**

- Modify: `src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts`
- Modify: `src/process/services/context/jobs/ConnectorDigestJobHandler.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing event-flow tests for richer Space Curator outputs**

```ts
it('writes both space digest and profile-memory artifacts for space memory distillation jobs', async () => {
  const vaultSyncService = {
    writeSpaceMemoryDistillation: vi.fn(async () => ({
      title: 'Space Memory Distillation',
      relativePath: 'System/Context Engine/Space Memory.md',
      summary: 'Shared release patterns distilled.',
      spaceId: 'space-1',
    })),
    writeProfileMemoryDistillation: vi.fn(async () => ({
      title: 'Profile Memory',
      relativePath: 'System/Context Engine/Profile Memory.md',
      summary: 'Team prefers minimal diffs and explicit validation.',
      spaceId: 'space-1',
    })),
  };
  const handler = new SpaceMemoryDistillationJobHandler(vaultSyncService as never);

  const artifact = await handler.run(
    makeJob({
      type: 'space_memory_distillation',
      governanceIdentity: 'space_curator',
      payload: {
        summary: 'Shared release patterns distilled.',
        profileSummary: 'Team prefers minimal diffs and explicit validation.',
        profileBullets: ['Observed across 3 project summaries.'],
        artifactTargets: ['space_digest', 'profile_memory'],
      },
    })
  );

  expect(vaultSyncService.writeSpaceMemoryDistillation).toHaveBeenCalled();
  expect(vaultSyncService.writeProfileMemoryDistillation).toHaveBeenCalled();
  expect(artifact?.summary).toContain('Shared release patterns distilled.');
  expect(artifact?.summary).toContain('Team prefers minimal diffs and explicit validation.');
});

it('writes richer connector digest bullets from connector payload metadata', async () => {
  const vaultSyncService = {
    writeConnectorDigest: vi.fn(async () => ({
      title: 'Connector Digest',
      relativePath: 'System/Context Engine/Connector Digest.md',
      summary: 'Digest newly ingested connector content into reusable context.',
      spaceId: 'space-1',
    })),
  };
  const handler = new ConnectorDigestJobHandler(vaultSyncService as never);

  await handler.run(
    makeJob({
      type: 'connector_digest',
      governanceIdentity: 'space_curator',
      payload: {
        summary: 'Digest newly ingested connector content into reusable context.',
        connectorId: 'browser-activity',
        title: 'Release checklist page',
        canonicalUri: 'https://example.com/release-checklist',
        sourceKind: 'web-resource',
        artifactTargets: ['space_digest'],
      },
    })
  );

  expect(vaultSyncService.writeConnectorDigest).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: expect.stringContaining('browser-activity'),
    })
  );
});
```

- [ ] **Step 2: Run the event-flow tests to verify space jobs still write only shallow digest notes**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: FAIL because `SpaceMemoryDistillationJobHandler` currently only writes one digest artifact and `ConnectorDigestJobHandler` does not yet build richer detail from payload metadata.

- [ ] **Step 3: Expand the space handlers to produce both digest and profile-memory outputs**

```ts
const digestArtifact = await this.vaultSyncService.writeSpaceMemoryDistillation({
  spaceId: job.spaceId,
  summary,
  detail,
  timestamp,
});

const profileArtifact = await this.vaultSyncService.writeProfileMemoryDistillation({
  spaceId: job.spaceId,
  summary: profileSummary,
  detail: profileDetail,
  bullets: profileBullets,
  timestamp,
});

return {
  title: digestArtifact?.title || 'Space Memory Distillation',
  relativePath: digestArtifact?.relativePath || '',
  summary: [digestArtifact?.summary, profileArtifact?.summary].filter(Boolean).join(' | '),
  spaceId: job.spaceId,
};
```

```ts
const bullets = [
  typeof job.payload.connectorId === 'string' ? `Connector: ${job.payload.connectorId}` : undefined,
  typeof job.payload.sourceKind === 'string' ? `Source kind: ${job.payload.sourceKind}` : undefined,
  typeof job.payload.title === 'string' ? `Title: ${job.payload.title}` : undefined,
  typeof job.payload.canonicalUri === 'string' ? `URI: ${job.payload.canonicalUri}` : undefined,
].filter((value): value is string => Boolean(value));

return this.vaultSyncService.writeConnectorDigest({
  spaceId: job.spaceId,
  summary: job.reason,
  detail: [typeof job.payload.summary === 'string' ? job.payload.summary : undefined, ...bullets].filter(Boolean).join('\n'),
  timestamp: job.completedAt || new Date().toISOString(),
});
```

- [ ] **Step 4: Re-run the event-flow tests to verify Space Curator jobs now emit richer artifacts**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: PASS with `space_memory_distillation` producing both digest and profile-memory output, and `connector_digest` writing source-aware detail.

- [ ] **Step 5: Commit the first Space Curator execution slice**

```bash
git add \
  src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts \
  src/process/services/context/jobs/ConnectorDigestJobHandler.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "feat(context): make space curator write richer artifacts"
```

### Task 4: Tighten trigger semantics and document Space Curator progress

**Files:**

- Modify: `src/process/services/context/events/triggers/builtinTriggers.ts`
- Modify: `docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md`
- Modify: `docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md`
- Test: `tests/unit/context-engine/contextScheduleService.test.ts`

- [ ] **Step 1: Write the failing schedule test for richer Space Curator trigger copy**

```ts
it('keeps the richer space curator trigger copy for timer and manual distillation jobs', () => {
  const timerTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find((trigger) => trigger.id === 'timer.space-memory-distillation');
  const manualTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find(
    (trigger) => trigger.id === 'manual.space-memory-distillation'
  );

  expect(timerTrigger?.defaultReason).toBe(
    'Periodically distill shared space memory and profile signals from recent project activity.'
  );
  expect(manualTrigger?.defaultReason).toBe(
    'Manually distill shared space memory and profile signals from recent project activity.'
  );
});
```

- [ ] **Step 2: Run the schedule tests to verify space-trigger copy is still the older generic text**

Run: `bun run test -- tests/unit/context-engine/contextScheduleService.test.ts`

Expected: FAIL because the current trigger copy still uses the older generic distillation wording.

- [ ] **Step 3: Update the built-in trigger copy and add Phase 3 status notes to both specs**

```ts
defaultReason: 'Manually distill shared space memory and profile signals from recent project activity.'
```

```ts
defaultReason: 'Periodically distill shared space memory and profile signals from recent project activity.'
```

```md
## Phase 3 status

- `Space Curator` digest and profile-memory artifacts landed
- connector digests are now source-aware
- runtime console and temporal expiration automation remain follow-up work
```

- [ ] **Step 4: Re-run the schedule tests and confirm the specs reflect Space Curator progress**

Run: `bun run test -- tests/unit/context-engine/contextScheduleService.test.ts`

Expected: PASS with the richer Space Curator trigger copy.

- [ ] **Step 5: Commit the trigger and spec updates**

```bash
git add \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md \
  docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md
git commit -m "feat(context): advance space curator loop"
```

### Task 5: Verify the full Space Curator slice and keep the branch green

**Files:**

- Modify: `docs/superpowers/plans/2026-04-16-space-curator-distillation-loop.md`

- [ ] **Step 1: Update this plan with a brief implementation status note**

```md
## Implementation status

- Task 1 complete
- Task 2 complete
- Task 3 complete
- Task 4 complete
```

- [ ] **Step 2: Run the focused Space Curator verification set**

Run:

```bash
bun run test -- \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: PASS for the new Space Curator artifact and trigger behavior.

- [ ] **Step 3: Run the context-engine bundle and typecheck**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine
```

Expected:

- `bunx tsc --noEmit` exits `0`
- context-engine unit tests stay green after the Space Curator slice lands

- [ ] **Step 4: Re-run the default test command to confirm the branch remains mergeable**

Run:

```bash
bun run test
```

Expected: full Vitest suite passes on this branch.

- [ ] **Step 5: Commit the finished Space Curator implementation batch**

```bash
git add \
  src/process/services/context/ContextJobOrchestrator.ts \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts \
  src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts \
  src/process/services/context/jobs/ConnectorDigestJobHandler.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts \
  docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md \
  docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md \
  docs/superpowers/plans/2026-04-16-space-curator-distillation-loop.md
git commit -m "feat(context): land space curator distillation loop"
```

## Follow-On Plans

After this plan lands, the remaining large subsystems are:

1. runtime console panels and governance observability
2. direct low-risk source-file mutation strategy for project truth files
3. temporal expiration and cross-project synthesis beyond the first Space Curator slice
