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
      target: buildObsidianChooseVaultUri(),
    });
  });
});
