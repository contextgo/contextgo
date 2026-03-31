/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceEngine, TSpace } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import type { ISpaceRepository } from '@process/services/database/space/ISpaceRepository';
import type { ISpaceService } from './ISpaceService';

const DEFAULT_SPACE_NAME = 'My Space';
const DEFAULT_SPACE_ENGINE: SpaceEngine = 'affine';

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
      isDefault: false,
      createTime: now,
      modifyTime: now,
    };
    await this.repo.createSpace(space);
    return space;
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
      isDefault: true,
      createTime: now,
      modifyTime: now,
    };
    await this.repo.createSpace(defaultSpace);
    return defaultSpace;
  }
}
