import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const socketInstances: FakeWebSocket[] = [];
const relayInstances: MockOfficialRemoteBrowserRelay[] = [];
const hostRuntimeState = {
  allowRemote: false,
  demandSources: [] as Array<'local-client' | 'official-remote'>,
  port: null as number | null,
  running: false,
};

class FakeWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = FakeWebSocket.CONNECTING;
  public readonly sentFrames: string[] = [];
  public readonly url: string;
  public readonly headers: Record<string, string> | undefined;

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    super();
    this.url = url;
    this.headers = options?.headers;
    socketInstances.push(this);
  }

  send(payload: string): void {
    this.sentFrames.push(payload);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }

  terminate(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open');
  }

  closeWith(code: number, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }
}

vi.mock('ws', () => ({
  default: FakeWebSocket,
}));

vi.mock('@process/bridge/webuiBridge', () => ({
  getWebServerInstance: vi.fn(() => null),
}));

class MockOfficialRemoteBrowserRelay {
  public readonly handleHttpRequest = vi.fn(async (_frame: unknown) => undefined);
  public readonly handleViteClientConnect = vi.fn(async (_frame: unknown) => undefined);
  public readonly handleViteClientFrame = vi.fn((_frame: unknown) => undefined);
  public readonly handleViteClientDisconnect = vi.fn((_frame: unknown) => undefined);
  public readonly dispose = vi.fn(async () => undefined);

  constructor(public readonly sendFrame: (frame: unknown) => void) {
    relayInstances.push(this);
  }
}

vi.mock('@/process/services/cloud/OfficialRemoteBrowserRelay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/process/services/cloud/OfficialRemoteBrowserRelay')>();
  return {
    ...actual,
    OfficialRemoteBrowserRelay: MockOfficialRemoteBrowserRelay,
  };
});

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    networkInterfaces: () => ({
      en0: [{ address: '192.168.1.8', family: 'IPv4', internal: false }],
    }),
  };
});

vi.mock('@/common/adapter/registry', () => ({
  getBridgeEmitter: () => ({ emit: vi.fn() }),
  registerWebSocketBroadcaster: () => () => {},
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: vi.fn(async (key: string) => storage.get(key)),
  },
}));

const hostBrowserEntryServiceMock = {
  getLocalBaseUrl: vi.fn(() =>
    hostRuntimeState.running && hostRuntimeState.port ? `http://127.0.0.1:${hostRuntimeState.port}` : null
  ),
  getRuntimeStatus: vi.fn(() => ({ ...hostRuntimeState })),
};

vi.mock('@process/services/host/HostBrowserEntryService', () => ({
  getHostBrowserEntryService: () => hostBrowserEntryServiceMock,
}));

function flushPromises(): Promise<void> {
  return Promise.resolve()
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined);
}

describe('OfficialRemoteBrowserRelay', () => {
  const originalFetch = global.fetch;
  const originalRendererUrl = process.env.ELECTRON_RENDERER_URL;

  beforeEach(() => {
    storage.clear();
    socketInstances.length = 0;
    hostRuntimeState.allowRemote = false;
    hostRuntimeState.demandSources = [];
    hostRuntimeState.port = null;
    hostRuntimeState.running = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalRendererUrl === undefined) {
      delete process.env.ELECTRON_RENDERER_URL;
    } else {
      process.env.ELECTRON_RENDERER_URL = originalRendererUrl;
    }
    socketInstances.length = 0;
  });

  it('prefers the configured renderer dev server host when probing official remote vite relay', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: url.startsWith('http://localhost:5173/@vite/client'),
      } as Response;
    }) as typeof fetch;

    const { buildLocalViteDevProbeUrls, resolveLocalViteDevWebSocketUrl } =
      await import('@/process/services/cloud/OfficialRemoteBrowserRelay');

    expect(buildLocalViteDevProbeUrls().map((url) => url.toString())).toEqual([
      'http://localhost:5173/',
      'http://[::1]:5173/',
      'http://127.0.0.1:5173/',
    ]);

    const socketUrl = await resolveLocalViteDevWebSocketUrl('token=abc');
    expect(socketUrl?.toString()).toBe('ws://localhost:5173/?token=abc');
    expect(global.fetch).toHaveBeenCalledWith(
      new URL('http://localhost:5173/@vite/client'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('falls back across localhost variants until a reachable vite dev server is found', async () => {
    delete process.env.ELECTRON_RENDERER_URL;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: url.startsWith('http://[::1]:5173/@vite/client'),
      } as Response;
    }) as typeof fetch;

    const { resolveLocalViteDevWebSocketUrl } = await import('@/process/services/cloud/OfficialRemoteBrowserRelay');

    const socketUrl = await resolveLocalViteDevWebSocketUrl();
    expect(socketUrl?.toString()).toBe('ws://[::1]:5173/');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to persisted desktop ports when host runtime is unavailable', async () => {
    storage.set('webui.desktop.port', 25809);
    hostRuntimeState.port = null;
    hostRuntimeState.running = false;
    const sendFrame = vi.fn();

    const { OfficialRemoteBrowserRelay } = await vi.importActual<
      typeof import('@/process/services/cloud/OfficialRemoteBrowserRelay')
    >('@/process/services/cloud/OfficialRemoteBrowserRelay');
    const relay = new OfficialRemoteBrowserRelay(sendFrame);

    await relay.handleHttpRequest({
      request: {
        headers: {},
        method: 'GET',
        path: '/healthz',
      },
      requestId: 'req-1',
    });

    expect(sendFrame).toHaveBeenCalledWith({
      type: 'http_error',
      requestId: 'req-1',
      message: 'Desktop WebUI is not available for Official Remote.',
    });
  });
});

describe('OfficialRemoteTunnelService relay helpers', () => {
  beforeEach(() => {
    storage.clear();
    socketInstances.length = 0;
    relayInstances.length = 0;
    hostRuntimeState.allowRemote = false;
    hostRuntimeState.demandSources = [];
    hostRuntimeState.port = null;
    hostRuntimeState.running = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    socketInstances.length = 0;
    relayInstances.length = 0;
  });

  it('builds a secure websocket relay URL from the cloud API base URL', async () => {
    const { buildOfficialRemoteRelayWebSocketUrl } =
      await import('@/process/services/cloud/OfficialRemoteTunnelService');

    expect(buildOfficialRemoteRelayWebSocketUrl('https://api.contextgo.io')).toBe(
      'wss://api.contextgo.io/api/remote/device-connect'
    );
    expect(buildOfficialRemoteRelayWebSocketUrl('http://127.0.0.1:3001')).toBe(
      'ws://127.0.0.1:3001/api/remote/device-connect'
    );
  });

  it('parses valid relay frames and rejects malformed payloads', async () => {
    const { parseOfficialRemoteRelayFrame } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    expect(parseOfficialRemoteRelayFrame('{"type":"hello","deviceId":"device-1"}')).toEqual({
      type: 'hello',
      deviceId: 'device-1',
    });
    expect(parseOfficialRemoteRelayFrame('{"foo":"bar"}')).toBeNull();
    expect(parseOfficialRemoteRelayFrame('not-json')).toBeNull();
  });
});

describe('OfficialRemoteTunnelService', () => {
  let serviceUnderTest: InstanceType<
    typeof import('@/process/services/cloud/OfficialRemoteTunnelService').OfficialRemoteTunnelService
  > | null = null;

  beforeEach(() => {
    storage.clear();
    socketInstances.length = 0;
    relayInstances.length = 0;
    hostRuntimeState.allowRemote = false;
    hostRuntimeState.demandSources = [];
    hostRuntimeState.port = null;
    hostRuntimeState.running = false;
    vi.clearAllMocks();
    serviceUnderTest = null;
  });

  afterEach(async () => {
    await serviceUnderTest?.dispose();
    socketInstances.length = 0;
    relayInstances.length = 0;
  });

  it('refreshes the device token and reconnects after a 4401 relay close', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    storage.set('cloud.deviceToken', 'ctxdev_old');
    const refreshDeviceToken = vi.fn(async () => {
      storage.set('cloud.deviceToken', 'ctxdev_new');
      return { refreshed: true };
    });

    const service = new OfficialRemoteTunnelService();
    serviceUnderTest = service;
    service.initialize(undefined, refreshDeviceToken);
    await service.reconcile('test');

    expect(socketInstances).toHaveLength(1);
    expect(socketInstances[0].headers?.Authorization).toBe('Bearer ctxdev_old');

    socketInstances[0].open();
    socketInstances[0].closeWith(4401, 'Invalid device token');
    await flushPromises();

    expect(refreshDeviceToken).toHaveBeenCalledTimes(1);
    expect(socketInstances).toHaveLength(2);
    expect(socketInstances[1].headers?.Authorization).toBe('Bearer ctxdev_new');
    expect(service.getState()).toMatchObject({
      desired: true,
      running: false,
      needsAttention: false,
    });
  });

  it('stops automatic relay recovery when token refresh cannot recover the desktop binding', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    storage.set('cloud.deviceToken', 'ctxdev_old');
    const refreshDeviceToken = vi.fn(async () => {
      storage.delete('cloud.deviceToken');
      return {
        refreshed: false,
        message: 'Official Remote needs a fresh cloud login before this desktop can reconnect.',
      };
    });

    const service = new OfficialRemoteTunnelService();
    serviceUnderTest = service;
    service.initialize(undefined, refreshDeviceToken);
    await service.reconcile('test');

    socketInstances[0].open();
    socketInstances[0].closeWith(4401, 'Invalid device token');
    await flushPromises();

    expect(refreshDeviceToken).toHaveBeenCalledTimes(1);
    expect(socketInstances).toHaveLength(1);
    expect(service.getState()).toMatchObject({
      desired: false,
      running: false,
      needsAttention: true,
      message: 'Official Remote needs a fresh cloud login before this desktop can reconnect.',
    });
  });

  it('marks browser entry ready locally as soon as the relay socket opens with a resolvable desktop runtime', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    storage.set('cloud.deviceToken', 'ctxdev_ready');
    hostRuntimeState.demandSources = ['official-remote'];
    hostRuntimeState.port = 25809;
    hostRuntimeState.running = true;

    const service = new OfficialRemoteTunnelService();
    serviceUnderTest = service;
    service.initialize();
    await service.reconcile('test');

    socketInstances[0].open();
    await flushPromises();

    expect(service.getState()).toMatchObject({
      desired: true,
      running: true,
      browserEntryReady: true,
      needsAttention: false,
    });

    expect(socketInstances[0].sentFrames).toHaveLength(1);
    expect(JSON.parse(socketInstances[0].sentFrames[0])).toEqual({
      type: 'hello',
      browserEntry: {
        url: 'official-remote://relay-ready',
        ready: true,
      },
    });
  });

  it('keeps the local browser runtime ready state when the relay hello frame omits browser entry data', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    storage.set('cloud.deviceToken', 'ctxdev_ready');
    hostRuntimeState.demandSources = ['official-remote'];
    hostRuntimeState.port = 25809;
    hostRuntimeState.running = true;

    const service = new OfficialRemoteTunnelService();
    serviceUnderTest = service;
    service.initialize();
    await service.reconcile('test');

    socketInstances[0].open();
    await flushPromises();
    socketInstances[0].emit(
      'message',
      JSON.stringify({
        type: 'hello',
        deviceId: 'device-1',
        connectedAt: '2026-04-02T00:00:00Z',
        transport: 'cloud-relay',
      })
    );

    expect(service.getState()).toMatchObject({
      desired: true,
      running: true,
      browserEntryReady: true,
      needsAttention: false,
    });
  });

  it('forwards http and vite relay frames into the desktop browser relay', async () => {
    const { OfficialRemoteTunnelService } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

    storage.set('cloud.deviceToken', 'ctxdev_ready');

    const service = new OfficialRemoteTunnelService();
    serviceUnderTest = service;
    service.initialize();
    await service.reconcile('test');

    expect(relayInstances).toHaveLength(1);

    socketInstances[0].open();
    await flushPromises();

    socketInstances[0].emit(
      'message',
      JSON.stringify({
        type: 'http_request',
        requestId: 'req-1',
        request: { method: 'GET', path: '/' },
      })
    );
    socketInstances[0].emit(
      'message',
      JSON.stringify({
        type: 'vite_client_connect',
        socketId: 'vite-1',
        query: 'token=1',
        protocols: ['vite-hmr'],
      })
    );
    socketInstances[0].emit(
      'message',
      JSON.stringify({
        type: 'vite_client_frame',
        socketId: 'vite-1',
        data: 'ping',
      })
    );
    socketInstances[0].emit(
      'message',
      JSON.stringify({
        type: 'vite_client_disconnect',
        socketId: 'vite-1',
        code: 1000,
        reason: 'done',
      })
    );

    expect(relayInstances[0].handleHttpRequest).toHaveBeenCalledWith({
      type: 'http_request',
      requestId: 'req-1',
      request: { method: 'GET', path: '/' },
    });
    expect(relayInstances[0].handleViteClientConnect).toHaveBeenCalledWith({
      type: 'vite_client_connect',
      socketId: 'vite-1',
      query: 'token=1',
      protocols: ['vite-hmr'],
    });
    expect(relayInstances[0].handleViteClientFrame).toHaveBeenCalledWith({
      type: 'vite_client_frame',
      socketId: 'vite-1',
      data: 'ping',
    });
    expect(relayInstances[0].handleViteClientDisconnect).toHaveBeenCalledWith({
      type: 'vite_client_disconnect',
      socketId: 'vite-1',
      code: 1000,
      reason: 'done',
    });
  });
});
