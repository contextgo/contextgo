import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/renderer/hooks/context/AuthContext';

const setThemeMock = vi.fn().mockResolvedValue(undefined);
const changeLanguageMock = vi.fn().mockResolvedValue(undefined);
const openDevToolsInvokeMock = vi.fn().mockResolvedValue(false);
const isDevToolsOpenedInvokeMock = vi.fn().mockResolvedValue(false);
const getPathInvokeMock = vi.fn().mockResolvedValue('/Users/bytedance');
const devToolsStateChangedOnMock = vi.fn(() => vi.fn());
const cloudGetStatusInvokeMock = vi.fn().mockResolvedValue({ success: false });
const cloudStatusChangedOnMock = vi.fn(() => vi.fn());
const spaceListInvokeMock = vi.fn();
const spaceEnsureDefaultInvokeMock = vi.fn();
const spaceCreateInvokeMock = vi.fn();
const openTabMock = vi.fn();
let authUserMock: AuthUser | null = {
  id: 'user-1',
  username: 'bytedance',
};

const defaultSpace = {
  id: 'space-1',
  name: 'My Space',
  engine: 'affine',
  createTime: 1,
  modifyTime: 1,
};

vi.mock('@/common', () => ({
  ipcBridge: {
    cloud: {
      getStatus: { invoke: (...args: unknown[]) => cloudGetStatusInvokeMock(...args) },
      statusChanged: { on: (...args: unknown[]) => cloudStatusChangedOnMock(...args) },
    },
    space: {
      list: { invoke: (...args: unknown[]) => spaceListInvokeMock(...args) },
      ensureDefault: { invoke: (...args: unknown[]) => spaceEnsureDefaultInvokeMock(...args) },
      create: { invoke: (...args: unknown[]) => spaceCreateInvokeMock(...args) },
    },
    application: {
      openDevTools: { invoke: (...args: unknown[]) => openDevToolsInvokeMock(...args) },
      isDevToolsOpened: { invoke: (...args: unknown[]) => isDevToolsOpenedInvokeMock(...args) },
      getPath: { invoke: (...args: unknown[]) => getPathInvokeMock(...args) },
      devToolsStateChanged: { on: (...args: unknown[]) => devToolsStateChangedOnMock(...args) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue || key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
    setTheme: setThemeMock,
  }),
}));

vi.mock('@/renderer/services/i18n', () => ({
  changeLanguage: (...args: unknown[]) => changeLanguageMock(...args),
}));

vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({
    closePreview: vi.fn(),
  }),
}));

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    user: authUserMock,
  }),
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
    openTab: openTabMock,
  }),
}));

vi.mock('@renderer/pages/conversation/platforms/group/CreateDiscussionGroupModal', () => ({
  default: () => null,
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
}));

import Sider from '@/renderer/components/layout/Sider';
import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';

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
    cloudGetStatusInvokeMock.mockResolvedValue({ success: false });
    spaceListInvokeMock.mockResolvedValue([defaultSpace]);
    spaceEnsureDefaultInvokeMock.mockResolvedValue(defaultSpace);
    spaceCreateInvokeMock.mockResolvedValue({ ...defaultSpace, id: 'space-2', name: 'New Space 2' });
    authUserMock = {
      id: 'user-1',
      username: 'bytedance',
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

  it('shows cloud display name, email, and avatar when the real authenticated user is available', async () => {
    authUserMock = {
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

  it('shows the space card above the user card in workbench routes', async () => {
    renderSider('/guid');

    expect(screen.queryByText('My Space')).not.toBeInTheDocument();
    expect(screen.queryByText('common.space')).not.toBeInTheDocument();
  });

  it('switches the space card into a return-to-workbench action inside space routes', async () => {
    renderSider('/space/space-1');

    expect(await screen.findByText('My Space')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /common\.returnToWorkbench/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'space.views.overview' })).toBeInTheDocument();
  });

  it('shows the final space shell navigation entries inside space routes', async () => {
    renderSider('/space/space-1?view=context');

    await screen.findByRole('button', { name: 'space.views.overview' });

    for (const key of [
      'space.views.overview',
      'space.views.docs',
      'space.views.canvas',
      'space.views.context',
      'space.views.runs',
      'space.views.members',
      'space.views.settings',
    ]) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument();
    }
  });
});
