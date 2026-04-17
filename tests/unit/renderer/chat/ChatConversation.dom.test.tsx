import type { TChatConversation } from '@/common/config/storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openPreviewMock = vi.fn();
const previewContextStateRef = {
  current: {
    isOpen: false,
    activeTab: null as null | {
      id: string;
      title: string;
      content: string;
      contentType: string;
      metadata?: {
        fileName?: string;
      };
    },
  },
};
const acpModelSelectorMock = vi.fn(() => <div data-testid='acp-model-selector' />);
const navigateMock = vi.fn();
const mockPrepareConversationPublicationInvoke = vi.fn();
const mockGetAssociateConversationInvoke = vi.fn();
const mockConversationWarmupInvoke = vi.fn();
const emitterEmitMock = vi.fn();

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    prepareConversationPublication: {
      invoke: (...args: unknown[]) => mockPrepareConversationPublicationInvoke(...args),
    },
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      getAssociateConversation: {
        invoke: (...args: unknown[]) => mockGetAssociateConversationInvoke(...args),
      },
      warmup: {
        invoke: (...args: unknown[]) => mockConversationWarmupInvoke(...args),
      },
      get: {
        invoke: vi.fn(),
      },
      update: {
        invoke: vi.fn(),
      },
      createWithConversation: {
        invoke: vi.fn(),
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    isOpen: previewContextStateRef.current.isOpen,
    activeTab: previewContextStateRef.current.activeTab,
    openPreview: openPreviewMock,
  }),
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: (...args: unknown[]) => emitterEmitMock(...args),
  },
}));

vi.mock('@/renderer/hooks/agent/usePresetAssistantInfo', () => ({
  usePresetAssistantInfo: (conversation?: TChatConversation) => ({
    info: conversation
      ? {
          name: `${conversation.type}-agent`,
          logo: undefined,
          isEmoji: false,
        }
      : undefined,
    isLoading: false,
  }),
}));

vi.mock('@/renderer/pages/schedule/components/ProjectAutomationModal', () => ({
  __esModule: true,
  default: ({ visible, conversation }: { visible: boolean; conversation: TChatConversation; onClose: () => void }) =>
    visible ? (
      <div data-testid='project-automation-modal'>
        <div>{conversation.id}</div>
      </div>
    ) : null,
}));

vi.mock('@/renderer/pages/conversation/ProjectSkillMarketModal', () => ({
  __esModule: true,
  default: ({ visible, workspacePath }: { visible: boolean; workspacePath: string; onClose: () => void }) =>
    visible ? (
      <div data-testid='project-skill-market-modal'>
        <div>{workspacePath}</div>
      </div>
    ) : null,
}));

vi.mock('@/renderer/pages/conversation/components/ChatLayout', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    headerLeft,
    headerExtra,
  }: {
    title?: React.ReactNode;
    children: React.ReactNode;
    headerLeft?: React.ReactNode;
    headerExtra?: React.ReactNode;
  }) => (
    <div data-testid='chat-layout'>
      <div data-testid='chat-layout-title'>{title}</div>
      <div data-testid='chat-layout-header-left'>{headerLeft}</div>
      <div data-testid='chat-layout-header-extra'>{headerExtra}</div>
      <div data-testid='chat-layout-children'>{children}</div>
    </div>
  ),
}));

vi.mock('@/renderer/pages/conversation/components/ChatSider', () => ({
  __esModule: true,
  default: () => <div data-testid='chat-sider' />,
}));

vi.mock('@/renderer/pages/conversation/platforms/acp/AcpChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='acp-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/codex/CodexChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='codex-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/nanobot/NanobotChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => (
    <div data-testid='nanobot-chat'>{conversation_id}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/openclaw/OpenClawChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => (
    <div data-testid='openclaw-chat'>{conversation_id}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/group/GroupChat', () => ({
  __esModule: true,
  default: ({ conversation }: { conversation: Extract<TChatConversation, { type: 'group' }> }) => (
    <div data-testid='group-chat'>{conversation.id}</div>
  ),
}));

vi.mock('@/renderer/components/agent/AcpModelSelector', () => ({
  __esModule: true,
  default: (props: unknown) => acpModelSelectorMock(props),
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/GeminiModelSelector', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean; selection?: unknown }) => (
    <div data-testid='gemini-model-selector'>{disabled ? 'disabled' : 'enabled'}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/useGeminiModelSelection', () => ({
  useGeminiModelSelection: () => ({
    currentModel: { id: 'gemini', useModel: 'gemini-2.5-pro' },
    providers: [],
    geminiModeLookup: new Map(),
    getAvailableModels: () => [],
    handleSelectModel: vi.fn(),
    formatModelLabel: () => 'Gemini 2.5 Pro',
  }),
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/GeminiChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='gemini-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/openclaw/StarOfficeMonitorCard.tsx', () => ({
  __esModule: true,
  default: () => <div data-testid='staroffice-monitor-card' />,
}));

vi.mock('@/renderer/pages/conversation/platforms/ConversationBrowserContextButton', () => ({
  __esModule: true,
  default: () => <div data-testid='browser-context-button' />,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button type='button' onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
  Dropdown: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Menu: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  }),
  Popover: ({ children, content }: { children?: React.ReactNode; content?: React.ReactNode }) => (
    <>
      {children}
      {content}
    </>
  ),
  Message: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Typography: {
    Ellipsis: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@icon-park/react', () => ({
  ConnectionPoint: () => <span data-testid='icon-connection-point' />,
  FolderOpen: () => <span data-testid='icon-folder-open' />,
  History: () => <span data-testid='icon-history' />,
  Search: () => <span data-testid='icon-search' />,
  SettingTwo: () => <span data-testid='icon-setting-two' />,
}));

import ChatConversation from '@/renderer/pages/conversation/components/ChatConversation';

const createConversation = (type: TChatConversation['type'], id: string): TChatConversation =>
  ({
    id,
    type,
    name: `${type}-${id}`,
    extra: {
      workspace: `/tmp/${id}`,
    },
    model: {
      id: 'provider-1',
      name: 'Provider One',
      platform: type,
      useModel: `${type}-model`,
    },
  }) as TChatConversation;

describe('ChatConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewContextStateRef.current = {
      isOpen: false,
      activeTab: null,
    };
    mockConversationWarmupInvoke.mockResolvedValue(undefined);
    mockGetAssociateConversationInvoke.mockResolvedValue([]);
    mockPrepareConversationPublicationInvoke.mockResolvedValue({
      success: true,
      data: {
        id: 'agent-profile-1',
      },
    });
  });

  it('keeps hook order stable when switching from a gemini conversation to a non-gemini conversation', () => {
    const geminiConversation = createConversation('gemini', 'gemini-1') as Extract<
      TChatConversation,
      { type: 'gemini' }
    >;
    const acpConversation = createConversation('acp', 'acp-1');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { rerender } = render(<ChatConversation conversation={geminiConversation} />);

      expect(screen.getByTestId('gemini-chat')).toHaveTextContent('gemini-1');

      expect(() => {
        rerender(<ChatConversation conversation={acpConversation} />);
      }).not.toThrow();

      expect(screen.getByTestId('acp-chat')).toHaveTextContent('acp-1');
      expect(
        consoleErrorSpy.mock.calls.some((args) =>
          args.some((arg) => String(arg).includes('Rendered more hooks than during the previous render'))
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('passes the codex backend and persisted model into the shared model selector', () => {
    const conversation = {
      ...createConversation('codex', 'codex-1'),
      extra: {
        workspace: '/tmp/codex-1',
        codexModel: 'gpt-5',
      },
    } as Extract<TChatConversation, { type: 'codex' }>;

    render(<ChatConversation conversation={conversation} />);

    expect(acpModelSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'codex-1',
        backend: 'codex',
        initialModelId: 'gpt-5',
      })
    );
  });

  it('falls back to conversation.model.useModel for imported acp sessions without extra.currentModelId', () => {
    const conversation = {
      ...createConversation('acp', 'acp-import-1'),
      extra: {
        workspace: '/tmp/acp-import-1',
        backend: 'claude',
      },
      model: {
        id: 'provider-1',
        name: 'Provider One',
        platform: 'anthropic',
        useModel: 'claude-sonnet-4-6',
      },
    } as TChatConversation;

    render(<ChatConversation conversation={conversation} />);

    expect(acpModelSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'acp-import-1',
        backend: 'claude',
        initialModelId: 'claude-sonnet-4-6',
      })
    );
  });

  it('warms imported external acp sessions on first render so model info can hydrate early', async () => {
    const conversation = {
      ...createConversation('acp', 'acp-import-warmup'),
      extra: {
        workspace: '/tmp/acp-import-warmup',
        backend: 'claude',
        externalSessionImported: true,
      },
    } as TChatConversation;

    render(<ChatConversation conversation={conversation} />);

    await waitFor(() => {
      expect(mockConversationWarmupInvoke).toHaveBeenCalledWith({
        conversation_id: 'acp-import-warmup',
      });
    });
  });

  it('falls back to conversation.model.useModel for legacy codex sessions without extra.codexModel', () => {
    const conversation = {
      ...createConversation('codex', 'codex-import-1'),
      extra: {
        workspace: '/tmp/codex-import-1',
      },
      model: {
        id: 'provider-1',
        name: 'Provider One',
        platform: 'codex',
        useModel: 'gpt-5.4',
      },
    } as Extract<TChatConversation, { type: 'codex' }>;

    render(<ChatConversation conversation={conversation} />);

    expect(acpModelSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'codex-import-1',
        backend: 'codex',
        initialModelId: 'gpt-5.4',
      })
    );
  });

  it('renders the browser capability addon even before a browser context is bound', () => {
    render(<ChatConversation conversation={createConversation('acp', 'acp-no-browser')} />);

    expect(screen.getByTestId('browser-context-button')).toBeInTheDocument();
  });

  it('renders the browser context header button when the conversation is already bound to a browser context', () => {
    const conversation = {
      ...createConversation('acp', 'acp-browser-bound'),
      extra: {
        workspace: '/tmp/acp-browser-bound',
        browserContextAssetId: 'asset-1',
      },
    } as TChatConversation;

    render(<ChatConversation conversation={conversation} />);

    expect(screen.getByTestId('browser-context-button')).toBeInTheDocument();
  });

  it('shows the workspace capability surface state when the conversation has a workspace', () => {
    const conversation = {
      ...createConversation('acp', 'acp-workspace-capability'),
      extra: {
        workspace: '/tmp/capability-workspace',
        backend: 'claude',
      },
    } as TChatConversation;

    render(<ChatConversation conversation={conversation} />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText(/capability-workspace/i)).toBeInTheDocument();
  });

  it('shows the preview capability surface state when preview is currently open', () => {
    previewContextStateRef.current = {
      isOpen: true,
      activeTab: {
        id: 'preview-1',
        title: 'README.md',
        content: '# README',
        contentType: 'markdown',
        metadata: {
          fileName: 'README.md',
        },
      },
    };

    render(<ChatConversation conversation={createConversation('acp', 'acp-preview-capability')} />);

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('writes publication intent into url search when opening the agent publish page', async () => {
    const conversation = {
      ...createConversation('acp', 'acp-publish-1'),
      name: 'Workspace triage',
      extra: {
        workspace: '/tmp/publish',
        backend: 'openclaw-gateway',
        customAgentId: 'agent-custom-1',
        agentName: 'Support Agent',
      },
    } as TChatConversation;

    render(<ChatConversation conversation={conversation} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.header.publishAgentEntry' }));

    await waitFor(() => {
      expect(mockPrepareConversationPublicationInvoke).toHaveBeenCalledWith({
        conversationId: 'acp-publish-1',
      });
      expect(navigateMock).toHaveBeenCalledWith(
        {
          pathname: '/settings/agent-publish',
          search:
            '?agentProfileId=agent-profile-1&conversationId=acp-publish-1&conversationName=Workspace+triage&backend=openclaw-gateway&customAgentId=agent-custom-1&workspace=%2Ftmp%2Fpublish&agentName=Support+Agent',
        },
        {
          state: {
            agentPublishFocus: 'publication',
            publicationIntent: {
              agentProfileId: 'agent-profile-1',
              conversationId: 'acp-publish-1',
              conversationName: 'Workspace triage',
              backend: 'openclaw-gateway',
              customAgentId: 'agent-custom-1',
              workspace: '/tmp/publish',
              agentName: 'Support Agent',
            },
          },
        }
      );
    });
  });

  it('does not render standalone hooks or schedule header entries anymore', () => {
    const conversation = createConversation('acp', 'acp-hooks-1');

    render(<ChatConversation conversation={conversation} />);

    expect(screen.queryByRole('button', { name: 'conversation.workspace.sessionHooksOpen' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('schedule-job-manager')).not.toBeInTheDocument();
  });

  it('renders the project automation entry for workspace-backed conversations', () => {
    const conversation = createConversation('acp', 'acp-automation-1');

    render(<ChatConversation conversation={conversation} />);

    expect(screen.getByRole('button', { name: 'conversation.workspace.automation.action' })).toBeInTheDocument();
  });

  it('renders the project skill market entry for workspace-backed conversations', () => {
    const conversation = createConversation('acp', 'acp-skill-market-1');

    render(<ChatConversation conversation={conversation} />);

    expect(screen.getByRole('button', { name: 'conversation.workspace.skillMarket.action' })).toBeInTheDocument();
  });

  it('opens the project automation modal from the header entry', async () => {
    const conversation = createConversation('acp', 'acp-automation-open');

    render(<ChatConversation conversation={conversation} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.automation.action' }));

    await waitFor(() => {
      expect(screen.getByTestId('project-automation-modal')).toHaveTextContent('acp-automation-open');
    });
  });

  it('opens the project skill market modal from the header entry', async () => {
    const conversation = createConversation('acp', 'acp-skill-market-open');

    render(<ChatConversation conversation={conversation} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.skillMarket.action' }));

    await waitFor(() => {
      expect(screen.getByTestId('project-skill-market-modal')).toHaveTextContent('/tmp/acp-skill-market-open');
    });
  });

  it('opens the unified automation modal without delegating to a separate hooks drawer event', async () => {
    const conversation = createConversation('acp', 'acp-automation-hooks');

    render(<ChatConversation conversation={conversation} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.automation.action' }));

    await waitFor(() => {
      expect(screen.getByTestId('project-automation-modal')).toBeInTheDocument();
    });

    expect(emitterEmitMock).not.toHaveBeenCalledWith('conversation.session-hooks.open', 'acp-automation-hooks');
  });
});
