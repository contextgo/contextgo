import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spaceGetInvokeMock = vi.fn();
const spaceGetContextInvokeMock = vi.fn();
const getUserConversationsInvokeMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    space: {
      get: { invoke: (...args: unknown[]) => spaceGetInvokeMock(...args) },
      getContext: { invoke: (...args: unknown[]) => spaceGetContextInvokeMock(...args) },
    },
    database: {
      getUserConversations: { invoke: (...args: unknown[]) => getUserConversationsInvokeMock(...args) },
    },
  },
}));

vi.mock('@/renderer/pages/space/affine/AffineCanvasSurface', () => ({
  default: ({
    onOpenSession,
    projection,
    projectCount,
    runningCount,
    sessionCount,
  }: {
    onOpenSession: (conversationId: string) => void;
    projection: { items: Array<{ conversationId?: string; kind: string; title: string }> };
    projectCount: number;
    runningCount: number;
    sessionCount: number;
  }) => {
    const firstSession = projection.items.find(
      (item) => item.kind === 'session' && item.conversationId
    )?.conversationId;
    return (
      <div data-testid='space-canvas'>
        <div>{projectCount} projects</div>
        <div>{sessionCount} sessions</div>
        <div>{runningCount} running</div>
        <div>{projection.items.map((item) => item.title).join(' | ')}</div>
        {firstSession ? <button onClick={() => onOpenSession(firstSession)}>Open Session</button> : null}
      </div>
    );
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'space.overview.projectCount') {
        return `${options?.count ?? 0} projects`;
      }

      if (key === 'space.overview.sessionCount') {
        return `${options?.count ?? 0} sessions`;
      }

      if (key === 'space.overview.runningCount') {
        return `${options?.count ?? 0} running`;
      }

      if (key === 'space.canvas.projectSummary') {
        return `${options?.sessionCount ?? 0} sessions`;
      }

      if (key === 'space.canvas.projectSummaryRunning') {
        return `${options?.sessionCount ?? 0} sessions / ${options?.runningCount ?? 0} running`;
      }

      if (key === 'space.canvas.memorySummary') {
        return `${options?.count ?? 0} memories`;
      }

      if (key === 'space.canvas.profileSummary') {
        return `${options?.count ?? 0} profiles`;
      }

      const labels: Record<string, string> = {
        'space.overview.title': 'Space Overview',
        'space.overview.projects': 'Projects',
        'space.overview.sessions': 'Sessions',
        'space.overview.running': 'Running',
        'space.overview.openCanvas': 'Open Canvas',
        'space.overview.openContext': 'Open Context',
        'space.overview.projectsTitle': 'Projects in this space',
        'space.overview.projectsDescription': 'Project description',
        'space.overview.projectsEmpty': 'No projects yet.',
        'space.overview.runningTitle': 'Running sessions',
        'space.overview.runningDescription': 'Running description',
        'space.overview.runningEmpty': 'Nothing running.',
        'space.overview.contextTitle': 'Shared context signals',
        'space.overview.contextDescription': 'Context description',
        'space.overview.openSession': 'Open Session',
        'space.shell.description': 'Space description',
        'space.shell.memory': 'Memories',
        'space.shell.profiles': 'Profiles',
        'space.shell.emptyDescription': 'No space found.',
        'space.shell.comingSoon': 'Coming soon.',
        'space.shell.preparedDescription': 'Prepared description',
        'space.shell.workbenchHint': 'Workbench hint',
        'space.context.memoryEmpty': 'No memories yet.',
        'space.context.profileEmpty': 'No profiles yet.',
        'space.views.overview': 'Overview',
        'space.views.canvas': 'Canvas',
        'space.views.context': 'Context',
        'space.views.docs': 'Docs',
        'space.views.runs': 'Runs',
        'space.views.members': 'Members',
        'space.views.settings': 'Settings',
        'space.canvas.title': 'Space Canvas',
        'space.canvas.summary': 'Canvas summary',
        'space.canvas.gestureHint': 'Gesture hint',
        'space.canvas.resetView': 'Reset View',
        'space.canvas.emptyTitle': 'Empty title',
        'space.canvas.emptyDescription': 'Empty description',
        'space.canvas.project': 'Project',
        'space.canvas.session': 'Session',
        'space.canvas.memory': 'Context Memory',
        'space.canvas.profile': 'Profiles',
        'space.canvas.openSession': 'Open Session',
        'space.canvas.status.running': 'Running',
        'space.canvas.status.ready': 'Ready',
        'space.canvas.backends.codex': 'Codex',
        'space.canvas.backends.gemini': 'Gemini',
        'space.canvas.backends.group': 'Group',
        'common.returnToWorkbench': 'Return to Workbench',
      };

      return labels[key] || options?.defaultValue || key;
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import SpacePage from '@/renderer/pages/space';

const renderSpacePage = (initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path='/space/:spaceId' element={<SpacePage />} />
        <Route path='/conversation/:id' element={<div>conversation</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('SpacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spaceGetInvokeMock.mockResolvedValue({
      id: 'space-1',
      name: 'Studio Space',
      engine: 'affine',
      description: 'Operate all active work here.',
      createTime: 1,
      modifyTime: 1,
    });
    spaceGetContextInvokeMock.mockResolvedValue({
      memories: [{ id: 'memory-1', summary: 'Team prefers concise updates.', detail: 'Keep updates short.' }],
      profiles: [{ id: 'profile-1', key: 'team-style', summary: 'High review standard' }],
    });
    getUserConversationsInvokeMock.mockResolvedValue([
      {
        id: 'conv-1',
        name: 'Ship desktop packaging',
        type: 'codex',
        createTime: 1,
        modifyTime: 50,
        status: 'running',
        model: {
          id: 'provider-1',
          platform: 'openai',
          name: 'Provider',
          baseUrl: 'https://example.com',
          apiKey: 'key',
          useModel: 'gpt-4.1',
        },
        extra: {
          spaceId: 'space-1',
          workingDirectory: '/workspace/desktop-app',
          workspace: '/workspace/desktop-app',
        },
      },
      {
        id: 'conv-2',
        name: 'Polish mobile shell',
        type: 'gemini',
        createTime: 1,
        modifyTime: 40,
        status: 'finished',
        model: {
          id: 'provider-1',
          platform: 'openai',
          name: 'Provider',
          baseUrl: 'https://example.com',
          apiKey: 'key',
          useModel: 'gpt-4.1',
        },
        extra: {
          spaceId: 'space-1',
          workingDirectory: '/workspace/mobile-shell',
          workspace: '/workspace/mobile-shell',
        },
      },
      {
        id: 'conv-3',
        name: 'Other space work',
        type: 'group',
        createTime: 1,
        modifyTime: 80,
        status: 'running',
        model: {
          id: 'provider-1',
          platform: 'openai',
          name: 'Provider',
          baseUrl: 'https://example.com',
          apiKey: 'key',
          useModel: 'gpt-4.1',
        },
        extra: {
          spaceId: 'space-2',
          workingDirectory: '/workspace/other-space',
          workspace: '/workspace/other-space',
        },
      },
    ]);
  });

  it('renders overview cards using only conversations linked to the current space', async () => {
    renderSpacePage('/space/space-1?view=overview');

    expect(await screen.findByText('Studio Space')).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText('Ship desktop packaging')).toBeInTheDocument();
    expect(screen.queryByText('Other space work')).toBeNull();
  });

  it('renders the connected canvas view by default and opens a session from the projected board data', async () => {
    renderSpacePage('/space/space-1');

    expect(await screen.findByTestId('space-canvas')).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByText(/Ship desktop packaging/)).toBeInTheDocument();
    expect(screen.queryByText(/Other space work/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open Session' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/conversation/conv-1');
    });
  });

  it('shows the empty state when the space cannot be loaded', async () => {
    spaceGetInvokeMock.mockResolvedValueOnce(null);

    renderSpacePage('/space/missing-space');

    expect(await screen.findByText('No space found.')).toBeInTheDocument();
  });
});
