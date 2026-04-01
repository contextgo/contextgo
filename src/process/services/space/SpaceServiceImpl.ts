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
  TSpace,
} from '@/common/config/storage';
import { uuid } from '@/common/utils';
import type { ISpaceRepository } from '@process/services/database/space/ISpaceRepository';
import type { ISpaceService } from './ISpaceService';

const DEFAULT_SPACE_NAME = 'My Space';
const DEFAULT_SPACE_ENGINE: SpaceEngine = 'affine';
const DEFAULT_ROLE_CAPABILITIES: Record<SpaceMemberRole, SpaceCapability[]> = {
  owner: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  admin: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  editor: ['content.edit', 'agent.run', 'context.view', 'workflow.reuse'],
  reviewer: ['content.edit', 'agent.run', 'memory.review', 'context.view', 'workflow.reuse'],
  viewer: ['context.view'],
};

const DEFAULT_PROVIDER_ROLE_BINDINGS: NonNullable<SpacePermissionsPolicy['providerRoleBindings']> = {
  owner: { affine: 'owner' },
  admin: { affine: 'admin' },
  editor: { affine: 'editor' },
  reviewer: { affine: 'editor' },
  viewer: { affine: 'viewer' },
};

function createDefaultPermissionsPolicy(): SpacePermissionsPolicy {
  return {
    roleCapabilities: DEFAULT_ROLE_CAPABILITIES,
    durableMemoryRoles: ['owner', 'admin', 'reviewer'],
    criticalMemoryReviewRoles: ['owner', 'admin', 'reviewer'],
    providerRoleBindings: DEFAULT_PROVIDER_ROLE_BINDINGS,
  };
}

export class SpaceServiceImpl implements ISpaceService {
  constructor(private readonly repo: ISpaceRepository) {}

  async getSpace(id: string): Promise<TSpace | undefined> {
    return this.repo.getSpace(id);
  }

  async listSpaces(): Promise<TSpace[]> {
    return this.repo.listSpaces();
  }

  async createSpace(name: string, engine: SpaceEngine, description?: string): Promise<TSpace> {
    const now = Date.now();
    const space: TSpace = {
      id: uuid(),
      name,
      engine,
      description,
      members: [],
      permissionsPolicy: createDefaultPermissionsPolicy(),
      providerRef: {
        engine,
        workspaceId: uuid(),
        homeBoardId: uuid(),
        homeDocId: uuid(),
      },
      isDefault: false,
      createTime: now,
      modifyTime: now,
    };
    await this.repo.createSpace(space);
    return space;
  }

  async updateSpace(id: string, updates: Partial<TSpace>): Promise<TSpace | undefined> {
    const existing = await this.repo.getSpace(id);
    if (!existing) {
      return undefined;
    }

    await this.repo.updateSpace(id, updates);
    return this.repo.getSpace(id);
  }

  async renameSpace(id: string, name: string): Promise<void> {
    await this.repo.updateSpace(id, { name });
  }

  async archiveSpace(id: string): Promise<void> {
    await this.repo.archiveSpace(id);
  }

  async ensureDefaultSpace(): Promise<TSpace> {
    const existing = await this.repo.getDefaultSpace();
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const defaultSpace: TSpace = {
      id: uuid(),
      name: DEFAULT_SPACE_NAME,
      engine: DEFAULT_SPACE_ENGINE,
      members: [],
      permissionsPolicy: createDefaultPermissionsPolicy(),
      providerRef: {
        engine: DEFAULT_SPACE_ENGINE,
        workspaceId: uuid(),
        homeBoardId: uuid(),
        homeDocId: uuid(),
      },
      isDefault: true,
      createTime: now,
      modifyTime: now,
    };
    await this.repo.createSpace(defaultSpace);
    return defaultSpace;
  }
}
