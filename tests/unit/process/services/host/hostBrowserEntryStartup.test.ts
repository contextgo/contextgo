import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const restoreLocalClientAccessFromPreferencesMock = vi.fn(async () => undefined);
const prepareOfficialRemoteAtStartupMock = vi.fn(async () => undefined);
const prepareForWebUiModeMock = vi.fn(async () => undefined);

describe('hostRuntimeStartup', () => {
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
    const { prepareOfficialRemoteHostRuntimeAtStartup } = await import('@/process/services/host/hostRuntimeStartup');

    await prepareOfficialRemoteHostRuntimeAtStartup();

    expect(prepareOfficialRemoteAtStartupMock).toHaveBeenCalledTimes(1);
  });

  it('delegates local-client restore to HostRuntimeService', async () => {
    const { restoreDesktopHostRuntimeFromPreferences } = await import('@/process/services/host/hostRuntimeStartup');

    await restoreDesktopHostRuntimeFromPreferences();

    expect(restoreLocalClientAccessFromPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it('delegates webui mode bootstrap to HostRuntimeService', async () => {
    const { prepareHostRuntimeForWebUiMode } = await import('@/process/services/host/hostRuntimeStartup');

    await prepareHostRuntimeForWebUiMode({
      allowRemote: true,
      preferredPort: 35811,
    });

    expect(prepareForWebUiModeMock).toHaveBeenCalledWith({
      allowRemote: true,
      preferredPort: 35811,
    });
  });
});
