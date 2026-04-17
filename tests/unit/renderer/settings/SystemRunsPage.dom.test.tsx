import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const activityState = {
  status: 'idle' as const,
  systemRuns: [] as Array<Record<string, unknown>>,
  activeMaintenanceCount: 0,
  maintenanceAgents: [] as Array<Record<string, unknown>>,
  lastCheckedAt: new Date('2026-04-11T06:08:00Z').getTime(),
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue) {
        return String(options.defaultValue);
      }

      if (key === 'settings.systemRunsLastChecked') {
        return 'Last checked: ' + String(options?.time ?? '--');
      }

      return key;
    },
  }),
}));

vi.mock('@/renderer/hooks/agent/useContextEngineActivity', () => ({
  useContextEngineActivity: () => activityState,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Paragraph: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock('@icon-park/react', () => ({
  Right: () => <span>right-icon</span>,
  Robot: () => <span>robot-icon</span>,
}));

import SystemRunsPage from '@/renderer/pages/settings/AgentSettings/SystemRunsPage';

describe('SystemRunsPage', () => {
  beforeEach(() => {
    activityState.status = 'idle';
    activityState.systemRuns = [];
    activityState.activeMaintenanceCount = 0;
    activityState.maintenanceAgents = [];
    activityState.lastCheckedAt = new Date('2026-04-11T06:08:00Z').getTime();
  });

  it('shows registered system agent definitions when there is no run history', () => {
    render(<SystemRunsPage />);

    expect(screen.getByText('No run history yet.')).toBeInTheDocument();
    expect(screen.getByText('Registered system agents')).toBeInTheDocument();
    expect(screen.getByText('Session Context Keeper')).toBeInTheDocument();
    expect(screen.getByText('Project Knowledge Promoter')).toBeInTheDocument();
    expect(screen.getAllByText('Governance: session_steward').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Governance: project_curator').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Governance: space_curator').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Artifacts: session_timeline · session_working_context · session_checkpoint').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Artifacts: project_doc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Artifacts: space_digest · profile_memory').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Last checked:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Trigger:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Boundary:/).length).toBeGreaterThan(0);
  });

  it('shows governance identity and artifact targets for recorded system runs', async () => {
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
        lifecycleSummary: 'Planner delegate completed release validation synthesis.',
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

    expect(await screen.findByText('Compressing repeated session signals')).toBeInTheDocument();
    expect(screen.getByText('session_steward · 1')).toBeInTheDocument();
    expect(screen.getByText('project_curator · 1')).toBeInTheDocument();
    expect(screen.getByText('hook')).toBeInTheDocument();
    expect(screen.getAllByText('session-context').length).toBeGreaterThan(0);
    expect(screen.getAllByText('proposal').length).toBeGreaterThan(0);
    expect(screen.getByText('Governance: session_steward')).toBeInTheDocument();
    expect(screen.getByText('Source: hook')).toBeInTheDocument();
    expect(screen.getByText('Artifact kind: session-context')).toBeInTheDocument();
    expect(screen.getByText('Artifact summary: Session working context refreshed.')).toBeInTheDocument();
    expect(
      screen.getByText('Lifecycle summary: Planner delegate completed release validation synthesis.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Artifacts: session_timeline · session_working_context · session_checkpoint')
    ).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('Running session compaction')).toBeInTheDocument();
    expect(screen.getByText('Artifact kind: proposal')).toBeInTheDocument();
    expect(screen.getByText('Source: timer')).toBeInTheDocument();
    expect(screen.getByText('Artifact summary: Add a stable release-validation rule.')).toBeInTheDocument();
    expect(screen.getByText('Queued AGENTS append proposal')).toBeInTheDocument();
  });

  it('renders recent events as structured log rows with artifact qualifiers', async () => {
    activityState.status = 'active';
    activityState.activeMaintenanceCount = 3;
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
      {
        id: 'run-4',
        rootRunId: 'run-4',
        backend: 'context-engine',
        agentProfileId: 'profile-4',
        agentName: 'Context Engine · Connector Digest Curator',
        state: 'researching',
        runtimeStatus: 'running',
        lastActiveAt: new Date('2026-04-11T06:38:00Z').getTime(),
        currentTask: 'Digesting connector provenance',
        systemManaged: true,
        assistantId: 'system-context-engine-connector-digester',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-connector-digester',
        governanceIdentity: 'space_curator',
        scopeLabel: 'workspace-alpha',
        maintenanceKind: 'connector_digest',
        latestArtifactSummary: 'Captured browser activity from example.com: Release checklist page',
        artifactRelativePath: 'System/Context Engine/connector-digest.md',
        artifactTitle: 'Connector Digest',
        artifactTargets: ['space_digest'],
        reason: 'Digest newly ingested connector content into reusable context.',
        source: 'connector',
        triggerLabel: 'Connector source ingested',
        triggerEvent: 'connector.source.ingested',
        executionBoundaryPath: '/vault/space-1',
        executionBoundaryLabel: 'My Space',
        provenanceSummary: 'Merged 3 newly ingested browser records.',
        sourceRecordId: 'source-1',
        ingestMode: 'incremental',
        replayFromCursor: 'cursor-42',
        recentEvents: [
          {
            conversationId: 'thread-4',
            kind: 'message',
            text: 'Merged 3 newly ingested browser records.',
            at: new Date('2026-04-11T06:38:00Z').getTime(),
          },
        ],
      },
    ];

    render(<SystemRunsPage />);

    const proposalRun = await screen.findByTestId('system-run-run-2');
    const sessionRun = screen.getByTestId('system-run-run-1');
    const distillationRun = screen.getByTestId('system-run-run-3');
    const connectorRun = screen.getByTestId('system-run-run-4');

    expect(within(proposalRun).getByText('Routing')).toBeInTheDocument();
    expect(within(proposalRun).getByText('Artifact')).toBeInTheDocument();
    expect(within(proposalRun).getByTestId('system-run-event-stream-run-2')).toBeInTheDocument();
    expect(within(proposalRun).getByTestId('system-run-event-qualifier-run-2-0')).toHaveTextContent('proposal');
    expect(within(sessionRun).getByTestId('system-run-event-qualifier-run-1-0')).toHaveTextContent('session-context');
    expect(within(sessionRun).getByTestId('system-run-event-kind-run-1-0')).toHaveTextContent('status');
    expect(
      within(distillationRun).getByText('Artifact summary: Merged repeated space-level signals.')
    ).toBeInTheDocument();
    expect(within(distillationRun).getByTestId('system-run-event-qualifier-run-3-0')).toHaveTextContent(
      'space-distillation'
    );
    expect(within(connectorRun).getByText('Source record: source-1')).toBeInTheDocument();
    expect(within(connectorRun).getByText('Ingest mode: incremental')).toBeInTheDocument();
    expect(within(connectorRun).getByText('Replay cursor: cursor-42')).toBeInTheDocument();
    expect(
      within(connectorRun).getByText('Provenance summary: Merged 3 newly ingested browser records.')
    ).toBeInTheDocument();
  });
});
