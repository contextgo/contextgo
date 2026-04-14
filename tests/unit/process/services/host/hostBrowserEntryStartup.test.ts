import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processConfigState = new Map<string, unknown>();
const ensureForDemandMock = vi.fn();

describe('hostBrowserEntryStartup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    processConfigState.clear();

    vi.doMock('@process/utils/initStorage', () => ({
      ProcessConfig: {
        get: vi.fn(async (key: string) => processConfigState.get(key)),
        set: vi.fn(async (key: string, value: unknown) => {
          processConfigState.set(key, value);
        }),
      },
    }));

    vi.doMock('@process/services/host/HostBrowserEntryService', () => ({
      getHostBrowserEntryService: () => ({
        ensureForDemand: ensureForDemandMock,
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepares the official remote host browser entry from a stored device binding', async () => {
    processConfigState.set('cloud.deviceToken', 'ctxdev_token');
    processConfigState.set('webui.desktop.port', 35808);
    ensureForDemandMock.mockResolvedValue({
      allowRemote: false,
      port: 36808,
    });

    const { prepareOfficialRemoteHostBrowserEntryAtStartup } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await prepareOfficialRemoteHostBrowserEntryAtStartup();

    expect(ensureForDemandMock).toHaveBeenCalledWith('official-remote', {
      allowPortFallback: true,
      allowRemote: false,
      preferredPort: 35808,
      reason: 'app-startup-official-remote',
    });
    expect(processConfigState.get('webui.desktop.port')).toBe(36808);
  });

  it('skips official remote startup preparation when no stored device binding exists', async () => {
    const { prepareOfficialRemoteHostBrowserEntryAtStartup } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await prepareOfficialRemoteHostBrowserEntryAtStartup();

    expect(ensureForDemandMock).not.toHaveBeenCalled();
  });

  it('restores local-client demand from desktop preferences when local access is enabled', async () => {
    processConfigState.set('webui.desktop.enabled', true);
    processConfigState.set('webui.desktop.allowRemote', true);
    processConfigState.set('webui.desktop.port', 35809);
    ensureForDemandMock.mockResolvedValue({
      allowRemote: true,
      port: 35809,
    });

    const { restoreDesktopHostBrowserEntryFromPreferences } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await restoreDesktopHostBrowserEntryFromPreferences();

    expect(ensureForDemandMock).toHaveBeenCalledWith('local-client', {
      allowRemote: true,
      preferredPort: 35809,
      reason: 'desktop-preferences',
    });
  });

  it('does not restore local-client demand when desktop local access is disabled', async () => {
    processConfigState.set('webui.desktop.enabled', false);

    const { restoreDesktopHostBrowserEntryFromPreferences } =
      await import('@/process/services/host/hostBrowserEntryStartup');

    await restoreDesktopHostBrowserEntryFromPreferences();

    expect(ensureForDemandMock).not.toHaveBeenCalled();
  });
});
