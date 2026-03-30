/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TSpace } from '@/common/config/storage';

export interface ISpaceRepository {
  getSpace(id: string): Promise<TSpace | undefined>;
  getDefaultSpace(userId?: string): Promise<TSpace | undefined>;
  listSpaces(userId?: string): Promise<TSpace[]>;
  createSpace(space: TSpace, userId?: string): Promise<void>;
  updateSpace(id: string, updates: Partial<TSpace>): Promise<void>;
  archiveSpace(id: string): Promise<void>;
}
