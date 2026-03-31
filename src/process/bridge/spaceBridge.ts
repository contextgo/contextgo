/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ISpaceService } from '@process/services/space/ISpaceService';

export function initSpaceBridge(spaceService: ISpaceService): void {
  ipcBridge.space.list.provider(async () => {
    return spaceService.listSpaces();
  });

  ipcBridge.space.ensureDefault.provider(async () => {
    return spaceService.ensureDefaultSpace();
  });

  ipcBridge.space.create.provider(async ({ name, description }) => {
    return spaceService.createSpace(name, 'affine', description);
  });
}
