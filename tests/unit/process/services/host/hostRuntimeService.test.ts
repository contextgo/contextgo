import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processConfigGetMock = vi.fn(async () => undefined);
const ensureForDemandMock = vi.fn();
const releaseDemandMock = vi.fn(async () => undefined);
const getCurrentInstanceMock = vi.fn(() => null);
const getDemandStateMock = vi.fn();
const getLocalBaseUrlMock = vi.fn(() => null);
const getRuntimeStatusMock = vi.fn(() => ({
  allowRemote: false,
  demandSources: [],
  lifecycle: 'stopped',
  port: null,
  running: false,
}));
const setCurrentInstanceForLegacyMock = vi.fn();
const setStatusChangedEmitterMock = vi.fn();
const getHostLocalClientAccessPreferencesMock = vi.fn();
const getPreferredHostBrowserEntryPortMock = vi.fn(async () => 25809);
const rememberHostBrowserEntryPortMock = vi.fn(async () => undefined);

describe('HostRuntimeService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: processConfigGetMock,
      },
    }));

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => ({
        ensureForDemand: ensureForDemandMock,
        getCurrentInstance: getCurrentInstanceMock,
        getDemandState: getDemandStateMock,
        getLocalBaseUrl: getLocalBaseUrlMock,
        getRuntimeStatus: getRuntimeStatusMock,
        releaseDemand: releaseDemandMock,
        setCurrentInstanceForLegacy: setCurrentInstanceForLegacyMock,
        setStatusChangedEmitter: setStatusChangedEmitterMock,
      }),
    }));

    vi.doMock('@process/services/host/hostBrowserEntryPreferences', () => ({
      getHostLocalClientAccessPreferences: getHostLocalClientAccessPreferencesMock,
      getPreferredHostBrowserEntryPort: getPreferredHostBrowserEntryPortMock,
      rememberHostBrowserEntryPort: rememberHostBrowserEntryPortMock,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores local-client runtime demand from persisted host preferences', async () => {
    getHostLocalClientAccessPreferencesMock.mockResolvedValue({
      allowRemote: true,
      enabled: true,
      preferredPort: 35809,
    });
    ensureForDemandMock.mockResolvedValue({
      allowRemote: true,
      port: 35809,
    });

    const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
    await getHostRuntimeService().restoreLocalClientAccessFromPreferences();

    expect(ensureForDemandMock).toHaveBeenCalledWith('local-client', {
      allowRemote: true,
      preferredPort: 35809,
      reason: 'desktop-preferences',
    });
  });

  it('prepares official-remote runtime from a stored device token', async () => {
    processConfigGetMock.mockResolvedValue('ctxdev_token');
    ensureForDemandMock.mockResolvedValue({
      allowRemote: false,
      port: 36808,
    });

    const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
    await getHostRuntimeService().prepareOfficialRemoteAtStartup();

    expect(getPreferredHostBrowserEntryPortMock).toHaveBeenCalledTimes(1);
    expect(ensureForDemandMock).toHaveBeenCalledWith('official-remote', {
      allowPortFallback: true,
      allowRemote: false,
      preferredPort: 25809,
      reason: 'app-startup-official-remote',
    });
    expect(rememberHostBrowserEntryPortMock).toHaveBeenCalledWith(36808);
  });

  it('prepares local-client runtime for electron webui mode', async () => {
    ensureForDemandMock.mockResolvedValue({
      allowRemote: true,
      port: 43123,
    });

    const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
    await getHostRuntimeService().prepareForWebUiMode({
      allowRemote: true,
      preferredPort: 43123,
    });

    expect(ensureForDemandMock).toHaveBeenCalledWith('local-client', {
      allowRemote: true,
      preferredPort: 43123,
      reason: 'electron-webui-mode',
    });
  });

  it('proxies runtime status access and emitter wiring to the browser entry owner', async () => {
    const onStatusChanged = vi.fn();
    getCurrentInstanceMock.mockReturnValue({
      allowRemote: false,
      port: 25809,
    });

    const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
    const service = getHostRuntimeService();

    expect(service.getRuntimeStatus()).toEqual(getRuntimeStatusMock.mock.results[0]?.value ?? getRuntimeStatusMock());
    expect(service.getCurrentInstance()).toEqual({
      allowRemote: false,
      port: 25809,
    });

    service.setCurrentInstanceForLegacy(null);
    service.setStatusChangedEmitter(onStatusChanged);

    expect(setCurrentInstanceForLegacyMock).toHaveBeenCalledWith(null);
    expect(setStatusChangedEmitterMock).toHaveBeenCalledWith(onStatusChanged);
  });

  it('routes local-client and official-remote lifecycle operations through the shared owner', async () => {
    ensureForDemandMock.mockResolvedValue({
      allowRemote: false,
      port: 25809,
    });

    const { getHostRuntimeService } = await import('@/process/services/host/HostRuntimeService');
    const service = getHostRuntimeService();

    await service.ensureLocalClientAccess({
      allowRemote: false,
      preferredPort: 25809,
      reason: 'webui.start',
    });
    await service.ensureOfficialRemoteRuntime('official-remote');
    await service.releaseOfficialRemoteRuntime('official-remote released');
    await service.stopLocalClientAccess('local-client released');

    expect(ensureForDemandMock).toHaveBeenNthCalledWith(1, 'local-client', {
      allowRemote: false,
      preferredPort: 25809,
      reason: 'webui.start',
    });
    expect(ensureForDemandMock).toHaveBeenNthCalledWith(2, 'official-remote', {
      allowPortFallback: true,
      allowRemote: false,
      preferredPort: 25809,
      reason: 'official-remote',
    });
    expect(releaseDemandMock).toHaveBeenNthCalledWith(1, 'official-remote', 'official-remote released');
    expect(releaseDemandMock).toHaveBeenNthCalledWith(2, 'local-client', 'local-client released');
  });
});
