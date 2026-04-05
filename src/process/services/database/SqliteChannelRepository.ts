/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IAgentProfile,
  IChannelBinding,
  IChannelPluginConfig,
  IChannelPairingRequest,
  IChannelAuthorizedTarget,
  IChannelUser,
  IChannelSession,
  IConnectorInstance,
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

  async getConnectorInstances(): Promise<IConnectorInstance[]> {
    const db = await getDatabase();
    const result = db.getConnectorInstances();
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get connector instances');
    }
    return result.data;
  }

  async upsertConnectorInstance(connector: IConnectorInstance): Promise<void> {
    const db = await getDatabase();
    const result = db.upsertConnectorInstance(connector);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to upsert connector instance ${connector.id}`);
    }
  }

  async deleteConnectorInstance(connectorId: string): Promise<void> {
    const db = await getDatabase();
    const result = db.deleteConnectorInstance(connectorId);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to delete connector instance ${connectorId}`);
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

  async getRemoteIdentities(connectorId?: string): Promise<IRemoteIdentity[]> {
    const db = await getDatabase();
    const result = db.getRemoteIdentities(connectorId);
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to get remote identities');
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
