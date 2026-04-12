/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalize the outer shell path used by the hash-based WebUI.
 *
 * Historically authenticated sessions could stay on `/login#/...`, which makes
 * the app look like it is still inside the login page even after entering a
 * protected route. The actual route lives in the hash, so we only need to strip
 * the `/login` shell and keep the hash untouched.
 */
export function normalizeHashRouteShellPath(pathname: string, search: string, hash: string): string | null {
  if (pathname !== '/login') {
    return null;
  }

  return `/${search}${hash}`;
}

export function normalizeHashRouteShellHref(currentHref: string): string {
  const url = new URL(currentHref);
  const normalizedPath = normalizeHashRouteShellPath(url.pathname, url.search, url.hash);

  if (!normalizedPath) {
    return currentHref;
  }

  return `${url.origin}${normalizedPath}`;
}

const LAST_STABLE_HASH_ROUTE_KEY = 'contextgo:last-stable-hash-route';

type RouteLoader = () => Promise<unknown>;

let lastStableHashRoute = '/guid';

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const normalizeStableHashRoute = (routePath: string): string => {
  const trimmed = routePath.trim();
  if (!trimmed) {
    return '/guid';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export function rememberStableHashRoute(routePath: string): void {
  const normalized = normalizeStableHashRoute(routePath);
  lastStableHashRoute = normalized;

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(LAST_STABLE_HASH_ROUTE_KEY, normalized);
  } catch {
    // Ignore storage write failures in constrained environments.
  }
}

export function getLastStableHashRoute(): string {
  if (!canUseSessionStorage()) {
    return lastStableHashRoute;
  }

  try {
    const saved = window.sessionStorage.getItem(LAST_STABLE_HASH_ROUTE_KEY);
    if (saved) {
      lastStableHashRoute = normalizeStableHashRoute(saved);
    }
  } catch {
    // Ignore storage read failures and use the in-memory fallback.
  }

  return lastStableHashRoute;
}

const ROUTE_PRELOADERS: Array<{ match: (routePath: string) => boolean; loaders: RouteLoader[] }> = [
  {
    match: (routePath) => routePath === '/guid',
    loaders: [() => import('@renderer/pages/guid')],
  },
  {
    match: (routePath) => routePath === '/remote/devices',
    loaders: [() => import('@renderer/pages/RemoteDevicesPage')],
  },
  {
    match: (routePath) => routePath === '/hooks' || routePath === '/settings/hooks',
    loaders: [
      () => import('@renderer/pages/settings/AgentSettings/HooksManagement'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/connectors' || routePath.startsWith('/connectors/'),
    loaders: [() => import('@renderer/pages/connectors')],
  },
  {
    match: (routePath) => routePath === '/skills-hub' || routePath === '/settings/skills-hub',
    loaders: [() => import('@renderer/pages/settings/SkillsHubSettings')],
  },
  {
    match: (routePath) => routePath === '/agents' || routePath === '/settings/agent',
    loaders: [() => import('@renderer/pages/settings/AgentSettings')],
  },
  {
    match: (routePath) =>
      routePath === '/settings/system' || routePath === '/settings/about' || routePath === '/settings/display',
    loaders: [
      () => import('@renderer/pages/settings/SystemSettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/settings/webui',
    loaders: [
      () => import('@renderer/pages/settings/WebuiSettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/settings/commands',
    loaders: [
      () => import('@renderer/pages/settings/ToolsSettings/CommandSettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/settings/gemini',
    loaders: [
      () => import('@renderer/pages/settings/GeminiSettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/settings/model',
    loaders: [
      () => import('@renderer/pages/settings/ModeSettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) =>
      routePath === '/settings/runtime' ||
      routePath === '/settings/channels' ||
      routePath === '/settings/active-sessions' ||
      routePath === '/settings/agent-entry',
    loaders: [
      () => import('@renderer/pages/settings/AgentSettings/AgentEntrySettings'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
  {
    match: (routePath) => routePath === '/settings/system-runs',
    loaders: [
      () => import('@renderer/pages/settings/AgentSettings/SystemRunsPage'),
      () => import('@renderer/pages/settings/components/SettingsSider'),
    ],
  },
];

const preloadSettled = new Set<string>();

const normalizePreloadPath = (routePath: string): string => {
  const trimmed = normalizeStableHashRoute(routePath);
  return trimmed.split(/[?#]/)[0] || '/guid';
};

const collectPreloaders = (routePath: string): RouteLoader[] => {
  const normalized = normalizePreloadPath(routePath);
  return ROUTE_PRELOADERS.filter((entry) => entry.match(normalized)).flatMap((entry) => entry.loaders);
};

export function preloadRoutePath(routePath: string): void {
  const normalized = normalizePreloadPath(routePath);
  if (preloadSettled.has(normalized)) {
    return;
  }

  const loaders = collectPreloaders(normalized);
  if (loaders.length === 0) {
    return;
  }

  preloadSettled.add(normalized);
  void Promise.all(loaders.map((loader) => loader())).catch(() => {
    preloadSettled.delete(normalized);
  });
}

export function warmCriticalRendererRoutes(): void {
  const warm = () => {
    ['/guid', '/settings/system', '/connectors', '/settings/hooks'].forEach((routePath) => {
      preloadRoutePath(routePath);
    });
  };

  if (typeof window === 'undefined') {
    warm();
    return;
  }

  type IdleWindow = Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(warm, { timeout: 1200 });
    return;
  }

  window.setTimeout(warm, 250);
}
