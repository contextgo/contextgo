import { describe, expect, it } from 'vitest';
import {
  buildObsidianChooseVaultUri,
  buildObsidianPathUri,
  buildObsidianVaultOpenIntent,
  buildObsidianVaultUri,
} from '@/common/utils/obsidianVaultOpen';

describe('obsidianVaultOpen', () => {
  it('builds a vault uri for a bound space vault', () => {
    expect(
      buildObsidianVaultUri({
        vaultPath: '/tmp/team-space',
        vaultName: 'Team Space',
        landingNotePath: 'Space Home.md',
      })
    ).toBe('obsidian://open?vault=Team%20Space&file=Space%20Home.md');
  });

  it('builds a path uri for a bound space vault', () => {
    expect(
      buildObsidianPathUri({
        vaultPath: '/tmp/team-space',
        vaultName: 'Team Space',
        landingNotePath: 'Space Home.md',
      })
    ).toBe('obsidian://open?path=%2Ftmp%2Fteam-space%2FSpace%20Home.md');
  });

  it('returns a mobile ready intent when the space already has an obsidian vault binding', () => {
    expect(
      buildObsidianVaultOpenIntent({
        isMobileShell: true,
        providerRef: {
          kind: 'obsidian-vault',
          vaultPath: '/tmp/team-space',
          vaultName: 'Team Space',
          landingNotePath: 'Space Home.md',
        },
      })
    ).toEqual({
      actionKey: 'guid.vault.mobileAffordance',
      readiness: 'ready',
      readinessKey: 'guid.vault.mobileStatusReady',
      target: 'obsidian://open?vault=Team%20Space&file=Space%20Home.md',
    });
  });

  it('returns a mobile setup intent when no obsidian vault binding is available', () => {
    expect(
      buildObsidianVaultOpenIntent({
        isMobileShell: true,
        providerRef: null,
      })
    ).toEqual({
      actionKey: 'guid.vault.mobileSetupAffordance',
      readiness: 'needs-bind-in-obsidian',
      readinessKey: 'guid.vault.mobileStatusNeedsSetup',
      target: buildObsidianChooseVaultUri(),
    });
  });

  it('returns an Android prepared-directory intent when the local replica folder already exists', () => {
    expect(
      buildObsidianVaultOpenIntent({
        isMobileShell: true,
        providerRef: null,
        androidSetupState: {
          status: 'prepared-directory',
          spaceId: 'space-1',
          vaultName: 'team-space',
          rootTreeUri: 'content://root/contextgo',
          spaceDirectoryUri: 'content://root/contextgo/team-space',
          vaultBindingId: 'vault_space-1',
          replicaId: 'android_replica_1',
          landingNotePath: 'Home.md',
        },
      })
    ).toEqual({
      actionKey: 'guid.vault.mobileSetupAffordance',
      readiness: 'prepared-directory',
      readinessKey: 'guid.vault.androidStatusPrepared',
      target: buildObsidianChooseVaultUri(),
    });
  });
});
