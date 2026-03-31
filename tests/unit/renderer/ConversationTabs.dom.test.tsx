import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useLayoutContextMock = vi.fn();
const useConversationTabsMock = vi.fn();
const useSWRMock = vi.fn();
const configStorageGetMock = vi.fn();
const navigateMock = vi.fn();
const useParamsMock = vi.fn();
const closePreviewMock = vi.fn();
const getModelInfoInvokeMock = vi.fn();
const setModelInvokeMock = vi.fn();
const responseStreamOnMock = vi.fn(() => vi.fn());
const openclawGetModelInfoInvokeMock = vi.fn();
const openclawSetModelInvokeMock = vi.fn();
const openclawResponseStreamOnMock = vi.fn(() => vi.fn());
const openclawGetRuntimeInvokeMock = vi.fn();
const getModelConfigInvokeMock = vi.fn();
const messageErrorMock = vi.fn();
let acpResponseStreamHandler: ((message: { conversation_id?: string; type: string; data?: unknown }) => void) | null =
  null;
const chatConversationMock = vi.fn(({ conversation }: { conversation: { name: string } }) => (
  <div data-testid='chat-conversation'>{conversation.name}</div>
));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      create: { invoke: vi.fn() },
    },
    acpConversation: {
      getModelInfo: { invoke: (...args: unknown[]) => getModelInfoInvokeMock(...args) },
      setModel: { invoke: (...args: unknown[]) => setModelInvokeMock(...args) },
      responseStream: { on: (...args: unknown[]) => responseStreamOnMock(...args) },
    },
    openclawConversation: {
      getModelInfo: { invoke: (...args: unknown[]) => openclawGetModelInfoInvokeMock(...args) },
      setModel: { invoke: (...args: unknown[]) => openclawSetModelInvokeMock(...args) },
      responseStream: { on: (...args: unknown[]) => openclawResponseStreamOnMock(...args) },
      getRuntime: { invoke: (...args: unknown[]) => openclawGetRuntimeInvokeMock(...args) },
    },
    mode: {
      getModelConfig: { invoke: (...args: unknown[]) => getModelConfigInvokeMock(...args) },
    },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: (...args: unknown[]) => configStorageGetMock(...args),
  },
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => useLayoutContextMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => useConversationTabsMock(),
}));

vi.mock('@/renderer/hooks/agent/usePresetAssistantInfo', () => ({
  usePresetAssistantInfo: () => ({ info: null }),
}));

vi.mock('@/renderer/pages/conversation/hooks/useConversationAgents', () => ({
  useConversationAgents: () => ({
    cliAgents: [],
    presetAssistants: [],
    isLoading: false,
  }),
}));

vi.mock('@/renderer/utils/model/agentLogo', () => ({
  getAgentLogo: () => undefined,
  getModelLogo: () => undefined,
  getModelDisplayLabel: ({ selectedLabel, fallbackLabel }: { selectedLabel?: string; fallbackLabel: string }) =>
    selectedLabel || fallbackLabel,
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: { emit: vi.fn() },
}));

vi.mock('@/renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
}));

vi.mock('@/renderer/utils/workspace/workspaceHistory', () => ({
  updateWorkspaceTime: vi.fn(),
}));

vi.mock('@/renderer/pages/guid/constants', () => ({
  CUSTOM_AVATAR_IMAGE_MAP: {},
}));

vi.mock('@/renderer/pages/conversation/utils/newConversationName', () => ({
  applyDefaultConversationName: vi.fn((value) => value),
}));

vi.mock('@/renderer/pages/conversation/utils/createConversationParams', () => ({
  buildCliAgentParams: vi.fn(),
  buildPresetAssistantParams: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => useParamsMock(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN' },
  }),
}));

vi.mock('@icon-park/react', () => ({
  Brain: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>brain</span>,
  Close: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>close</span>,
  MessageOne: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>message</span>,
  Plus: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>plus</span>,
  Robot: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>robot</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    title,
    className,
    style,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    title?: string;
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button title={title} className={className} style={style} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Dropdown: ({ children, droplist }: { children: React.ReactNode; droplist?: React.ReactNode }) => (
    <>
      {children}
      {droplist}
    </>
  ),
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Menu: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Item: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
    }) => (
      <button type='button' className={className} onClick={onClick}>
        {children}
      </button>
    ),
    ItemGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Message: {
    error: (...args: unknown[]) => messageErrorMock(...args),
  },
  Spin: ({ loading }: { loading?: boolean }) => (loading ? <div>loading</div> : null),
}));

vi.mock('swr', () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    isOpen: false,
    closePreview: closePreviewMock,
  }),
}));

vi.mock('@/renderer/pages/conversation/Preview/context', () => ({
  usePreviewContext: () => ({
    isOpen: false,
    closePreview: closePreviewMock,
  }),
}));

vi.mock('@/renderer/pages/conversation/components/ChatConversation', () => ({
  default: (props: { conversation: { name: string } }) => chatConversationMock(props),
}));

import ChatConversationIndex from '@/renderer/pages/conversation';
import AcpModelSelector from '@/renderer/components/agent/AcpModelSelector';
import ConversationTabs, {
  resolveConversationTabDensity,
  resolveConversationTabWidth,
} from '@/renderer/pages/conversation/components/ConversationTabs';
import GeminiModelSelector from '@/renderer/pages/conversation/platforms/gemini/GeminiModelSelector';

describe('ConversationTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    useParamsMock.mockReturnValue({ id: 'conv-1' });
    useSWRMock.mockImplementation((key: unknown) => {
      if (key === 'model.config') {
        return {
          data: [
            {
              id: 'provider-1',
              name: 'Claude',
              platform: 'claude',
              model: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
              modelHealth: {
                'claude-3.7-sonnet': {
                  status: 'healthy',
                },
              },
            },
          ],
          isLoading: false,
        };
      }

      return {
        data: {
          id: 'conv-1',
          name: 'OpenClaw Session',
          type: 'openclaw-gateway',
          workspace: '/tmp/workspace',
          extra: { backend: 'openclaw-gateway' },
        },
        isLoading: false,
      };
    });
    configStorageGetMock.mockResolvedValue(undefined);
    getModelInfoInvokeMock.mockResolvedValue({
      success: true,
      data: {
        modelInfo: {
          source: 'models',
          currentModelId: 'claude-3.7-sonnet',
          currentModelLabel: 'claude-3.7-sonnet',
          canSwitch: true,
          availableModels: [{ id: 'claude-3.7-sonnet', label: 'claude-3.7-sonnet' }],
        },
      },
    });
    openclawGetModelInfoInvokeMock.mockResolvedValue({
      success: true,
      data: {
        modelInfo: {
          source: 'models',
          currentModelId: 'claude-3.7-sonnet',
          currentModelLabel: 'claude-3.7-sonnet',
          canSwitch: true,
          switchSupported: true,
          availableModels: [
            { id: 'claude-3.7-sonnet', label: 'claude-3.7-sonnet' },
            { id: 'claude-3.5-haiku', label: 'claude-3.5-haiku' },
          ],
        },
      },
    });
    openclawSetModelInvokeMock.mockResolvedValue({ success: true, data: { modelInfo: null } });
    openclawResponseStreamOnMock.mockReturnValue(vi.fn());
    openclawGetRuntimeInvokeMock.mockResolvedValue({
      success: true,
      data: {
        conversationId: 'conv-openclaw',
        runtime: {
          modelProvider: 'claude',
          model: 'claude-3.7-sonnet',
        },
      },
    });
    setModelInvokeMock.mockResolvedValue({ success: true, data: { modelInfo: null } });
    acpResponseStreamHandler = null;
    responseStreamOnMock.mockImplementation(
      (listener: (message: { conversation_id?: string; type: string; data?: unknown }) => void) => {
        acpResponseStreamHandler = listener;
        return vi.fn();
      }
    );
    getModelConfigInvokeMock.mockResolvedValue([
      {
        id: 'provider-1',
        name: 'Claude',
        platform: 'claude',
        model: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
        modelHealth: {
          'claude-3.7-sonnet': {
            status: 'healthy',
          },
        },
      },
    ]);
    useConversationTabsMock.mockReturnValue({
      openTabs: [
        {
          id: 'conv-1',
          name: 'OpenClaw Session',
          type: 'openclaw-gateway',
          workspace: '/tmp/workspace',
          extra: { backend: 'openclaw-gateway' },
        },
      ],
      activeTabId: 'conv-1',
      switchTab: vi.fn(),
      closeTab: vi.fn(),
      closeAllTabs: vi.fn(),
      closeTabsToLeft: vi.fn(),
      closeTabsToRight: vi.fn(),
      closeOtherTabs: vi.fn(),
      openTabsForConversations: vi.fn(),
    });
  });

  it('uses full-height alignment classes on desktop header', () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });

    const { container } = render(<ConversationTabs showHeaderActions={false} />);
    const root = container.firstElementChild;
    const inner = root?.firstElementChild;

    expect(root?.className).toContain('h-full');
    expect(root?.className).toContain('w-full');
    expect(root?.className).toContain('max-w-full');
    expect(root?.className).toContain('items-center');
    expect(inner?.className).toContain('h-full');
    expect(inner?.className).toContain('max-w-full');
    expect(screen.getByText('OpenClaw Session')).toBeInTheDocument();
  });

  it('keeps the compact mobile wrapper sizing on mobile', () => {
    useLayoutContextMock.mockReturnValue({ isMobile: true });

    const { container } = render(<ConversationTabs showHeaderActions={false} />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('min-h-42px');
    expect(root?.className).toContain('py-4px');
  });

  it('switches to icon density when desktop tabs become crowded', () => {
    expect(
      resolveConversationTabDensity({
        isMobile: false,
        openTabsCount: 12,
        containerWidth: 0,
        showHeaderActions: true,
      })
    ).toBe('icon');
  });

  it('shrinks desktop density with the chat slot width even without header actions', () => {
    expect(
      resolveConversationTabDensity({
        isMobile: false,
        openTabsCount: 7,
        containerWidth: 220,
        showHeaderActions: false,
      })
    ).toBe('icon');
    expect(
      resolveConversationTabDensity({
        isMobile: false,
        openTabsCount: 7,
        containerWidth: 920,
        showHeaderActions: false,
      })
    ).toBe('full');
  });

  it('shrinks desktop tab width with the available chat slot width', () => {
    expect(
      resolveConversationTabWidth({
        density: 'full',
        openTabsCount: 5,
        containerWidth: 620,
        showHeaderActions: false,
      })
    ).toBe(120);
    expect(
      resolveConversationTabWidth({
        density: 'full',
        openTabsCount: 5,
        containerWidth: 1020,
        showHeaderActions: false,
      })
    ).toBe(184);
  });

  it('renders icon-only tabs when there are many desktop tabs and uses close icon for the active tab', () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });
    useConversationTabsMock.mockReturnValue({
      openTabs: Array.from({ length: 12 }, (_, index) => ({
        id: `conv-${index + 1}`,
        name: `Session ${index + 1}`,
        type: 'openclaw-gateway',
        workspace: `/tmp/workspace-${index + 1}`,
        extra: { backend: 'openclaw-gateway' },
      })),
      activeTabId: 'conv-1',
      switchTab: vi.fn(),
      closeTab: vi.fn(),
      closeAllTabs: vi.fn(),
      closeTabsToLeft: vi.fn(),
      closeTabsToRight: vi.fn(),
      closeOtherTabs: vi.fn(),
    });

    const { container } = render(<ConversationTabs showHeaderActions={false} />);
    const tabs = container.querySelectorAll('[data-density="icon"]');
    const activeTab = container.querySelector('[data-density="icon"][aria-label="Session 1"]');

    expect(tabs.length).toBe(12);
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument();
    expect(activeTab).toHaveTextContent('close');
    expect(activeTab).not.toHaveTextContent('message');
  });

  it('closes stale tabs and redirects when the active conversation no longer exists', async () => {
    const closeTabMock = vi.fn();
    const openTabsForConversationsMock = vi.fn();
    useParamsMock.mockReturnValue({ id: 'missing-conv' });
    useSWRMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    useConversationTabsMock.mockReturnValue({
      openTabs: [],
      activeTabId: null,
      switchTab: vi.fn(),
      closeTab: closeTabMock,
      closeAllTabs: vi.fn(),
      closeTabsToLeft: vi.fn(),
      closeTabsToRight: vi.fn(),
      closeOtherTabs: vi.fn(),
      openTabsForConversations: openTabsForConversationsMock,
    });

    render(<ChatConversationIndex />);

    await waitFor(() => {
      expect(closeTabMock).toHaveBeenCalledWith('missing-conv');
    });
    expect(navigateMock).toHaveBeenCalledWith('/guid', { replace: true });
    expect(openTabsForConversationsMock).not.toHaveBeenCalled();
    expect(chatConversationMock).not.toHaveBeenCalled();
  });

  it('keeps a native title on the ACP model button for hover text', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });

    const { container } = render(
      <AcpModelSelector conversationId='conv-acp' backend='claude' initialModelId='claude-3.7-sonnet' />
    );

    await waitFor(() => {
      const button = container.querySelector('button[title="claude-3.7-sonnet"]');
      expect(button).toBeTruthy();
    });
  });

  it('keeps Codex model selector clickable after a stream update without model list', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });
    getModelInfoInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        modelInfo: {
          source: 'models',
          currentModelId: 'gpt-5',
          currentModelLabel: 'gpt-5',
          canSwitch: true,
          availableModels: [
            { id: 'gpt-5', label: 'GPT-5' },
            { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
          ],
        },
      },
    });

    const { container } = render(
      <AcpModelSelector conversationId='conv-codex' backend='codex' initialModelId='gpt-5' />
    );

    await waitFor(() => {
      const button = container.querySelector('button[title="gpt-5"]');
      expect(button).toBeTruthy();
      expect(button?.hasAttribute('disabled')).toBe(false);
    });

    acpResponseStreamHandler?.({
      conversation_id: 'conv-codex',
      type: 'acp_model_info',
      data: {
        source: 'models',
        currentModelId: 'gpt-5',
        currentModelLabel: 'gpt-5',
        canSwitch: false,
        availableModels: [],
      },
    });

    await waitFor(() => {
      const button = container.querySelector('button[title="gpt-5"]');
      expect(button).toBeTruthy();
      expect(button?.hasAttribute('disabled')).toBe(false);
    });

    expect(screen.getByText('GPT-5 Mini')).toBeInTheDocument();
  });

  it('clears stale OpenClaw model entries when switching the selector to a Codex conversation', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });

    const { rerender } = render(
      <AcpModelSelector conversationId='conv-openclaw' backend='openclaw-gateway' initialModelId='claude-3.7-sonnet' />
    );

    await waitFor(() => {
      expect(screen.getByText('claude-3.5-haiku')).toBeInTheDocument();
    });

    getModelInfoInvokeMock.mockResolvedValueOnce({
      success: false,
      data: {
        modelInfo: null,
      },
    });

    rerender(<AcpModelSelector conversationId='conv-codex' backend='codex' initialModelId='gpt-5' />);

    await waitFor(() => {
      expect(screen.queryByText('claude-3.5-haiku')).not.toBeInTheDocument();
    });
  });

  it('keeps OpenClaw model selector clickable when backend returns configured models', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });

    const { container } = render(
      <AcpModelSelector conversationId='conv-openclaw' backend='openclaw-gateway' initialModelId='claude-3.7-sonnet' />
    );

    await waitFor(() => {
      const button = container.querySelector('button[title="claude-3.7-sonnet"]');
      expect(button).toBeTruthy();
      expect(button?.hasAttribute('disabled')).toBe(false);
    });

    expect(openclawResponseStreamOnMock).toHaveBeenCalledTimes(1);
    expect(openclawGetModelInfoInvokeMock).toHaveBeenCalledWith({ conversation_id: 'conv-openclaw' });
  });

  it('keeps OpenClaw model selector read-only when gateway does not support switching', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });
    openclawGetModelInfoInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        modelInfo: {
          source: 'models',
          currentModelId: 'claude-3.7-sonnet',
          currentModelLabel: 'claude-3.7-sonnet',
          canSwitch: false,
          switchSupported: false,
          availableModels: [{ id: 'claude-3.7-sonnet', label: 'claude-3.7-sonnet' }],
        },
      },
    });

    const { container } = render(
      <AcpModelSelector conversationId='conv-openclaw' backend='openclaw-gateway' initialModelId='claude-3.7-sonnet' />
    );

    await waitFor(() => {
      const wrapper = container.querySelector('span[title="conversation.chat.modelSwitchNotSupported"]');
      const button = wrapper?.querySelector('button');
      expect(button).toBeTruthy();
      expect(button?.hasAttribute('disabled')).toBe(true);
    });

    expect(screen.queryByText('claude-3.5-haiku')).not.toBeInTheDocument();
  });

  it('shows an error when OpenClaw model switching fails', async () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });
    openclawSetModelInvokeMock.mockResolvedValueOnce({
      success: false,
      msg: 'Current OpenClaw Gateway does not support model switching',
    });

    render(
      <AcpModelSelector conversationId='conv-openclaw' backend='openclaw-gateway' initialModelId='claude-3.7-sonnet' />
    );

    const alternativeModel = await screen.findByText('claude-3.5-haiku');
    fireEvent.click(alternativeModel);

    await waitFor(() => {
      expect(openclawSetModelInvokeMock).toHaveBeenCalledWith({
        conversation_id: 'conv-openclaw',
        modelId: 'claude-3.5-haiku',
      });
    });
    expect(messageErrorMock).toHaveBeenCalledWith('Current OpenClaw Gateway does not support model switching');
  });

  it('keeps a native title on the Gemini model button for hover text', () => {
    useLayoutContextMock.mockReturnValue({ isMobile: false });

    const selection = {
      currentModel: {
        id: 'provider-1',
        name: 'Claude Provider',
        platform: 'claude',
        useModel: 'claude-3.7-sonnet',
      },
      providers: [],
      geminiModeLookup: new Map(),
      getAvailableModels: vi.fn(() => []),
      handleSelectModel: vi.fn(),
      formatModelLabel: vi.fn(() => 'claude-3.7-sonnet'),
    };

    const { container } = render(<GeminiModelSelector selection={selection} />);

    expect(container.querySelector('button[title="claude-3.7-sonnet"]')).toBeTruthy();
  });
});
