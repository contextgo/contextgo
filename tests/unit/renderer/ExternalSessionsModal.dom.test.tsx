import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExternalSessionsMock = vi.fn();
const importExternalSessionMock = vi.fn();
const openTabMock = vi.fn();
const navigateMock = vi.fn();
const messageErrorMock = vi.fn();

type MockTabsProps = {
  activeTab?: string;
  onChange?: (key: string) => void;
  children?: React.ReactNode;
};

type MockButtonProps = React.PropsWithChildren<
  {
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>;

type MockChildrenProps = {
  children?: React.ReactNode;
};

type MockModalProps = {
  visible?: boolean;
  children?: React.ReactNode;
  title?: React.ReactNode;
};

const normalizeTabKey = (value: string | null): string => (value ? value.replace(/^\.\$/, '') : '');

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
          'guid.externalSessions.filters.all': 'All',
        }) as Record<string, string>
      )[key] ?? (key === 'guid.externalSessions.updatedAt' ? `Updated ${options?.time ?? ''}` : key),
  }),
}));

vi.mock('@icon-park/react', () => ({
  Refresh: () => <span data-testid='refresh-icon' />,
}));

vi.mock('@arco-design/web-react', () => {
  const Tabs = ({ activeTab, onChange, children }: MockTabsProps) => {
    const panes = React.Children.toArray(children) as React.ReactElement[];
    return (
      <div>
        <div>
          {panes.map((pane) => (
            <button key={String(pane.key)} type='button' onClick={() => onChange?.(normalizeTabKey(String(pane.key)))}>
              {pane.props.title}
            </button>
          ))}
        </div>
        <div>{panes.find((pane) => normalizeTabKey(String(pane.key)) === String(activeTab))?.props.children}</div>
      </div>
    );
  };

  Tabs.TabPane = ({ children }: MockChildrenProps) => <>{children}</>;

  return {
    Button: ({ children, onClick, disabled, loading, icon, ...rest }: MockButtonProps) => (
      <button type='button' onClick={onClick} disabled={disabled || loading} {...rest}>
        {icon}
        {children}
      </button>
    ),
    Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    Message: {
      useMessage: () => [
        {
          error: (message: unknown) => messageErrorMock(message),
          success: vi.fn(),
        },
        <div key='message-context' />,
      ],
    },
    Modal: ({ visible, children, title }: MockModalProps) =>
      visible ? (
        <div>
          <div>{title}</div>
          {children}
        </div>
      ) : null,
    Tabs,
    Tag: ({ children }: MockChildrenProps) => <span>{children}</span>,
    Typography: {
      Paragraph: ({ children }: MockChildrenProps) => <p>{children}</p>,
    },
  };
});

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      listExternalSessions: {
        invoke: (...args: unknown[]) => listExternalSessionsMock(...args),
      },
      importExternalSession: {
        invoke: (...args: unknown[]) => importExternalSessionMock(...args),
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
            modelProvider: 'anthropic',
            model: 'claude-sonnet-4-6',
          },
          {
            provider: 'codex',
            sessionId: 'codex-1',
            title: 'Codex Session',
            workspace: '/tmp/codex',
            updatedAt: 1_710_000_000_000,
            modelProvider: 'ttadk',
            model: 'gpt-5.4',
            reasoningEffort: 'high',
          },
          {
            provider: 'gemini',
            sessionId: 'gemini-1',
            title: 'Gemini Session',
            workspace: '/tmp/gemini',
            updatedAt: 1_710_000_025_000,
            model: 'gemini-3-flash-preview',
          },
          {
            provider: 'opencode',
            sessionId: 'opencode-1',
            title: 'OpenCode Session',
            workspace: '/tmp/opencode',
            updatedAt: 1_710_000_200_000,
            reasoningEffort: 'medium',
          },
        ],
      },
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
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));

    await waitFor(() => {
      expect(screen.getByText('Claude Session')).toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.getByText('Gemini Session')).toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'OpenCode' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Codex Session')).not.toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.getByText('OpenCode Session')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));

    await waitFor(() => {
      expect(screen.queryByText('Claude Session')).not.toBeInTheDocument();
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.queryByText('Gemini Session')).not.toBeInTheDocument();
      expect(screen.queryByText('OpenCode Session')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByText('Claude Session')).toBeInTheDocument();
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.getByText('Gemini Session')).toBeInTheDocument();
      expect(screen.getByText('OpenCode Session')).toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Main Session')).not.toBeInTheDocument();
    });
  });

  it('keeps legacy providers hidden even when discovery returns them', async () => {
    listExternalSessionsMock.mockResolvedValueOnce({
      success: true,
      data: {
        sessions: [
          {
            provider: 'codex',
            sessionId: 'codex-1',
            title: 'Codex Session',
            workspace: '/tmp/codex',
            updatedAt: 1_710_000_000_000,
          },
          {
            provider: 'openclaw-gateway',
            sessionId: 'openclaw-legacy',
            title: 'OpenClaw Legacy Session',
            workspace: '/tmp/openclaw',
            updatedAt: 1_710_000_100_000,
          },
        ],
      },
    });

    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Codex Session')).toBeInTheDocument();
      expect(screen.queryByText('OpenClaw Legacy Session')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'OpenClaw' })).not.toBeInTheDocument();
    });
  });

  it('shows an error toast when session scanning fails', async () => {
    listExternalSessionsMock.mockResolvedValueOnce({
      success: false,
      msg: 'boom',
    });

    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('Failed to scan external sessions.');
    });
  });

  it('renders detected model metadata on session cards', async () => {
    render(<ExternalSessionsModal visible onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
      expect(screen.getByText('ttadk')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
      expect(screen.getByText('gemini-3-flash-preview')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });
  });
});
