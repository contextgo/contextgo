import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockServer = {
  close: (callback?: () => void) => void;
};

type MockWss = {
  clients: Set<{ close: (code?: number, reason?: string) => void }>;
};

const processConfigMock = {
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
};

const startWebServerWithInstanceMock = vi.fn();
const cleanupWebAdapterMock = vi.fn();
const statusChangedEmitMock = vi.fn();

describe('HostBrowserEntryService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('electron', () => ({
      app: {
        whenReady: vi.fn(() => Promise.resolve()),
      },
    }));

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: processConfigMock,
    }));

    vi.doMock('@process/webserver', () => ({
      startWebServerWithInstance: startWebServerWithInstanceMock,
    }));

    vi.doMock('@process/webserver/adapter', () => ({
      cleanupWebAdapter: cleanupWebAdapterMock,
    }));

    vi.doMock('@/common/adapter/ipcBridge', () => ({
      webui: {
        statusChanged: {
          emit: statusChangedEmitMock,
        },
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts once and reuses the same runtime across demand sources', async () => {
    const closeClient = vi.fn();
    const server: MockServer = {
      close: (callback) => callback?.(),
    };
    const wss: MockWss = {
      clients: new Set([{ close: closeClient }]),
    };
    startWebServerWithInstanceMock.mockResolvedValue({
      server,
      wss,
      port: 43123,
      allowRemote: false,
    });

    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    const first = await service.ensureForDemand('official-remote', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'official-remote',
      allowPortFallback: true,
    });
    const second = await service.ensureForDemand('local-client', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'local-client',
    });

    expect(startWebServerWithInstanceMock).toHaveBeenCalledTimes(1);
    expect(first.port).toBe(43123);
    expect(second.port).toBe(43123);
    expect(service.getLocalBaseUrl()).toBe('http://localhost:43123');
    expect(service.getDemandState('local-client')).toMatchObject({
      active: true,
      allowRemote: false,
      preferredPort: 25809,
    });
    expect(service.getDemandState('official-remote')).toMatchObject({
      active: true,
      allowRemote: false,
      allowPortFallback: true,
      preferredPort: 25809,
    });
    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'running',
      running: true,
      port: 43123,
      allowRemote: false,
      demandSources: ['local-client', 'official-remote'],
    });
  });

  it('reports starting lifecycle while the browser entry is still booting', async () => {
    let resolveStartup:
      | ((instance: { server: MockServer; wss: MockWss; port: number; allowRemote: boolean }) => void)
      | null = null;
    startWebServerWithInstanceMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStartup = resolve;
        })
    );

    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    const startupPromise = service.ensureForDemand('local-client', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'local-client',
    });

    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'starting',
      running: false,
      port: null,
    });

    await Promise.resolve();
    resolveStartup?.({
      allowRemote: false,
      port: 43123,
      server: {
        close: (callback) => callback?.(),
      },
      wss: {
        clients: new Set(),
      },
    });
    await startupPromise;

    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'running',
      running: true,
      port: 43123,
    });
  });

  it('reports degraded lifecycle when startup fails with an active demand', async () => {
    startWebServerWithInstanceMock.mockRejectedValueOnce(new Error('boom'));

    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    await expect(
      service.ensureForDemand('official-remote', {
        preferredPort: 25809,
        allowRemote: false,
        reason: 'official-remote',
      })
    ).rejects.toThrow('boom');

    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'degraded',
      running: false,
      port: null,
    });
  });

  it('keeps the runtime alive until the last demand is released', async () => {
    const closeClient = vi.fn();
    const server: MockServer = {
      close: (callback) => callback?.(),
    };
    const wss: MockWss = {
      clients: new Set([{ close: closeClient }]),
    };
    startWebServerWithInstanceMock.mockResolvedValue({
      server,
      wss,
      port: 43123,
      allowRemote: false,
    });

    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    await service.ensureForDemand('official-remote', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'official-remote',
      allowPortFallback: true,
    });
    await service.ensureForDemand('local-client', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'local-client',
    });

    await service.releaseDemand('official-remote', 'official-remote released');

    expect(service.getRuntimeStatus()).toMatchObject({
      running: true,
      demandSources: ['local-client'],
    });
    expect(cleanupWebAdapterMock).not.toHaveBeenCalled();

    await service.releaseDemand('local-client', 'local-client released');

    expect(closeClient).toHaveBeenCalledWith(1000, 'local-client released');
    expect(cleanupWebAdapterMock).toHaveBeenCalledTimes(1);
    expect(service.getRuntimeStatus()).toMatchObject({
      running: false,
      demandSources: [],
    });
    expect(service.getLocalBaseUrl()).toBeNull();
  });

  it('reports stopping lifecycle while shutting down the current runtime', async () => {
    let resolveClose: (() => void) | null = null;
    const server: MockServer = {
      close: (callback) => {
        resolveClose = () => callback?.();
      },
    };
    const wss: MockWss = {
      clients: new Set(),
    };
    startWebServerWithInstanceMock.mockResolvedValue({
      server,
      wss,
      port: 43123,
      allowRemote: false,
    });

    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    await service.ensureForDemand('local-client', {
      preferredPort: 25809,
      allowRemote: false,
      reason: 'local-client',
    });

    const stopPromise = service.releaseDemand('local-client', 'local-client released');

    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'stopping',
      running: true,
      port: 43123,
    });

    resolveClose?.();
    await stopPromise;

    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'stopped',
      running: false,
      port: null,
    });
  });

  it('returns null base URL when no runtime is active', async () => {
    const { HostBrowserEntryService } = await import('@process/services/host/HostBrowserEntryService');
    const service = new HostBrowserEntryService();

    expect(service.getLocalBaseUrl()).toBeNull();
    expect(service.getDemandState('local-client')).toMatchObject({
      active: false,
      allowRemote: false,
      preferredPort: null,
    });
    expect(service.getRuntimeStatus()).toMatchObject({
      lifecycle: 'stopped',
      running: false,
      demandSources: [],
    });
  });
});
