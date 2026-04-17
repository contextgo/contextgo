# Project Curator Evolution Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first working `Project Curator` slice that automatically curates project docs, produces append-first `AGENTS.md` proposal notes, and emits skill evolution proposal notes from project capability evidence.

**Architecture:** Build this phase on top of the accepted dual-loop and governance-runtime specs plus the already-landed `Session Steward` foundation. Keep project-local files as the execution truth, but let `Project Curator` generate and update vault-backed project curation surfaces through typed context jobs. The first slice writes project docs directly and writes `AGENTS.md` / skill changes as proposal artifacts rather than mutating the source files.

**Tech Stack:** TypeScript, Electron main-process services, Obsidian vault sync, Vitest 4

---

## Scope Decomposition

This plan covers only the `Project Curator` phase.

It includes:

- project-governance job metadata
- project doc curation artifacts
- append-first `AGENTS.md` proposal artifacts
- skill evolution proposal artifacts
- manual and timer trigger routing for project-governance jobs

It excludes:

- direct source-file mutation of `AGENTS.md` or `skills/`
- `Space Curator`
- runtime console UI
- connector digestion

## Planned File Structure

### Files To Modify In This Plan

- `src/process/services/context/contextDomain.ts`
  - Extend project-governance artifacts and payload metadata for docs / rules / skill proposals.
- `src/process/services/context/ContextJobOrchestrator.ts`
  - Add explicit `Project Curator` artifact targets for project jobs.
- `src/process/services/context/events/types.ts`
  - Preserve typed event contracts while allowing richer project-governance artifacts.
- `src/process/services/context/events/triggers/builtinTriggers.ts`
  - Add or refine timer/manual project-curation triggers.
- `src/process/services/context/jobs/ProjectPromotionJobHandler.ts`
  - Promote stable session takeaways into project docs with explicit `Project Curator` semantics.
- `src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts`
  - Emit project capability review, `AGENTS.md` proposal, and skill proposal artifacts.
- `src/process/services/space/SpaceVaultContextSyncService.ts`
  - Write project doc curation artifacts and append-first proposal notes into project `_context`.

### Test Files To Modify

- `tests/unit/context-engine/contextJobOrchestrator.test.ts`
- `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- `tests/unit/context-engine/contextScheduleService.test.ts`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

### New Files To Create

- `src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts`
  - Small focused formatter for append-first `AGENTS.md` and skill proposal note bodies.
- `tests/unit/context-engine/projectCuratorProposalFormatter.test.ts`

---

### Task 1: Stamp project jobs with Project Curator artifact targets

**Files:**

- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/context/ContextJobOrchestrator.ts`
- Test: `tests/unit/context-engine/contextJobOrchestrator.test.ts`

- [ ] **Step 1: Write the failing orchestrator tests for Project Curator metadata**

```ts
it('creates project promotion jobs as Project Curator work with project-doc targets', () => {
  const orchestrator = new ContextJobOrchestrator();

  const job = orchestrator.createProjectPromotionJob({
    spaceId: 'space-1',
    threadId: 'thread-1',
    source: 'derived',
    candidate: {
      projectSlug: 'workspace-1',
      summary: 'Prefer minimal diffs and explicit validation steps.',
      sourceThreadIds: ['thread-1'],
      confidence: 0.9,
    },
  });

  expect(job).toEqual(
    expect.objectContaining({
      governanceIdentity: 'project_curator',
      payload: expect.objectContaining({
        artifactTargets: ['project_doc'],
      }),
    })
  );
});

it('creates capability curation jobs as Project Curator work with rules and skill proposal targets', () => {
  const job = createPlannedContextJob({
    type: 'project_capability_curation',
    priority: 'medium',
    spaceId: 'space-1',
    projectSlug: 'workspace-1',
    source: 'timer',
    triggerEvent: 'timer.project_capability_curation',
    reason: 'Refresh project capability mirror.',
    payload: { summary: 'Refresh project capability mirror.' },
  });

  expect(job).toEqual(
    expect.objectContaining({
      governanceIdentity: 'project_curator',
      payload: expect.objectContaining({
        artifactTargets: ['project_doc', 'project_rules', 'project_skill'],
      }),
    })
  );
});
```

- [ ] **Step 2: Run the orchestrator tests to verify project jobs do not yet carry explicit curator targets**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts`

Expected: FAIL because project jobs currently lack explicit `artifactTargets` metadata.

- [ ] **Step 3: Extend project jobs with explicit curator artifact target metadata**

```ts
return this.createTriggeredJob({
  type: 'project_promotion',
  status: 'queued',
  priority: input.candidate.confidence >= 0.86 ? 'high' : 'medium',
  governanceIdentity: 'project_curator',
  spaceId: input.spaceId,
  threadId: input.threadId,
  projectSlug: input.candidate.projectSlug,
  source: input.source,
  executionBoundary: input.executionBoundary,
  triggerEvent: input.triggerEvent,
  triggerLabel: input.triggerLabel,
  triggeredAt: input.triggeredAt,
  reason: `Promotion candidate is stable enough for project wiki (confidence=${input.candidate.confidence.toFixed(2)}).`,
  payload: {
    candidate: input.candidate,
    artifactTargets: ['project_doc'],
  },
});
```

```ts
return new ContextJobOrchestrator().createTriggeredJob({
  type: input.type,
  status: 'queued',
  priority: input.priority,
  governanceIdentity: input.type === 'project_capability_curation' ? 'project_curator' : /* existing mapping */,
  spaceId: input.spaceId,
  threadId: input.threadId,
  projectSlug: input.projectSlug,
  source: input.source,
  executionBoundary: input.executionBoundary,
  triggerEvent: input.triggerEvent,
  triggerLabel: input.triggerLabel,
  triggeredAt: input.triggeredAt,
  reason: input.reason,
  payload: {
    ...(input.payload ?? {}),
    artifactTargets:
      input.type === 'project_capability_curation'
        ? ['project_doc', 'project_rules', 'project_skill']
        : (input.payload as { artifactTargets?: string[] } | undefined)?.artifactTargets,
  },
});
```

- [ ] **Step 4: Re-run the orchestrator tests and confirm the richer metadata stays compatible**

Run: `bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts`

Expected: PASS with project jobs tagged as `project_curator` work and explicit project artifact targets.

- [ ] **Step 5: Commit the project-job metadata changes**

```bash
git add \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/ContextJobOrchestrator.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts
git commit -m "feat(context): tag project curator job targets"
```

### Task 2: Add vault-backed project curation and proposal artifact writers

**Files:**

- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Create: `src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts`
- Test: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- Test: `tests/unit/context-engine/projectCuratorProposalFormatter.test.ts`

- [ ] **Step 1: Write the failing formatter and vault-sync tests for project proposal notes**

```ts
it('formats append-first AGENTS proposal notes with evidence and patch bullets', () => {
  const content = formatProjectCuratorProposal({
    title: 'AGENTS append proposal',
    targetPath: 'AGENTS.md',
    summary: 'Add a stable release-validation rule.',
    evidence: ['Observed in 3 session checkpoints.', 'Skill usage repeatedly referenced staged validation.'],
    additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
  });

  expect(content).toContain('# AGENTS append proposal');
  expect(content).toContain('Observed in 3 session checkpoints.');
  expect(content).toContain('Add a short rule telling agents to keep release diffs minimal');
});

it('writes AGENTS and skill proposal notes under the project context directory', async () => {
  const artifact = await service.writeProjectCuratorProposal({
    spaceId: 'space-1',
    projectSlug: 'workspace-b9e43543',
    title: 'AGENTS append proposal',
    proposalKind: 'project_rules',
    summary: 'Add a stable release-validation rule.',
    targetPath: 'AGENTS.md',
    additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
    evidence: ['Observed in 3 session checkpoints.'],
    timestamp: '2026-04-16T08:00:00.000Z',
  });

  expect(artifact).toEqual(
    expect.objectContaining({
      relativePath: expect.stringContaining('_context/proposals'),
      summary: 'Add a stable release-validation rule.',
    })
  );
});
```

- [ ] **Step 2: Run the formatter and vault-sync tests to verify the project proposal surfaces do not exist yet**

Run: `bun run test -- tests/unit/context-engine/projectCuratorProposalFormatter.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: FAIL because neither `formatProjectCuratorProposal()` nor `writeProjectCuratorProposal()` exists.

- [ ] **Step 3: Create a focused formatter for append-first project proposals**

```ts
export function formatProjectCuratorProposal(input: {
  title: string;
  targetPath: string;
  summary: string;
  evidence: readonly string[];
  additions: readonly string[];
}): string {
  return [
    '<!-- contextgo-generated -->',
    '',
    `# ${input.title}`,
    '',
    `- Target: \`${input.targetPath}\``,
    `- Summary: ${input.summary}`,
    '',
    '## Evidence',
    '',
    ...(input.evidence.length > 0 ? input.evidence.map((item) => `- ${item}`) : ['- No evidence captured.']),
    '',
    '## Proposed Additions',
    '',
    ...(input.additions.length > 0 ? input.additions.map((item) => `- ${item}`) : ['- No additions proposed.']),
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Add project proposal artifact writers under vault `_context/proposals/`**

```ts
async writeProjectCuratorProposal(input: {
  spaceId: string;
  projectSlug: string;
  title: string;
  proposalKind: 'project_rules' | 'project_skill';
  summary: string;
  targetPath: string;
  additions: readonly string[];
  evidence: readonly string[];
  timestamp: string;
}): Promise<{ title: string; relativePath: string; summary: string } | undefined> {
  const space = await this.spaceService.getSpace(input.spaceId);
  const providerRef = space?.providerRef;
  if (!space || !isSpaceVaultProviderRef(providerRef)) {
    return undefined;
  }

  const project = await this.findProjectBindingBySlug(providerRef.vaultPath, input.projectSlug);
  if (!project) {
    return undefined;
  }

  const fileName = `${sanitizeVaultPathSegment(input.title)}.md`;
  const relativePath = path.posix.join(PROJECTS_DIR, project.folderName, PROJECT_CONTEXT_DIR, 'proposals', fileName);
  const body = formatProjectCuratorProposal({
    title: input.title,
    targetPath: input.targetPath,
    summary: input.summary,
    evidence: input.evidence,
    additions: input.additions,
  });
  await ensureFile(path.join(providerRef.vaultPath, relativePath), body);
  return { title: input.title, relativePath, summary: input.summary };
}
```

- [ ] **Step 5: Re-run the new tests and commit the project proposal surface**

Run: `bun run test -- tests/unit/context-engine/projectCuratorProposalFormatter.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts`

Expected: PASS with append-first proposal notes written into project `_context/proposals/`.

```bash
git add \
  src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/context-engine/projectCuratorProposalFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
git commit -m "feat(context): add project curator proposal artifacts"
```

### Task 3: Make project jobs write curated docs and append-first proposals

**Files:**

- Modify: `src/process/services/context/jobs/ProjectPromotionJobHandler.ts`
- Modify: `src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts`
- Test: `tests/unit/context-engine/contextEngineEventFlow.test.ts`

- [ ] **Step 1: Write the failing event-flow tests for Project Curator outputs**

```ts
it('writes a curated project insights entry for project promotion jobs', async () => {
  const vaultSyncService = {
    writeProjectPromotion: vi.fn(async () => ({
      projectSlug: 'workspace-b9e43543',
      noteTitle: 'workspace Insights',
      relativePath: 'Projects/workspace/Project Insights.md',
      summary: 'Prefer minimal diffs and explicit validation steps.',
      sourceThreadIds: ['thread-1'],
    })),
  };
  const handler = new ProjectPromotionJobHandler(vaultSyncService as never);

  const artifact = await handler.run({
    ...makeJob({ type: 'project_promotion', governanceIdentity: 'project_curator' }),
    payload: {
      candidate: {
        projectSlug: 'workspace-b9e43543',
        summary: 'Prefer minimal diffs and explicit validation steps.',
        sourceThreadIds: ['thread-1'],
        confidence: 0.88,
      },
      artifactTargets: ['project_doc'],
    },
  });

  expect(vaultSyncService.writeProjectPromotion).toHaveBeenCalled();
  expect(artifact?.summary).toBe('Prefer minimal diffs and explicit validation steps.');
});

it('writes AGENTS and skill proposals for capability curation jobs', async () => {
  const vaultSyncService = {
    curateProjectCapabilities: vi.fn(async () => ({
      projectSlug: 'workspace-b9e43543',
      noteTitle: 'workspace Capabilities',
      relativePath: 'Projects/workspace/_context/Capabilities.md',
      summary: 'Refreshed project capability mirror.',
    })),
    writeProjectCuratorProposal: vi
      .fn()
      .mockResolvedValueOnce({
        title: 'AGENTS append proposal',
        relativePath: 'Projects/workspace/_context/proposals/agents-append-proposal.md',
        summary: 'Add a stable release-validation rule.',
      })
      .mockResolvedValueOnce({
        title: 'Skill append proposal',
        relativePath: 'Projects/workspace/_context/proposals/skill-append-proposal.md',
        summary: 'Update release-validation skill guidance.',
      }),
  };

  const handler = new ProjectCapabilityCurationJobHandler(vaultSyncService as never);
  const artifact = await handler.run(
    makeJob({
      type: 'project_capability_curation',
      governanceIdentity: 'project_curator',
      projectSlug: 'workspace-b9e43543',
      payload: {
        summary: 'Refresh project capability mirror.',
        artifactTargets: ['project_doc', 'project_rules', 'project_skill'],
      },
    })
  );

  expect(vaultSyncService.curateProjectCapabilities).toHaveBeenCalled();
  expect(vaultSyncService.writeProjectCuratorProposal).toHaveBeenCalledTimes(2);
  expect(artifact?.summary).toContain('Refreshed project capability mirror.');
});
```

- [ ] **Step 2: Run the event-flow tests to verify project jobs still stop at the old capability mirror behavior**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: FAIL because `ProjectCapabilityCurationJobHandler` currently only refreshes the capability mirror and does not emit append-first proposal artifacts.

- [ ] **Step 3: Expand the capability curation handler to emit rule and skill proposal notes**

```ts
const capabilityArtifact = await this.vaultSyncService.curateProjectCapabilities({
  spaceId: job.spaceId,
  projectSlug: job.projectSlug,
  summary: typeof job.payload.summary === 'string' ? job.payload.summary : job.reason,
  detail: typeof job.payload.detail === 'string' ? job.payload.detail : undefined,
  timestamp: job.completedAt || new Date().toISOString(),
});

const rulesProposal = await this.vaultSyncService.writeProjectCuratorProposal({
  spaceId: job.spaceId,
  projectSlug: job.projectSlug,
  title: 'AGENTS append proposal',
  proposalKind: 'project_rules',
  summary: 'Add a stable release-validation rule.',
  targetPath: 'AGENTS.md',
  additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
  evidence: [typeof job.payload.summary === 'string' ? job.payload.summary : job.reason],
  timestamp: job.completedAt || new Date().toISOString(),
});

const skillProposal = await this.vaultSyncService.writeProjectCuratorProposal({
  spaceId: job.spaceId,
  projectSlug: job.projectSlug,
  title: 'Skill append proposal',
  proposalKind: 'project_skill',
  summary: 'Update release-validation skill guidance.',
  targetPath: 'skills/release-validation/SKILL.md',
  additions: ['Add a short note describing when to run focused release verification.'],
  evidence: [typeof job.payload.summary === 'string' ? job.payload.summary : job.reason],
  timestamp: job.completedAt || new Date().toISOString(),
});

return {
  projectSlug: capabilityArtifact?.projectSlug ?? job.projectSlug,
  noteTitle: capabilityArtifact?.noteTitle ?? 'Project capability curation',
  relativePath: capabilityArtifact?.relativePath ?? '',
  summary: [capabilityArtifact?.summary, rulesProposal?.summary, skillProposal?.summary].filter(Boolean).join(' | '),
};
```

- [ ] **Step 4: Re-run the event-flow tests and verify project jobs now behave like Project Curator work**

Run: `bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts`

Expected: PASS with project promotion writing docs and project capability curation emitting append-first proposal notes.

- [ ] **Step 5: Commit the first Project Curator execution slice**

```bash
git add \
  src/process/services/context/jobs/ProjectPromotionJobHandler.ts \
  src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
git commit -m "feat(context): make project jobs write curator artifacts"
```

### Task 4: Wire manual and timer project-curation triggers through schedules

**Files:**

- Modify: `src/process/services/context/events/triggers/builtinTriggers.ts`
- Test: `tests/unit/context-engine/contextScheduleService.test.ts`

- [ ] **Step 1: Write the failing schedule tests for explicit Project Curator triggers**

```ts
it('queues project capability curation schedules as project curator work', async () => {
  const { service, queueTimerTrigger } = createService();

  const schedule = await service.createConversationSchedule({
    name: 'Project capability review',
    schedule: { kind: 'interval', everyMinutes: 60, description: 'Every 60 minutes' },
    message: 'Refresh project capability mirror.',
    conversationId: 'conv-1',
    conversationTitle: 'Daily thread',
    workspacePath: '/tmp/workspace',
    agentType: 'codex',
    createdBy: 'system',
    spaceId: 'space-1',
    triggerId: 'timer.project-capability-curation',
  });

  await service.runDueSchedules(Date.now());

  expect(queueTimerTrigger).toHaveBeenCalledWith(
    expect.objectContaining({
      triggerId: 'timer.project-capability-curation',
      projectSlug: expect.any(String),
      payload: expect.objectContaining({
        summary: 'Refresh project capability mirror.',
      }),
    })
  );
  expect(schedule.owner).toBe('system');
});
```

- [ ] **Step 2: Run the schedule tests to verify timer/manual project-curator routing is still thin**

Run: `bun run test -- tests/unit/context-engine/contextScheduleService.test.ts`

Expected: FAIL if project-curation schedules do not yet propagate the richer project payload or target trigger IDs.

- [ ] **Step 3: Tighten the built-in trigger definitions and schedule payload mapping**

```ts
{
  id: 'manual.project-capability-curation',
  kind: 'manual',
  source: 'manual',
  builder: 'planned',
  jobType: 'project_capability_curation',
  scopeKind: 'project',
  event: 'manual.project_capability_curation',
  label: 'Manual project capability curation',
  defaultPriority: 'medium',
  defaultReason: 'Manually refresh project docs, AGENTS append proposals, and skill proposals from local automation evidence.',
}
```

```ts
{
  id: 'timer.project-capability-curation',
  kind: 'timer',
  source: 'timer',
  builder: 'planned',
  jobType: 'project_capability_curation',
  scopeKind: 'project',
  event: 'timer.project_capability_curation',
  label: 'Project capability curation',
  defaultPriority: 'medium',
  defaultReason: 'Periodically refresh project docs and append-first proposals from local automation evidence.',
}
```

- [ ] **Step 4: Re-run the schedule suite to verify project-curation automation remains typed and deterministic**

Run: `bun run test -- tests/unit/context-engine/contextScheduleService.test.ts`

Expected: PASS with project-capability schedules routed through the richer project-curator trigger metadata.

- [ ] **Step 5: Commit the trigger-layer changes**

```bash
git add \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  tests/unit/context-engine/contextScheduleService.test.ts
git commit -m "feat(context): route project curator schedules"
```

### Task 5: Verify the full Project Curator slice and document completion state

**Files:**

- Modify: `docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md`
- Modify: `docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md`

- [ ] **Step 1: Update both accepted specs with a short Project Curator phase status note**

```md
## Phase 2 status

- Project Curator docs curation landed
- AGENTS and skill append-first proposals land in project `_context/proposals`
- direct source-file mutation remains out of scope
```

- [ ] **Step 2: Run the focused Project Curator verification set**

Run:

```bash
bun run test -- \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  tests/unit/context-engine/projectCuratorProposalFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: PASS for the new project curation and proposal scenarios.

- [ ] **Step 3: Run typecheck plus the whole context-engine test bundle**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine
```

Expected:

- `bunx tsc --noEmit` exits `0`
- context-engine unit tests stay green after the Project Curator slice lands

- [ ] **Step 4: Run autofix formatting and targeted linting on the touched files**

Run:

```bash
bun run format
bunx oxlint \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/ContextJobOrchestrator.ts \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts \
  src/process/services/context/jobs/ProjectPromotionJobHandler.ts \
  src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  tests/unit/context-engine/projectCuratorProposalFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: formatter completes and targeted oxlint reports no new errors.

- [ ] **Step 5: Commit the finished Project Curator implementation batch**

```bash
git add \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/ContextJobOrchestrator.ts \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts \
  src/process/services/context/jobs/ProjectPromotionJobHandler.ts \
  src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextScheduleService.test.ts \
  tests/unit/context-engine/projectCuratorProposalFormatter.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts \
  docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md \
  docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md
git commit -m "feat(context): land project curator evolution loop"
```

## Follow-On Plans

After this plan lands, write separate plans for:

1. `Space Curator` profile distillation, connector digestion, and temporal expiration
2. runtime console panels and governance observability
3. optional append-first direct source-file mutation for low-risk project updates
