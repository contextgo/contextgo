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

  it('reads local-client preferences from the legacy desktop webui keys', async () => {
    processConfigGetMock.mockImplementation(async (key: string) => {
      if (key === 'webui.desktop.enabled') {
        return true;
      }
      if (key === 'webui.desktop.allowRemote') {
        return false;
      }
      if (key === 'webui.desktop.port') {
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

    expect(processConfigSetMock).toHaveBeenCalledWith('webui.desktop.enabled', false);
    expect(processConfigSetMock).toHaveBeenCalledWith('webui.desktop.allowRemote', true);
    expect(processConfigSetMock).toHaveBeenCalledWith('webui.desktop.port', 43124);
    expect(processConfigSetMock).toHaveBeenCalledWith('webui.desktop.port', 43125);
    expect(getPreferredDesktopWebUIPortMock).toHaveBeenCalledTimes(1);
    expect(preferredPort).toBe(25809);
  });
});
