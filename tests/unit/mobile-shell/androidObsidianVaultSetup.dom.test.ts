import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAndroidObsidianVaultSetupState,
  isAndroidMobileShell,
  registerAndBootstrapAndroidObsidianReplica,
  requestAndroidObsidianVaultSetup,
  updateAndroidObsidianVaultSetupState,
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
      vaultBindingId: 'vault_space_1',
      landingNotePath: 'Home.md',
    });

    expect(requestMock).toHaveBeenCalledWith(
      JSON.stringify({
        spaceId: 'space-1',
        spaceName: 'Team Space',
        suggestedFolderName: 'team-space',
        vaultBindingId: 'vault_space_1',
        landingNotePath: 'Home.md',
      })
    );

    listeners.get('contextgo:android-obsidian-vault-setup-result')?.(
      new CustomEvent('contextgo:android-obsidian-vault-setup-result', {
        detail: {
          status: 'prepared-directory',
          spaceId: 'space-1',
          vaultName: 'team-space',
          rootTreeUri: 'content://root/contextgo',
          spaceDirectoryUri: 'content://space/team-space',
          vaultBindingId: 'vault_space_1',
          replicaId: 'android_replica_1',
          landingNotePath: 'Home.md',
        },
      })
    );

    await expect(resultPromise).resolves.toEqual({
      status: 'prepared-directory',
      spaceId: 'space-1',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space_1',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
    });
  });

  it('writes updated Android vault setup state back through the shell bridge', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit ContextGoMobileShell/1.0',
    });

    const updateMock = vi.fn();
    vi.stubGlobal('window', {
      ContextGoMobileShell: {
        updateObsidianVaultSetupState: updateMock,
      },
    });

    await updateAndroidObsidianVaultSetupState({
      status: 'registered-mobile-replica',
      spaceId: 'space-1',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space_1',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
      healthStatus: 'warn',
      lastSyncedAt: '2026-04-16T00:00:00Z',
    });

    expect(updateMock).toHaveBeenCalledWith(
      JSON.stringify({
        status: 'registered-mobile-replica',
        spaceId: 'space-1',
        vaultName: 'team-space',
        rootTreeUri: 'content://root/contextgo',
        spaceDirectoryUri: 'content://space/team-space',
        vaultBindingId: 'vault_space_1',
        replicaId: 'android_replica_1',
        landingNotePath: 'Home.md',
        healthStatus: 'warn',
        lastSyncedAt: '2026-04-16T00:00:00Z',
      })
    );
  });

  it('registers and bootstraps an Android mobile replica through the shell bridge', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit ContextGoMobileShell/1.0',
    });

    const registerMock = vi.fn();
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', {
      ContextGoMobileShell: {
        registerAndBootstrapObsidianReplica: registerMock,
      },
      addEventListener: (name: string, listener: EventListener) => {
        listeners.set(name, listener);
      },
      removeEventListener: (name: string) => {
        listeners.delete(name);
      },
    });

    const resultPromise = registerAndBootstrapAndroidObsidianReplica({
      spaceId: 'space-1',
      spaceName: 'Team Space',
      suggestedFolderName: 'team-space',
      vaultBindingId: 'vault_space_1',
      landingNotePath: 'Home.md',
      apiBaseUrl: 'https://api.contextgo.test',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
    });

    expect(registerMock).toHaveBeenCalledWith(
      JSON.stringify({
        spaceId: 'space-1',
        spaceName: 'Team Space',
        suggestedFolderName: 'team-space',
        vaultBindingId: 'vault_space_1',
        landingNotePath: 'Home.md',
        apiBaseUrl: 'https://api.contextgo.test',
        rootTreeUri: 'content://root/contextgo',
        spaceDirectoryUri: 'content://space/team-space',
      })
    );

    listeners.get('contextgo:android-obsidian-vault-setup-result')?.(
      new CustomEvent('contextgo:android-obsidian-vault-setup-result', {
        detail: {
          status: 'registered-mobile-replica',
          spaceId: 'space-1',
          vaultName: 'team-space',
          rootTreeUri: 'content://root/contextgo',
          spaceDirectoryUri: 'content://space/team-space',
          vaultBindingId: 'vault_space_1',
          replicaId: 'android_replica_1',
          landingNotePath: 'Home.md',
          healthStatus: 'ok',
          lastSyncedAt: '2026-04-16T00:00:00Z',
        },
      })
    );

    await expect(resultPromise).resolves.toEqual({
      status: 'registered-mobile-replica',
      spaceId: 'space-1',
      vaultName: 'team-space',
      rootTreeUri: 'content://root/contextgo',
      spaceDirectoryUri: 'content://space/team-space',
      vaultBindingId: 'vault_space_1',
      replicaId: 'android_replica_1',
      landingNotePath: 'Home.md',
      healthStatus: 'ok',
      lastSyncedAt: '2026-04-16T00:00:00Z',
    });
  });
});
