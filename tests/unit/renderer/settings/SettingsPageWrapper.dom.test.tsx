import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsTabsInvokeMock = vi.fn().mockResolvedValue([]);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({
    isMobile: false,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  resolveExtensionAssetUrl: (input: string) => input,
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  extensions: {
    getSettingsTabs: { invoke: (...args: unknown[]) => getSettingsTabsInvokeMock(...args) },
  },
}));

vi.mock('@/renderer/hooks/system/useExtI18n', () => ({
  useExtI18n: () => ({
    resolveExtTabName: (tab: { title: string }) => tab.title,
  }),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  PreviewPanel: () => <div data-testid='preview-panel'>preview panel</div>,
  usePreviewContext: () => ({
    isOpen: true,
    activeTab: { id: 'preview-1', title: 'config.toml' },
  }),
}));

import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';

describe('SettingsPageWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsTabsInvokeMock.mockResolvedValue([]);
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
    expect(container.querySelector('.settings-page-preview-shell')).toBeNull();
    expect(document.body.querySelector('.settings-page-preview-shell')).not.toBeNull();
  });
});
