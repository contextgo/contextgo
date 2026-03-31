import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationTab } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';

const setSiderCollapsedMock = vi.fn();
const navigateMock = vi.fn();
const isFullScreenInvokeMock = vi.fn();
const fullScreenChangedOnMock = vi.fn(() => vi.fn());
const useConversationTabsMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    windowControls: {
      isFullScreen: { invoke: (...args: unknown[]) => isFullScreenInvokeMock(...args) },
      fullScreenChanged: { on: (...args: unknown[]) => fullScreenChangedOnMock(...args) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue || key,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  isMacOS: () => true,
}));

vi.mock('@renderer/pages/conversation/hooks/useConversationAgents', () => ({
  useConversationAgents: () => ({
    cliAgents: [],
    presetAssistants: [],
  }),
}));

vi.mock('@renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => useConversationTabsMock(),
}));

vi.mock('@renderer/pages/conversation/platforms/group/CreateDiscussionGroupModal', () => ({
  default: () => null,
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
    isFullScreenInvokeMock.mockResolvedValue(false);
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

  it('renders desktop conversation content as soon as the first tab is open', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1')],
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-content--conversation')).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeTruthy();
  });

  it('renders desktop conversation content when multiple tabs are open', async () => {
    const { container } = renderTitlebar('/conversation/conv-1', {
      workspaceAvailable: true,
      openTabs: [createTab('conv-1'), createTab('conv-2')],
    });

    expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('.app-titlebar__desktop-content--conversation')).toBeTruthy();
    expect(container.querySelector('#app-titlebar-chat-slot')).toBeTruthy();
  });
});
