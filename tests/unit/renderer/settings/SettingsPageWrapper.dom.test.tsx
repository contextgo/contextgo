import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_NAV_DRAWER_EVENT } from '@/renderer/pages/settings/components/settingsNavigation';

const getSettingsTabsInvokeMock = vi.fn().mockResolvedValue([]);
const extensionsStateChangedOnMock = vi.fn(() => vi.fn());
const useLayoutContextMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => useLayoutContextMock(),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  resolveExtensionAssetUrl: (input: string) => input,
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  extensions: {
    getSettingsTabs: { invoke: (...args: unknown[]) => getSettingsTabsInvokeMock(...args) },
    stateChanged: { on: (...args: unknown[]) => extensionsStateChangedOnMock(...args) },
  },
}));

vi.mock('@/renderer/hooks/system/useExtI18n', () => ({
  useExtI18n: () => ({
    resolveExtTabName: (tab: { title: string }) => tab.title,
  }),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  PreviewPanel: () => <div data-testid='preview-panel'>preview panel</div>,
  usePreviewSurface: () => ({
    isOpen: true,
    activeTab: { id: 'preview-1', title: 'config.toml' },
    activeTabId: 'preview-1',
  }),
}));

import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';

describe('SettingsPageWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsTabsInvokeMock.mockResolvedValue([]);
    extensionsStateChangedOnMock.mockReturnValue(vi.fn());
    useLayoutContextMock.mockReturnValue({
      isMobile: false,
    });
  });

  it('renders the preview dock alongside the settings content when a preview tab is active', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings/runtime']}>
        <Routes>
          <Route
            path='/settings/runtime'
            element={
              <SettingsPageWrapper>
                <div>runtime content</div>
              </SettingsPageWrapper>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('runtime content')).toBeInTheDocument();
    expect(screen.getByTestId('settings-page-preview')).toBeInTheDocument();
    expect(screen.getByTestId('preview-panel')).toBeInTheDocument();

    expect(container.querySelector('.settings-page-shell--with-preview')).toBeNull();
    expect(container.querySelector('.settings-side-dock')).toBeNull();
    expect(document.body.querySelector('.settings-side-dock--preview')).not.toBeNull();
  });

  it('does not mark system as active on the system runs route', async () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    render(
      <MemoryRouter initialEntries={['/settings/system-runs']}>
        <Routes>
          <Route
            path='/settings/system-runs'
            element={
              <SettingsPageWrapper>
                <div>system runs content</div>
              </SettingsPageWrapper>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('system runs content')).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(SETTINGS_NAV_DRAWER_EVENT, { detail: { open: true } }));
    });

    const activeItem = await screen.findByText('settings.systemRuns');
    expect(activeItem.closest('[data-settings-path="system-runs"]')).toHaveClass('!bg-aou-2');
    expect(screen.getByText('settings.system').closest('[data-settings-path="system"]')).not.toHaveClass('!bg-aou-2');
  });

  it('opens a mobile settings drawer instead of rendering a top tab list', async () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/settings/runtime']}>
        <Routes>
          <Route
            path='/settings/runtime'
            element={
              <SettingsPageWrapper>
                <div>runtime content</div>
              </SettingsPageWrapper>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('runtime content')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'settings.title' })).toBeNull();
    expect(container.querySelector('.settings-page-wrapper')).toHaveClass('settings-page-wrapper--mobile-compact');

    await act(async () => {
      window.dispatchEvent(new CustomEvent(SETTINGS_NAV_DRAWER_EVENT, { detail: { open: true } }));
    });

    expect(await screen.findByText('Runtime')).toBeInTheDocument();
    expect(document.body.querySelector('.settings-mobile-nav-drawer')).not.toBeNull();
  });
});
