import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationTab } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';

const setSiderCollapsedMock = vi.fn();
const navigateMock = vi.fn();
const isFullScreenInvokeMock = vi.fn();
const fullScreenChangedOnMock = vi.fn(() => vi.fn());
const useConversationTabsMock = vi.fn();
const useConversationAgentsMock = vi.fn();
const useSelectedSpaceIdMock = vi.fn();
const remoteAccessTargetRef = {
  current: {
    mode: 'local',
    currentUrl: '',
    entryUrl: '',
  } as { mode: 'local' | 'device-list' | 'remote-host-shell' | 'remote-device'; currentUrl: string; entryUrl: string },
};
let isElectronDesktopMock = true;
let isMacOSMock = true;
let isWindowsMock = false;
let isMobileShellWebViewMock = false;

vi.mock('@/common', () => ({
  ipcBridge: {
    windowControls: {
      isFullScreen: { invoke: (...args: unknown[]) => isFullScreenInvokeMock(...args) },
      fullScreenChanged: { on: (...args: unknown[]) => fullScreenChangedOnMock(...args) },
    },
    conversation: {
      get: {
        invoke: vi.fn(async ({ id }: { id: string }) => ({
          name:
            id === 'conv-long'
              ? 'A very long conversation title for mobile shell'
              : id === 'conv-dirty'
                ? '准备中\ncodex\n5s\n\n这个运行中的时候输入框上方这个样式是否可以优化一下，看起来太技术风格了'
                : 'Conversation Name',
        })),
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue || key,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => isElectronDesktopMock,
  isMacOS: () => isMacOSMock,
  isWindows: () => isWindowsMock,
  isMobileShellWebView: () => isMobileShellWebViewMock,
}));

vi.mock('@/renderer/hooks/context/useSelectedSpace', () => ({
  useSelectedSpaceId: () => useSelectedSpaceIdMock(),
}));

vi.mock('@/renderer/hooks/context/RemoteAccessContext', () => ({
  useRemoteAccessContext: () => ({
    target: remoteAccessTargetRef.current,
    setTarget: vi.fn(),
    resetToDeviceList: vi.fn(),
  }),
}));

vi.mock('@renderer/pages/conversation/hooks/useConversationAgents', () => ({
  useConversationAgents: () => useConversationAgentsMock(),
}));

vi.mock('@renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => useConversationTabsMock(),
}));

vi.mock('@renderer/pages/conversation/platforms/group/CreateGroupModal', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/layout/WindowControls', () => ({
  __esModule: true,
  default: () => <div data-testid='window-controls' />,
}));

vi.mock('@renderer/utils/emitter', () => ({
  emitter: { emit: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import Titlebar from '@/renderer/components/layout/Titlebar';
import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';

const createTab = (id: string): ConversationTab => ({
  id,
  name: `Conversation ${id}`,
  workspace: '/tmp/workspace',
  type: 'gemini',
});

const renderTitlebar = (
  path: string,
  {
    layoutValue,
    workspaceAvailable = false,
    openTabs = [],
  }: {
    layoutValue?: Partial<LayoutContextValue>;
    workspaceAvailable?: boolean;
    openTabs?: ConversationTab[];
  } = {}
) => {
  const value: LayoutContextValue = {
    isMobile: false,
    siderCollapsed: false,
    setSiderCollapsed: setSiderCollapsedMock,
    activeWorkbenchDefinition: null,
    ...layoutValue,
  };

  useConversationTabsMock.mockReturnValue({
    activeTab: openTabs[0] ?? null,
    openTab: vi.fn(),
    openTabs,
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <LayoutContext.Provider value={value}>
        <Titlebar workspaceAvailable={workspaceAvailable} leftPaneWidth={250} />
      </LayoutContext.Provider>
    </MemoryRouter>
  );
};

describe('Titlebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remoteAccessTargetRef.current = {
      mode: 'local',
      currentUrl: '',
      entryUrl: '',
    };
    isElectronDesktopMock = true;
    isMacOSMock = true;
    isWindowsMock = false;
    isMobileShellWebViewMock = false;
    isFullScreenInvokeMock.mockResolvedValue(false);
    useConversationAgentsMock.mockReturnValue({
      cliAgents: [],
      presetAssistants: [],
    });
    useSelectedSpaceIdMock.mockReturnValue('space-selected');
    useConversationTabsMock.mockReturnValue({
      activeTab: null,
      openTab: vi.fn(),
      openTabs: [],
    });
  });

  it('keeps desktop left controls visible on settings routes', async () => {
    const { container } = renderTitlebar('/settings/about');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.goBack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.forward' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
  });

  it('keeps connector routes free of desktop header content', async () => {
    const { container } = renderTitlebar('/connectors/google-drive');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-content')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
  });

  it('keeps conversation search routes free of desktop header titles', async () => {
    const { container } = renderTitlebar('/search/conversations');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-content')).toBeNull();
  });

  it('keeps top-level guid routes free of an empty desktop header shell', async () => {
    const { container } = renderTitlebar('/guid');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
  });

  it('keeps agents routes free of an empty desktop header shell', async () => {
    const { container } = renderTitlebar('/agents');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-content')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
  });

  it('keeps hooks routes free of an empty desktop header shell', async () => {
    const { container } = renderTitlebar('/hooks');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__desktop-content')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
  });

  it('keeps remote device shells free of docked sidebar spacing', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    const desktopLeft = container.querySelector('.app-titlebar__desktop-left') as HTMLDivElement | null;
    expect(desktopLeft).toBeTruthy();
    expect(desktopLeft?.style.width).toBe('250px');

    render(
      <MemoryRouter initialEntries={['/conversation/conv-1']}>
        <LayoutContext.Provider
          value={{
            isMobile: false,
            siderCollapsed: false,
            setSiderCollapsed: setSiderCollapsedMock,
          }}
        >
          <Titlebar workspaceAvailable={true} leftPaneWidth={0} />
        </LayoutContext.Provider>
      </MemoryRouter>
    );

    const allDesktopLeft = document.querySelectorAll('.app-titlebar__desktop-left');
    const latestDesktopLeft = allDesktopLeft.item(allDesktopLeft.length - 1) as HTMLDivElement | null;
    expect(latestDesktopLeft).toBeTruthy();
    expect(latestDesktopLeft?.style.width).toBe('');
    expect(latestDesktopLeft?.className).not.toContain('app-titlebar__desktop-left--docked');
  });

  it('renders desktop conversation content as soon as the first tab is open', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
      layoutValue: {
        activeWorkbenchDefinition: {
          kind: 'conversation-cowork',
          capabilities: ['chat', 'preview', 'workspace', 'browser'],
          shellContract: {
            shellStyle: 'conversation',
            titlebar: {
              primarySlotId: 'app-titlebar-chat-slot',
            },
            toolbar: {
              slotId: 'app-titlebar-toolbar-slot',
            },
          },
        } as never,
      },
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-right--conversation')).toBeTruthy();
    const conversationContent = container.querySelector('.app-titlebar__desktop-content--conversation');
    expect(conversationContent).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeTruthy();
    expect(conversationContent?.querySelector('.app-titlebar__drag-spacer')).toBeTruthy();
  });

  it('does not subscribe mobile create-group data on desktop conversation routes', async () => {
    renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
      layoutValue: {
        activeWorkbenchDefinition: {
          kind: 'conversation-cowork',
          capabilities: ['chat', 'preview', 'workspace', 'browser'],
          shellContract: {
            shellStyle: 'conversation',
            titlebar: {
              primarySlotId: 'app-titlebar-chat-slot',
            },
            toolbar: {
              slotId: 'app-titlebar-toolbar-slot',
            },
          },
        } as never,
      },
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(useConversationAgentsMock).not.toHaveBeenCalled();
    expect(useSelectedSpaceIdMock).not.toHaveBeenCalled();
  });

  it('renders shell slots defined by the active conversation workbench contract', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
      layoutValue: {
        activeWorkbenchDefinition: {
          kind: 'conversation-cowork',
          capabilities: ['chat', 'preview', 'workspace', 'browser'],
          shellContract: {
            shellStyle: 'conversation',
            titlebar: {
              primarySlotId: 'shell-titlebar-primary-slot',
            },
            toolbar: {
              slotId: 'shell-toolbar-slot',
            },
          },
        } as never,
      },
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('#shell-titlebar-primary-slot')).toBeTruthy();
    expect(container.querySelector('#shell-toolbar-slot')).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeNull();
    expect(container.querySelector('#app-titlebar-toolbar-slot')).toBeNull();
  });

  it('does not render workbench slots when the active route has no shell contract', async () => {
    const { container } = renderTitlebar('/guid');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeNull();
    expect(container.querySelector('#app-titlebar-toolbar-slot')).toBeNull();
  });

  it('renders desktop conversation content when multiple tabs are open', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1'), createTab('conv-2')],
      layoutValue: {
        activeWorkbenchDefinition: {
          kind: 'conversation-cowork',
          capabilities: ['chat', 'preview', 'workspace', 'browser'],
          shellContract: {
            shellStyle: 'conversation',
            titlebar: {
              primarySlotId: 'app-titlebar-chat-slot',
            },
            toolbar: {
              slotId: 'app-titlebar-toolbar-slot',
            },
          },
        } as never,
      },
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-content--conversation')).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeTruthy();
  });

  it('keeps the workspace toggle inside the desktop titlebar on non-mac runtimes', async () => {
    isMacOSMock = false;

    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByRole('button', { name: 'Expand workspace' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__toolbar')).toBeTruthy();
  });

  it('shows a development badge on desktop builds', async () => {
    const { container } = renderTitlebar('/guid');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByLabelText('common.devBuild')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__build-badge')?.textContent).toBe('common.devBadge');
    expect(screen.getByLabelText('settings.webui.deviceModeLocal')).toBeInTheDocument();
  });

  it('renders desktop runtime status badges in a detached bottom-right dock instead of the left controls', async () => {
    const { container } = renderTitlebar('/guid');

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-left .app-titlebar__build-badge')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-left .app-titlebar__mode-badge')).toBeNull();

    const statusDock = container.querySelector('.app-titlebar__status-dock');
    expect(statusDock).toBeTruthy();
    expect(statusDock?.querySelector('.app-titlebar__build-badge')).toBeTruthy();
    expect(statusDock?.querySelector('.app-titlebar__mode-badge')).toBeTruthy();
  });

  it('switches the desktop runtime badge to remote devices when the device picker is active', async () => {
    remoteAccessTargetRef.current = {
      mode: 'device-list',
      currentUrl: 'https://remote.contextgo.io/remote/devices?view=list',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    renderTitlebar('/remote/devices?view=list');

    expect(await screen.findByLabelText('settings.webui.remoteDevicesNav')).toBeInTheDocument();
  });

  it('uses the local mode badge as the desktop entry point to the host list', async () => {
    const switcherSpy = vi.fn();
    window.addEventListener('official-remote:switcher', switcherSpy as EventListener);

    try {
      renderTitlebar('/guid');

      const localBadge = await screen.findByRole('button', { name: 'settings.webui.deviceModeLocal' });
      fireEvent.mouseEnter(localBadge);

      const openHostListButton = screen.getByRole('button', { name: 'settings.webui.openOfficialRemote' });
      expect(openHostListButton).toBeInTheDocument();

      fireEvent.click(openHostListButton);

      expect(switcherSpy).toHaveBeenCalledTimes(1);
      expect(navigateMock).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('official-remote:switcher', switcherSpy as EventListener);
    }
  });

  it('uses the remote mode badge as a hoverable switch-device control for desktop remote host shells', async () => {
    remoteAccessTargetRef.current = {
      mode: 'remote-host-shell',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    const switcherSpy = vi.fn();
    window.addEventListener('official-remote:switcher', switcherSpy as EventListener);

    try {
      const { container } = renderTitlebar('/remote/devices?deviceId=device-1');

      expect(await screen.findByLabelText('settings.webui.deviceModeRemote')).toBeInTheDocument();
      expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeNull();
      expect(container.querySelector('.app-titlebar__desktop-left')).toBeNull();
      expect(setSiderCollapsedMock).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'common.goBack' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'common.forward' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand workspace' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Collapse workspace' })).not.toBeInTheDocument();

      const remoteBadge = screen.getByRole('button', { name: 'settings.webui.deviceModeRemote' });
      fireEvent.mouseEnter(remoteBadge);

      const switchDeviceButton = screen.getByRole('button', { name: 'settings.webui.switchDevice' });
      expect(switchDeviceButton).toBeInTheDocument();

      fireEvent.click(switchDeviceButton);

      expect(switcherSpy).toHaveBeenCalledTimes(1);
      expect(navigateMock).not.toHaveBeenCalledWith('/guid');
    } finally {
      window.removeEventListener('official-remote:switcher', switcherSpy as EventListener);
    }
  });

  it('keeps mac remote device shells free of the desktop chrome overlay even when local workspace tabs still exist', async () => {
    remoteAccessTargetRef.current = {
      mode: 'remote-host-shell',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    const { container } = renderTitlebar('/remote/devices?deviceId=device-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByLabelText('settings.webui.deviceModeRemote')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-left')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeNull();
    expect(container.querySelector('.app-titlebar__toolbar')).toBeNull();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.goBack' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.forward' })).not.toBeInTheDocument();
  });

  it('exits hosted remote runtime pages back to the local desktop host from the remote badge', async () => {
    const originalHash = window.location.hash;
    const originalPathname = window.location.pathname;
    const originalSearch = window.location.search;
    window.history.replaceState({}, '', '/device/device-1?client=desktop-host#/conversation/conv-1');

    remoteAccessTargetRef.current = {
      mode: 'remote-device',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    try {
      renderTitlebar('/conversation/conv-1');

      const remoteBadge = await screen.findByRole('button', { name: 'settings.webui.deviceModeRemote' });
      fireEvent.mouseEnter(remoteBadge);

      const backToHostButton = screen.getByRole('button', { name: 'settings.webui.switchDeviceReturnHost' });
      expect(backToHostButton).toBeInTheDocument();

      fireEvent.click(backToHostButton);

      expect(window.location.hash).toBe('#/remote/devices?remoteNotice=return_local_host');
      expect(navigateMock).not.toHaveBeenCalledWith('/guid');
    } finally {
      window.history.replaceState({}, '', `${originalPathname}${originalSearch}${originalHash}`);
    }
  });

  it('keeps Windows remote host shells free of local tabs while preserving host window controls', async () => {
    isMacOSMock = false;
    isWindowsMock = true;
    remoteAccessTargetRef.current = {
      mode: 'remote-host-shell',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    const { container } = renderTitlebar('/remote/devices?deviceId=device-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByLabelText('settings.webui.deviceModeRemote')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-left')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-right')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__toolbar')).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.goBack' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.forward' })).not.toBeInTheDocument();
    expect(screen.getByTestId('window-controls')).toBeInTheDocument();
  });

  it('does not show the desktop host switcher badge on Linux desktop shells', async () => {
    isMacOSMock = false;
    isWindowsMock = false;
    remoteAccessTargetRef.current = {
      mode: 'remote-host-shell',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    const { container } = renderTitlebar('/remote/devices?deviceId=device-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(container.querySelector('.app-titlebar__mode-badge')).toBeNull();
    expect(screen.queryByLabelText('settings.webui.deviceModeRemote')).not.toBeInTheDocument();
    expect(screen.getByTestId('window-controls')).toBeInTheDocument();
  });

  it('keeps hosted remote runtime pages in control of their own desktop left chrome', async () => {
    remoteAccessTargetRef.current = {
      mode: 'remote-device',
      currentUrl: 'https://remote.contextgo.io/device/device-1',
      entryUrl: 'https://remote.contextgo.io/remote/devices',
    };

    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByLabelText('settings.webui.deviceModeRemote')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--desktop-chrome-only')).toBeNull();
    expect(container.querySelector('.app-titlebar__desktop-left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.goBack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.forward' })).toBeInTheDocument();
  });

  it('shows a route title on mobile connector pages', async () => {
    const { container } = renderTitlebar('/connectors/google-drive', {
      layoutValue: {
        isMobile: true,
      },
    });

    expect(await screen.findByText('settings.connectors.title')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeTruthy();
  });

  it('uses the dedicated mobile home chrome on the guid page', async () => {
    const { container } = renderTitlebar('/guid', {
      layoutValue: {
        isMobile: true,
      },
    });

    expect(await screen.findByText('ContextGo')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile-home')).toBeTruthy();
    expect(container.querySelector('.app-titlebar--mobile-conversation')).toBeNull();
    expect(container.querySelector('.app-titlebar--mobile-secondary')).toBeNull();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeNull();
  });

  it('shows a settings section title on mobile runtime pages', async () => {
    const { container } = renderTitlebar('/settings/runtime', {
      layoutValue: {
        isMobile: true,
      },
    });

    expect(await screen.findByText('Runtime')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.mobileNavigation' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile-settings')).toBeTruthy();
    expect(container.querySelector('.app-titlebar--mobile-secondary')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeTruthy();
  });

  it('keeps the mobile shell titlebar visible on non-workspace pages', async () => {
    isElectronDesktopMock = false;
    isMacOSMock = false;
    isMobileShellWebViewMock = true;

    const { container } = renderTitlebar('/connectors/google-drive', {
      layoutValue: {
        isMobile: true,
      },
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByText('settings.connectors.title')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile')).toBeNull();
    expect(container.querySelector('.app-titlebar--mobile-shell')).toBeTruthy();
    expect(container.querySelector('.app-titlebar--mobile-secondary')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeTruthy();
  });

  it.each([
    ['/agents', 'settings.assistants'],
    ['/hooks', 'settings.hooksPage'],
    ['/skills-hub', 'settings.skillsHub.title'],
    ['/search/conversations', 'conversation.historySearch.title'],
    ['/settings/schedule', 'schedule.scheduledTasks'],
    ['/settings/system-runs', 'settings.systemRuns'],
  ])('left-aligns mobile route titles for %s', async (path, titleKey) => {
    const { container } = renderTitlebar(path, {
      layoutValue: {
        isMobile: true,
      },
    });

    expect(await screen.findByText(titleKey)).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile-secondary')).toBeTruthy();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeTruthy();
  });

  it('keeps conversation actions visible without workspace chrome inside the mobile shell', async () => {
    isElectronDesktopMock = false;
    isMacOSMock = false;
    isMobileShellWebViewMock = true;

    renderTitlebar('/conversation/conv-1', {
      layoutValue: {
        isMobile: true,
      },
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conversation.entry.create' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand workspace' })).not.toBeInTheDocument();
  });

  it('truncates long conversation titles inside the mobile shell header', async () => {
    isElectronDesktopMock = false;
    isMacOSMock = false;
    isMobileShellWebViewMock = true;

    const { container } = renderTitlebar('/conversation/conv-long', {
      layoutValue: {
        isMobile: true,
      },
      workspaceAvailable: true,
      openTabs: [createTab('conv-long')],
    });

    const title = await screen.findByText('A very long c…');

    expect(title).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile-shell .app-titlebar__brand-text')).toBeTruthy();
  });

  it('uses the dedicated mobile conversation chrome on workspace routes', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      layoutValue: {
        isMobile: true,
      },
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByText('Conversation Name')).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar--mobile-conversation')).toBeTruthy();
    expect(container.querySelector('.app-titlebar--mobile-secondary')).toBeNull();
    expect(container.querySelector('.app-titlebar__brand--leading')).toBeTruthy();
  });

  it('normalizes technical multiline conversation titles in the mobile header', async () => {
    const { container } = renderTitlebar('/conversation/conv-dirty', {
      layoutValue: {
        isMobile: true,
      },
      workspaceAvailable: true,
      openTabs: [createTab('conv-dirty')],
    });

    expect(
      await screen.findByText('这个运行中的时候输入框上方这个样式是否可以优化一下，看起来太技术风格了')
    ).toBeInTheDocument();

    const brand = container.querySelector('.app-titlebar__brand') as HTMLDivElement | null;
    expect(brand?.getAttribute('title')).toBe('这个运行中的时候输入框上方这个样式是否可以优化一下，看起来太技术风格了');
  });

  it('does not reserve mac traffic-light width while fullscreen is active', async () => {
    isFullScreenInvokeMock.mockResolvedValue(true);

    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    await screen.findByRole('button', { name: 'Collapse sidebar' });
    const leftControls = container.querySelector('.app-titlebar__desktop-left') as HTMLDivElement | null;
    expect(leftControls).toBeTruthy();
    expect(leftControls?.style.paddingLeft).toBe('8px');
  });
});
