import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'agent.contextEngine.title': 'Context Engine',
          'agent.contextEngine.description': 'Maintenance visibility',
          'agent.contextEngine.systemManaged': 'System-managed',
          'agent.contextEngine.active': 'Active',
          'agent.contextEngine.idle': 'Watching',
          'agent.contextEngine.loading': 'Loading maintenance activity...',
          'agent.contextEngine.loadFailed': 'Failed to load maintenance activity.',
          'agent.contextEngine.activeCount': `${String(options?.count ?? '0')} maintenance runs active`,
          'agent.contextEngine.idleCount': `${String(options?.count ?? '0')} maintenance agents watching`,
          'agent.contextEngine.empty': 'Waiting for the first maintenance run.',
          'agent.contextEngine.taskFallback': 'No summary yet',
          'agent.contextEngine.groupActiveCount': `${String(options?.count ?? '0')} runs active`,
          'agent.contextEngine.groupWatchingCount': `${String(options?.count ?? '0')} agents watching`,
          'agent.contextEngine.scope': `Scope: ${String(options?.scope ?? '')}`,
          'agent.contextEngine.artifactTitle': `Doc: ${String(options?.title ?? '')}`,
          'agent.contextEngine.artifactPath': `Path: ${String(options?.path ?? '')}`,
          'agent.contextEngine.latestEvent': `Latest: ${String(options?.event ?? '')}`,
          'agent.contextEngine.updatedAt': `Updated ${String(options?.time ?? '')}`,
          'agent.contextEngine.groups.session_compaction': 'Session Compaction',
          'agent.contextEngine.groups.project_promotion': 'Project Promotion',
          'agent.contextEngine.groups.other': 'Other Maintenance',
          'agent.contextEngine.state.idle': 'Idle',
          'agent.contextEngine.state.syncing': 'Syncing',
          'agent.contextEngine.openConsole': 'Open Console',
          'common.loading': 'Loading',
          'common.error': 'Error',
        }) as Record<string, string>
      )[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Paragraph: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Robot: () => <span data-testid='robot-icon' />,
}));

vi.mock('@/renderer/hooks/agent/useContextEngineActivity', () => ({
  useContextEngineActivity: () => ({
    activeMaintenanceCount: 1,
    status: 'active',
    maintenanceAgents: [
      {
        id: 'session-agent',
        backend: 'context-engine',
        agentName: 'Context Engine · Session Compactor',
        state: 'syncing',
        runtimeStatus: 'running',
        conversations: 1,
        activeConversations: 1,
        lastActiveAt: Date.now(),
        currentTask: 'Compressing repeated session signals',
        runType: 'maintenance',
        systemManaged: true,
        systemRole: 'context-engine-session-compactor',
        scopeLabel: 'project-alpha',
        maintenanceKind: 'session_compaction',
        artifactTitle: 'Release Session',
        artifactRelativePath: 'Sessions/thread-1.md',
        recentEvents: [
          {
            conversationId: 'thread-1',
            kind: 'status',
            text: 'Completed session compaction',
            at: Date.now(),
          },
        ],
      },
      {
        id: 'project-agent',
        backend: 'context-engine',
        agentName: 'Context Engine · Project Promoter',
        state: 'idle',
        runtimeStatus: 'finished',
        conversations: 1,
        activeConversations: 0,
        lastActiveAt: Date.now() - 1000,
        currentTask: 'Promoting stable release checklist',
        runType: 'maintenance',
        systemManaged: true,
        systemRole: 'context-engine-project-promoter',
        scopeLabel: 'project-alpha',
        maintenanceKind: 'project_promotion',
        artifactTitle: 'Project Wiki',
        artifactRelativePath: 'Projects/project-alpha/Project Wiki.md',
        recentEvents: [
          {
            conversationId: 'thread-1',
            kind: 'status',
            text: 'Completed project promotion',
            at: Date.now() - 1000,
          },
        ],
      },
    ],
  }),
}));

import ContextEngineActivityCard from '@/renderer/components/agent/ContextEngineActivityCard';

describe('ContextEngineActivityCard', () => {
  it('groups maintenance agents, renders artifact metadata, and links to the console', () => {
    render(<ContextEngineActivityCard />);

    expect(screen.getByText('Session Compaction')).toBeInTheDocument();
    expect(screen.getByText('Project Promotion')).toBeInTheDocument();
    expect(screen.getByText('Session Context Keeper')).toBeInTheDocument();
    expect(screen.getByText('Project Knowledge Promoter')).toBeInTheDocument();
    expect(screen.getByText('Doc: Release Session')).toBeInTheDocument();
    expect(screen.getByText('Path: Sessions/thread-1.md')).toBeInTheDocument();
    expect(screen.getByText('Doc: Project Wiki')).toBeInTheDocument();
    expect(screen.getByText('Path: Projects/project-alpha/Project Wiki.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Console' }));
    expect(navigateMock).toHaveBeenCalledWith('/settings/system-runs');
  });
});
