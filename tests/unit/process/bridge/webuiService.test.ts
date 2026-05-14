import { beforeEach, describe, expect, it, vi } from 'vitest';

const processConfigGetMock = vi.fn(async () => undefined);
const processConfigSetMock = vi.fn(async () => undefined);
const ensureLocalClientAccessMock = vi.fn();
const stopLocalClientAccessMock = vi.fn(async () => undefined);
const getCurrentInstanceMock = vi.fn();
const getSystemUserMock = vi.fn(async () => ({
  id: 'system-default-user',
  username: 'admin',
}));
const getRuntimeStatusMock = vi.fn();
const getLocalClientAccessStateMock = vi.fn();
const getInitialAdminPasswordMock = vi.fn(() => null);
const clearInitialAdminPasswordMock = vi.fn();

describe('WebuiService.getStatus', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: processConfigGetMock,
        set: processConfigSetMock,
      },
    }));

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {
        getSystemUser: getSystemUserMock,
      },
    }));

    vi.doMock('@process/services/host/HostRuntimeService', () => ({
      getHostRuntimeService: () => ({
        ensureLocalClientAccess: ensureLocalClientAccessMock,
        getCurrentInstance: getCurrentInstanceMock,
        getLocalClientAccessState: getLocalClientAccessStateMock,
        getRuntimeStatus: getRuntimeStatusMock,
        stopLocalClientAccess: stopLocalClientAccessMock,
      }),
    }));

    vi.doMock('@process/webserver/index', () => ({
      clearInitialAdminPassword: clearInitialAdminPasswordMock,
      getInitialAdminPassword: getInitialAdminPasswordMock,
    }));

    vi.doMock('os', () => ({
      networkInterfaces: () => ({
        en0: [{ address: '192.168.1.8', family: 'IPv4', internal: false }],
      }),
    }));
  });

  it('derives local-client state from HostBrowserEntryService instead of legacy desktop flags', async () => {
    getRuntimeStatusMock.mockReturnValue({
      allowRemote: true,
      demandSources: ['local-client', 'official-remote'],
      lifecycle: 'running',
      localUrl: 'http://localhost:43123',
      networkUrl: 'http://192.168.1.8:43123',
      port: 43123,
      running: true,
    });
    getLocalClientAccessStateMock.mockReturnValue({
      active: true,
      allowPortFallback: false,
      allowRemote: true,
      preferredPort: 43123,
    });

    const { WebuiService } = await import('@/process/bridge/services/WebuiService');
    const status = await WebuiService.getStatus();

    expect(status).toMatchObject({
      adminUsername: 'admin',
      allowRemote: true,
      lifecycle: 'running',
      localAccessAllowRemote: true,
      localAccessEnabled: true,
      localUrl: 'http://localhost:43123',
      networkUrl: 'http://192.168.1.8:43123',
      port: 43123,
      running: true,
    });
    expect(processConfigGetMock).not.toHaveBeenCalledWith('webui.desktop.enabled');
    expect(processConfigGetMock).not.toHaveBeenCalledWith('webui.desktop.allowRemote');
  });

  it('keeps local access disabled when only official remote demand is active even if legacy desktop flags were enabled', async () => {
    processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'webui.desktop.enabled' || key === 'webui.desktop.allowRemote') {
        return true;
      }
      return undefined;
    });
    getRuntimeStatusMock.mockReturnValue({
      allowRemote: false,
      demandSources: ['official-remote'],
      lifecycle: 'degraded',
      localUrl: 'http://localhost:43123',
      networkUrl: undefined,
      port: 43123,
      running: true,
    });
    getLocalClientAccessStateMock.mockReturnValue({
      active: false,
      allowPortFallback: false,
      allowRemote: false,
      preferredPort: null,
    });

    const { WebuiService } = await import('@/process/bridge/services/WebuiService');
    const status = await WebuiService.getStatus();

    expect(status).toMatchObject({
      lifecycle: 'degraded',
      localAccessAllowRemote: false,
      localAccessEnabled: false,
      running: true,
    });
  });
});

describe('WebuiService local access ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: processConfigGetMock,
        set: processConfigSetMock,
      },
    }));

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {
        getSystemUser: getSystemUserMock,
      },
    }));

    vi.doMock('@process/services/host/HostRuntimeService', () => ({
      getHostRuntimeService: () => ({
        ensureLocalClientAccess: ensureLocalClientAccessMock,
        getCurrentInstance: getCurrentInstanceMock,
        getLocalClientAccessState: getLocalClientAccessStateMock,
        getRuntimeStatus: getRuntimeStatusMock,
        stopLocalClientAccess: stopLocalClientAccessMock,
      }),
    }));

    vi.doMock('@process/webserver/index', () => ({
      clearInitialAdminPassword: clearInitialAdminPasswordMock,
      getInitialAdminPassword: getInitialAdminPasswordMock,
    }));

    vi.doMock('os', () => ({
      networkInterfaces: () => ({
        en0: [{ address: '192.168.1.8', family: 'IPv4', internal: false }],
      }),
    }));
  });

  it('starts local access through HostBrowserEntryService and persists the resolved runtime port', async () => {
    ensureLocalClientAccessMock.mockResolvedValue({
      allowRemote: true,
      port: 43123,
    });
    getInitialAdminPasswordMock.mockReturnValue('initial-password');

    const { WebuiService } = await import('@/process/bridge/services/WebuiService');
    const result = await WebuiService.startLocalAccess({
      allowRemote: true,
      port: 43000,
    });

    expect(ensureLocalClientAccessMock).toHaveBeenCalledWith({
      allowRemote: true,
      preferredPort: 43000,
      reason: 'webui.start',
    });
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.enabled', true);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.allowRemote', true);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.port', 43123);
    expect(result).toEqual({
      initialPassword: 'initial-password',
      lanIP: '192.168.1.8',
      localUrl: 'http://localhost:43123',
      networkUrl: 'http://192.168.1.8:43123',
      port: 43123,
    });
  });

  it('stops local access through HostBrowserEntryService after clearing the persisted enabled flag', async () => {
    getCurrentInstanceMock.mockReturnValue({
      allowRemote: false,
      port: 42111,
    });

    const { WebuiService } = await import('@/process/bridge/services/WebuiService');
    await WebuiService.stopLocalAccess();

    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.enabled', false);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.port', 42111);
    expect(stopLocalClientAccessMock).toHaveBeenCalledWith('Server shutting down');
  });
});
