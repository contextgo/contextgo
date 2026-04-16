# Runtime Console Governance Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing `SystemRunsPage` into the first real Context Engine runtime console by exposing governance identities, trigger sources, artifact targets, and richer artifact summaries without creating a new settings page.

**Architecture:** Reuse the existing `ActivitySnapshotBuilder -> useContextEngineActivity -> SystemRunsPage` chain. Extend the snapshot payload with governance metadata already stored in maintenance-run records, then render that metadata in the existing page for both empty-state system definitions and real run history. Keep this slice read-only; no new control actions or mutation UI are part of this plan.

**Tech Stack:** TypeScript, Electron main-process bridges, React, Vitest 4, existing settings runtime UI

---

## Scope Decomposition

This plan covers only the first runtime-console observability slice.

It includes:

- richer maintenance-run metadata in extension activity snapshots
- existing `SystemRunsPage` UI updates
- trigger source / governance identity / artifact target rendering
- empty-state system-agent definitions aligned with the three-governance-identity model

It excludes:

- mutation actions from the runtime console
- job retry / cancel controls
- filtering, search, and pagination
- timeline drill-down and artifact diff views

## Planned File Structure

### Files To Modify In This Plan

- `src/common/adapter/ipcBridge.ts`
  - Extend the activity snapshot item types with runtime-console governance metadata.
- `src/process/bridge/services/ActivitySnapshotBuilder.ts`
  - Carry governance metadata from maintenance-run records into the snapshot payload.
- `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
  - Persist richer maintenance metadata for trigger source, governance identity, and artifact targets.
- `src/renderer/hooks/agent/useContextEngineActivity.ts`
  - Keep the richer snapshot data intact through sorting and memoization.
- `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`
  - Render governance identity, trigger source, artifact targets, and richer definition badges in the existing page.
- `src/renderer/services/i18n/locales/zh-CN/settings.json`
  - Add explicit strings for runtime-console governance labels if needed.
- `src/renderer/services/i18n/locales/en-US/settings.json`
  - Add matching default strings.

### Test Files To Modify

- `tests/unit/extensionsBridge.test.ts`
- `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

---

### Task 1: Persist governance identity and artifact targets in maintenance-run metadata

**Files:**

- Modify: `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
- Modify: `src/common/adapter/ipcBridge.ts`
- Test: `tests/unit/extensionsBridge.test.ts`

- [ ] **Step 1: Write the failing snapshot test for governance metadata**

```ts
it('carries governance identity and artifact targets into maintenance run snapshots', async () => {
  vi.mocked(getDatabase).mockResolvedValue({
    listChannelRuns: vi.fn(() => ({
      success: true,
      data: [
        {
          id: 'run-1',
          rootRunId: 'run-1',
          agentProfileId: 'profile-1',
          backend: 'context-engine',
          conversationId: 'thread-1',
          status: 'running',
          startedAt: Date.now(),
          metadata: {
            systemManaged: true,
            assistantId: 'system-context-engine-session-compactor',
            systemOwner: 'context-engine',
            systemRole: 'context-engine-session-compactor',
            governanceIdentity: 'session_steward',
            jobType: 'session_compaction',
            artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
            currentTask: 'Compressing repeated session signals',
            events: [{ kind: 'status', text: 'Running session compaction', at: Date.now() }],
          },
        },
      ],
    })),
    getAgentProfile: vi.fn(() => ({
      success: true,
      data: { name: 'Context Engine · Session Compactor' },
    })),
  } as never);

  const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

  expect(snapshot.systemRuns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        governanceIdentity: 'session_steward',
        artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      }),
    ])
  );
});
```

- [ ] **Step 2: Run the snapshot test to verify the current bridge payload is still missing those fields**

Run: `bun run test -- tests/unit/extensionsBridge.test.ts`

Expected: FAIL because `IExtensionSystemRunItem` does not yet expose `governanceIdentity` or `artifactTargets`.

- [ ] **Step 3: Extend the bridge types and snapshot builder with governance fields**

```ts
export interface IExtensionSystemRunItem {
  id: string;
  rootRunId: string;
  backend: string;
  agentProfileId: string;
  agentName: string;
  state: AgentActivityState;
  runtimeStatus: 'pending' | 'running' | 'finished' | 'unknown';
  lastActiveAt: number;
  lastStatus?: string;
  currentTask?: string;
  systemManaged?: boolean;
  assistantId?: string;
  systemOwner?: string;
  systemRole?: string;
  governanceIdentity?: string;
  scopeLabel?: string;
  maintenanceKind?: string;
  artifactRelativePath?: string;
  artifactTitle?: string;
  artifactTargets?: string[];
  threadId?: string;
  projectSlug?: string;
  reason?: string;
  source?: string;
  triggerLabel?: string;
  triggerEvent?: string;
  executionBoundaryPath?: string;
  executionBoundaryLabel?: string;
  recentEvents: IExtensionAgentActivityEvent[];
}
```

```ts
systemRuns.push({
  id: snapshot.run.id,
  rootRunId: snapshot.run.rootRunId,
  backend: snapshot.run.backend,
  agentProfileId: snapshot.run.agentProfileId,
  agentName: snapshot.agentName,
  state: snapshot.state,
  runtimeStatus: snapshot.runtimeStatus,
  lastActiveAt: latestEventAt,
  lastStatus: snapshot.run.status,
  currentTask: snapshot.metadata.currentTask || snapshot.events[0]?.text || getDefaultTaskLabel(snapshot.runtimeStatus),
  systemManaged: snapshot.metadata.systemManaged === true,
  assistantId: snapshot.metadata.assistantId,
  systemOwner: snapshot.metadata.systemOwner,
  systemRole: snapshot.metadata.systemRole,
  governanceIdentity: snapshot.metadata.governanceIdentity,
  scopeLabel: snapshot.metadata.scopeLabel,
  maintenanceKind: snapshot.metadata.jobType,
  artifactRelativePath: snapshot.metadata.artifactRelativePath,
  artifactTitle: snapshot.metadata.artifactTitle,
  artifactTargets: snapshot.metadata.artifactTargets,
  threadId: snapshot.metadata.threadId || snapshot.run.conversationId,
  projectSlug: snapshot.metadata.projectSlug,
  reason: snapshot.metadata.reason,
  source: snapshot.metadata.source,
  triggerLabel: snapshot.metadata.trigger?.label,
  triggerEvent: snapshot.metadata.trigger?.event,
  executionBoundaryPath: snapshot.metadata.executionBoundary?.vaultRoot,
  executionBoundaryLabel: snapshot.metadata.executionBoundary?.spaceName || snapshot.metadata.executionBoundary?.spaceId,
  recentEvents: snapshot.events,
});
```

- [ ] **Step 4: Persist the richer metadata in the job run projector**

```ts
const nextMetadata = appendEvent(
  {
    ...existingMetadata,
    kind: 'context-maintenance',
    systemManaged: true,
    assistantId: resolvedRuntime.assistant?.id ?? existingMetadata.assistantId,
    systemOwner: resolvedRuntime.assistant?.owner ?? existingMetadata.systemOwner,
    systemRole: resolvedRuntime.assistant?.systemRole ?? existingMetadata.systemRole,
    governanceIdentity: input.job.governanceIdentity,
    jobType: input.job.type,
    spaceId: input.job.spaceId,
    threadId: input.job.threadId,
    projectSlug: input.job.projectSlug,
    reason: input.job.reason,
    source: input.job.source,
    trigger: input.job.trigger,
    executionBoundary: input.job.executionBoundary,
    scopeLabel: buildScopeLabel(input.job),
    currentTask: buildCurrentTask(input.job, input.artifact, existingMetadata),
    latestArtifactSummary: input.artifact?.summary ?? existingMetadata.latestArtifactSummary,
    artifactRelativePath: getArtifactRelativePath(input.artifact) ?? existingMetadata.artifactRelativePath,
    artifactTitle: getArtifactTitle(input.artifact) ?? existingMetadata.artifactTitle,
    artifactTargets: Array.isArray(input.job.payload.artifactTargets)
      ? input.job.payload.artifactTargets.filter((target): target is string => typeof target === 'string')
      : existingMetadata.artifactTargets,
    lastError: input.error,
  },
  {
    kind: 'status',
    text: buildEventText(input.phase, input.job, input.artifact, input.error),
    at: input.endedAt ?? input.startedAt,
  }
);
```

- [ ] **Step 5: Re-run the snapshot tests and commit the bridge metadata changes**

Run: `bun run test -- tests/unit/extensionsBridge.test.ts`

Expected: PASS with governance identity and artifact targets available to renderer code.

```bash
git add \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  src/process/services/context/events/handlers/ContextJobRunProjector.ts \
  tests/unit/extensionsBridge.test.ts
git commit -m "feat(context): expose governance metadata in activity snapshots"
```

### Task 2: Expose governance identity and artifact targets in System Runs

**Files:**

- Modify: `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`
- Test: `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

- [ ] **Step 1: Write the failing DOM test for the richer run details**

```ts
it('shows governance identity and artifact targets for recorded system runs', async () => {
  activityState.status = 'active';
  activityState.activeMaintenanceCount = 1;
  activityState.systemRuns = [
    {
      id: 'run-1',
      rootRunId: 'run-1',
      backend: 'context-engine',
      agentProfileId: 'profile-1',
      agentName: 'Context Engine · Session Compactor',
      state: 'writing',
      runtimeStatus: 'running',
      lastActiveAt: new Date('2026-04-11T06:08:00Z').getTime(),
      currentTask: 'Compressing repeated session signals',
      systemManaged: true,
      assistantId: 'system-context-engine-session-compactor',
      systemOwner: 'context-engine',
      systemRole: 'context-engine-session-compactor',
      governanceIdentity: 'session_steward',
      scopeLabel: 'workspace-alpha',
      maintenanceKind: 'session_compaction',
      artifactRelativePath: 'Projects/workspace/_context/sessions/thread-1/working-context.md',
      artifactTitle: 'Session working context',
      artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      reason: 'Session compaction triggered by repeated requests.',
      source: 'hook',
      triggerLabel: 'Context window prepared',
      triggerEvent: 'context.window.prepared',
      executionBoundaryPath: '/vault/space-1',
      executionBoundaryLabel: 'My Space',
      recentEvents: [],
    },
  ];

  render(<SystemRunsPage />);

  expect(await screen.findByText('Compressing repeated session signals')).toBeInTheDocument();
  expect(screen.getByText('Governance: session_steward')).toBeInTheDocument();
  expect(screen.getByText('Artifacts: session_timeline · session_working_context · session_checkpoint')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the DOM test to verify the current page still hides those governance details**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

Expected: FAIL because the page currently renders trigger, boundary, and artifact path, but not governance identity or artifact targets.

- [ ] **Step 3: Add minimal renderer helpers for the new labels and render them in the run details block**

```ts
function formatArtifactTargets(targets: readonly string[] | undefined): string {
  if (!targets || targets.length === 0) {
    return '--';
  }

  return targets.join(' · ');
}
```

```tsx
{run.governanceIdentity ? (
  <div className={styles.systemRunsDetailText}>{`Governance: ${run.governanceIdentity}`}</div>
) : null}
{run.artifactTargets && run.artifactTargets.length > 0 ? (
  <div className={styles.systemRunsDetailText}>{`Artifacts: ${formatArtifactTargets(run.artifactTargets)}`}</div>
) : null}
```

- [ ] **Step 4: Re-run the System Runs DOM test to verify the runtime console now shows the richer details**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

Expected: PASS with governance identity and artifact targets visible in the run history card.

- [ ] **Step 5: Commit the System Runs page changes**

```bash
git add \
  src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx \
  tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx
git commit -m "feat(settings): expose governance details in system runs"
```

### Task 3: Verify the runtime-console slice stays green

**Files:**

- Modify: `docs/superpowers/plans/2026-04-16-runtime-console-governance-observability.md`

- [ ] **Step 1: Write this plan to disk if it does not exist yet and mark the current implementation status**

```md
## Implementation status

- Task 1 complete
- Task 2 complete
```

- [ ] **Step 2: Run the focused runtime-console verification set**

Run:

```bash
bun run test -- \
  tests/unit/extensionsBridge.test.ts \
  tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx \
  tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: PASS with governance metadata flowing from job records to the settings page.

- [ ] **Step 3: Run typecheck and the default test command**

Run:

```bash
bunx tsc --noEmit
bun run test
```

Expected:

- `bunx tsc --noEmit` exits `0`
- default `bun run test` stays green on the branch

- [ ] **Step 4: Run formatter and targeted oxlint on touched files**

Run:

```bash
bun run format
bunx oxlint \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  src/process/services/context/events/handlers/ContextJobRunProjector.ts \
  src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx \
  tests/unit/extensionsBridge.test.ts \
  tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx
```

Expected: formatter succeeds and targeted oxlint reports no new errors.

- [ ] **Step 5: Commit the finished runtime-console observability slice**

```bash
git add \
  src/common/adapter/ipcBridge.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  src/process/services/context/events/handlers/ContextJobRunProjector.ts \
  src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx \
  tests/unit/extensionsBridge.test.ts \
  tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx \
  docs/superpowers/plans/2026-04-16-runtime-console-governance-observability.md
git commit -m "feat(settings): add governance observability to system runs"
```

## Follow-On Plans

After this plan lands, the next runtime-console steps are:

1. show proposal summaries and artifact kinds more clearly
2. expose trigger-source filters and failure-focused views
3. add explicit controls for retry / manual rerun / promotion review
