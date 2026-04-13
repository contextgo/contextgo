import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      logStream: { on: vi.fn(() => vi.fn()) },
    },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@renderer/hooks/system/useDeepLink', () => ({
  useDeepLink: vi.fn(),
}));

vi.mock('@renderer/hooks/system/useNotificationClick', () => ({
  useNotificationClick: vi.fn(),
}));

vi.mock('@renderer/hooks/file/useDirectorySelection', () => ({
  useDirectorySelection: () => ({ contextHolder: null }),
}));

vi.mock('@renderer/hooks/agent/useMultiAgentDetection', () => ({
  useMultiAgentDetection: () => ({ contextHolder: null }),
}));

vi.mock('@renderer/hooks/ui/useConversationShortcuts', () => ({
  useConversationShortcuts: vi.fn(),
}));

vi.mock('@renderer/utils/platform', () => ({
  isElectronDesktop: () => false,
  isMobileShellWebView: () => false,
}));

vi.mock('@renderer/utils/theme/customCssProcessor', () => ({
  processCustomCss: (css: string) => css,
}));

vi.mock('@renderer/utils/theme/themeCssSync', () => ({
  computeCssSyncDecision: () => ({
    shouldSkipApply: false,
    effectiveCss: '',
    shouldHealStorage: false,
  }),
  resolveCssByActiveTheme: () => '',
}));

vi.mock('@renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@/renderer/components/layout/PwaPullToRefresh', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/layout/Titlebar', () => ({
  default: () => <div data-testid='titlebar' />,
}));

vi.mock('@/renderer/components/layout/WindowControls', () => ({
  __esModule: true,
  default: () => <div data-testid='window-controls' />,
}));

vi.mock('@/renderer/hooks/context/RemoteAccessContext', () => ({
  createDefaultRemoteAccessTarget: () => ({
    mode: 'local',
    currentUrl: '',
    entryUrl: '',
  }),
  RemoteAccessContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

describe('Layout mobile sider gestures', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: none)' || query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('opens the mobile sider from a left-edge swipe and closes it from the backdrop', async () => {
    const { default: Layout } = await import('@/renderer/components/layout/Layout');

    const { container } = render(
      <MemoryRouter initialEntries={['/conversation/test-conversation']}>
        <Layout sider={<div data-testid='mobile-sider'>Sider Content</div>} />
      </MemoryRouter>
    );

    const appShell = container.querySelector('.app-shell') as HTMLDivElement | null;
    expect(appShell).toBeTruthy();
    expect(appShell?.className).toContain('app-shell--mobile-conversation');

    const themeColorMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    expect(themeColorMeta?.content).toBe('#f6f8fb');

    const sider = container.querySelector('.layout-sider') as HTMLDivElement | null;
    expect(sider).toBeTruthy();
    expect(sider?.style.transform).toContain('-261px');

    fireEvent.touchStart(appShell as Element, {
      touches: [{ clientX: 12, clientY: 120 }],
    });
    fireEvent.touchMove(appShell as Element, {
      touches: [{ clientX: 160, clientY: 126 }],
    });
    fireEvent.touchEnd(appShell as Element, {
      changedTouches: [{ clientX: 160, clientY: 126 }],
    });

    expect(sider?.style.transform).toBe('translateX(0px)');

    const backdrop = Array.from(container.querySelectorAll('div')).find((element) =>
      element.className.includes('bg-black/30')
    ) as HTMLDivElement | undefined;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);

    expect(sider?.style.transform).toContain('-261px');
    expect(screen.getByTestId('mobile-sider')).toBeInTheDocument();
  });

  it('uses the settings mobile chrome mode for settings routes', async () => {
    const { default: Layout } = await import('@/renderer/components/layout/Layout');

    const { container } = render(
      <MemoryRouter initialEntries={['/settings/runtime']}>
        <Layout sider={<div data-testid='mobile-sider'>Sider Content</div>} />
      </MemoryRouter>
    );

    const appShell = container.querySelector('.app-shell') as HTMLDivElement | null;
    expect(appShell).toBeTruthy();
    expect(appShell?.className).toContain('app-shell--mobile-settings');

    const themeColorMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    expect(themeColorMeta?.content).toBe('#f7f8fb');
  });

  it('hides the desktop sider but keeps the native titlebar when rendering a remote device shell on desktop', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });

    vi.doMock('@renderer/utils/platform', () => ({
      isElectronDesktop: () => true,
      isMacOS: () => false,
      isMobileShellWebView: () => false,
    }));

    vi.doMock('@/renderer/components/layout/Titlebar', () => ({
      default: () => <div data-testid='titlebar'>Desktop Titlebar</div>,
    }));

    vi.doMock('@/renderer/hooks/context/RemoteAccessContext', () => ({
      createDefaultRemoteAccessTarget: () => ({
        mode: 'remote-device',
        currentUrl: 'https://remote.contextgo.io/device/device-1',
        entryUrl: 'https://remote.contextgo.io/remote/devices',
      }),
      RemoteAccessContext: {
        Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      },
    }));

    const { default: Layout } = await import('@/renderer/components/layout/Layout');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    const { container } = render(
      <MemoryRouter initialEntries={['/conversation/test-conversation']}>
        <Layout sider={<div data-testid='desktop-sider'>Sider Content</div>} />
      </MemoryRouter>
    );

    expect(container.querySelector('.layout-sider')).toBeNull();
    expect(screen.queryByTestId('desktop-sider')).not.toBeInTheDocument();
    expect(screen.getByTestId('titlebar')).toBeInTheDocument();
    expect(container.querySelector('.desktop-remote-session-bar')).toBeNull();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });
});
