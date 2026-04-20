import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const THEME_STORAGE_KEY = 'contextgo-theme';

const dict = {
  toggle: 'Theme',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

let ThemeToggle: typeof import('../../../apps/web/src/components/ThemeToggle').default;
let act: typeof import('../../../apps/web/node_modules/react').act;
let createElement: typeof import('../../../apps/web/node_modules/react').createElement;
let hydrateRoot: typeof import('../../../apps/web/node_modules/react-dom/client').hydrateRoot;
let renderToString: typeof import('../../../apps/web/node_modules/react-dom/server').renderToString;

const createMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

const collectConsoleMessages = (calls: unknown[][]): string => {
  return calls
    .map((args) =>
      args
        .map((value) => {
          if (typeof value === 'string') {
            return value;
          }

          if (value instanceof Error) {
            return value.message;
          }

          return JSON.stringify(value);
        })
        .join(' ')
    )
    .join('\n');
};

describe('ThemeToggle hydration', () => {
  beforeAll(async () => {
    const webReact = await import('../../../apps/web/node_modules/react');
    const webReactClient = await import('../../../apps/web/node_modules/react-dom/client');
    const webReactServer = await import('../../../apps/web/node_modules/react-dom/server');

    (globalThis as { React?: typeof webReact }).React = webReact;
    act = webReact.act;
    createElement = webReact.createElement;
    hydrateRoot = webReactClient.hydrateRoot;
    renderToString = webReactServer.renderToString;
    ThemeToggle = (await import('../../../apps/web/src/components/ThemeToggle')).default;
  });

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('hydrates cleanly when a stored dark theme is applied after mount', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.dataset.themeMode = 'dark';
    document.documentElement.dataset.theme = 'dark';

    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(ThemeToggle, { dict }));
    document.body.appendChild(container);

    const buttonBeforeHydration = container.querySelector('button');
    expect(buttonBeforeHydration).not.toBeNull();
    expect(buttonBeforeHydration).toHaveAttribute('aria-label', 'Theme: System');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = hydrateRoot(container, createElement(ThemeToggle, { dict }));

    await act(async () => Promise.resolve());

    const buttonAfterHydration = container.querySelector('button');
    expect(buttonAfterHydration).not.toBeNull();
    expect(buttonAfterHydration).toHaveAttribute('aria-label', 'Theme: Dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    const consoleMessages = collectConsoleMessages(consoleErrorSpy.mock.calls);
    expect(consoleMessages).not.toContain('Hydration failed');

    root.unmount();
  });

  it('falls back to system mode when storage contains an unsupported value', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'aurora');

    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(ThemeToggle, { dict }));
    document.body.appendChild(container);

    const root = hydrateRoot(container, createElement(ThemeToggle, { dict }));

    await act(async () => Promise.resolve());

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button).toHaveAttribute('aria-label', 'Theme: System');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.dataset.themeMode).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');

    root.unmount();
  });
});
