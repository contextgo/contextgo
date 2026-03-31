import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const socketInstances: FakeWebSocket[] = [];

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

vi.mock('@/common/adapter/registry', () => ({
  getBridgeEmitter: () => ({ emit: vi.fn() }),
  registerWebSocketBroadcaster: () => () => {},
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: vi.fn(async (key: string) => storage.get(key)),
  },
}));

function flushPromises(): Promise<void> {
  return Promise.resolve()
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined);
}

describe('OfficialRemoteTunnelService relay helpers', () => {
  beforeEach(() => {
    storage.clear();
    socketInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    socketInstances.length = 0;
  });

  it('builds a secure websocket relay URL from the cloud API base URL', async () => {
    const { buildOfficialRemoteRelayWebSocketUrl } = await import('@/process/services/cloud/OfficialRemoteTunnelService');

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
  let serviceUnderTest: InstanceType<typeof import('@/process/services/cloud/OfficialRemoteTunnelService').OfficialRemoteTunnelService> | null =
    null;

  beforeEach(() => {
    storage.clear();
    socketInstances.length = 0;
    vi.clearAllMocks();
    serviceUnderTest = null;
  });

  afterEach(async () => {
    await serviceUnderTest?.dispose();
    socketInstances.length = 0;
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
});
