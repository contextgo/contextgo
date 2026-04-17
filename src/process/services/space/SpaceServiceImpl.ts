/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SpaceCapability,
  SpaceEngine,
  SpaceMemberRole,
  SpacePermissionsPolicy,
  SpaceVaultProviderRef,
  TSpace,
} from '@/common/config/storage';
import {
  normalizeManagedSlashCommandLibrary,
  type ManagedSlashCommandRecord,
} from '@/common/chat/slash/library';
import { buildObsidianPathUri, buildObsidianVaultUri } from '@/common/utils/obsidianVaultOpen';
import { uuid } from '@/common/utils';
import { execFile } from 'node:child_process';
import type { ISpaceRepository } from '@process/services/database/space/ISpaceRepository';
import type { ISpaceService } from './ISpaceService';
import { ensureSpaceVaultBinding, isSpaceVaultProviderRef } from './vaultBinding';

const DEFAULT_SPACE_NAME = 'Default Space';
const DEFAULT_SPACE_ENGINE: SpaceEngine = 'vault';
const DEFAULT_ROLE_CAPABILITIES: Record<SpaceMemberRole, SpaceCapability[]> = {
  owner: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  admin: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  editor: ['content.edit', 'agent.run', 'context.view', 'workflow.reuse'],
  reviewer: ['content.edit', 'agent.run', 'memory.review', 'context.view', 'workflow.reuse'],
  viewer: ['context.view'],
};

const DEFAULT_PROVIDER_ROLE_BINDINGS: NonNullable<SpacePermissionsPolicy['providerRoleBindings']> = {
  owner: { vault: 'owner' },
  admin: { vault: 'admin' },
  editor: { vault: 'editor' },
  reviewer: { vault: 'editor' },
  viewer: { vault: 'viewer' },
};

function createDefaultPermissionsPolicy(): SpacePermissionsPolicy {
  return {
    roleCapabilities: DEFAULT_ROLE_CAPABILITIES,
    durableMemoryRoles: ['owner', 'admin', 'reviewer'],
    criticalMemoryReviewRoles: ['owner', 'admin', 'reviewer'],
    providerRoleBindings: DEFAULT_PROVIDER_ROLE_BINDINGS,
  };
}

const runOpen = async (args: string[]): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const [command, ...commandArgs] =
      process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', ...args]
        : process.platform === 'darwin'
          ? ['open', ...args]
          : ['xdg-open', ...args];

    execFile(command, commandArgs, (error) => {
      resolve(!error);
    });
  });
};

const openObsidianPathUri = async (providerRef: SpaceVaultProviderRef): Promise<boolean> => {
  return runOpen([buildObsidianPathUri(providerRef)]);
};

const openObsidianUri = async (providerRef: SpaceVaultProviderRef): Promise<boolean> => {
  return runOpen([buildObsidianVaultUri(providerRef)]);
};

const openObsidianAppVault = async (providerRef: SpaceVaultProviderRef): Promise<boolean> => {
  if (process.platform !== 'darwin') {
    return false;
  }

  return runOpen(['-a', 'Obsidian', providerRef.vaultPath]);
};

const openVaultFolder = async (providerRef: SpaceVaultProviderRef): Promise<void> => {
  const opened = await runOpen([providerRef.vaultPath]);
  if (!opened) {
    throw new Error(`Failed to open vault folder: ${providerRef.vaultPath}`);
  }
};

type SpaceVaultBootstrap = (space: TSpace) => Promise<void>;

const bootstrapSpaceVault: SpaceVaultBootstrap = async (space) => {
  const { SpaceVaultContextSyncService } = await import('./SpaceVaultContextSyncService');
  await new SpaceVaultContextSyncService().syncSpaceOverviewForSpace(space);
};

export class SpaceServiceImpl implements ISpaceService {
  constructor(
    private readonly repo: ISpaceRepository,
    private readonly syncSpaceVault: SpaceVaultBootstrap = bootstrapSpaceVault
  ) {}

  private async ensureVaultBackedSpace(space: TSpace): Promise<TSpace> {
    const providerRef = await ensureSpaceVaultBinding(space);

    if (
      space.engine === DEFAULT_SPACE_ENGINE &&
      isSpaceVaultProviderRef(space.providerRef) &&
      space.providerRef.vaultPath === providerRef.vaultPath &&
      space.providerRef.vaultName === providerRef.vaultName &&
      space.providerRef.landingNotePath === providerRef.landingNotePath &&
      space.providerRef.launchStrategy === providerRef.launchStrategy
    ) {
      return space;
    }

    const updatedSpace: TSpace = {
      ...space,
      engine: DEFAULT_SPACE_ENGINE,
      providerRef,
      modifyTime: Date.now(),
    };
    await this.repo.updateSpace(space.id, updatedSpace);
    return updatedSpace;
  }

  async getSpace(id: string): Promise<TSpace | undefined> {
    const space = await this.repo.getSpace(id);
    if (!space) {
      return undefined;
    }

    return this.ensureVaultBackedSpace(space);
  }

  async getCommandLibrary(id: string): Promise<ManagedSlashCommandRecord[]> {
    const space = await this.getSpace(id);
    return normalizeManagedSlashCommandLibrary(space?.automation?.commands ?? []);
  }

  async listSpaces(): Promise<TSpace[]> {
    const spaces = await this.repo.listSpaces();
    return Promise.all(spaces.map((space) => this.ensureVaultBackedSpace(space)));
  }

  async createSpace(name: string, description?: string): Promise<TSpace> {
    const now = Date.now();
    const space: TSpace = {
      id: uuid(),
      name,
      engine: DEFAULT_SPACE_ENGINE,
      description,
      members: [],
      permissionsPolicy: createDefaultPermissionsPolicy(),
      isDefault: false,
      createTime: now,
      modifyTime: now,
    };
    const providerRef = await ensureSpaceVaultBinding(space);
    const nextSpace: TSpace = {
      ...space,
      providerRef,
    };
    await this.repo.createSpace(nextSpace);
    await this.syncSpaceVault(nextSpace);
    return nextSpace;
  }

  async updateSpace(id: string, updates: Partial<TSpace>): Promise<TSpace | undefined> {
    const existing = await this.repo.getSpace(id);
    if (!existing) {
      return undefined;
    }

    await this.repo.updateSpace(id, updates);
    return this.getSpace(id);
  }

  async saveCommandLibrary(id: string, library: ManagedSlashCommandRecord[]): Promise<ManagedSlashCommandRecord[]> {
    const space = await this.getSpace(id);
    if (!space) {
      throw new Error('Space not found');
    }

    const nextLibrary = normalizeManagedSlashCommandLibrary(library);
    await this.repo.updateSpace(id, {
      automation: {
        ...(space.automation ?? {}),
        version: 1,
        commands: nextLibrary,
      },
    });

    return nextLibrary;
  }

  async openSpaceVault(id: string): Promise<{
    opened: boolean;
    fallback: 'obsidian-uri' | 'folder' | 'none';
    target: string;
    obsidianInstalled: boolean;
  }> {
    const space = await this.getSpace(id);
    if (!space) {
      throw new Error('Space not found');
    }

    const providerRef = await ensureSpaceVaultBinding(space);
    const openedViaApp = await openObsidianAppVault(providerRef);
    if (openedViaApp) {
      return { opened: true, fallback: 'none', target: providerRef.vaultPath, obsidianInstalled: true };
    }

    const openedViaVaultUri = await openObsidianUri(providerRef);
    if (openedViaVaultUri) {
      return {
        opened: true,
        fallback: 'none',
        target: buildObsidianVaultUri(providerRef),
        obsidianInstalled: true,
      };
    }

    const openedViaPathUri = await openObsidianPathUri(providerRef);
    if (openedViaPathUri) {
      return {
        opened: true,
        fallback: 'obsidian-uri',
        target: buildObsidianPathUri(providerRef),
        obsidianInstalled: true,
      };
    }

    await openVaultFolder(providerRef);
    return { opened: true, fallback: 'folder', target: providerRef.vaultPath, obsidianInstalled: false };
  }

  async renameSpace(id: string, name: string): Promise<void> {
    const existing = await this.repo.getSpace(id);
    if (!existing) {
      return;
    }

    const nextSpace = await this.ensureVaultBackedSpace({
      ...existing,
      name,
      modifyTime: Date.now(),
    });
    await this.repo.updateSpace(id, nextSpace);
    await this.syncSpaceVault(nextSpace);
  }

  async archiveSpace(id: string): Promise<void> {
    await this.repo.archiveSpace(id);
  }

  async ensureDefaultSpace(): Promise<TSpace> {
    const existing = await this.repo.getDefaultSpace();
    if (existing) {
      const ensuredSpace = await this.ensureVaultBackedSpace(existing);
      await this.syncSpaceVault(ensuredSpace);
      return ensuredSpace;
    }

    const now = Date.now();
    const defaultSpace: TSpace = {
      id: uuid(),
      name: DEFAULT_SPACE_NAME,
      engine: DEFAULT_SPACE_ENGINE,
      members: [],
      permissionsPolicy: createDefaultPermissionsPolicy(),
      isDefault: true,
      createTime: now,
      modifyTime: now,
    };
    const providerRef = await ensureSpaceVaultBinding(defaultSpace);
    const nextDefaultSpace: TSpace = {
      ...defaultSpace,
      providerRef,
    };
    await this.repo.createSpace(nextDefaultSpace);
    await this.syncSpaceVault(nextDefaultSpace);
    return nextDefaultSpace;
  }
}
