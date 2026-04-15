import { beforeEach, describe, expect, it, vi } from 'vitest';

const processConfigGetMock = vi.fn(async () => undefined);
const processConfigSetMock = vi.fn(async () => undefined);
const getSystemUserMock = vi.fn(async () => ({
  id: 'system-default-user',
  username: 'admin',
}));
const getRuntimeStatusMock = vi.fn();
const getDemandStateMock = vi.fn();

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

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => ({
        getDemandState: getDemandStateMock,
        getRuntimeStatus: getRuntimeStatusMock,
      }),
    }));

    vi.doMock('@process/webserver/index', () => ({
      clearInitialAdminPassword: vi.fn(),
      getInitialAdminPassword: vi.fn(() => null),
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
    getDemandStateMock.mockImplementation((demand: 'local-client' | 'official-remote') => {
      if (demand === 'local-client') {
        return {
          active: true,
          allowPortFallback: false,
          allowRemote: true,
          preferredPort: 43123,
        };
      }

      return {
        active: true,
        allowPortFallback: true,
        allowRemote: false,
        preferredPort: 43123,
      };
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
    getDemandStateMock.mockImplementation((demand: 'local-client' | 'official-remote') => {
      if (demand === 'local-client') {
        return {
          active: false,
          allowPortFallback: false,
          allowRemote: false,
          preferredPort: null,
        };
      }

      return {
        active: true,
        allowPortFallback: true,
        allowRemote: false,
        preferredPort: 43123,
      };
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
