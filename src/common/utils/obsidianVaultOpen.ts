import path from 'node:path';
import type { SpaceProviderRef, SpaceVaultProviderRef } from '@/common/config/storage';

export type ObsidianVaultOpenIntent = {
  actionKey: 'guid.vault.affordance' | 'guid.vault.mobileAffordance' | 'guid.vault.mobileSetupAffordance';
  readiness: 'ready' | 'prepared-directory' | 'registered-mobile-replica' | 'needs-bind-in-obsidian';
  readinessKey: string | null;
  target: string | null;
};

export function isObsidianVaultProviderRef(providerRef?: SpaceProviderRef | null): providerRef is SpaceVaultProviderRef {
  return providerRef != null && 'kind' in providerRef && providerRef.kind === 'obsidian-vault';
}

export function buildObsidianChooseVaultUri(): string {
  return 'obsidian://open?choose-vault';
}

export function buildObsidianVaultUri(providerRef: SpaceVaultProviderRef): string {
  const encodedVaultName = encodeURIComponent(providerRef.vaultName);
  const encodedFile = providerRef.landingNotePath ? `&file=${encodeURIComponent(providerRef.landingNotePath)}` : '';
  return `obsidian://open?vault=${encodedVaultName}${encodedFile}`;
}

export function buildObsidianPathUri(providerRef: SpaceVaultProviderRef): string {
  return `obsidian://open?path=${encodeURIComponent(resolveObsidianOpenPath(providerRef))}`;
}

export function buildObsidianVaultOpenIntent(input: {
  isMobileShell: boolean;
  providerRef?: SpaceProviderRef | null;
  androidSetupState?:
    | {
        status: 'prepared-directory';
      }
    | {
        status: 'registered-mobile-replica';
      }
    | {
        status: 'unprepared';
      }
    | null;
}): ObsidianVaultOpenIntent {
  if (!input.isMobileShell) {
    return {
      actionKey: 'guid.vault.affordance',
      readiness: 'ready',
      readinessKey: null,
      target: null,
    };
  }

  if (isObsidianVaultProviderRef(input.providerRef)) {
    return {
      actionKey: 'guid.vault.mobileAffordance',
      readiness: 'ready',
      readinessKey: 'guid.vault.mobileStatusReady',
      target: buildObsidianVaultUri(input.providerRef),
    };
  }

  if (input.androidSetupState?.status === 'prepared-directory') {
    return {
      actionKey: 'guid.vault.mobileSetupAffordance',
      readiness: 'prepared-directory',
      readinessKey: 'guid.vault.androidStatusPrepared',
      target: buildObsidianChooseVaultUri(),
    };
  }

  if (input.androidSetupState?.status === 'registered-mobile-replica') {
    return {
      actionKey: 'guid.vault.mobileSetupAffordance',
      readiness: 'registered-mobile-replica',
      readinessKey: 'guid.vault.androidStatusRegistered',
      target: buildObsidianChooseVaultUri(),
    };
  }

  return {
    actionKey: 'guid.vault.mobileSetupAffordance',
    readiness: 'needs-bind-in-obsidian',
    readinessKey: 'guid.vault.mobileStatusNeedsSetup',
    target: buildObsidianChooseVaultUri(),
  };
}

function resolveObsidianOpenPath(providerRef: SpaceVaultProviderRef): string {
  if (!providerRef.landingNotePath) {
    return providerRef.vaultPath;
  }

  const normalizedLandingNotePath = providerRef.landingNotePath.replace(/^[/\\]+/, '');
  return path.join(providerRef.vaultPath, normalizedLandingNotePath);
}
