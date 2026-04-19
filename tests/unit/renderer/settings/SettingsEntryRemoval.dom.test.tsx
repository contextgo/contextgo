import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsTabsInvoke = vi.fn();
const settingsTabsStateChangedOn = vi.fn(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  resolveExtensionAssetUrl: () => null,
}));

vi.mock('@/renderer/hooks/system/useExtI18n', () => ({
  useExtI18n: () => ({
    resolveExtTabName: (tab: { title?: string; id: string }) => tab.title ?? tab.id,
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  extensions: {
    getSettingsTabs: {
      invoke: (...args: unknown[]) => getSettingsTabsInvoke(...args),
    },
    stateChanged: {
      on: (...args: unknown[]) => settingsTabsStateChangedOn(...args),
    },
  },
}));

vi.mock('@/renderer/utils/ui/siderTooltip', () => ({
  getSiderTooltipProps: () => ({}),
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/base/ContextGoModal', () => ({
  __esModule: true,
  default: ({ visible, children, title }: { visible?: boolean; children?: React.ReactNode; title?: React.ReactNode }) =>
    visible ? (
      <div>
        <div>{title}</div>
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock('@/renderer/components/settings', () => ({
  SettingsSubModal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Select: Object.assign(({ children }: { children?: React.ReactNode }) => <select>{children}</select>, {
    Option: ({ children }: { children?: React.ReactNode }) => <option>{children}</option>,
    OptGroup: ({ children }: { children?: React.ReactNode }) => <optgroup>{children}</optgroup>,
  }),
  Tabs: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
    TabPane: ({ title }: { title?: React.ReactNode }) => <div>{title}</div>,
  }),
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/AboutModalContent', () => ({
  __esModule: true,
  default: () => <div>about-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/AgentModalContent', () => ({
  __esModule: true,
  default: () => <div>agent-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent', () => ({
  __esModule: true,
  default: () => <div>channels-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/ExtensionSettingsTabContent', () => ({
  __esModule: true,
  default: () => <div>extension-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/GeminiModalContent', () => ({
  __esModule: true,
  default: () => <div>gemini-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/ModelModalContent', () => ({
  __esModule: true,
  default: () => <div>model-content</div>,
}));

vi.mock('@/renderer/pages/settings/AgentSettings/CustomAcpAgent', () => ({
  __esModule: true,
  default: () => <div>runtime-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/SystemModalContent', () => ({
  __esModule: true,
  default: () => <div>system-content</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent', () => ({
  __esModule: true,
  default: () => <div>webui-content</div>,
}));

describe('settings entry removal', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSettingsTabsInvoke.mockResolvedValue([]);
  });

  it('does not render a webui entry in the settings sider', async () => {
    const { default: SettingsSider } = await import('@/renderer/pages/settings/components/SettingsSider');
    const { container } = render(
      <MemoryRouter initialEntries={['/settings/system']}>
        <SettingsSider />
      </MemoryRouter>
    );

    expect(await screen.findByText('Runtime')).toBeInTheDocument();
    expect(container.querySelector('[data-settings-id="webui"]')).toBeNull();
  });

  it('does not render a webui tab in the desktop settings modal', async () => {
    const { default: SettingsModal } = await import('@/renderer/components/settings/SettingsModal');
    render(<SettingsModal visible onCancel={() => undefined} defaultTab='system' />);

    expect(await screen.findByText('Runtime')).toBeInTheDocument();
    expect(screen.queryByText('settings.webui')).not.toBeInTheDocument();
  });
});
