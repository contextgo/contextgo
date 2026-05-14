import { beforeEach, describe, expect, it, vi } from 'vitest';

const processConfigGetMock = vi.fn(async () => undefined);
const processConfigSetMock = vi.fn(async () => undefined);
const getPreferredDesktopWebUIPortMock = vi.fn(async () => 25809);
const resolvePreferredDesktopWebUIPortMock = vi.fn((value: unknown) => {
  return typeof value === 'number' ? value : 25809;
});

describe('hostBrowserEntryPreferences', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: processConfigGetMock,
        set: processConfigSetMock,
      },
    }));

    vi.doMock('@process/utils/webuiConfig', () => ({
      getPreferredDesktopWebUIPort: getPreferredDesktopWebUIPortMock,
      resolvePreferredDesktopWebUIPort: resolvePreferredDesktopWebUIPortMock,
    }));
  });

  it('reads local-client preferences from the new host-runtime keys first', async () => {
    processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'host.runtime.localAccess.enabled') {
        return true;
      }
      if (key === 'host.runtime.localAccess.allowRemote') {
        return false;
      }
      if (key === 'host.runtime.localAccess.port') {
        return 43123;
      }
      return undefined;
    });

    const { getHostLocalClientAccessPreferences } = await import('@process/services/host/hostBrowserEntryPreferences');
    const preferences = await getHostLocalClientAccessPreferences();

    expect(resolvePreferredDesktopWebUIPortMock).toHaveBeenCalledWith(43123);
    expect(preferences).toEqual({
      allowRemote: false,
      enabled: true,
      preferredPort: 43123,
    });
  });

  it('falls back to the legacy desktop webui keys when the new host-runtime keys are absent', async () => {
    processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'host.runtime.localAccess.enabled') {
        return undefined;
      }
      if (key === 'host.runtime.localAccess.allowRemote') {
        return undefined;
      }
      if (key === 'host.runtime.localAccess.port') {
        return undefined;
      }
      if (key === 'webui.desktop.enabled') {
        return true;
      }
      if (key === 'webui.desktop.allowRemote') {
        return true;
      }
      if (key === 'webui.desktop.port') {
        return 43124;
      }
      return undefined;
    });

    const { getHostLocalClientAccessPreferences } = await import('@process/services/host/hostBrowserEntryPreferences');
    const preferences = await getHostLocalClientAccessPreferences();

    expect(preferences).toEqual({
      allowRemote: true,
      enabled: true,
      preferredPort: 43124,
    });
  });

  it('updates persisted preferences and host runtime port through one host-layer helper', async () => {
    const { getPreferredHostBrowserEntryPort, rememberHostBrowserEntryPort, updateHostLocalClientAccessPreferences } =
      await import('@process/services/host/hostBrowserEntryPreferences');

    await updateHostLocalClientAccessPreferences({
      allowRemote: true,
      enabled: false,
      port: 43124,
    });
    await rememberHostBrowserEntryPort(43125);
    const preferredPort = await getPreferredHostBrowserEntryPort();

    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.enabled', false);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.allowRemote', true);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.port', 43124);
    expect(processConfigSetMock).toHaveBeenCalledWith('host.runtime.localAccess.port', 43125);
    expect(getPreferredDesktopWebUIPortMock).toHaveBeenCalledTimes(1);
    expect(preferredPort).toBe(25809);
  });
});
