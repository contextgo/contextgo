import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/renderer/hooks/context/AuthContext';
import type { LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';

let isMobileShellWebViewMock = false;

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
    cloudStatusChangedOnMock: vi.fn(() => vi.fn()),
    ensureDefaultSpaceInvokeMock: vi.fn().mockResolvedValue({ id: 'space-1', name: 'My Space' }),
    openVaultInvokeMock: vi.fn().mockResolvedValue({
      opened: true,
      fallback: 'none',
      target: '/tmp/vault',
      obsidianInstalled: true,
    }),
    openExternalUrlMock: vi.fn().mockResolvedValue(undefined),
    messageSuccessMock: vi.fn(),
    messageErrorMock: vi.fn(),
    messageWarningMock: vi.fn(),
    openTabMock: vi.fn(),
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
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    cloud: {
      getStatus: { invoke: (...args: unknown[]) => hoisted.cloudGetStatusInvokeMock(...args) },
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
  openExternalUrl: (...args: unknown[]) => hoisted.openExternalUrlMock(...args),
}));

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
    hoisted.ensureDefaultSpaceInvokeMock.mockResolvedValue({ id: 'space-1', name: 'My Space' });
    hoisted.openVaultInvokeMock.mockResolvedValue({
      opened: true,
      fallback: 'none',
      target: '/tmp/vault',
      obsidianInstalled: true,
    });
    hoisted.openExternalUrlMock.mockClear();
    isMobileShellWebViewMock = false;
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
    expect(screen.getByRole('button', { name: 'Hooks' })).toBeInTheDocument();
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeTruthy();
  });

  it('does not add desktop chrome inset on conversation routes', async () => {
    const { container } = renderSider('/conversation/conv-1');

    expect(await screen.findByText('conversation.entry.create')).toBeInTheDocument();
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeNull();
  });

  it('marks hooks as a first-level active feature entry on the hooks route', async () => {
    const { container } = renderSider('/hooks');
    const hooksButton = await screen.findByRole('button', { name: 'Hooks' });

    expect(hooksButton).toBeInTheDocument();
    expect(hooksButton.className).toContain('sider-entry-row--active');
    expect(container.querySelector('.sider-main-section--desktop-chrome-offset')).toBeTruthy();
  });

  it('shows the selected space and opens that vault from the menu action', async () => {
    renderSider('/guid');

    expect(screen.getAllByText('Team Space').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.openVaultInvokeMock).toHaveBeenCalledWith({ id: 'space-2' });
    });
    expect(hoisted.ensureDefaultSpaceInvokeMock).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith(
        'obsidian://open?vault=Team%20Space&file=Space%20Home.md'
      );
    });
    expect(hoisted.openVaultInvokeMock).not.toHaveBeenCalled();
  });

  it('opens the Obsidian download page when the vault falls back to folder opening', async () => {
    hoisted.openVaultInvokeMock.mockResolvedValue({
      opened: true,
      fallback: 'folder',
      target: '/tmp/vault',
      obsidianInstalled: false,
    });

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

    await waitFor(() => {
      expect(hoisted.openExternalUrlMock).toHaveBeenCalledWith('https://obsidian.md/download');
      expect(hoisted.messageWarningMock).toHaveBeenCalledWith('guid.vault.obsidianMissing');
    });
  });

  it('falls back to the default space vault when the menu opens vault without a selection', async () => {
    hoisted.selectedSpaceStateRef.current = {
      ...hoisted.selectedSpaceStateRef.current!,
      selectedSpace: null,
    };

    renderSider('/guid');

    fireEvent.click(screen.getByTestId('menu-item-space:open-vault'));

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

    renderSider('/guid');

    expect(await screen.findByText('Yeyi Tech')).toBeInTheDocument();
    expect(screen.getByText('yeyitech@gmail.com')).toBeInTheDocument();
    expect(screen.getByAltText('Yeyi Tech')).toBeInTheDocument();
  });
});
