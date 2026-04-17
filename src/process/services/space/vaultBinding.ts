/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceProviderRef, SpaceVaultProviderRef, TSpace } from '@/common/config/storage';
import { getPlatformServices } from '@/common/platform';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveBrandStoragePath } from '@process/utils';
import { ensureObsidianVaultBootstrap } from './obsidianVaultBootstrap';

const SPACE_VAULTS_DIR_NAME = 'vaults';
const DEFAULT_LANDING_NOTE_PATH = 'Home.md';
const DEFAULT_LAUNCH_STRATEGY = process.platform === 'darwin' ? 'obsidian-app' : 'obsidian-uri';

const sanitizeVaultDirectorySegment = (value: string): string => {
  const sanitized = value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+$/g, '');

  return sanitized || 'space';
};

const buildVaultDirectoryName = (spaceId: string, spaceName: string): string => {
  const suffix = spaceId.slice(0, 8).toLowerCase();
  return `${sanitizeVaultDirectorySegment(spaceName)}-${suffix}`;
};

const getCanonicalContextGoDataDir = (): string => {
  return resolveBrandStoragePath({
    baseDir: getPlatformServices().paths.getDataDir(),
    preferredName: 'contextgo',
    legacyNames: [],
    kind: 'directory',
  });
};

const resolveCanonicalVaultPath = async (
  space: Pick<TSpace, 'id' | 'name'>,
  existingProviderRef?: SpaceVaultProviderRef
): Promise<string> => {
  if (existingProviderRef?.vaultPath) {
    try {
      return await fs.realpath(existingProviderRef.vaultPath);
    } catch {
      return existingProviderRef.vaultPath;
    }
  }

  return path.join(
    getCanonicalContextGoDataDir(),
    SPACE_VAULTS_DIR_NAME,
    buildVaultDirectoryName(space.id, space.name)
  );
};

const ensureLandingNote = async (vaultPath: string, spaceName: string, landingNotePath: string): Promise<void> => {
  const absoluteLandingNotePath = path.join(vaultPath, landingNotePath);
  await fs.mkdir(path.dirname(absoluteLandingNotePath), { recursive: true });

  try {
    await fs.access(absoluteLandingNotePath);
  } catch {
    await fs.writeFile(absoluteLandingNotePath, `# ${spaceName}\n`, 'utf8');
  }
};

export const isSpaceVaultProviderRef = (providerRef?: SpaceProviderRef): providerRef is SpaceVaultProviderRef => {
  return providerRef != null && 'kind' in providerRef && providerRef.kind === 'obsidian-vault';
};

export const ensureSpaceVaultBinding = async (
  space: Pick<TSpace, 'id' | 'name' | 'providerRef'>
): Promise<SpaceVaultProviderRef> => {
  const existingProviderRef = isSpaceVaultProviderRef(space.providerRef) ? space.providerRef : undefined;
  const vaultPath = await resolveCanonicalVaultPath(space, existingProviderRef);
  const landingNotePath = existingProviderRef?.landingNotePath || DEFAULT_LANDING_NOTE_PATH;
  const vaultName = path.basename(vaultPath);

  await fs.mkdir(vaultPath, { recursive: true });
  await ensureLandingNote(vaultPath, space.name, landingNotePath);

  const providerRef: SpaceVaultProviderRef = {
    kind: 'obsidian-vault',
    vaultPath,
    vaultName,
    landingNotePath,
    launchStrategy: existingProviderRef?.launchStrategy || DEFAULT_LAUNCH_STRATEGY,
  };

  await ensureObsidianVaultBootstrap(providerRef);
  return providerRef;
};
