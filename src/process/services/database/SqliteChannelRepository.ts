/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IAgentProfile,
  IChannelAccount,
  IChannelBinding,
  IChannelPluginConfig,
  IChannelPairingRequest,
  IChannelAuthorizedTarget,
  IChannelUser,
  IChannelSession,
  IRemoteIdentity,
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

  async getChannelAuthorizedTargets(): Promise<IChannelAuthorizedTarget[]> {
    const db = await getDatabase();
    const result = db.getChannelAuthorizedTargets();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get authorized targets');
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

  async getChannelAccounts(): Promise<IChannelAccount[]> {
    const db = await getDatabase();
    const result = db.getChannelAccounts();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get channel accounts');
    }
    return result.data;
  }

  async upsertChannelAccount(channelAccount: IChannelAccount): Promise<void> {
    const db = await getDatabase();
    const result = db.upsertChannelAccount(channelAccount);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to upsert channel account ${channelAccount.id}`);
    }
  }

  async deleteChannelAccount(channelAccountId: string): Promise<void> {
    const db = await getDatabase();
    const result = db.deleteChannelAccount(channelAccountId);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to delete channel account ${channelAccountId}`);
    }
  }

  async getAgentProfiles(): Promise<IAgentProfile[]> {
    const db = await getDatabase();
    const result = db.getAgentProfiles();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get agent profiles');
    }
    return result.data;
  }

  async getRemoteIdentities(channelAccountId?: string): Promise<IRemoteIdentity[]> {
    const db = await getDatabase();
    const result = db.getRemoteIdentities(channelAccountId);
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get remote identities');
    }
    return result.data;
  }

  async getChannelBindings(channelAccountId?: string): Promise<IChannelBinding[]> {
    const db = await getDatabase();
    const result = db.getChannelBindings(channelAccountId);
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
