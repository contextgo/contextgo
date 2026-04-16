# System Runs Log Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `System Runs` read like a runtime log stream while making artifact-bearing runs easier to distinguish through grouped metadata and stronger event qualifiers.

**Architecture:** Keep the existing `SystemRunsPage` card layout and data contract, but restructure the renderer so each run exposes two metadata groups (`Routing` and `Artifact`) plus a denser event stream row shape. Drive the change with DOM tests first, then update the page markup and `AgentSettingsPage.module.css` styles without changing IPC or context-engine payloads.

**Tech Stack:** React, TypeScript, Arco Design, CSS Modules, Vitest, Testing Library

---

### Task 1: Lock the New Event-Stream Rendering in DOM Tests

**Files:**

- Modify: `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
- Test: `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders recent events as structured log rows with artifact qualifiers', async () => {
  activityState.status = 'active';
  activityState.activeMaintenanceCount = 2;
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
      latestArtifactSummary: 'Session working context refreshed.',
      artifactRelativePath: 'Projects/workspace/_context/sessions/thread-1/working-context.md',
      artifactTitle: 'Session working context',
      artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      reason: 'Session compaction triggered by repeated requests.',
      source: 'hook',
      triggerLabel: 'Context window prepared',
      triggerEvent: 'context.window.prepared',
      executionBoundaryPath: '/vault/space-1',
      executionBoundaryLabel: 'My Space',
      recentEvents: [
        {
          conversationId: 'thread-1',
          kind: 'status',
          text: 'Running session compaction',
          at: new Date('2026-04-11T06:08:00Z').getTime(),
        },
      ],
    },
    {
      id: 'run-2',
      rootRunId: 'run-2',
      backend: 'context-engine',
      agentProfileId: 'profile-2',
      agentName: 'Context Engine · Project Curator',
      state: 'writing',
      runtimeStatus: 'running',
      lastActiveAt: new Date('2026-04-11T06:18:00Z').getTime(),
      currentTask: 'Writing AGENTS append proposal',
      systemManaged: true,
      assistantId: 'system-context-engine-project-capability-curator',
      systemOwner: 'context-engine',
      systemRole: 'context-engine-project-capability-curator',
      governanceIdentity: 'project_curator',
      scopeLabel: 'workspace-alpha',
      maintenanceKind: 'project_capability_curation',
      latestArtifactSummary: 'Add a stable release-validation rule.',
      artifactRelativePath: 'Projects/workspace/_context/proposals/agents-append-proposal.md',
      artifactTitle: 'AGENTS append proposal',
      artifactTargets: ['project_doc', 'project_rules', 'project_skill'],
      reason: 'Refresh project docs and append-first proposals.',
      source: 'timer',
      triggerLabel: 'Project capability curation',
      triggerEvent: 'timer.project_capability_curation',
      executionBoundaryPath: '/vault/space-1',
      executionBoundaryLabel: 'My Space',
      recentEvents: [
        {
          conversationId: 'thread-2',
          kind: 'message',
          text: 'Queued AGENTS append proposal',
          at: new Date('2026-04-11T06:18:00Z').getTime(),
        },
      ],
    },
  ];

  render(<SystemRunsPage />);

  const proposalRun = await screen.findByTestId('system-run-run-2');
  const sessionRun = screen.getByTestId('system-run-run-1');

  expect(within(proposalRun).getByText('Routing')).toBeInTheDocument();
  expect(within(proposalRun).getByText('Artifact')).toBeInTheDocument();
  expect(within(proposalRun).getByTestId('system-run-event-qualifier-run-2-0')).toHaveTextContent('proposal');
  expect(within(sessionRun).getByTestId('system-run-event-qualifier-run-1-0')).toHaveTextContent('session-context');
  expect(within(sessionRun).getByTestId('system-run-event-kind-run-1-0')).toHaveTextContent('status');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
Expected: FAIL because `Routing`, `Artifact`, and the new event qualifier test ids are not rendered yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
function resolveRunEventQualifier(run: IExtensionSystemRunItem): string | undefined {
  return resolveArtifactKindLabel(run) ?? run.source;
}

function renderDetailGroup(
  title: string,
  rows: Array<{ key: string; value: string | undefined }>
): React.ReactNode {
  const visibleRows = rows.filter((row) => row.value);
  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <section className={styles.systemRunsMetaGroup}>
      <div className={styles.systemRunsMetaGroupTitle}>{title}</div>
      <div className={styles.systemRunsMetaGroupBody}>
        {visibleRows.map((row) => (
          <div key={row.key} className={styles.systemRunsDetailText}>
            {row.value}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
Expected: PASS with the new grouped metadata headings and event qualifier rows rendered.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css
git commit -m "feat(settings): restructure system runs event stream"
```

### Task 2: Tighten Log-Stream Styling and Re-Verify the Page

**Files:**

- Modify: `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css`
- Test: `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('keeps log rows compact while preserving artifact metadata text', async () => {
  activityState.status = 'active';
  activityState.activeMaintenanceCount = 1;
  activityState.systemRuns = [
    {
      id: 'run-3',
      rootRunId: 'run-3',
      backend: 'context-engine',
      agentProfileId: 'profile-3',
      agentName: 'Context Engine · Space Distiller',
      state: 'syncing',
      runtimeStatus: 'running',
      lastActiveAt: new Date('2026-04-11T06:28:00Z').getTime(),
      currentTask: 'Distilling space memory',
      systemManaged: true,
      assistantId: 'system-context-engine-space-memory-distiller',
      systemOwner: 'context-engine',
      systemRole: 'context-engine-space-memory-distiller',
      governanceIdentity: 'space_curator',
      scopeLabel: 'workspace-alpha',
      maintenanceKind: 'space_memory_distillation',
      latestArtifactSummary: 'Merged repeated space-level signals.',
      artifactRelativePath: 'Projects/workspace/_context/space/digest.md',
      artifactTitle: 'Space digest',
      artifactTargets: ['space_digest', 'profile_memory'],
      reason: 'Refresh space memory digest.',
      source: 'schedule',
      triggerLabel: 'Space memory distillation',
      triggerEvent: 'schedule.space_memory_distillation',
      executionBoundaryPath: '/vault/space-1',
      executionBoundaryLabel: 'My Space',
      recentEvents: [
        {
          conversationId: 'thread-3',
          kind: 'message',
          text: 'Merged repeated space-level signals.',
          at: new Date('2026-04-11T06:28:00Z').getTime(),
        },
      ],
    },
  ];

  render(<SystemRunsPage />);

  const runCard = await screen.findByTestId('system-run-run-3');
  expect(within(runCard).getByText('Artifact summary: Merged repeated space-level signals.')).toBeInTheDocument();
  expect(within(runCard).getByTestId('system-run-event-qualifier-run-3-0')).toHaveTextContent('space-distillation');
  expect(within(runCard).getByTestId('system-run-event-stream-run-3')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
Expected: FAIL because the new compact event-stream container and qualifier rendering for `space-distillation` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
<article key={run.id} data-testid={`system-run-${run.id}`} className={styles.systemRunsCard}>
  <div className={styles.systemRunsMetaGrid}>
    {renderDetailGroup('Routing', routingRows)}
    {renderDetailGroup('Artifact', artifactRows)}
  </div>

  {run.recentEvents.length > 0 ? (
    <div data-testid={`system-run-event-stream-${run.id}`} className={styles.systemRunsEventStream}>
      {run.recentEvents.slice(0, 4).map((event, index) => {
        const qualifier = resolveRunEventQualifier(run);
        return (
          <div key={`${run.id}-${index}-${event.at}`} className={styles.systemRunsEventRow}>
            <span className={styles.systemRunsEventTimestamp}>{formatUpdateTime(event.at)}</span>
            <Tag size='small' data-testid={`system-run-event-kind-${run.id}-${index}`}>
              {formatRecentEventKind(event.kind)}
            </Tag>
            {qualifier ? (
              <span
                data-testid={`system-run-event-qualifier-${run.id}-${index}`}
                className={styles.systemRunsEventQualifier}
              >
                {qualifier}
              </span>
            ) : null}
            <span className={styles.systemRunsEventMessage}>{event.text}</span>
          </div>
        );
      })}
    </div>
  ) : null}
</article>
```

```css
.systemRunsMetaGrid {
  display: grid;
  gap: 10px;
}

.systemRunsMetaGroup {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--border-base) 72%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--fill-2) 72%, var(--bg-1) 28%);
}

.systemRunsEventStream {
  display: grid;
  gap: 6px;
}

.systemRunsEventTimestamp {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.systemRunsEventQualifier {
  color: rgb(var(--primary-6));
  font-size: 11px;
  font-weight: 600;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
Expected: PASS with compact log rows and preserved artifact metadata text.

- [ ] **Step 5: Run broader verification**

Run: `bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
Expected: PASS

Run: `bunx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css
git commit -m "feat(settings): emphasize system run artifact logs"
```
