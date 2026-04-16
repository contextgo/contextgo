import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/renderer/hooks/context/AuthContext';
import type { LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';

let isMobileShellWebViewMock = false;
let isAndroidMobileShellMock = false;

type MockSpace = {
  id: string;
  name: string;
  isDefault?: boolean;
  providerRef?: {
    kind: 'obsidian-vault';
    vaultPath: string;
    vaultName: string;
    landingNotePath?: string;
  };
};

type SelectedSpaceHookState = {
  spaces: MockSpace[];
  selectedSpace: MockSpace | null;
  isLoading: boolean;
  isCreating: boolean;
  refreshSpaces: () => Promise<MockSpace[]>;
  selectSpace: (spaceId: string) => Promise<void>;
  createSpace: (params: { name: string; description?: string }) => Promise<MockSpace>;
};

const hoisted = vi.hoisted(() => {
  const selectSpaceMock = vi.fn().mockResolvedValue(undefined);
  const createSpaceMock = vi
    .fn()
    .mockImplementation(async ({ name, description }: { name: string; description?: string }) => ({
      id: 'space-created',
      name,
      description,
    }));

  return {
    setThemeMock: vi.fn().mockResolvedValue(undefined),
    changeLanguageMock: vi.fn().mockResolvedValue(undefined),
    openDevToolsInvokeMock: vi.fn().mockResolvedValue(false),
    isDevToolsOpenedInvokeMock: vi.fn().mockResolvedValue(false),
    getPathInvokeMock: vi.fn().mockResolvedValue('/Users/bytedance'),
    devToolsStateChangedOnMock: vi.fn(() => vi.fn()),
    cloudGetStatusInvokeMock: vi.fn().mockResolvedValue({ success: false }),
    cloudListRemoteDevicesInvokeMock: vi.fn().mockResolvedValue({ success: false }),
    cloudGetObsidianSyncStatusInvokeMock: vi.fn().mockResolvedValue({ success: false }),
    cloudRegisterObsidianReplicaDraftInvokeMock: vi.fn().mockResolvedValue({
      success: true,
      data: {
        vaultBindingId: 'vault_space-2',
        replicaId: 'android_replica_1',
        checkpoint: { appliedCursor: 0 },
      },
    }),
    cloudStatusChangedOnMock: vi.fn(() => vi.fn()),
    ensureDefaultSpaceInvokeMock: vi.fn().mockResolvedValue({ id: 'space-1', name: 'My Space' }),
    openVaultInvokeMock: vi.fn().mockResolvedValue({
      opened: true,
      fallback: 'none',
      target: '/tmp/vault',
      obsidianInstalled: true,
    }),
    requestAndroidObsidianVaultSetupMock: vi.fn().mockResolvedValue({
      status: 'prepared-directory',
      spaceId: 'space-2',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space-2',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
    }),
    registerAndBootstrapAndroidObsidianReplicaMock: vi.fn().mockResolvedValue({
      status: 'registered-mobile-replica',
      spaceId: 'space-2',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space-2',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
      healthStatus: 'warn',
      lastSyncedAt: '2026-04-16T00:00:00Z',
    }),
    getAndroidObsidianVaultSetupStateMock: vi.fn().mockReturnValue(null),
    updateAndroidObsidianVaultSetupStateMock: vi.fn().mockResolvedValue(undefined),
    openExternalUrlMock: vi.fn().mockResolvedValue(undefined),
    messageSuccessMock: vi.fn(),
    messageErrorMock: vi.fn(),
    messageWarningMock: vi.fn(),
    openTabMock: vi.fn(),
    navigateMock: vi.fn(),
    selectSpaceMock,
    createSpaceMock,
    authUserRef: {
      current: {
        id: 'user-1',
        username: 'bytedance',
      } as AuthUser | null,
    },
    selectedSpaceStateRef: {
      current: null as SelectedSpaceHookState | null,
    },
    remoteAccessRef: {
      current: null as {
        target: {
          mode: 'local' | 'device-list' | 'remote-device';
          currentUrl: string;
          entryUrl: string;
        };
        setTarget: ReturnType<typeof vi.fn>;
        resetToDeviceList: ReturnType<typeof vi.fn>;
      } | null,
    },
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    cloud: {
      getStatus: { invoke: (...args: unknown[]) => hoisted.cloudGetStatusInvokeMock(...args) },
      getObsidianSyncStatus: { invoke: (...args: unknown[]) => hoisted.cloudGetObsidianSyncStatusInvokeMock(...args) },
      registerObsidianReplicaDraft: {
        invoke: (...args: unknown[]) => hoisted.cloudRegisterObsidianReplicaDraftInvokeMock(...args),
      },
      ensureOfficialRemoteReady: {
        invoke: (...args: unknown[]) =>
          (
            globalThis as { __ensureOfficialRemoteReadyInvokeMock?: (...args: unknown[]) => unknown }
          ).__ensureOfficialRemoteReadyInvokeMock?.(...args),
      },
      listRemoteDevices: { invoke: (...args: unknown[]) => hoisted.cloudListRemoteDevicesInvokeMock(...args) },
      statusChanged: { on: (...args: unknown[]) => hoisted.cloudStatusChangedOnMock(...args) },
    },
    space: {
      ensureDefault: { invoke: (...args: unknown[]) => hoisted.ensureDefaultSpaceInvokeMock(...args) },
      openVault: { invoke: (...args: unknown[]) => hoisted.openVaultInvokeMock(...args) },
    },
    application: {
      openDevTools: { invoke: (...args: unknown[]) => hoisted.openDevToolsInvokeMock(...args) },
      isDevToolsOpened: { invoke: (...args: unknown[]) => hoisted.isDevToolsOpenedInvokeMock(...args) },
      getPath: { invoke: (...args: unknown[]) => hoisted.getPathInvokeMock(...args) },
      devToolsStateChanged: { on: (...args: unknown[]) => hoisted.devToolsStateChangedOnMock(...args) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'guid.space.switchSuccess' && options?.name) {
        return `Switched to ${String(options.name)}`;
      }
      if (key === 'guid.space.createSuccess' && options?.name) {
        return `Created ${String(options.name)}`;
      }
      return options?.defaultValue || key;
    },
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
    setTheme: hoisted.setThemeMock,
  }),
}));

vi.mock('@/renderer/services/i18n', () => ({
  changeLanguage: (...args: unknown[]) => hoisted.changeLanguageMock(...args),
}));

vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({
    closePreview: vi.fn(),
  }),
}));

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    user: hoisted.authUserRef.current,
  }),
}));

vi.mock('@/renderer/hooks/context/RemoteAccessContext', () => ({
  useRemoteAccessContext: () => hoisted.remoteAccessRef.current,
}));

vi.mock('@renderer/hooks/context/useSelectedSpace', () => ({
  useSelectedSpace: () => hoisted.selectedSpaceStateRef.current,
}));

vi.mock('@renderer/pages/conversation/GroupedHistory', () => ({
  default: () => <div data-testid='grouped-history' />,
}));

vi.mock('@renderer/pages/settings/components/SettingsSider', () => ({
  default: () => <div data-testid='settings-sider' />,
}));

vi.mock('@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover', () => ({
  default: ({ buttonLabel, buttonClassName }: { buttonLabel: string; buttonClassName?: string }) => (
    <button type='button' className={buttonClassName}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock('@renderer/pages/conversation/hooks/useConversationAgents', () => ({
  useConversationAgents: () => ({
    cliAgents: [],
    presetAssistants: [],
  }),
}));

vi.mock('@renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => ({
    activeTab: null,
    openTab: hoisted.openTabMock,
  }),
}));

vi.mock('@renderer/pages/conversation/platforms/group/CreateGroupModal', () => ({
  default: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => hoisted.navigateMock,
  };
});

vi.mock('@renderer/components/base', () => ({
  ContextGoModal: ({
    visible,
    header,
    children,
    footer,
  }: {
    visible?: boolean;
    header?: React.ReactNode | { title?: React.ReactNode };
    children?: React.ReactNode;
    footer?: React.ReactNode | { render?: () => React.ReactNode } | null;
  }) => {
    if (!visible) {
      return null;
    }

    const title = typeof header === 'object' && header !== null && 'title' in header ? header.title : header;
    const footerContent =
      typeof footer === 'object' && footer !== null && 'render' in footer ? footer.render?.() : footer;

    return (
      <div>
        <div>{title}</div>
        {children}
        {footerContent}
      </div>
    );
  },
}));

vi.mock('@renderer/utils/emitter', () => ({
  emitter: { emit: vi.fn() },
}));

vi.mock('@renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
}));

vi.mock('@renderer/utils/ui/focus', () => ({
  blurActiveElement: vi.fn(),
}));

vi.mock('@renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  isMacOS: () => true,
  isMobileShellWebView: () => isMobileShellWebViewMock,
  isAndroidMobileShell: () => isAndroidMobileShellMock,
  getAndroidObsidianVaultSetupState: (...args: unknown[]) => hoisted.getAndroidObsidianVaultSetupStateMock(...args),
  requestAndroidObsidianVaultSetup: (...args: unknown[]) => hoisted.requestAndroidObsidianVaultSetupMock(...args),
  registerAndBootstrapAndroidObsidianReplica: (...args: unknown[]) =>
    hoisted.registerAndBootstrapAndroidObsidianReplicaMock(...args),
  updateAndroidObsidianVaultSetupState: (...args: unknown[]) =>
    hoisted.updateAndroidObsidianVaultSetupStateMock(...args),
  openExternalUrl: (...args: unknown[]) => hoisted.openExternalUrlMock(...args),
}));

vi.mock('@icon-park/react', () => {
  const icon = (label: string) => () => <span>{label}</span>;

  return {
    CheckSmall: icon('check-small-icon'),
    Computer: icon('computer-icon'),
    ConnectionPoint: icon('connection-point-icon'),
    Down: icon('down-icon'),
    Earth: icon('earth-icon'),
    FolderOpen: icon('folder-open-icon'),
    Github: icon('github-icon'),
    Google: icon('google-icon'),
    LinkCloud: icon('link-cloud-icon'),
    Moon: icon('moon-icon'),
    Plus: icon('plus-icon'),
    Right: icon('right-icon'),
    Robot: icon('robot-icon'),
    RobotOne: icon('robot-one-icon'),
    SettingTwo: icon('setting-two-icon'),
    Sun: icon('sun-icon'),
    Theme: icon('theme-icon'),
  };
});

vi.mock('@arco-design/web-react', () => {
  const normalizeMenuKey = (value: React.Key | null): string => {
    if (typeof value === 'string') {
      return value.replace(/^\.\$/, '');
    }

    return typeof value === 'number' ? String(value) : '';
  };

  const MenuItem: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
  const MenuSubMenu: React.FC<React.PropsWithChildren<{ title?: React.ReactNode }>> = ({ title, children }) => (
    <div>
      {title}
      {children}
    </div>
  );
  const MenuItemGroup: React.FC<React.PropsWithChildren<{ title?: React.ReactNode }>> = ({ title, children }) => (
    <div>
      {title}
      {children}
    </div>
  );

  const renderMenuNode = (node: React.ReactNode, onClickMenuItem?: (key: string) => void): React.ReactNode => {
    if (!React.isValidElement(node)) {
      return node;
    }

    if (node.type === MenuItem) {
      const key = normalizeMenuKey(node.key);
      const props = node.props as { children?: React.ReactNode; className?: string };
      return (
        <button
          type='button'
          className={props.className}
          data-testid={`menu-item-${key}`}
          onClick={() => onClickMenuItem?.(key)}
        >
          {React.Children.map(props.children, (child) => renderMenuNode(child, onClickMenuItem))}
        </button>
      );
    }

    if (node.type === MenuSubMenu || node.type === MenuItemGroup) {
      const props = node.props as { children?: React.ReactNode; title?: React.ReactNode };
      return (
        <div>
          {props.title}
          {React.Children.map(props.children, (child) => renderMenuNode(child, onClickMenuItem))}
        </div>
      );
    }

    const props = node.props as { children?: React.ReactNode };
    return React.cloneElement(
      node,
      undefined,
      React.Children.map(props.children, (child) => renderMenuNode(child, onClickMenuItem))
    );
  };

  const Menu = ({
    children,
    onClickMenuItem,
    className,
  }: React.PropsWithChildren<{ onClickMenuItem?: (key: string) => void; className?: string }>) => (
    <div className={className}>{React.Children.map(children, (child) => renderMenuNode(child, onClickMenuItem))}</div>
  );
  Menu.Item = MenuItem;
  Menu.SubMenu = MenuSubMenu;
  Menu.ItemGroup = MenuItemGroup;

  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
      <button type='button' disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Dropdown: ({ children, droplist }: React.PropsWithChildren<{ droplist?: React.ReactNode }>) => (
      <div>
        {children}
        {droplist}
      </div>
    ),
    Input: Object.assign(
      ({
        value,
        onChange,
        placeholder,
        maxLength,
      }: {
        value?: string;
        onChange?: (value: string) => void;
        placeholder?: string;
        maxLength?: number;
      }) => (
        <input
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ),
      {
        TextArea: ({
          value,
          onChange,
          placeholder,
          maxLength,
        }: {
          value?: string;
          onChange?: (value: string) => void;
          placeholder?: string;
          maxLength?: number;
        }) => (
          <textarea
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => onChange?.(event.target.value)}
          />
        ),
      }
    ),
    Menu,
    Message: {
      success: (...args: unknown[]) => hoisted.messageSuccessMock(...args),
      error: (...args: unknown[]) => hoisted.messageErrorMock(...args),
      warning: (...args: unknown[]) => hoisted.messageWarningMock(...args),
    },
  };
});

import Sider from '@/renderer/components/layout/Sider';
import { LayoutContext } from '@/renderer/hooks/context/LayoutContext';

const renderSider = (
  path: string,
  {
    layoutValue,
  }: {
    layoutValue?: Partial<LayoutContextValue>;
  } = {}
) => {
  const value: LayoutContextValue = {
    isMobile: false,
    siderCollapsed: false,
    setSiderCollapsed: vi.fn(),
    ...layoutValue,
  };

  return render(
    <MemoryRouter initialEntries={[path]}>
      <LayoutContext.Provider value={value}>
        <Sider />
      </LayoutContext.Provider>
    </MemoryRouter>
  );
};

describe('Sider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({ success: false });
    hoisted.cloudListRemoteDevicesInvokeMock.mockResolvedValue({ success: false });
    hoisted.cloudGetObsidianSyncStatusInvokeMock.mockResolvedValue({ success: false });
    hoisted.cloudRegisterObsidianReplicaDraftInvokeMock.mockResolvedValue({
      success: true,
      data: {
        vaultBindingId: 'vault_space-2',
        replicaId: 'android_replica_1',
        checkpoint: { appliedCursor: 0 },
      },
    });
    hoisted.registerAndBootstrapAndroidObsidianReplicaMock.mockResolvedValue({
      status: 'registered-mobile-replica',
      spaceId: 'space-2',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space-2',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
      healthStatus: 'warn',
      lastSyncedAt: '2026-04-16T00:00:00Z',
    });
    (
      globalThis as { __ensureOfficialRemoteReadyInvokeMock?: ReturnType<typeof vi.fn> }
    ).__ensureOfficialRemoteReadyInvokeMock = vi.fn().mockResolvedValue({ success: false });
    hoisted.ensureDefaultSpaceInvokeMock.mockResolvedValue({ id: 'space-1', name: 'My Space' });
    hoisted.openVaultInvokeMock.mockResolvedValue({
      opened: true,
      fallback: 'none',
      target: '/tmp/vault',
      obsidianInstalled: true,
    });
    hoisted.openExternalUrlMock.mockClear();
    hoisted.navigateMock.mockReset();
    hoisted.getAndroidObsidianVaultSetupStateMock.mockReset();
    hoisted.getAndroidObsidianVaultSetupStateMock.mockReturnValue(null);
    hoisted.updateAndroidObsidianVaultSetupStateMock.mockReset();
    isMobileShellWebViewMock = false;
    isAndroidMobileShellMock = false;
    hoisted.remoteAccessRef.current = null;
    hoisted.authUserRef.current = {
      id: 'user-1',
      username: 'bytedance',
    };
    hoisted.selectedSpaceStateRef.current = {
      spaces: [
        { id: 'space-1', name: 'My Space', isDefault: true },
        { id: 'space-2', name: 'Team Space' },
      ],
      selectedSpace: { id: 'space-2', name: 'Team Space' },
      isLoading: false,
      isCreating: false,
      refreshSpaces: vi.fn().mockResolvedValue([]),
      selectSpace: hoisted.selectSpaceMock,
      createSpace: hoisted.createSpaceMock,
    };
  });

  it('adds desktop chrome inset on non-conversation routes so the create entry stays visible', async () => {
    const { container } = renderSider('/skills-hub');

    expect(await screen.findByText('conversation.entry.create')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remote Hosts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hooks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'settings.skillsHub.title' })).not.toBeInTheDocument();
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeTruthy();
  });

  it('does not add desktop chrome inset on conversation routes', async () => {
    const { container } = renderSider('/conversation/conv-1');

    expect(await screen.findByText('conversation.entry.create')).toBeInTheDocument();
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeNull();
  });

  it('does not show hooks as a first-level feature entry on the hooks route', async () => {
    const { container } = renderSider('/hooks');

    expect(await screen.findByText('conversation.entry.create')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hooks' })).not.toBeInTheDocument();
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeTruthy();
  });

  it('shows the selected space and opens that vault from the hover action inside the card', async () => {
    renderSider('/guid');

    expect(screen.getAllByText('Team Space').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getAllByText('settings.webui.switchDevice').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'guid.vault.affordance' }));

    await waitFor(() => {
      expect(hoisted.openVaultInvokeMock).toHaveBeenCalledWith({ id: 'space-2' });
    });
    expect(hoisted.ensureDefaultSpaceInvokeMock).not.toHaveBeenCalled();
  });

  it('keeps a single space card while exposing an internal obsidian action target', async () => {
    renderSider('/guid');

    const selectorTrigger = screen.getByRole('button', { name: 'guid.space.selectorTitle' });
    const openVaultButton = screen.getByRole('button', { name: 'guid.vault.affordance' });
    expect(openVaultButton).toHaveAttribute('data-testid', 'space-card-vault-button');

    fireEvent.click(openVaultButton);

    await waitFor(() => {
      expect(hoisted.openVaultInvokeMock).toHaveBeenCalledWith({ id: 'space-2' });
    });

    expect(hoisted.selectSpaceMock).not.toHaveBeenCalled();
    expect(hoisted.createSpaceMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('menu-item-space:create'));
    });

    expect(screen.getByText('guid.space.createTitle')).toBeInTheDocument();
    expect(selectorTrigger).toBeInTheDocument();
  });

  it('renders the vault action and create action before the switchable space list in the space popup', async () => {
    renderSider('/guid');

    const menuItems = screen.getAllByTestId(/menu-item-space:/);
    expect(menuItems[0]).toHaveAttribute('data-testid', 'menu-item-space:open-vault');
    expect(menuItems[1]).toHaveAttribute('data-testid', 'menu-item-space:create');
    expect(menuItems[2]).toHaveAttribute('data-testid', 'menu-item-space:space-1');
    expect(menuItems[3]).toHaveAttribute('data-testid', 'menu-item-space:space-2');
  });

  it('prefers current desktop official remote readiness when rendering the current device status', async () => {
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'running',
          mode: 'gui-host',
          platform: 'macos',
          running: true,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: true,
          localUrl: 'http://localhost:25809',
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudListRemoteDevicesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        devices: [
          {
            id: 'device-local',
            userId: 'cloud-user-1',
            deviceName: 'Local Mac',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
            lastSeenAt: '2026-04-01T02:00:00Z',
            remoteStatus: {
              connected: false,
              clientConnected: false,
              browserEntryReady: false,
            },
          },
        ],
        selection: {
          preferredDeviceId: null,
          autoOpenDeviceId: null,
          openableDeviceCount: 0,
          forcePicker: false,
        },
      },
    });

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getAllByText('Local Mac').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('settings.webui.officialRemoteStatusShort.ready')).toBeInTheDocument();
  });

  it('renders compact platform indicators for the device switch menu item instead of the inline device name', async () => {
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemoteReady: true,
        officialRemote: {
          desired: true,
          running: true,
          browserEntryReady: true,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });

    renderSider('/guid');

    const menuItem = await screen.findByTestId('menu-item-device-switch');

    expect(menuItem).not.toHaveTextContent('Local Mac');
    expect(screen.getByAltText('macOS')).toBeInTheDocument();
    expect(screen.getByTestId('device-switch-local-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('device-switch-indicators')).toHaveAttribute(
      'title',
      expect.stringContaining('Local Mac')
    );
  });

  it('ensures current desktop official remote readiness before loading devices when needed', async () => {
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'stopped',
          mode: 'gui-host',
          platform: 'macos',
          running: false,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: false,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudListRemoteDevicesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        devices: [],
        selection: {
          preferredDeviceId: null,
          autoOpenDeviceId: null,
          openableDeviceCount: 0,
          forcePicker: false,
        },
      },
    });
    const ensureOfficialRemoteReadyInvokeMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'running',
          mode: 'gui-host',
          platform: 'macos',
          running: true,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: true,
          localUrl: 'http://localhost:25809',
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    (
      globalThis as { __ensureOfficialRemoteReadyInvokeMock?: typeof ensureOfficialRemoteReadyInvokeMock }
    ).__ensureOfficialRemoteReadyInvokeMock = ensureOfficialRemoteReadyInvokeMock;

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(ensureOfficialRemoteReadyInvokeMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(hoisted.cloudListRemoteDevicesInvokeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the current device immediately while official remote readiness is still reconciling', async () => {
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'stopped',
          mode: 'gui-host',
          platform: 'macos',
          running: false,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: false,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudListRemoteDevicesInvokeMock.mockImplementation(() => new Promise(() => undefined));
    const ensureOfficialRemoteReadyInvokeMock = vi.fn().mockImplementation(() => new Promise(() => undefined));
    (
      globalThis as { __ensureOfficialRemoteReadyInvokeMock?: typeof ensureOfficialRemoteReadyInvokeMock }
    ).__ensureOfficialRemoteReadyInvokeMock = ensureOfficialRemoteReadyInvokeMock;

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getAllByText('Local Mac').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('settings.webui.officialRemoteStatusShort.connecting')).toBeInTheDocument();
    expect(screen.queryByText('settings.cloud.loading')).not.toBeInTheDocument();
    expect(ensureOfficialRemoteReadyInvokeMock).toHaveBeenCalledTimes(1);
    expect(hoisted.cloudListRemoteDevicesInvokeMock).toHaveBeenCalledTimes(1);
  });
  it('opens a native device switcher and loads devices with the current cloud session', async () => {
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          desired: true,
          running: true,
          browserEntryReady: true,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudListRemoteDevicesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        devices: [
          {
            id: 'device-local',
            userId: 'cloud-user-1',
            deviceName: 'Local Mac',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
            lastSeenAt: '2026-04-01T02:00:00Z',
            remoteStatus: {
              connected: true,
              clientConnected: true,
              browserEntryReady: true,
            },
          },
          {
            id: 'device-remote-1',
            userId: 'cloud-user-1',
            deviceName: 'Office Mac mini',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
            lastSeenAt: '2026-04-01T01:00:00Z',
            remoteStatus: {
              connected: true,
              clientConnected: false,
              browserEntryReady: true,
            },
          },
        ],
        selection: {
          preferredDeviceId: 'device-remote-1',
          autoOpenDeviceId: null,
          openableDeviceCount: 1,
          forcePicker: false,
        },
      },
    });

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getAllByText('Office Mac mini').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Local Mac').length).toBeGreaterThan(0);
    expect(screen.getByText('settings.webui.switchDeviceCurrent')).toBeInTheDocument();
    expect(screen.getAllByText('settings.webui.switchDeviceOpen')).toHaveLength(1);
    expect(hoisted.cloudListRemoteDevicesInvokeMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('settings.webui.switchDeviceDescription')).toBeInTheDocument();
  });

  it('opens another device directly from a remote-device view without bouncing through the picker', async () => {
    hoisted.remoteAccessRef.current = {
      target: {
        mode: 'remote-device',
        currentUrl: 'https://remote.contextgo.test/device/device-remote-1',
        entryUrl: 'https://remote.contextgo.test/remote/devices',
      },
      setTarget: vi.fn(),
      resetToDeviceList: vi.fn(),
    };
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-local',
          userId: 'cloud-user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemoteReady: true,
        officialRemote: {
          desired: true,
          running: true,
          browserEntryReady: true,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://remote.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudListRemoteDevicesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        devices: [
          {
            id: 'device-local',
            userId: 'cloud-user-1',
            deviceName: 'Local Mac',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
            lastSeenAt: '2026-04-01T02:00:00Z',
            remoteStatus: {
              connected: true,
              clientConnected: true,
              browserEntryReady: true,
            },
          },
          {
            id: 'device-remote-2',
            userId: 'cloud-user-1',
            deviceName: 'Office Mac mini',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
            lastSeenAt: '2026-04-01T01:00:00Z',
            remoteStatus: {
              connected: true,
              clientConnected: false,
              browserEntryReady: true,
            },
          },
        ],
        selection: {
          preferredDeviceId: 'device-remote-2',
          autoOpenDeviceId: null,
          openableDeviceCount: 1,
          forcePicker: false,
        },
      },
    });

    renderSider('/remote/devices?deviceId=device-remote-1');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getByText('Office Mac mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.webui.switchDeviceOpen' }));

    expect(hoisted.remoteAccessRef.current.resetToDeviceList).not.toHaveBeenCalled();
    expect(hoisted.navigateMock).toHaveBeenCalledWith('/remote/devices?deviceId=device-remote-2');
    expect(hoisted.navigateMock).not.toHaveBeenCalledWith('/remote/devices?view=list');
  });

  it('falls back out of loading when cloud status lookup times out', async () => {
    hoisted.cloudGetStatusInvokeMock.mockImplementation(() => new Promise(() => undefined));

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(
      () => {
        expect(screen.getAllByText('settings.cloud.notConnected').length).toBeGreaterThan(0);
      },
      { timeout: 7000 }
    );
  });

  it('shows cloud login actions in the device switcher when desktop cloud auth is missing', async () => {
    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    await waitFor(() => {
      expect(screen.getAllByText('settings.cloud.notConnected').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('settings.webui.officialRemoteStatusShort.signedOut').length).toBeGreaterThan(0);
    expect(screen.getByText('settings.cloud.description')).toBeInTheDocument();
    expect(screen.queryByText('settings.cloud.notConnectedDesc')).not.toBeInTheDocument();
    expect(screen.getAllByText('settings.cloud.loginWithGithub').length).toBeGreaterThan(0);
    expect(screen.getAllByText('settings.cloud.loginWithGoogle').length).toBeGreaterThan(0);
    expect(screen.getByAltText('GitHub')).toBeInTheDocument();
    expect(screen.getByAltText('Google')).toBeInTheDocument();
    expect(hoisted.cloudListRemoteDevicesInvokeMock).not.toHaveBeenCalled();
  });

  it('opens the selected space in mobile Obsidian when running inside the mobile shell', async () => {
    isMobileShellWebViewMock = true;
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: {
        id: 'space-2',
        name: 'Team Space',
        providerRef: {
          kind: 'obsidian-vault',
          vaultPath: '/tmp/team-space',
          vaultName: 'Team Space',
          landingNotePath: 'Space Home.md',
        },
      },
    };

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    expect(screen.getByText('guid.vault.mobileAffordance')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith(
        'obsidian://open?vault=Team%20Space&file=Space%20Home.md'
      );
    });
    expect(hoisted.openVaultInvokeMock).not.toHaveBeenCalled();
  });

  it('opens the Obsidian vault chooser instead of host IPC when mobile shell lacks a bound vault provider', async () => {
    isMobileShellWebViewMock = true;
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: {
        id: 'space-2',
        name: 'Team Space',
      },
    };

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));

    expect(screen.getByText('guid.vault.mobileSetupAffordance')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith('obsidian://open?choose-vault');
      expect(hoisted.messageWarningMock).toHaveBeenCalledWith('guid.vault.mobileSetupRequired');
    });
    expect(hoisted.openVaultInvokeMock).not.toHaveBeenCalled();
  });

  it('requests Android vault setup before opening the Obsidian chooser when running in the Android shell', async () => {
    isMobileShellWebViewMock = true;
    isAndroidMobileShellMock = true;
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'cloud-user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-mobile',
          userId: 'cloud-user-1',
          deviceName: 'Pixel 9',
          platform: 'android',
          status: 'active',
          createdAt: '2026-04-16T00:00:00Z',
          updatedAt: '2026-04-16T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemoteReady: false,
        officialRemote: {
          desired: false,
          running: false,
        },
        providers: ['github'],
        authBaseUrl: 'https://auth.contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });
    hoisted.cloudGetObsidianSyncStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        vaultBindingId: 'vault_space-2',
        spaceId: 'space-2',
        riskLevel: 'normal',
        replicas: [
          {
            replicaId: 'android_replica_1',
            platform: 'mobile',
            healthStatus: 'warn',
            localReadyState: 'prepared-directory',
            rootTreeUri: 'content://root/contextgo',
            localDirectoryUri: 'content://space/team-space',
            landingNotePath: 'Home.md',
            lastSyncedAt: '2026-04-16T00:00:00Z',
          },
        ],
      },
    });
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: {
        id: 'space-2',
        name: 'Team Space',
      },
    };

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-device-switch'));
    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.requestAndroidObsidianVaultSetupMock).toHaveBeenCalledWith({
        spaceId: 'space-2',
        spaceName: 'Team Space',
        suggestedFolderName: 'team-space',
        vaultBindingId: 'vault_space-2',
        landingNotePath: 'Home.md',
      });
      expect(hoisted.registerAndBootstrapAndroidObsidianReplicaMock).toHaveBeenCalledWith({
        spaceId: 'space-2',
        spaceName: 'Team Space',
        suggestedFolderName: 'team-space',
        vaultBindingId: 'vault_space-2',
        landingNotePath: 'Home.md',
        apiBaseUrl: 'https://api.contextgo.test',
        rootTreeUri: 'content://root/contextgo',
        spaceDirectoryUri: 'content://space/team-space',
      });
      expect(hoisted.cloudGetObsidianSyncStatusInvokeMock).toHaveBeenCalledWith({ spaceId: 'space-2' });
      expect(hoisted.updateAndroidObsidianVaultSetupStateMock).toHaveBeenCalledWith({
        status: 'registered-mobile-replica',
        spaceId: 'space-2',
        vaultName: 'team-space',
        rootTreeUri: 'content://root/contextgo',
        spaceDirectoryUri: 'content://space/team-space',
        vaultBindingId: 'vault_space-2',
        replicaId: 'android_replica_1',
        landingNotePath: 'Home.md',
        healthStatus: 'warn',
        lastSyncedAt: '2026-04-16T00:00:00Z',
      });
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith('obsidian://open?choose-vault');
      expect(hoisted.messageSuccessMock).toHaveBeenCalledWith('guid.vault.androidReplicaRegistered');
    });
    expect(hoisted.openVaultInvokeMock).not.toHaveBeenCalled();
  });

  it('shows Android prepared-directory readiness and skips directory picking on later opens', async () => {
    isMobileShellWebViewMock = true;
    isAndroidMobileShellMock = true;
    hoisted.getAndroidObsidianVaultSetupStateMock.mockReturnValue({
      status: 'registered-mobile-replica',
      spaceId: 'space-2',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space-2',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
      healthStatus: 'warn',
      lastSyncedAt: '2026-04-16T00:00:00Z',
    });
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: {
        id: 'space-2',
        name: 'Team Space',
      },
    };

    renderSider('/guid');

    expect(screen.getAllByText('guid.vault.androidStatusRegistered').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('menu-item-device-switch'));
    expect(screen.getByText('guid.vault.mobileSetupAffordance')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.requestAndroidObsidianVaultSetupMock).not.toHaveBeenCalled();
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith('obsidian://open?choose-vault');
      expect(hoisted.messageSuccessMock).toHaveBeenCalledWith('guid.vault.androidReplicaRegistered');
    });
  });

  it('opens the Obsidian download page when the vault falls back to folder opening', async () => {
    hoisted.openVaultInvokeMock.mockResolvedValue({
      opened: true,
      fallback: 'folder',
      target: '/tmp/vault',
      obsidianInstalled: false,
    });

    renderSider('/guid');

    fireEvent.click(screen.getByRole('button', { name: 'guid.vault.affordance' }));

    await waitFor(() => {
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith('https://obsidian.md/download');
      expect(hoisted.messageWarningMock).toHaveBeenCalledWith('guid.vault.obsidianMissing');
    });
  });

  it('falls back to the default space vault when the dedicated space action opens without a selection', async () => {
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: null,
    };

    renderSider('/guid');

    fireEvent.click(screen.getByRole('button', { name: 'guid.vault.affordance' }));

    await waitFor(() => {
      expect(hoisted.ensureDefaultSpaceInvokeMock).toHaveBeenCalledTimes(1);
      expect(hoisted.selectSpaceMock).toHaveBeenCalledWith('space-1');
      expect(hoisted.openVaultInvokeMock).toHaveBeenCalledWith({ id: 'space-1' });
    });
  });

  it('switches space from the footer dropdown', async () => {
    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-space:space-2'));

    await waitFor(() => {
      expect(hoisted.selectSpaceMock).toHaveBeenCalledWith('space-2');
    });
  });

  it('creates a new space from the footer modal', async () => {
    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-space:create'));
    fireEvent.change(screen.getByPlaceholderText('guid.space.namePlaceholder'), {
      target: { value: 'Research Space' },
    });
    fireEvent.change(screen.getByPlaceholderText('guid.space.descriptionPlaceholder'), {
      target: { value: 'Experiment notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'guid.space.createAction' }));

    await waitFor(() => {
      expect(hoisted.createSpaceMock).toHaveBeenCalledWith({
        name: 'Research Space',
        description: 'Experiment notes',
      });
    });
  });

  it('shows cloud display name, email, and avatar when the real authenticated user is available', async () => {
    hoisted.authUserRef.current = {
      id: 'cloud-user-1',
      username: 'yeyitech',
      displayName: 'Yeyi Tech',
      email: 'yeyitech@gmail.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/231244789?v=4',
      authSource: 'cloud',
    };
    hoisted.cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        user: {
          id: 'cloud-user-1',
          email: 'yeyitech@gmail.com',
          displayName: 'Yeyi Tech',
          authSource: 'cloud',
        },
        device: null,
        officialRemote: {
          running: false,
          clientConnected: false,
          transport: null,
          browserEntryReady: false,
          browserEntryReason: null,
        },
        officialRemoteReady: false,
      },
    });

    renderSider('/guid');

    expect(await screen.findByText('Yeyi Tech')).toBeInTheDocument();
    expect(screen.getByText('yeyitech@gmail.com')).toBeInTheDocument();
    expect(screen.getByAltText('Yeyi Tech')).toBeInTheDocument();
  });

  it('keeps the infermesh entry but removes the standalone cloud login hint from the user menu', async () => {
    renderSider('/guid');

    await waitFor(() => {
      expect(screen.getByTestId('menu-item-cloud:infermesh')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('menu-item-cloud:login')).not.toBeInTheDocument();
  });
});
