import React from 'react';
import { render, screen } from '@testing-library/react';
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
        recentEvents: [],
      },
    ];

    render(<SystemRunsPage />);

    expect(await screen.findByText('Compressing repeated session signals')).toBeInTheDocument();
    expect(screen.getByText('Governance: session_steward')).toBeInTheDocument();
    expect(screen.getByText('Source: hook')).toBeInTheDocument();
    expect(screen.getByText('Artifact summary: Session working context refreshed.')).toBeInTheDocument();
    expect(
      screen.getByText('Artifacts: session_timeline · session_working_context · session_checkpoint')
    ).toBeInTheDocument();
  });
});
