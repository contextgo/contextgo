import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudAuthProviderId } from '@/common/types/cloud';

type MockRequest = {
  method: string;
  url: string;
};

type MockResponse = {
  body: string;
  headers: Record<string, string>;
  statusCode: number;
  end: (body?: string) => void;
  writeHead: (statusCode: number, headers?: Record<string, string>) => void;
};

type MockServer = {
  address: () => { address: string; family: string; port: number };
  close: () => void;
  listen: (_port: number, _host: string) => void;
  off: (event: string, callback: () => void) => void;
  on: (event: string, callback: (error: Error) => void) => void;
  once: (event: string, callback: ((error: Error) => void) | (() => void)) => void;
  unref: () => void;
};

const shellOpenExternal = vi.fn();
const fetchSessionUserResponse = {
  authenticated: true,
  user: {
    id: 'user-1',
    email: 'dev@example.com',
    username: 'dev-user',
    displayName: 'Dev User',
    avatarUrl: null,
  },
};
const completeDesktopLoginResponse = {
  success: true,
  authenticated: true,
  user: fetchSessionUserResponse.user,
  provider: 'github',
};

const processConfigState = new Map<string, unknown>();
const processConfigMock = {
  get: vi.fn(async (key: string) => processConfigState.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    processConfigState.set(key, value);
  }),
  remove: vi.fn(async (key: string) => {
    processConfigState.delete(key);
  }),
};

const officialRemoteTunnelState = {
  desired: false,
  running: false,
  browserEntryReady: false,
  needsAttention: false,
};

const officialRemoteTunnelServiceMock = {
  initialize: vi.fn(),
  reconcile: vi.fn(async () => undefined),
  getState: vi.fn(() => ({ ...officialRemoteTunnelState })),
};

const authSessionFetch = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.endsWith('/api/auth/session')) {
    return new Response(JSON.stringify(fetchSessionUserResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/api/auth/desktop/consume')) {
    return new Response(JSON.stringify(completeDesktopLoginResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/api/devices/register')) {
    return new Response(
      JSON.stringify({
        success: true,
        device: {
          id: 'device-1',
          userId: 'user-1',
          deviceName: 'ContextGo on dev-host',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
          lastSeenAt: '2026-04-01T00:00:00Z',
          lastIpAddress: null,
          lastUserAgent: null,
        },
        token: 'ctxdev_token',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (url.endsWith('/api/integrations/infermesh/handoff')) {
    return new Response(
      JSON.stringify({ success: true, url: 'https://infermesh.org/api/oauth/contextgo/handoff?token=test-handoff' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  throw new Error(`Unexpected fetch URL: ${url} ${init?.method ?? 'GET'}`);
});

let serverRequestHandler: ((request: MockRequest, response: MockResponse) => void) | null = null;
let onceListeners = new Map<string, Array<((error: Error) => void) | (() => void)>>();
let onListeners = new Map<string, Array<(error: Error) => void>>();

function emitOnce(event: string): void {
  const listeners = onceListeners.get(event) ?? [];
  onceListeners.delete(event);
  for (const listener of listeners) {
    (listener as () => void)();
  }
}

function createMockServer(): MockServer {
  return {
    address: () => ({
      address: '127.0.0.1',
      family: 'IPv4',
      port: 43123,
    }),
    close: () => undefined,
    listen: (_port: number, _host: string) => {
      emitOnce('listening');
    },
    off: (event: string, callback: () => void) => {
      const listeners = onceListeners.get(event);
      if (!listeners) {
        return;
      }
      onceListeners.set(
        event,
        listeners.filter((listener) => listener !== callback)
      );
    },
    on: (event: string, callback: (error: Error) => void) => {
      const listeners = onListeners.get(event) ?? [];
      listeners.push(callback);
      onListeners.set(event, listeners);
    },
    once: (event: string, callback: ((error: Error) => void) | (() => void)) => {
      const listeners = onceListeners.get(event) ?? [];
      listeners.push(callback);
      onceListeners.set(event, listeners);
    },
    unref: () => undefined,
  };
}

vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof import('node:http')>('node:http');
  return {
    ...actual,
    createServer: vi.fn((handler) => {
      serverRequestHandler = handler as (request: MockRequest, response: MockResponse) => void;
      return createMockServer();
    }),
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getName: () => 'ContextGo',
    whenReady: () => Promise.resolve(),
  },
  session: {
    fromPartition: vi.fn(() => ({
      fetch: authSessionFetch,
      clearStorageData: vi.fn(async () => undefined),
    })),
  },
  shell: {
    openExternal: shellOpenExternal,
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    systemSettings: {
      languageChanged: {
        emit: vi.fn(),
      },
    },
    cloud: {
      statusChanged: {
        emit: vi.fn(),
      },
    },
  },
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: processConfigMock,
}));

vi.mock('@process/services/i18n', () => ({
  changeLanguage: vi.fn(async () => undefined),
}));

const ensureDesktopWebUIForOfficialRemoteMock = vi.fn(async () => undefined);
const releaseDesktopWebUIForOfficialRemoteMock = vi.fn(async () => undefined);

vi.mock('@process/utils/webuiConfig', () => ({
  ensureDesktopWebUIForOfficialRemote: ensureDesktopWebUIForOfficialRemoteMock,
  releaseDesktopWebUIForOfficialRemote: releaseDesktopWebUIForOfficialRemoteMock,
}));

let deepLinkListener: ((payload: { action: string; params: Record<string, string> }) => void) | null = null;

vi.mock('@process/utils/deepLink', () => ({
  onDeepLinkReceived: vi.fn((listener: (payload: { action: string; params: Record<string, string> }) => void) => {
    deepLinkListener = listener;
    return () => {
      if (deepLinkListener === listener) {
        deepLinkListener = null;
      }
    };
  }),
}));

vi.mock('@/common/config/i18n', async () => {
  const actual = await vi.importActual<typeof import('@/common/config/i18n')>('@/common/config/i18n');
  return {
    ...actual,
    normalizeLanguageCode: vi.fn((value: string) => value),
  };
});

vi.mock('@/common/utils/cloudAuth', async () => {
  const actual = await vi.importActual<typeof import('@/common/utils/cloudAuth')>('@/common/utils/cloudAuth');
  return {
    ...actual,
    buildCloudDesktopOAuthStartUrl: vi.fn(actual.buildCloudDesktopOAuthStartUrl),
  };
});

vi.mock('@/common/config/constants', async () => {
  const actual = await vi.importActual<typeof import('@/common/config/constants')>('@/common/config/constants');
  return {
    ...actual,
    CONTEXTGO_AUTH_BASE_URL: 'https://auth.contextgo.test',
    CONTEXTGO_API_BASE_URL: 'https://api.contextgo.test',
  };
});

vi.mock('@/process/services/cloud/constants', () => ({
  CLOUD_API_BASE_URL: 'https://api.contextgo.test',
  CLOUD_AUTH_BASE_URL: 'https://auth.contextgo.test',
  CLOUD_AUTH_PROVIDERS: ['github', 'google'],
  CLOUD_AUTH_SESSION_PARTITION: 'persist:cloud-auth',
}));

vi.mock('@/process/services/cloud/OfficialRemoteTunnelService', () => ({
  getOfficialRemoteTunnelService: () => officialRemoteTunnelServiceMock,
}));

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CloudService desktop loopback login', () => {
  beforeEach(() => {
    processConfigState.clear();
    shellOpenExternal.mockReset();
    authSessionFetch.mockClear();
    processConfigMock.get.mockClear();
    processConfigMock.set.mockClear();
    processConfigMock.remove.mockClear();
    ensureDesktopWebUIForOfficialRemoteMock.mockClear();
    releaseDesktopWebUIForOfficialRemoteMock.mockClear();
    officialRemoteTunnelServiceMock.initialize.mockClear();
    officialRemoteTunnelServiceMock.reconcile.mockClear();
    officialRemoteTunnelServiceMock.getState.mockClear();
    Object.assign(officialRemoteTunnelState, {
      desired: false,
      running: false,
      browserEntryReady: false,
      needsAttention: false,
    });
    serverRequestHandler = null;
    deepLinkListener = null;
    onceListeners = new Map();
    onListeners = new Map();
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function importCloudService() {
    const mod = await import('@/process/services/cloud/CloudService');
    return mod.CloudService.getInstance();
  }

  async function finishLoopback(shellUrl: string, params: Record<string, string>) {
    if (!serverRequestHandler) {
      throw new Error('Loopback handler was not registered');
    }

    const callbackUrl = new URL(new URL(shellUrl).searchParams.get('next')!);
    const loopback = new URL(callbackUrl.searchParams.get('loopback')!);
    Object.entries(params).forEach(([key, value]) => loopback.searchParams.set(key, value));

    const response: MockResponse = {
      body: '',
      headers: {},
      statusCode: 200,
      end(body?: string) {
        this.body = body ?? '';
      },
      writeHead(statusCode: number, headers?: Record<string, string>) {
        this.statusCode = statusCode;
        this.headers = headers ?? {};
      },
    };

    serverRequestHandler(
      {
        method: 'GET',
        url: `${loopback.pathname}${loopback.search}`,
      },
      response
    );

    return response;
  }

  function emitDeepLink(params: Record<string, string>) {
    if (!deepLinkListener) {
      throw new Error('Deep-link listener was not registered');
    }

    deepLinkListener({
      action: 'cloud-login',
      params,
    });
  }

  it('prepares official remote runtime on startup when a stored device token exists before browser session refresh recovers', async () => {
    const defaultFetch = authSessionFetch.getMockImplementation();

    authSessionFetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/session')) {
        return new Response(JSON.stringify({ authenticated: false, user: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!defaultFetch) {
        throw new Error(`Unexpected fetch URL: ${url} ${init?.method ?? 'GET'}`);
      }

      return defaultFetch(url, init);
    });

    processConfigState.set('cloud.user', fetchSessionUserResponse.user);
    processConfigState.set('cloud.device', {
      id: 'device-1',
      userId: 'user-1',
      deviceName: 'ContextGo on dev-host',
      platform: 'macos',
      status: 'active',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    const cloudService = await importCloudService();
    cloudService.initialize();
    await flushAsyncWork();

    expect(ensureDesktopWebUIForOfficialRemoteMock).toHaveBeenCalledTimes(2);
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('cloud-init');
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('official-remote-ensure-ready');
  });

  it('re-ensures official remote runtime after system resume when a stored device token exists', async () => {
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    const cloudService = await importCloudService();
    cloudService.handleSystemResume();
    await flushAsyncWork();

    expect(ensureDesktopWebUIForOfficialRemoteMock).toHaveBeenCalledTimes(1);
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('system-resume');
  });

  it('auto-ensures official remote readiness on startup when the desktop is already signed in', async () => {
    officialRemoteTunnelServiceMock.reconcile.mockImplementation(async (reason: string) => {
      if (reason === 'official-remote-ensure-ready') {
        Object.assign(officialRemoteTunnelState, {
          desired: true,
          running: true,
          browserEntryReady: true,
          needsAttention: false,
        });
      }
    });

    const cloudService = await importCloudService();
    cloudService.initialize();
    await flushAsyncWork();

    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('cloud-init');
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('official-remote-ensure-ready');
  });

  it('auto-recovers the desktop device binding after the cloud session refresh succeeds later', async () => {
    const defaultFetch = authSessionFetch.getMockImplementation();

    authSessionFetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/session')) {
        return new Response(JSON.stringify({ authenticated: false, user: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!defaultFetch) {
        throw new Error(`Unexpected fetch URL: ${url} ${init?.method ?? 'GET'}`);
      }

      return defaultFetch(url, init);
    });

    officialRemoteTunnelServiceMock.reconcile.mockImplementation(async (reason: string) => {
      if (reason === 'official-remote-ensure-ready') {
        Object.assign(officialRemoteTunnelState, {
          desired: true,
          running: true,
          browserEntryReady: true,
          needsAttention: false,
        });
      }
    });

    processConfigState.set('cloud.user', fetchSessionUserResponse.user);

    const cloudService = await importCloudService();
    cloudService.initialize();
    await flushAsyncWork();

    expect(processConfigState.get('cloud.deviceToken')).toBeUndefined();

    await cloudService.getStatus();
    await flushAsyncWork();

    const recoveredStatus = await cloudService.getStatus();

    expect(recoveredStatus.deviceTokenAvailable).toBe(true);
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('official-remote-ensure-ready');
  });

  it('opens browser login with loopback callback and consumes returned code', async () => {
    const cloudService = await importCloudService();
    let openedUrl = '';

    shellOpenExternal.mockImplementation(async (url: string) => {
      openedUrl = url;
      await finishLoopback(url, {
        provider: 'github',
        code: 'desktop-code-1',
      });
    });

    const status = await cloudService.startLogin('github' satisfies CloudAuthProviderId);

    const opened = new URL(openedUrl);
    const nextUrl = new URL(opened.searchParams.get('next')!);
    expect(opened.pathname).toBe('/api/auth/oauth/github/start');
    expect(nextUrl.searchParams.get('loopback')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/contextgo-cloud-login\//);
    expect(authSessionFetch).toHaveBeenCalledWith(
      'https://auth.contextgo.test/api/auth/desktop/consume',
      expect.objectContaining({ method: 'POST' })
    );
    expect(status.authenticated).toBe(true);
    expect(status.deviceTokenAvailable).toBe(true);
  });

  it('accepts legacy deep-link desktop callbacks while loopback rollout is incomplete', async () => {
    const cloudService = await importCloudService();

    shellOpenExternal.mockImplementation(async (url: string) => {
      const opened = new URL(url);
      const nextUrl = new URL(opened.searchParams.get('next')!);

      expect(nextUrl.searchParams.get('loopback')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/contextgo-cloud-login\//);
      emitDeepLink({
        provider: 'github',
        code: 'desktop-code-legacy',
      });
    });

    const status = await cloudService.startLogin('github' satisfies CloudAuthProviderId);

    expect(authSessionFetch).toHaveBeenCalledWith(
      'https://auth.contextgo.test/api/auth/desktop/consume',
      expect.objectContaining({ method: 'POST' })
    );
    expect(status.authenticated).toBe(true);
    expect(status.deviceTokenAvailable).toBe(true);
  });

  it('surfaces loopback callback errors for packaged desktop login too', async () => {
    const cloudService = await importCloudService();

    shellOpenExternal.mockImplementation(async (url: string) => {
      const response = await finishLoopback(url, {
        provider: 'github',
        error: 'access_denied',
      });
      expect(response.body).toContain('ContextGo sign-in could not be completed: access_denied.');
      expect(response.statusCode).toBe(200);
    });

    await expect(cloudService.startLogin('github' satisfies CloudAuthProviderId)).rejects.toThrow(
      'Cloud login failed: access_denied'
    );
  });

  it('opens InferMesh through a trusted handoff when the desktop device is linked', async () => {
    const cloudService = await importCloudService();

    processConfigState.set('cloud.user', fetchSessionUserResponse.user);
    processConfigState.set('cloud.device', {
      id: 'device-1',
      userId: 'user-1',
      deviceName: 'ContextGo on dev-host',
      platform: 'macos',
      status: 'active',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
      lastSeenAt: '2026-04-01T00:00:00Z',
      lastIpAddress: null,
      lastUserAgent: null,
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    await cloudService.openInfermesh();

    expect(authSessionFetch).toHaveBeenCalledWith(
      'https://api.contextgo.test/api/integrations/infermesh/handoff',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer ctxdev_token' }),
      })
    );
    expect(shellOpenExternal).toHaveBeenCalledWith(
      'https://infermesh.org/api/oauth/contextgo/handoff?token=test-handoff'
    );
  });

  it('falls back to the public InferMesh login page when cloud auth is missing', async () => {
    const cloudService = await importCloudService();
    const defaultFetch = authSessionFetch.getMockImplementation();

    authSessionFetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/session')) {
        return new Response(JSON.stringify({ authenticated: false, user: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!defaultFetch) {
        throw new Error(`Unexpected fetch URL: ${url} ${init?.method ?? 'GET'}`);
      }

      return defaultFetch(url, init);
    });

    await cloudService.openInfermesh();

    expect(shellOpenExternal).toHaveBeenCalledWith('https://infermesh.org/login?provider=oidc&auto=1&source=contextgo');
  });

  it('waits for official remote readiness after ensuring the desktop browser entry', async () => {
    const cloudService = await importCloudService();

    processConfigState.set('cloud.user', fetchSessionUserResponse.user);
    processConfigState.set('cloud.device', {
      id: 'device-1',
      userId: 'user-1',
      deviceName: 'ContextGo on dev-host',
      platform: 'macos',
      status: 'active',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    officialRemoteTunnelServiceMock.reconcile.mockImplementation(async () => {
      Object.assign(officialRemoteTunnelState, {
        desired: true,
        running: true,
        browserEntryReady: true,
        needsAttention: false,
      });
    });

    const status = await cloudService.ensureOfficialRemoteReady();

    expect(ensureDesktopWebUIForOfficialRemoteMock).toHaveBeenCalledTimes(1);
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('official-remote-ensure-ready');
    expect(status.officialRemoteReady).toBe(true);
  });

  it('releases the official remote desktop runtime on logout', async () => {
    const cloudService = await importCloudService();

    processConfigState.set('cloud.user', fetchSessionUserResponse.user);
    processConfigState.set('cloud.device', {
      id: 'device-1',
      userId: 'user-1',
      deviceName: 'ContextGo on dev-host',
      platform: 'macos',
      status: 'active',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    await cloudService.logout();

    expect(releaseDesktopWebUIForOfficialRemoteMock).toHaveBeenCalledTimes(1);
  });
});
