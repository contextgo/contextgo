import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExternalSessionsMock = vi.fn();
const getAvailableAgentsMock = vi.fn();
const importExternalSessionMock = vi.fn();
const openTabMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'guid.externalSessions.title': 'Continue external sessions',
          'guid.externalSessions.description': 'External sessions description',
          'guid.externalSessions.refresh': 'Refresh',
          'guid.externalSessions.loading': 'Scanning external sessions...',
          'guid.externalSessions.import': 'Take over',
          'guid.externalSessions.loadFailed': 'Failed to scan external sessions.',
          'guid.externalSessions.importFailed': 'Failed to take over the selected external session.',
          'guid.externalSessions.providers.claude': 'Claude',
          'guid.externalSessions.providers.codex': 'Codex',
          'guid.externalSessions.providers.gemini': 'Gemini',
          'guid.externalSessions.providers.opencode': 'OpenCode',
          'guid.externalSessions.providers.openclaw-gateway': 'OpenClaw',
          'guid.externalSessions.filters.all': 'All',
        }) as Record<string, string>
      )[key] ?? (key === 'guid.externalSessions.updatedAt' ? `Updated ${options?.time ?? ''}` : key),
  }),
}));

vi.mock('@icon-park/react', () => ({
  Refresh: () => <span data-testid='refresh-icon' />,
  Down: () => <span data-testid='group-expanded' />,
  Right: () => <span data-testid='group-collapsed' />,
}));

vi.mock('@arco-design/web-react', () => {
  const Tabs = ({ activeTab, onChange, children }: any) => {
    const panes = React.Children.toArray(children) as React.ReactElement[];
    const normalizeKey = (value: string | null) => (value ? value.replace(/^\.\$/, '') : '');
    return (
      <div>
        <div>
          {panes.map((pane) => (
            <button key={String(pane.key)} type='button' onClick={() => onChange?.(normalizeKey(String(pane.key)))}>
              {pane.props.title}
            </button>
          ))}
        </div>
        <div>{panes.find((pane) => normalizeKey(String(pane.key)) === String(activeTab))?.props.children}</div>
      </div>
    );
  };

  Tabs.TabPane = ({ children }: any) => <>{children}</>;

  return {
    Button: ({ children, onClick, disabled, loading, icon, ...rest }: any) => (
      <button type='button' onClick={onClick} disabled={disabled || loading} {...rest}>
        {icon}
        {children}
      </button>
    ),
    Empty: ({ description }: any) => <div>{description}</div>,
    Message: {
      useMessage: () => [
        {
          error: vi.fn(),
          success: vi.fn(),
        },
        <div key='message-context' />,
      ],
    },
    Modal: ({ visible, children, title }: any) =>
      visible ? (
        <div>
          <div>{title}</div>
          {children}
        </div>
      ) : null,
    Tabs,
    Tag: ({ children }: any) => <span>{children}</span>,
    Typography: {
      Paragraph: ({ children }: any) => <p>{children}</p>,
    },
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      listExternalSessions: {
        invoke: (...args: any[]) => listExternalSessionsMock(...args),
      },
      getAvailableAgents: {
        invoke: (...args: any[]) => getAvailableAgentsMock(...args),
      },
      importExternalSession: {
        invoke: (...args: any[]) => importExternalSessionMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: vi.fn(),
  },
}));

vi.mock('@/renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => ({
    openTab: openTabMock,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

import ExternalSessionsModal from '@/renderer/pages/conversation/components/ExternalSessionsModal';

describe('ExternalSessionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listExternalSessionsMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            provider: 'claude',
            sessionId: 'claude-1',
            title: 'Claude Session',
            workspace: '/tmp/claude',
            updatedAt: 1_710_000_050_000,
          },
          {
            provider: 'codex',
            sessionId: 'codex-1',
            title: 'Codex Session',
            workspace: '/tmp/codex',
            updatedAt: 1_710_000_000_000,
          },
          {
            provider: 'gemini',
            sessionId: 'gemini-1',
            title: 'Gemini Session',
            workspace: '/tmp/gemini',
            updatedAt: 1_710_000_025_000,
          },
          {
            provider: 'opencode',
            sessionId: 'opencode-1',
            title: 'OpenCode Session',
            workspace: '/tmp/opencode',
            updatedAt: 1_710_000_200_000,
          },
          {
            provider: 'openclaw-gateway',
            sessionId: 'openclaw-main',
            title: 'OpenClaw Main Session',
            workspace: '/tmp/openclaw-main',
            updatedAt: 1_710_000_100_000,
            openclawAgentId: 'main',
            agentName: 'OpenClaw Main',
          },
          {
            provider: 'openclaw-gateway',
            sessionId: 'openclaw-dev',
            title: 'OpenClaw Dev Session',
            workspace: '/tmp/openclaw-dev',
            updatedAt: 1_710_000_150_000,
            openclawAgentId: 'dev',
            agentName: 'OpenClaw Dev',
          },
        ],
      },
    });
    getAvailableAgentsMock.mockResolvedValue({
      success: true,
      data: [
        {
          backend: 'openclaw-gateway',
          name: 'OpenClaw Main',
          openclawAgentId: 'main',
          workspace: '/agent/main',
        },
        {
          backend: 'openclaw-gateway',
          name: 'OpenClaw Dev (dev)',
          openclawAgentId: 'dev',
          workspace: '/agent/dev',
        },
        {
          backend: 'openclaw-gateway',
          name: 'OpenClaw Review (review)',
          openclawAgentId: 'review',
          workspace: '/agent/review',
        },
      ],
    });
    importExternalSessionMock.mockResolvedValue({ success: true });
  });

  it('filters external sessions by provider tabs', async () => {
    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Claude Session')).toBeInTheDocument();
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.getByText('Gemini Session')).toBeInTheDocument();
      expect(screen.getByText('OpenCode Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Main Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev Session')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));

    await waitFor(() => {
      expect(screen.getByText('Claude Session')).toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Dev Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.getByText('Gemini Session')).toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Dev Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'OpenCode' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.getByText('OpenCode Session')).toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Dev Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'OpenClaw' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
      expect(screen.getByText('OpenClaw Main Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Main')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev (dev)')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Review (review)')).toBeInTheDocument();
      expect(screen.getByText('/agent/main')).toBeInTheDocument();
      expect(screen.getByText('/agent/dev')).toBeInTheDocument();
      expect(screen.queryByText('/agent/review')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Dev Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByText('Claude Session')).toBeInTheDocument();
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.getByText('Gemini Session')).toBeInTheDocument();
      expect(screen.getByText('OpenCode Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Main Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev Session')).toBeInTheDocument();
    });
  });

  it('groups OpenClaw sessions by configured agent', async () => {
    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'OpenClaw' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'OpenClaw' }));

    await waitFor(() => {
      expect(screen.getByText('OpenClaw Main')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev (dev)')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Review (review)')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Main Session')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev Session')).toBeInTheDocument();
      expect(screen.getByText('/agent/main')).toBeInTheDocument();
      expect(screen.getByText('/agent/dev')).toBeInTheDocument();
      expect(screen.queryByText('/agent/review')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('OpenClaw Review (review)'));

    await waitFor(() => {
      expect(screen.getByText('/agent/review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('OpenClaw Main'));

    await waitFor(() => {
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
    });
  });

  it('groups OpenClaw sessions with mixed-case agent ids under the configured agent', async () => {
    listExternalSessionsMock.mockResolvedValueOnce({
      success: true,
      data: {
        sessions: [
          {
            provider: 'openclaw-gateway',
            sessionId: 'openclaw-dev-mixed',
            title: 'OpenClaw Dev Session',
            workspace: '/tmp/openclaw-dev',
            updatedAt: 1_710_000_150_000,
            openclawAgentId: 'DEV',
            agentName: 'OpenClaw Dev',
          },
        ],
      },
    });

    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'OpenClaw' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'OpenClaw' }));

    await waitFor(() => {
      expect(screen.getByText('OpenClaw Dev (dev)')).toBeInTheDocument();
      expect(screen.getByText('OpenClaw Dev Session')).toBeInTheDocument();
      expect(screen.getByText('/agent/dev')).toBeInTheDocument();
    });
  });
});
