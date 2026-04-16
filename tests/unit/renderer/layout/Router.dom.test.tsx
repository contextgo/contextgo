import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseConversationTabs = vi.fn();
const mockGetConversation = vi.fn();

const mountStats = {
  mounts: 0,
  unmounts: 0,
};

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
  }),
}));

vi.mock('@renderer/hooks/context/ConversationHistoryContext', () => ({
  ConversationHistoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => mockUseConversationTabs(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getUserConversations: {
        invoke: vi.fn().mockResolvedValue([]),
      },
    },
    conversation: {
      get: {
        invoke: (...args: unknown[]) => mockGetConversation(...args),
      },
    },
  },
}));

vi.mock('@renderer/components/layout/AppLoader', () => ({
  default: () => <div data-testid='app-loader'>loading</div>,
}));

vi.mock('@renderer/components/layout/Sider', () => ({
  default: () => <div data-testid='mock-sider'>sider</div>,
}));

vi.mock('@/renderer/components/layout/Layout', () => ({
  default: () => (
    <div data-testid='layout'>
      <Outlet />
    </div>
  ),
}));

vi.mock('@renderer/utils/ui/clipboard', () => ({
  copyText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover', () => ({
  CONVERSATION_SEARCH_ROUTE: '/conversation-search',
  ConversationSearchPage: () => <div>search</div>,
}));

vi.mock('@renderer/components/layout/routerLocation', () => ({
  getLastStableHashRoute: () => '/guid',
  normalizeHashRouteShellHref: (href: string) => href,
  rememberStableHashRoute: vi.fn(),
  warmCriticalRendererRoutes: vi.fn(),
}));

vi.mock('@renderer/pages/conversation', () => ({
  default: () => {
    const { id } = useParams();

    React.useEffect(() => {
      mountStats.mounts += 1;
      return () => {
        mountStats.unmounts += 1;
      };
    }, []);

    return <div data-testid='conversation-page'>{id}</div>;
  },
}));

vi.mock('@renderer/pages/guid', () => ({
  default: () => <div>guid</div>,
}));

vi.mock('@renderer/pages/RemoteDevicesPage', () => ({
  default: () => <div>remote-devices</div>,
}));

vi.mock('@renderer/pages/connectors', () => ({
  default: () => <div>connectors</div>,
}));

vi.mock('@renderer/pages/schedule/GlobalScheduleSettings', () => ({
  default: () => <div>schedule</div>,
}));

vi.mock('@renderer/pages/settings/AgentSettings', () => ({
  default: () => {
    const location = useLocation();
    return <div data-testid='agent-settings-route'>{location.pathname}</div>;
  },
}));

vi.mock('@renderer/pages/agents', () => ({
  default: () => {
    const location = useLocation();
    return <div data-testid='agents-route'>{location.pathname}</div>;
  },
}));

vi.mock('@renderer/pages/settings/AgentSettings/AgentEntrySettings', () => ({
  default: () => <div>agent-entry-settings</div>,
}));

vi.mock('@renderer/pages/settings/AgentSettings/HooksManagement', () => ({
  default: () => <div>hooks</div>,
}));

vi.mock('@renderer/pages/settings/SkillsHubSettings', () => ({
  default: () => <div>skills-hub</div>,
}));

vi.mock('@renderer/pages/settings/DisplaySettings', () => ({
  default: () => <div>display-settings</div>,
}));

vi.mock('@renderer/pages/settings/GeminiSettings', () => ({
  default: () => <div>gemini-settings</div>,
}));

vi.mock('@renderer/pages/settings/ModeSettings', () => ({
  default: () => <div>mode-settings</div>,
}));

vi.mock('@renderer/pages/settings/SystemSettings', () => ({
  default: () => <div>system-settings</div>,
}));

vi.mock('@renderer/pages/settings/ToolsSettings', () => ({
  default: () => <div>tools-settings</div>,
}));

vi.mock('@renderer/pages/settings/ToolsSettings/CommandSettings', () => ({
  default: () => <div>command-settings</div>,
}));

vi.mock('@renderer/pages/settings/WebuiSettings', () => ({
  default: () => <div>webui-settings</div>,
}));

vi.mock('@renderer/pages/settings/ExtensionSettingsPage', () => ({
  default: () => <div>extension-settings</div>,
}));

vi.mock('@renderer/pages/login', () => ({
  default: () => <div>login</div>,
}));

vi.mock('@renderer/pages/TestShowcase', () => ({
  default: () => <div>showcase</div>,
}));

import Router from '@/renderer/components/layout/Router';

const renderRouter = () => {
  return render(
    <Router
      renderLayout={() => (
        <div data-testid='layout'>
          <Outlet />
        </div>
      )}
    />
  );
};

describe('Router route switching', () => {
  beforeEach(() => {
    mountStats.mounts = 0;
    mountStats.unmounts = 0;
    mockUseConversationTabs.mockReturnValue({
      openTabs: [],
      activeTabId: null,
      closeAllTabs: vi.fn(),
    });
    mockGetConversation.mockReset();
    window.history.replaceState({}, '', '/#/conversation/alpha');
  });

  it('keeps the conversation route mounted when only the route param changes', async () => {
    renderRouter();

    expect(await screen.findByTestId('conversation-page')).toHaveTextContent('alpha');
    expect(mountStats.mounts).toBe(1);
    expect(mountStats.unmounts).toBe(0);

    await act(async () => {
      window.location.hash = '#/conversation/beta';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('conversation-page')).toHaveTextContent('beta');
    });
    expect(mountStats.mounts).toBe(1);
    expect(mountStats.unmounts).toBe(0);
  });

  it('renders the embedded remote devices page on the official remote route', async () => {
    window.history.replaceState({}, '', '/#/remote/devices');

    renderRouter();

    expect(await screen.findByText('remote-devices')).toBeInTheDocument();
  });

  it('redirects the removed webui settings route to system settings', async () => {
    window.history.replaceState({}, '', '/#/settings/webui');

    renderRouter();

    expect(await screen.findByText('system-settings')).toBeInTheDocument();
    expect(screen.queryByText('webui-settings')).not.toBeInTheDocument();
  });

  it('routes AI assistant workspace through the top-level agents page instead of settings', async () => {
    window.history.replaceState({}, '', '/#/agents/new');

    renderRouter();

    expect(await screen.findByTestId('agents-route')).toHaveTextContent('/agents/new');
    expect(screen.queryByTestId('agent-settings-route')).not.toBeInTheDocument();
  });

  it('falls back to guid without mounting the conversation route when the restored active tab is invalid', async () => {
    let resolveConversation: ((value: null) => void) | null = null;
    const closeAllTabs = vi.fn();

    window.history.replaceState({}, '', '/#/');
    mockUseConversationTabs.mockReturnValue({
      openTabs: [{ id: 'missing-conversation', name: 'Missing', workspace: '', type: 'acp' }],
      activeTabId: 'missing-conversation',
      closeAllTabs,
    });
    mockGetConversation.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveConversation = resolve;
        })
    );

    renderRouter();

    expect(screen.getByTestId('app-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-page')).not.toBeInTheDocument();

    await act(async () => {
      resolveConversation?.(null);
    });

    await waitFor(() => {
      expect(screen.getByText('guid')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('conversation-page')).not.toBeInTheDocument();
    expect(closeAllTabs).toHaveBeenCalledTimes(1);
    expect(mountStats.mounts).toBe(0);
  });
});
