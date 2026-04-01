/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ISpaceService } from '@process/services/space/ISpaceService';
import { getDatabase } from '@process/services/database';

export function initSpaceBridge(spaceService: ISpaceService): void {
  ipcBridge.space.list.provider(async () => {
    return spaceService.listSpaces();
  });

  ipcBridge.space.get.provider(async ({ id }) => {
    return spaceService.getSpace(id);
  });

  ipcBridge.space.ensureDefault.provider(async () => {
    return spaceService.ensureDefaultSpace();
  });

  ipcBridge.space.create.provider(async ({ name, description }) => {
    return spaceService.createSpace(name, 'affine', description);
  });

  ipcBridge.space.update.provider(async ({ id, updates }) => {
    return spaceService.updateSpace(id, updates);
  });

  ipcBridge.space.getContext.provider(async ({ spaceId }) => {
    const db = await getDatabase();
    const memoriesResult = db.listContextMemoriesBySpace(spaceId);
    const profilesResult = db.listContextProfilesBySpace(spaceId);

    const memories =
      memoriesResult.success && memoriesResult.data
        ? memoriesResult.data
            .filter((memory) => memory.state === 'accepted')
            .map((memory) => ({
              id: memory.id,
              spaceId: memory.spaceId,
              kind: memory.kind,
              tier: memory.tier,
              summary: memory.summary,
              detail: memory.detail,
              confidence: memory.confidence,
              priority: memory.priority,
              state: memory.state,
              updatedAt: memory.updatedAt,
            }))
        : [];

    const profiles =
      profilesResult.success && profilesResult.data
        ? profilesResult.data
            .filter((profile) => profile.state === 'active')
            .map((profile) => ({
              id: profile.id,
              spaceId: profile.spaceId,
              key: profile.key,
              summary: profile.summary,
              confidence: profile.confidence,
              state: profile.state,
              updatedAt: profile.updatedAt,
            }))
        : [];

    return {
      memories,
      profiles,
    };
  });
}
