/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TSpace } from '@/common/config/storage';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import type { ISpaceService } from '@process/services/space/ISpaceService';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';
import { ensureSpaceVaultBinding, isSpaceVaultProviderRef } from '@process/services/space/vaultBinding';
import { createContextExecutionBoundary } from '../ContextJobOrchestrator';
import type { ContextExecutionBoundary } from '../contextDomain';

type SpaceLookup = Pick<TSpace, 'id' | 'name' | 'providerRef'>;

export class ContextExecutionBoundaryResolver {
  constructor(
    private readonly spaceService: Pick<ISpaceService, 'getSpace'> = new SpaceServiceImpl(new SqliteSpaceRepository())
  ) {}

  async resolve(spaceId: string): Promise<ContextExecutionBoundary> {
    const space = await this.spaceService.getSpace(spaceId);
    if (!space) {
      throw new Error(`Space not found for Context Engine boundary: ${spaceId}`);
    }

    const providerRef = await this.resolveVaultProviderRef(space);
    return createContextExecutionBoundary({
      spaceId: space.id,
      spaceName: space.name,
      vaultRoot: providerRef.vaultPath,
    });
  }

  private async resolveVaultProviderRef(space: SpaceLookup) {
    if (isSpaceVaultProviderRef(space.providerRef)) {
      return space.providerRef;
    }

    return ensureSpaceVaultBinding(space);
  }
}
