/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel as channelBridge } from '@/common/adapter/ipcBridge';
import { getDatabase } from '@process/services/database';
import * as crypto from 'crypto';
import { getChannelRouteResolver, inferRemoteChatType } from '../core/ChannelRouteResolver';
import type { IRemoteIdentity, IUnifiedPeer } from '../types';
import type { IChannelPairingRequest, IChannelUser, PluginType } from '../types';

/**
 * Pairing code configuration
 */
const PAIRING_CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  CLEANUP_INTERVAL_MS: 60 * 1000, // 1 minute
};

type PairingPeerContext = Pick<IUnifiedPeer, 'platformChatId' | 'scope' | 'parentChatId' | 'threadId' | 'chatType'>;

function readPairingPeerMetadata(metadata: Record<string, unknown> | undefined): {
  platformChatId?: string;
  peerScope?: 'chat' | 'thread';
  parentChatId?: string;
  threadId?: string;
  remoteChatType?: string;
} {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  return {
    platformChatId:
      typeof metadata.platformChatId === 'string' && metadata.platformChatId ? metadata.platformChatId : undefined,
    peerScope: metadata.peerScope === 'thread' || metadata.peerScope === 'chat' ? metadata.peerScope : undefined,
    parentChatId: typeof metadata.parentChatId === 'string' && metadata.parentChatId ? metadata.parentChatId : undefined,
    threadId: typeof metadata.threadId === 'string' && metadata.threadId ? metadata.threadId : undefined,
    remoteChatType:
      typeof metadata.remoteChatType === 'string' && metadata.remoteChatType ? metadata.remoteChatType : undefined,
  };
}

function buildPairingMetadata(
  existing: Record<string, unknown> | undefined,
  peerContext: PairingPeerContext | undefined
): Record<string, unknown> {
  return {
    ...existing,
    ...(peerContext?.platformChatId ? { platformChatId: peerContext.platformChatId } : {}),
    ...(peerContext?.scope ? { peerScope: peerContext.scope } : {}),
    ...(peerContext?.parentChatId ? { parentChatId: peerContext.parentChatId } : {}),
    ...(peerContext?.threadId ? { threadId: peerContext.threadId } : {}),
    ...(peerContext?.chatType ? { remoteChatType: peerContext.chatType } : {}),
  };
}

/**
 * PairingService - Manages user authorization through pairing codes
 *
 * Flow:
 * 1. User sends /start to bot
 * 2. Bot generates 6-digit pairing code
 * 3. User enters code in ContextGo Settings (or code is auto-displayed)
 * 4. Local user approves/rejects the pairing
 * 5. Bot notifies remote user of result
 */
export class PairingService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate a new pairing code for a user
   */
  async generatePairingCode(
    platformUserId: string,
    platformType: PluginType,
    displayName?: string,
    chatId?: string,
    pluginId?: string,
    peerContext?: PairingPeerContext
  ): Promise<{ code: string; expiresAt: number }> {
    const db = await getDatabase();
    const connector = await getChannelRouteResolver().resolveChannelAccount(platformType, pluginId);

    // Check for existing pending request
    const existingResult = db.getPendingPairingRequests();
    if (existingResult.success && existingResult.data) {
      const existing = existingResult.data.find(
        (r) =>
          r.connectorId === connector.id &&
          r.platformUserId === platformUserId &&
          r.platformType === platformType &&
          r.status === 'pending' &&
          (chatId ? r.remoteChatId === chatId : true)
      );

      // Return existing code if not expired
      if (existing && existing.expiresAt > Date.now()) {
        return {
          code: existing.code,
          expiresAt: existing.expiresAt,
        };
      }
    }

    // Generate unique code
    const code = await this.generateUniqueCode();
    const now = Date.now();
    const expiresAt = now + PAIRING_CONFIG.CODE_EXPIRY_MS;

    // Create pairing request
    const request: IChannelPairingRequest = {
      code,
      platformUserId,
      platformType,
      connectorId: connector.id,
      remoteChatId: chatId ?? platformUserId,
      displayName,
      requestedAt: now,
      expiresAt,
      status: 'pending',
      metadata: buildPairingMetadata(
        {
          source: 'channel-pairing',
        },
        peerContext
      ),
    };

    const createResult = db.createPairingRequest(request);
    if (!createResult.success) {
      throw new Error(createResult.error || 'Failed to create pairing request');
    }

    // Emit event for Settings UI
    channelBridge.pairingRequested.emit(request);

    return { code, expiresAt };
  }

  /**
   * Refresh pairing code for a user (generate new one)
   */
  async refreshPairingCode(
    platformUserId: string,
    platformType: PluginType,
    displayName?: string,
    chatId?: string,
    pluginId?: string,
    peerContext?: PairingPeerContext
  ): Promise<{ code: string; expiresAt: number }> {
    const db = await getDatabase();

    // Expire any existing pending codes
    const existingResult = db.getPendingPairingRequests();
    if (existingResult.success && existingResult.data) {
      const connector = await getChannelRouteResolver().resolveChannelAccount(platformType, pluginId);
      for (const request of existingResult.data) {
        if (
          request.connectorId === connector.id &&
          request.platformUserId === platformUserId &&
          request.platformType === platformType &&
          request.remoteChatId === (chatId ?? platformUserId) &&
          request.status === 'pending'
        ) {
          db.updatePairingRequestStatus(request.code, 'expired');
        }
      }
    }

    // Generate new code
    return this.generatePairingCode(platformUserId, platformType, displayName, chatId, pluginId, peerContext);
  }

  /**
   * Check if a user is already authorized
   */
  async isUserAuthorized(
    platformUserId: string,
    platformType: PluginType,
    chatId?: string,
    pluginId?: string,
    platformChatId?: string,
    remoteChatType?: string
  ): Promise<boolean> {
    const db = await getDatabase();

    if (chatId) {
      try {
        const connector = await getChannelRouteResolver().resolveChannelAccount(platformType, pluginId);
        const identityResult = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
        if (identityResult.success && identityResult.data) {
          return true;
        }

        if (platformChatId && platformChatId !== chatId) {
          const parentIdentityResult = db.getRemoteIdentityByConnectorPlatformChat(connector.id, platformChatId);
          if (parentIdentityResult.success && parentIdentityResult.data) {
            return true;
          }
        }

        const inferredChatType = inferRemoteChatType({
          chatId: platformChatId ?? chatId,
          platformUserId,
          remoteChatType,
        });

        const publishedBindingResult = db.getChannelBindingsForScope(connector.id, 'remote_chat', chatId);
        if (publishedBindingResult.success && publishedBindingResult.data.length > 0) {
          return true;
        }

        if (platformChatId && platformChatId !== chatId) {
          const parentBindingResult = db.getChannelBindingsForScope(connector.id, 'remote_chat', platformChatId);
          if (parentBindingResult.success && parentBindingResult.data.length > 0) {
            return true;
          }
        }

        const connectorDefaultBindingResult = db.getChannelBindingsForScope(connector.id, 'connector_default');
        if (connectorDefaultBindingResult.success && connectorDefaultBindingResult.data.length > 0) {
          return true;
        }

        if (inferredChatType === 'group') {
          return false;
        }

        const connectorsResult = db.getConnectorInstances();
        if (!connectorsResult.success || !connectorsResult.data) {
          return false;
        }

        const samePlatformConnectorCount = connectorsResult.data.filter(
          (existingConnector) => existingConnector.platform === platformType
        ).length;
        if (samePlatformConnectorCount > 1) {
          return false;
        }

        const legacyUserResult = db.getLegacyChannelUserByPlatform(platformUserId, platformType);
        return Boolean(legacyUserResult.success && legacyUserResult.data);
      } catch (error) {
        console.warn('[PairingService] Failed to resolve connector for authorization check:', error);
        return false;
      }
    }

    const usersResult = db.getChannelUsers();
    if (!usersResult.success || !usersResult.data) {
      return false;
    }

    return usersResult.data.some(
      (user) => user.platformUserId === platformUserId && user.platformType === platformType
    );
  }

  /**
   * Get pairing request by code
   */
  async getPairingRequest(code: string): Promise<IChannelPairingRequest | null> {
    const db = await getDatabase();
    const result = db.getPairingRequestByCode(code);
    return result.success ? (result.data ?? null) : null;
  }

  /**
   * Get pending pairing request for a user
   */
  async getPendingRequestForUser(
    platformUserId: string,
    platformType: PluginType,
    chatId?: string,
    pluginId?: string
  ): Promise<IChannelPairingRequest | null> {
    const db = await getDatabase();
    const result = db.getPendingPairingRequests();

    if (!result.success || !result.data) {
      return null;
    }

    let connectorId: string | undefined;
    if (pluginId) {
      try {
        const connector = await getChannelRouteResolver().resolveChannelAccount(platformType, pluginId);
        connectorId = connector.id;
      } catch (error) {
        console.warn('[PairingService] Failed to resolve connector for pending pairing lookup:', error);
        return null;
      }
    }

    return (
      result.data.find(
        (r) =>
          (!connectorId || r.connectorId === connectorId) &&
          r.platformUserId === platformUserId &&
          r.platformType === platformType &&
          (chatId ? r.remoteChatId === chatId : true) &&
          r.status === 'pending' &&
          r.expiresAt > Date.now()
      ) ?? null
    );
  }

  async authorizeRemoteUser(params: {
    platformUserId: string;
    platformType: PluginType;
    displayName?: string;
    chatId?: string;
    pluginId?: string;
    peerContext?: PairingPeerContext;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; user?: IChannelUser; error?: string }> {
    const db = await getDatabase();

    let channelUser: IChannelUser | null = null;
    try {
      const connector = await getChannelRouteResolver().resolveChannelAccount(params.platformType, params.pluginId);
      const remoteChatId = params.chatId ?? params.platformUserId;
      const resolvedMetadata = buildPairingMetadata(params.metadata, params.peerContext);
      const peerMetadata = readPairingPeerMetadata(resolvedMetadata);
      const platformChatId = peerMetadata.platformChatId ?? remoteChatId;
      const remoteChatType = inferRemoteChatType({
        chatId: platformChatId,
        platformUserId: params.platformUserId,
        remoteChatType: peerMetadata.remoteChatType,
      });
      const existingIdentity = db.getRemoteIdentityByConnectorChat(connector.id, remoteChatId);
      const inheritedIdentity =
        existingIdentity.success && existingIdentity.data
          ? existingIdentity.data
          : platformChatId !== remoteChatId
            ? (db.getRemoteIdentityByConnectorPlatformChat(connector.id, platformChatId).data ?? null)
            : null;
      const remoteIdentity: IRemoteIdentity =
        existingIdentity.success && existingIdentity.data
          ? {
              ...existingIdentity.data,
              remoteUserId:
                remoteChatType === 'group'
                  ? (existingIdentity.data.remoteUserId ?? params.platformUserId)
                  : params.platformUserId,
              platformChatId,
              remoteChatType: peerMetadata.remoteChatType ?? remoteChatType ?? existingIdentity.data.remoteChatType,
              peerScope: peerMetadata.peerScope ?? existingIdentity.data.peerScope,
              parentChatId: peerMetadata.parentChatId ?? existingIdentity.data.parentChatId,
              threadId: peerMetadata.threadId ?? existingIdentity.data.threadId,
              displayName: params.displayName ?? existingIdentity.data.displayName,
              lastActive: Date.now(),
              metadata: {
                ...existingIdentity.data.metadata,
                ...resolvedMetadata,
              },
            }
          : {
              id: `remote_identity_${Date.now()}_${crypto.randomBytes(4).toString('hex').slice(0, 6)}`,
              connectorId: connector.id,
              remoteUserId:
                remoteChatType === 'group'
                  ? inheritedIdentity?.remoteUserId ?? params.platformUserId
                  : params.platformUserId,
              remoteChatId,
              platformChatId,
              remoteChatType: peerMetadata.remoteChatType ?? remoteChatType,
              peerScope: peerMetadata.peerScope ?? (platformChatId !== remoteChatId ? 'thread' : 'chat'),
              parentChatId: peerMetadata.parentChatId,
              threadId: peerMetadata.threadId,
              displayName: params.displayName ?? inheritedIdentity?.displayName,
              authorizedAt: inheritedIdentity?.authorizedAt ?? Date.now(),
              lastActive: Date.now(),
              legacyUserId: inheritedIdentity?.legacyUserId,
              metadata: resolvedMetadata,
            };

      const upsertIdentityResult = db.upsertRemoteIdentity(remoteIdentity);
      if (!upsertIdentityResult.success) {
        return { success: false, error: upsertIdentityResult.error || 'Failed to store remote identity' };
      }

      const mirrorUserResult = db.ensureChannelUserMirror({
        remoteIdentityId: remoteIdentity.id,
        platformUserId: params.platformUserId,
        platformType: params.platformType,
        displayName: params.displayName ?? remoteIdentity.displayName,
        authorizedAt: remoteIdentity.authorizedAt,
        lastActive: remoteIdentity.lastActive,
      });
      if (!mirrorUserResult.success || !mirrorUserResult.data) {
        return { success: false, error: mirrorUserResult.error || 'Failed to ensure channel user mirror' };
      }

      channelUser = {
        id: remoteIdentity.id,
        connectorId: connector.id,
        platformUserId: remoteIdentity.remoteUserId ?? params.platformUserId,
        platformType: params.platformType,
        displayName: params.displayName ?? remoteIdentity.displayName,
        authorizedAt: remoteIdentity.authorizedAt,
        lastActive: remoteIdentity.lastActive,
        sessionId: mirrorUserResult.data.sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve connector for pairing',
      };
    }

    if (!channelUser) {
      return { success: false, error: 'Failed to create channel user mirror' };
    }

    channelBridge.userAuthorized.emit(channelUser);

    return { success: true, user: channelUser };
  }

  /**
   * Approve a pairing request
   */
  async approvePairing(code: string): Promise<{ success: boolean; user?: IChannelUser; error?: string }> {
    const db = await getDatabase();

    // Get the pairing request
    const request = await this.getPairingRequest(code);
    if (!request) {
      return { success: false, error: 'Pairing request not found' };
    }

    // Check if expired
    if (request.expiresAt < Date.now()) {
      db.updatePairingRequestStatus(code, 'expired');
      return { success: false, error: 'Pairing code has expired' };
    }

    // Check if already processed
    if (request.status !== 'pending') {
      return {
        success: false,
        error: `Pairing request already ${request.status}`,
      };
    }

    const authorizationResult = await this.authorizeRemoteUser({
      platformUserId: request.platformUserId,
      platformType: request.platformType,
      displayName: request.displayName,
      chatId: request.remoteChatId,
      pluginId: request.connectorId,
      metadata: request.metadata,
    });
    if (!authorizationResult.success) {
      return authorizationResult;
    }

    // Update pairing request status
    db.updatePairingRequestStatus(code, 'approved');

    return authorizationResult;
  }

  /**
   * Reject a pairing request
   */
  async rejectPairing(code: string): Promise<{ success: boolean; error?: string }> {
    const db = await getDatabase();

    // Get the pairing request
    const request = await this.getPairingRequest(code);
    if (!request) {
      return { success: false, error: 'Pairing request not found' };
    }

    // Update status
    db.updatePairingRequestStatus(code, 'rejected');

    return { success: true };
  }

  /**
   * Get all pending pairing requests
   */
  async getPendingRequests(): Promise<IChannelPairingRequest[]> {
    const db = await getDatabase();
    const result = db.getPendingPairingRequests();

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.filter((r) => r.status === 'pending' && r.expiresAt > Date.now());
  }

  /**
   * Cleanup expired pairing codes
   */
  async cleanupExpired(): Promise<number> {
    const db = await getDatabase();
    const result = db.cleanupExpiredPairingRequests();
    return result.success ? (result.data ?? 0) : 0;
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate a unique 6-digit pairing code
   */
  private async generateUniqueCode(): Promise<string> {
    const db = await getDatabase();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = this.generateRandomCode();

      // Check if code exists
      const existing = db.getPairingRequestByCode(code);
      if (!existing.success || !existing.data) {
        return code;
      }

      // If code exists but expired, we can reuse it
      if (existing.data.status !== 'pending' || existing.data.expiresAt < Date.now()) {
        return code;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique pairing code');
  }

  /**
   * Generate a random 6-digit code
   */
  private generateRandomCode(): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < PAIRING_CONFIG.CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      const cleaned = await this.cleanupExpired();
      if (cleaned > 0) {
        console.log(`[PairingService] Cleaned up ${cleaned} expired pairing requests`);
      }
    }, PAIRING_CONFIG.CLEANUP_INTERVAL_MS);
  }
}

// Export singleton getter for convenience
let pairingServiceInstance: PairingService | null = null;

export function getPairingService(): PairingService {
  if (!pairingServiceInstance) {
    pairingServiceInstance = new PairingService();
  }
  return pairingServiceInstance;
}
