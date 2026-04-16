import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const restoreLocalClientAccessFromPreferencesMock = vi.fn(async () => undefined);
const prepareOfficialRemoteAtStartupMock = vi.fn(async () => undefined);
const prepareForWebUiModeMock = vi.fn(async () => undefined);

describe('hostBrowserEntryStartup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@process/services/host/HostRuntimeService', () => ({
      getHostRuntimeService: () => ({
        prepareForWebUiMode: prepareForWebUiModeMock,
        prepareOfficialRemoteAtStartup: prepareOfficialRemoteAtStartupMock,
        restoreLocalClientAccessFromPreferences: restoreLocalClientAccessFromPreferencesMock,
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates official remote startup preparation to HostRuntimeService', async () => {
    const { prepareOfficialRemoteHostBrowserEntryAtStartup } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await prepareOfficialRemoteHostBrowserEntryAtStartup();

    expect(prepareOfficialRemoteAtStartupMock).toHaveBeenCalledTimes(1);
  });

  it('delegates local-client restore to HostRuntimeService', async () => {
    const { restoreDesktopHostBrowserEntryFromPreferences } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await restoreDesktopHostBrowserEntryFromPreferences();

    expect(restoreLocalClientAccessFromPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it('delegates webui mode bootstrap to HostRuntimeService', async () => {
    const { prepareHostBrowserEntryForWebUiMode } = await import('@/process/services/host/hostBrowserEntryStartup');

    await prepareHostBrowserEntryForWebUiMode({
      allowRemote: true,
      preferredPort: 35811,
    });

    expect(prepareForWebUiModeMock).toHaveBeenCalledWith({
      allowRemote: true,
      preferredPort: 35811,
    });
  });
});
