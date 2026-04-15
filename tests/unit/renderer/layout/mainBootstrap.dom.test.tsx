import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRootMock = vi.fn(() => ({
  render: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: (...args: unknown[]) => createRootMock(...args),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    ready: false,
  }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  PreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  ConversationTabsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@arco-design/web-react', () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/renderer/components/layout/RendererCrashBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/components/layout/RendererCrashOverlay', () => ({
  mountRendererCrashOverlay: vi.fn(),
}));

vi.mock('@/renderer/utils/ui/rendererCrashReporting', () => ({
  registerRendererCrashReporting: vi.fn(),
}));

vi.mock('@/renderer/components/layout/Router', () => ({
  default: () => <div data-testid='router'>router</div>,
}));

vi.mock('@/renderer/components/layout/AppLoader', () => ({
  default: () => <div data-testid='app-loader'>loading</div>,
}));

vi.mock('@/common/adapter/browser', () => ({}));
vi.mock('@/renderer/services/i18n', () => ({}));
vi.mock('@/renderer/utils/ui/runtimePatches', () => ({}));
vi.mock('@sentry/electron/renderer', () => ({
  init: vi.fn(),
}));
vi.mock('uno.css', () => ({}));
vi.mock('@/renderer/styles/arco-override.css', () => ({}));
vi.mock('@/renderer/styles/icon.css', () => ({}));
vi.mock('@/renderer/styles/renderer-crash-overlay.css', () => ({}));
vi.mock('@/renderer/styles/themes/index.css', () => ({}));
vi.mock('@arco-design/web-react/dist/css/arco.css', () => ({}));
vi.mock('@icon-park/react/styles/index.css', () => ({}));

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    createRootMock.mockClear();
    document.body.innerHTML = "<div id='root'></div>";
  });

  it('exports a Main gate that renders the startup loader while auth is unresolved', async () => {
    const mainModule = await import('@/renderer/main');
    const Main = (mainModule as { Main?: React.ComponentType }).Main;

    expect(Main).toBeTypeOf('function');

    render(<Main />);

    expect(screen.getByTestId('app-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('router')).not.toBeInTheDocument();
  });
});
