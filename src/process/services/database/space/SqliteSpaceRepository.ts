/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TSpace } from '@/common/config/storage';
import { getDatabase } from '@process/services/database';
import type { ISpaceRepository } from './ISpaceRepository';

export class SqliteSpaceRepository implements ISpaceRepository {
  private getDb() {
    return getDatabase();
  }

  async getSpace(id: string): Promise<TSpace | undefined> {
    const db = await this.getDb();
    const result = db.getSpace(id);
    return result.success ? (result.data ?? undefined) : undefined;
  }

  async getDefaultSpace(userId?: string): Promise<TSpace | undefined> {
    const db = await this.getDb();
    const result = db.getDefaultSpace(userId);
    return result.success ? (result.data ?? undefined) : undefined;
  }

  async listSpaces(userId?: string): Promise<TSpace[]> {
    const db = await this.getDb();
    const result = db.listSpaces(userId);
    return result.success ? (result.data ?? []) : [];
  }

  async createSpace(space: TSpace, userId?: string): Promise<void> {
    const db = await this.getDb();
    db.createSpace(space, userId);
  }

  async updateSpace(id: string, updates: Partial<TSpace>): Promise<void> {
    const db = await this.getDb();
    db.updateSpace(id, updates);
  }

  async archiveSpace(id: string): Promise<void> {
    const db = await this.getDb();
    db.archiveSpace(id);
  }
}
