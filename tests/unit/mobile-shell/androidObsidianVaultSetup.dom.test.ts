import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAndroidObsidianVaultSetupState,
  isAndroidMobileShell,
  requestAndroidObsidianVaultSetup,
} from '@/renderer/utils/platform';

describe('android Obsidian vault setup bridge', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects Android mobile shell from the user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit ContextGoMobileShell/1.0',
    });

    expect(isAndroidMobileShell()).toBe(true);
  });

  it('reads prepared Android vault setup state from the mobile shell bridge', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit ContextGoMobileShell/1.0',
    });
    vi.stubGlobal('window', {
      ContextGoMobileShell: {
        getObsidianVaultSetupState: (spaceId: string) =>
          JSON.stringify({
            status: 'prepared-directory',
            spaceId,
            vaultName: 'team-space',
            spaceDirectoryUri: 'content://space/team-space',
          }),
      },
    });

    expect(getAndroidObsidianVaultSetupState('space-1')).toEqual({
      status: 'prepared-directory',
      spaceId: 'space-1',
      vaultName: 'team-space',
      spaceDirectoryUri: 'content://space/team-space',
    });
  });

  it('requests Android vault setup and resolves from the shell result event', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit ContextGoMobileShell/1.0',
    });

    const requestMock = vi.fn();
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', {
      ContextGoMobileShell: {
        requestObsidianVaultSetup: requestMock,
      },
      addEventListener: (name: string, listener: EventListener) => {
        listeners.set(name, listener);
      },
      removeEventListener: (name: string) => {
        listeners.delete(name);
      },
    });

    const resultPromise = requestAndroidObsidianVaultSetup({
      spaceId: 'space-1',
      spaceName: 'Team Space',
      suggestedFolderName: 'team-space',
    });

    expect(requestMock).toHaveBeenCalledWith(
      JSON.stringify({
        spaceId: 'space-1',
        spaceName: 'Team Space',
        suggestedFolderName: 'team-space',
      })
    );

    listeners.get('contextgo:android-obsidian-vault-setup-result')?.(
      new CustomEvent('contextgo:android-obsidian-vault-setup-result', {
        detail: {
          status: 'prepared-directory',
          spaceId: 'space-1',
          vaultName: 'team-space',
          spaceDirectoryUri: 'content://space/team-space',
        },
      })
    );

    await expect(resultPromise).resolves.toEqual({
      status: 'prepared-directory',
      spaceId: 'space-1',
      vaultName: 'team-space',
      spaceDirectoryUri: 'content://space/team-space',
    });
  });
});
