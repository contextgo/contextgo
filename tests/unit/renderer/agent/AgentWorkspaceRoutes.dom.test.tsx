import { render, screen } from '@testing-library/react';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
  }),
}));

vi.mock('@renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => ({
    openTabs: [],
    activeTabId: null,
  }),
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
  default: () => <div>conversation</div>,
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

vi.mock('@renderer/pages/settings/GeminiSettings', () => ({
  default: () => <div>gemini-settings</div>,
}));

vi.mock('@renderer/pages/settings/ModeSettings', () => ({
  default: () => <div>mode-settings</div>,
}));

vi.mock('@renderer/pages/settings/SystemSettings', () => ({
  default: () => <div>system-settings</div>,
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

describe('Agent workspace route integration', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/#/agents/assistant-1/skills');
  });

  it('routes nested assistant detail tabs into the top-level agents workspace', async () => {
    renderRouter();

    expect(await screen.findByTestId('agents-route')).toHaveTextContent('/agents/assistant-1/skills');
    expect(screen.queryByTestId('agent-settings-route')).not.toBeInTheDocument();
  });
});
