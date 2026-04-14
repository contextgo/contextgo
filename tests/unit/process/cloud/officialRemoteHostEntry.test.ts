import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CloudUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type FakeAuthSession = {
  clearStorageData: ReturnType<typeof vi.fn>;
  fetch: ReturnType<typeof vi.fn>;
};

type HostRuntimeStatus = {
  running: boolean;
  port: number | null;
  allowRemote: boolean;
  demandSources: Array<'local-client' | 'official-remote'>;
};

class FakeWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readonly sentFrames: string[] = [];
  public readyState = FakeWebSocket.CONNECTING;

  constructor(
    public readonly url: string,
    public readonly options?: { headers?: Record<string, string> }
  ) {
    super();
  }

  public send(payload: string): void {
    this.sentFrames.push(payload);
  }

  public close(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }

  public terminate(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  public open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open');
  }
}

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('CloudService host browser entry ownership', () => {
  const processConfigState = new Map<string, unknown>();
  const sessionUser: CloudUser = {
    id: 'user-1',
    email: 'dev@example.com',
    username: 'dev-user',
    displayName: 'Dev User',
    avatarUrl: null,
  };

  let browserSessionAuthenticated = true;
  let officialRemoteState = {
    desired: false,
    running: false,
    browserEntryReady: false,
    needsAttention: false,
  };
  let authSession: FakeAuthSession;
  let hostBrowserEntryServiceMock: {
    ensureForDemand: ReturnType<typeof vi.fn>;
    getLocalBaseUrl: ReturnType<typeof vi.fn>;
    getRuntimeStatus: ReturnType<typeof vi.fn>;
    releaseDemand: ReturnType<typeof vi.fn>;
  };
  let officialRemoteTunnelServiceMock: {
    dispose: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    reconcile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetModules();
    processConfigState.clear();
    browserSessionAuthenticated = true;
    officialRemoteState = {
      desired: true,
      running: false,
      browserEntryReady: false,
      needsAttention: false,
    };

    authSession = {
      clearStorageData: vi.fn(async () => undefined),
      fetch: vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/auth/session')) {
          return new Response(
            JSON.stringify({
              authenticated: browserSessionAuthenticated,
              user: browserSessionAuthenticated ? sessionUser : null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (url.endsWith('/api/auth/logout')) {
          browserSessionAuthenticated = false;
          return new Response(null, { status: 200 });
        }

        throw new Error(`Unexpected auth session fetch: ${url} ${init?.method ?? 'GET'}`);
      }),
    };

    hostBrowserEntryServiceMock = {
      ensureForDemand: vi.fn(async () => ({
        allowRemote: false,
        port: 35808,
      })),
      getLocalBaseUrl: vi.fn(() => 'http://127.0.0.1:35808'),
      getRuntimeStatus: vi.fn(
        (): HostRuntimeStatus => ({
          allowRemote: false,
          demandSources: ['official-remote'],
          port: 35808,
          running: true,
        })
      ),
      releaseDemand: vi.fn(async () => undefined),
    };

    officialRemoteTunnelServiceMock = {
      dispose: vi.fn(async () => undefined),
      getState: vi.fn(() => ({ ...officialRemoteState })),
      initialize: vi.fn(),
      reconcile: vi.fn(async () => {
        officialRemoteState = {
          ...officialRemoteState,
          browserEntryReady: true,
          running: true,
        };
      }),
    };

    vi.doMock('electron', () => ({
      app: {
        getName: () => 'ContextGo',
        isPackaged: false,
        whenReady: () => Promise.resolve(),
      },
      session: {
        fromPartition: vi.fn(() => authSession),
      },
      shell: {
        openExternal: vi.fn(async () => undefined),
      },
    }));

    vi.doMock('@/common', () => ({
      ipcBridge: {
        cloud: {
          statusChanged: {
            emit: vi.fn(),
          },
        },
        systemSettings: {
          languageChanged: {
            emit: vi.fn(),
          },
        },
      },
    }));

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: vi.fn(async (key: string) => processConfigState.get(key)),
        remove: vi.fn(async (key: string) => {
          processConfigState.delete(key);
        }),
        set: vi.fn(async (key: string, value: unknown) => {
          processConfigState.set(key, value);
        }),
      },
    }));

    vi.doMock('@process/utils/deepLink', () => ({
      onDeepLinkReceived: vi.fn(() => () => undefined),
    }));

    vi.doMock('@process/utils/webuiConfig', () => ({
      ensureDesktopWebUIForOfficialRemote: vi.fn(async () => {
        throw new Error('legacy webui helper should not be used by CloudService');
      }),
      getPreferredDesktopWebUIPort: vi.fn(async () => 35808),
      releaseDesktopWebUIForOfficialRemote: vi.fn(async () => {
        throw new Error('legacy webui helper should not be used by CloudService');
      }),
    }));

    vi.doMock('@process/services/cloud/OfficialRemoteTunnelService', () => ({
      getOfficialRemoteTunnelService: () => officialRemoteTunnelServiceMock,
    }));

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => hostBrowserEntryServiceMock,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ensures Official Remote readiness through HostBrowserEntryService', async () => {
    processConfigState.set('cloud.user', sessionUser);
    processConfigState.set('cloud.device', {
      createdAt: '2026-04-01T00:00:00Z',
      deviceName: 'ContextGo on dev-host',
      id: 'device-1',
      platform: 'macos',
      status: 'active',
      updatedAt: '2026-04-01T00:00:00Z',
      userId: 'user-1',
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');
    processConfigState.set('webui.desktop.port', 35808);

    const { CloudService } = await import('@/process/services/cloud/CloudService');
    const service = CloudService.getInstance();

    const status = await service.ensureOfficialRemoteReady();

    expect(hostBrowserEntryServiceMock.ensureForDemand).toHaveBeenCalledWith('official-remote', {
      allowPortFallback: true,
      allowRemote: false,
      preferredPort: 35808,
      reason: 'official-remote',
    });
    expect(officialRemoteTunnelServiceMock.reconcile).toHaveBeenCalledWith('official-remote-ensure-ready');
    expect(status.officialRemoteReady).toBe(true);
  });

  it('releases the Official Remote demand through HostBrowserEntryService on logout', async () => {
    processConfigState.set('cloud.user', sessionUser);
    processConfigState.set('cloud.device', {
      createdAt: '2026-04-01T00:00:00Z',
      deviceName: 'ContextGo on dev-host',
      id: 'device-1',
      platform: 'macos',
      status: 'active',
      updatedAt: '2026-04-01T00:00:00Z',
      userId: 'user-1',
    });
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');

    const { CloudService } = await import('@/process/services/cloud/CloudService');
    const service = CloudService.getInstance();

    await service.logout();

    expect(hostBrowserEntryServiceMock.releaseDemand).toHaveBeenCalledWith(
      'official-remote',
      'Official Remote runtime released after cloud logout'
    );
  });
});

describe('OfficialRemoteTunnelService host runtime readiness', () => {
  let hostRuntimeStatus: HostRuntimeStatus;

  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/process/services/cloud/OfficialRemoteTunnelService');
    vi.doUnmock('@process/services/cloud/OfficialRemoteTunnelService');
    hostRuntimeStatus = {
      allowRemote: false,
      demandSources: ['official-remote'],
      port: 43123,
      running: true,
    };

    vi.doMock('ws', () => ({
      default: FakeWebSocket,
    }));

    vi.doMock('@/common/adapter/registry', () => ({
      getBridgeEmitter: () => ({ emit: vi.fn() }),
      registerWebSocketBroadcaster: () => () => undefined,
    }));

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: vi.fn(async (key: string) => {
          if (key === 'cloud.deviceToken') {
            return 'ctxdev_token';
          }
          if (key === 'webui.desktop.enabled') {
            return false;
          }
          if (key === 'webui.desktop.port') {
            return 25809;
          }
          return undefined;
        }),
      },
    }));

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => ({
        getRuntimeStatus: vi.fn(() => ({ ...hostRuntimeStatus })),
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks browser entry ready from host runtime status even without desktop WebUI preference enabled', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    const service = new OfficialRemoteTunnelService();
    service.initialize();
    await service.reconcile('test');

    const socket = (service as unknown as { socket: FakeWebSocket | null }).socket;
    expect(socket).not.toBeNull();

    socket?.open();
    await flushPromises();

    expect(service.getState()).toMatchObject({
      browserEntryReady: true,
      needsAttention: false,
      running: true,
    });
    expect(socket?.sentFrames).toHaveLength(1);
    expect(JSON.parse(socket?.sentFrames[0] ?? '{}')).toEqual({
      browserEntry: {
        ready: true,
        url: 'official-remote://relay-ready',
      },
      type: 'hello',
    });
  });
});

describe('OfficialRemoteBrowserRelay host runtime URL resolution', () => {
  const sendFrame = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/process/services/cloud/OfficialRemoteBrowserRelay');
    vi.doUnmock('@process/services/cloud/OfficialRemoteBrowserRelay');
    sendFrame.mockReset();

    vi.doMock('@process/bridge/webuiBridge', () => ({
      getWebServerInstance: vi.fn(() => null),
    }));

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: vi.fn(async (key: string) => {
          if (key === 'webui.desktop.port') {
            return 25809;
          }
          return undefined;
        }),
      },
    }));

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => ({
        getLocalBaseUrl: vi.fn(() => 'http://127.0.0.1:43123'),
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards relay HTTP traffic to the host runtime base URL instead of persisted desktop settings', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      return new Response('ok', {
        headers: {
          'Content-Type': 'text/plain',
        },
        status: 200,
      });
    }) as typeof fetch;

    try {
      const { OfficialRemoteBrowserRelay } = await import('@/process/services/cloud/OfficialRemoteBrowserRelay');
      const relay = new OfficialRemoteBrowserRelay(sendFrame);

      await relay.handleHttpRequest({
        request: {
          headers: {},
          method: 'GET',
          path: '/healthz',
        },
        requestId: 'req-1',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        new URL('http://127.0.0.1:43123/healthz'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(sendFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          response: expect.objectContaining({
            statusCode: 200,
          }),
          type: 'http_response',
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
