/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IChannelBinding,
  IChannelPluginConfig,
  IChannelPairingRequest,
  IChannelUser,
  IChannelSession,
} from '@process/channels/types';
import { getDatabase } from '@process/services/database';
import type { IChannelRepository } from './IChannelRepository';

/** Thin delegation wrapper around the better-sqlite3 database for channel-related queries. */
export class SqliteChannelRepository implements IChannelRepository {
  async getChannelPlugins(): Promise<IChannelPluginConfig[]> {
    const db = await getDatabase();
    const result = db.getChannelPlugins();
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.error ?? 'Failed to get channel plugins');
    }
    return result.data;
  }

  async getPendingPairingRequests(): Promise<IChannelPairingRequest[]> {
    const db = await getDatabase();
    const result = db.getPendingPairingRequests();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get pending pairing requests');
    }
    return result.data;
  }

  async getChannelUsers(): Promise<IChannelUser[]> {
    const db = await getDatabase();
    const result = db.getChannelUsers();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get channel users');
    }
    return result.data;
  }

  async deleteChannelUser(userId: string): Promise<void> {
    const db = await getDatabase();
    const result = db.deleteChannelUser(userId);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to delete channel user ${userId}`);
    }
  }

  async getChannelSessions(): Promise<IChannelSession[]> {
    const db = await getDatabase();
    const result = db.getChannelSessions();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get channel sessions');
    }
    return result.data;
  }

  async getChannelBindings(connectorId?: string): Promise<IChannelBinding[]> {
    const db = await getDatabase();
    const result = db.getChannelBindings(connectorId);
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get channel bindings');
    }
    return result.data;
  }

  async upsertChannelBinding(binding: IChannelBinding): Promise<void> {
    const db = await getDatabase();
    const result = db.upsertChannelBinding(binding);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to upsert channel binding ${binding.id}`);
    }
  }

  async deleteChannelBinding(bindingId: string): Promise<void> {
    const db = await getDatabase();
    const result = db.deleteChannelBinding(bindingId);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to delete channel binding ${bindingId}`);
    }
  }
}
