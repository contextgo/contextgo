/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceEngine, TSpace } from '@/common/config/storage';

export interface ISpaceService {
  getSpace(id: string): Promise<TSpace | undefined>;
  listSpaces(): Promise<TSpace[]>;
  createSpace(name: string, engine: SpaceEngine, description?: string): Promise<TSpace>;
  updateSpace(id: string, updates: Partial<TSpace>): Promise<TSpace | undefined>;
  renameSpace(id: string, name: string): Promise<void>;
  archiveSpace(id: string): Promise<void>;
  ensureDefaultSpace(): Promise<TSpace>;
}
