/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import { BUILTIN_CHANNEL_TYPES, getBuiltinChannel, isBuiltinChannelType } from '@/common/config/builtinChannels';
import { getChannelManager } from '@process/channels/core/ChannelManager';
import { getChannelHandoffService } from '@process/channels/core/ChannelHandoffService';
import { getPairingService } from '@process/channels/pairing/PairingService';
import { getDatabase } from '@process/services/database';
import { ExtensionRegistry } from '@process/extensions';
import { toAssetUrl } from '@process/extensions/protocol/assetProtocol';
import * as path from 'path';
import type {
  IChannelActiveSessionEntry,
  IChannelAudienceEntry,
  IChannelBinding,
  IChannelPluginStatus,
  IChannelSession,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
} from '@process/channels/types';
import { getChannelBindingSource, hasPluginCredentials, isSystemFallbackBinding } from '@process/channels/types';
import type { IChannelRepository } from '@process/services/database/IChannelRepository';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toThreadParts(remoteChatId: string): { parentChatId?: string; threadId?: string } {
  const marker = ':thread:';
  const markerIndex = remoteChatId.indexOf(marker);
  if (markerIndex < 0) {
    return {};
  }

  return {
    parentChatId: remoteChatId.slice(0, markerIndex),
    threadId: remoteChatId.slice(markerIndex + marker.length) || undefined,
  };
}

function buildRemoteChatAudience(identity: IRemoteIdentity): IChannelAudienceEntry {
  const { parentChatId, threadId } = toThreadParts(identity.remoteChatId);
  const chatType = identity.remoteChatType ?? (threadId ? 'thread' : undefined);
  const title = identity.displayName || identity.remoteChatId;
  const subtitle =
    chatType === 'thread'
      ? parentChatId
        ? `Topic in ${parentChatId}`
        : 'Topic / thread audience'
      : chatType === 'group' || chatType === 'supergroup' || chatType === 'channel'
        ? 'Group / shared audience'
        : 'Direct or exact audience binding';

  return {
    key: identity.remoteChatId,
    connectorId: identity.connectorId,
    scopeType: 'remote_chat',
    remoteIdentityId: identity.id,
    remoteUserId: identity.remoteUserId,
    remoteChatId: identity.remoteChatId,
    remoteChatType: chatType,
    parentChatId,
    threadId,
    displayName: identity.displayName,
    title,
    subtitle,
    lastActive: identity.lastActive,
  };
}

function buildRemoteUserAudiences(identities: IRemoteIdentity[]): IChannelAudienceEntry[] {
  const uniqueByUser = new Map<string, IRemoteIdentity>();

  for (const identity of identities) {
    if (!identity.remoteUserId) {
      continue;
    }
    if (
      identity.remoteChatType === 'group' ||
      identity.remoteChatType === 'thread' ||
      identity.remoteChatType === 'topic'
    ) {
      continue;
    }

    const current = uniqueByUser.get(identity.remoteUserId);
    if (!current || (identity.lastActive ?? 0) > (current.lastActive ?? 0)) {
      uniqueByUser.set(identity.remoteUserId, identity);
    }
  }

  return Array.from(uniqueByUser.values()).map((identity) => ({
    key: identity.remoteUserId!,
    connectorId: identity.connectorId,
    scopeType: 'remote_user',
    remoteIdentityId: identity.id,
    remoteUserId: identity.remoteUserId,
    remoteChatId: identity.remoteChatId,
    remoteChatType: identity.remoteChatType,
    displayName: identity.displayName,
    title: identity.displayName || identity.remoteUserId!,
    subtitle: identity.remoteChatId ? `Direct audience via ${identity.remoteChatId}` : 'Direct audience',
    lastActive: identity.lastActive,
  }));
}

function buildAudienceEntries(remoteIdentities: IRemoteIdentity[]): IChannelAudienceEntry[] {
  const remoteChatAudiences = remoteIdentities.map(buildRemoteChatAudience);
  const remoteUserAudiences = buildRemoteUserAudiences(remoteIdentities);

  return [...remoteUserAudiences, ...remoteChatAudiences].toSorted(
    (left, right) => (right.lastActive ?? 0) - (left.lastActive ?? 0)
  );
}

function buildActiveSessionEntries(params: {
  sessions: IChannelSession[];
  remoteIdentities: IRemoteIdentity[];
  connectors: IConnectorInstance[];
  bindings: IChannelBinding[];
  externalSessions: IExternalSession[];
  controlLeases: import('@process/channels/types').IChannelControlLease[];
}): IChannelActiveSessionEntry[] {
  const remoteIdentityMap = new Map(params.remoteIdentities.map((identity) => [identity.id, identity]));
  const connectorMap = new Map(params.connectors.map((connector) => [connector.id, connector]));
  const bindingMap = new Map(params.bindings.map((binding) => [binding.id, binding]));
  const externalSessionMap = new Map(params.externalSessions.map((session) => [session.id, session]));
  const controlLeaseMap = new Map(params.controlLeases.map((lease) => [lease.externalSessionId, lease]));

  return params.sessions.map((session) => {
    const remoteIdentity = remoteIdentityMap.get(session.userId);
    const connector = remoteIdentity ? connectorMap.get(remoteIdentity.connectorId) : undefined;
    const externalSession = externalSessionMap.get(session.id);
    const binding = externalSession?.bindingId ? bindingMap.get(externalSession.bindingId) : undefined;
    const controlLease = controlLeaseMap.get(session.id);

    return {
      id: session.id,
      connectorId: connector?.id,
      connectorName: connector?.name,
      connectorPlatform: connector?.platform,
      remoteIdentityId: remoteIdentity?.id,
      audienceTitle: remoteIdentity?.displayName || remoteIdentity?.remoteChatId || session.chatId || session.id,
      audienceKey: remoteIdentity?.remoteChatId || session.chatId,
      conversationId: session.conversationId,
      workspace: session.workspace,
      agentType: session.agentType,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      bindingId: binding?.id ?? externalSession?.bindingId,
      bindingTemporary: binding?.temporary,
      bindingSource: binding ? getChannelBindingSource(binding) : undefined,
      bindingSystemFallback: binding ? isSystemFallbackBinding(binding) : undefined,
      ownerKey: controlLease?.ownerKey,
      controlMode: controlLease?.controlMode,
      handoffMode: controlLease?.handoffMode,
      handoffSourceExternalSessionId: controlLease?.sourceExternalSessionId,
      handoffSourceConversationId: controlLease?.sourceConversationId,
      leaseUpdatedAt: controlLease?.updatedAt,
      leaseReleasedAt: controlLease?.releasedAt,
    };
  });
}

/**
 * Initialize Channel IPC Bridge
 * Handles communication between renderer (Settings UI) and main process (Channel system)
 */
export function initChannelBridge(channelRepo: IChannelRepository): void {
  console.log('[ChannelBridge] Initializing...');

  // ==================== Plugin Management ====================

  /**
   * Get status of all plugins (including extension plugin metadata)
   */
  channel.getPluginStatus.provider(async () => {
    try {
      let dbPlugins: import('@process/channels/types').IChannelPluginConfig[] = [];
      try {
        dbPlugins = await channelRepo.getChannelPlugins();
      } catch (dbError) {
        console.warn('[ChannelBridge] getChannelPlugins failed, proceeding with builtin-only list:', dbError);
      }

      // Pre-fetch extension plugin metadata (lazy, cached by registry)
      const registry = ExtensionRegistry.getInstance();

      const extensions = registry.getLoadedExtensions();
      const resolveExtensionMeta = (pluginType: string): IChannelPluginStatus['extensionMeta'] | undefined => {
        try {
          const meta = registry.getChannelPluginMeta(pluginType);
          if (!meta || typeof meta !== 'object') return undefined;
          const m = meta as Record<string, unknown>;
          const extensionMeta: NonNullable<IChannelPluginStatus['extensionMeta']> = {
            credentialFields: Array.isArray(m.credentialFields) ? m.credentialFields : undefined,
            configFields: Array.isArray(m.configFields) ? m.configFields : undefined,
            description: typeof m.description === 'string' ? m.description : undefined,
          };

          const ext = extensions.find((e) =>
            e.manifest.contributes.channelPlugins?.some((cp) => cp.type === pluginType)
          );
          if (ext) {
            extensionMeta.extensionName = ext.manifest.displayName || ext.manifest.name;
            const iconField = typeof m.icon === 'string' ? m.icon : undefined;
            if (iconField) {
              if (
                iconField.startsWith('http://') ||
                iconField.startsWith('https://') ||
                iconField.startsWith('data:') ||
                iconField.startsWith('file://') ||
                iconField.startsWith('aion-asset://')
              ) {
                extensionMeta.icon = iconField;
              } else {
                const absPath = path.isAbsolute(iconField) ? iconField : path.resolve(ext.directory, iconField);
                extensionMeta.icon = toAssetUrl(absPath);
              }
            }
          }

          return extensionMeta;
        } catch {
          return undefined;
        }
      };

      // Build a set of channel types whose parent extension is currently enabled
      const enabledExtChannelTypes = new Set<string>();
      for (const [pluginType] of registry.getChannelPlugins()) {
        enabledExtChannelTypes.add(pluginType);
      }

      const statusMap = new Map<string, IChannelPluginStatus>();

      for (const plugin of dbPlugins) {
        const isExtension = !isBuiltinChannelType(plugin.type);

        // Skip extension channels whose parent extension is not loaded/enabled
        if (isExtension && !enabledExtChannelTypes.has(plugin.type)) {
          continue;
        }

        statusMap.set(plugin.type, {
          id: plugin.id,
          type: plugin.type,
          name: plugin.name,
          enabled: plugin.enabled,
          connected: plugin.status === 'running',
          status: plugin.status,
          lastConnected: plugin.lastConnected,
          activeUsers: 0,
          hasToken: hasPluginCredentials(plugin.type, plugin.credentials),
          isExtension,
          extensionMeta: isExtension ? resolveExtensionMeta(plugin.type) : undefined,
        });
      }

      // Ensure extension-contributed channel plugins are always visible in settings
      // even before first enable (i.e. not yet persisted in DB).
      for (const [pluginType, entry] of registry.getChannelPlugins()) {
        if (statusMap.has(pluginType)) continue;
        const extensionMeta = resolveExtensionMeta(pluginType);
        const meta = entry.meta as { name?: string } | undefined;
        statusMap.set(pluginType, {
          id: pluginType,
          type: pluginType,
          name: meta?.name || pluginType,
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
          isExtension: true,
          extensionMeta,
        });
      }

      // Ensure builtin channel types are always visible in settings
      // even before user configures them (i.e. not yet persisted in DB).
      for (const builtinType of BUILTIN_CHANNEL_TYPES) {
        if (statusMap.has(builtinType)) continue;
        const builtinChannel = getBuiltinChannel(builtinType);
        statusMap.set(builtinType, {
          id: builtinType,
          type: builtinType,
          name: builtinChannel?.displayName || builtinType,
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
          isExtension: false,
        });
      }

      return { success: true, data: Array.from(statusMap.values()) };
    } catch (error) {
      console.error('[ChannelBridge] getPluginStatus error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Enable a plugin
   */
  channel.enablePlugin.provider(async ({ pluginId, config }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.enablePlugin(pluginId, config);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] enablePlugin error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Disable a plugin
   */
  channel.disablePlugin.provider(async ({ pluginId }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.disablePlugin(pluginId);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] disablePlugin error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Test plugin connection (validate token)
   */
  channel.testPlugin.provider(async ({ pluginId, token, extraConfig }) => {
    try {
      const manager = getChannelManager();
      const result = await manager.testPlugin(pluginId, token, extraConfig);
      return { success: true, data: result };
    } catch (error) {
      console.error('[ChannelBridge] testPlugin error:', error);
      return { success: false, data: { success: false, error: getErrorMessage(error) } };
    }
  });

  // ==================== Pairing Management ====================

  /**
   * Get pending pairing requests
   */
  channel.getPendingPairings.provider(async () => {
    try {
      const data = await channelRepo.getPendingPairingRequests();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getPendingPairings error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Approve a pairing request
   * Delegates to PairingService to avoid duplicate logic
   */
  channel.approvePairing.provider(async ({ code }) => {
    try {
      const pairingService = getPairingService();
      const result = await pairingService.approvePairing(code);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      console.log(`[ChannelBridge] Approved pairing for code ${code}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] approvePairing error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Reject a pairing request
   * Delegates to PairingService to avoid duplicate logic
   */
  channel.rejectPairing.provider(async ({ code }) => {
    try {
      const pairingService = getPairingService();
      const result = await pairingService.rejectPairing(code);

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      console.log(`[ChannelBridge] Rejected pairing code ${code}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] rejectPairing error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  // ==================== User Management ====================

  /**
   * Get all authorized users
   */
  channel.getAuthorizedUsers.provider(async () => {
    try {
      const data = await channelRepo.getChannelUsers();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getAuthorizedUsers error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Revoke user authorization
   */
  channel.revokeUser.provider(async ({ userId }) => {
    try {
      // Delete user (cascades to sessions)
      await channelRepo.deleteChannelUser(userId);
      console.log(`[ChannelBridge] Revoked user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] revokeUser error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  // ==================== Session Management ====================

  /**
   * Get active sessions
   */
  channel.getActiveSessions.provider(async () => {
    try {
      const data = await channelRepo.getChannelSessions();
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getActiveSessions error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.getActiveSessionCatalog.provider(async () => {
    try {
      const db = await getDatabase();
      const [sessions, connectors, remoteIdentities, bindings] = await Promise.all([
        channelRepo.getChannelSessions(),
        channelRepo.getConnectorInstances(),
        channelRepo.getRemoteIdentities(),
        channelRepo.getChannelBindings(),
      ]);
      const externalSessionsResult = db.getAllExternalSessions();
      const controlLeasesResult = db.getAllChannelControlLeases();
      if (!externalSessionsResult.success || !externalSessionsResult.data) {
        throw new Error(externalSessionsResult.error || 'Failed to load external sessions');
      }
      if (!controlLeasesResult.success || !controlLeasesResult.data) {
        throw new Error(controlLeasesResult.error || 'Failed to load channel control leases');
      }
      return {
        success: true,
        data: buildActiveSessionEntries({
          sessions,
          connectors,
          remoteIdentities,
          bindings,
          externalSessions: externalSessionsResult.data,
          controlLeases: controlLeasesResult.data,
        }),
      };
    } catch (error) {
      console.error('[ChannelBridge] getActiveSessionCatalog error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Get binding catalog for publication management.
   */
  channel.getBindingCatalog.provider(async (params?: { connectorId?: string }) => {
    try {
      const [connectors, agentProfiles, bindings, remoteIdentities] = await Promise.all([
        channelRepo.getConnectorInstances(),
        channelRepo.getAgentProfiles(),
        channelRepo.getChannelBindings(params?.connectorId),
        channelRepo.getRemoteIdentities(params?.connectorId),
      ]);
      return {
        success: true,
        data: {
          connectors,
          agentProfiles,
          bindings,
          audiences: buildAudienceEntries(remoteIdentities),
        },
      };
    } catch (error) {
      console.error('[ChannelBridge] getBindingCatalog error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Get channel bindings
   */
  channel.getBindings.provider(async (params?: { connectorId?: string }) => {
    try {
      const data = await channelRepo.getChannelBindings(params?.connectorId);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] getBindings error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Upsert channel binding
   */
  channel.upsertBinding.provider(async ({ binding }) => {
    try {
      await channelRepo.upsertChannelBinding(binding);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] upsertBinding error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Delete channel binding
   */
  channel.deleteBinding.provider(async ({ bindingId }) => {
    try {
      await channelRepo.deleteChannelBinding(bindingId);
      return { success: true };
    } catch (error) {
      console.error('[ChannelBridge] deleteBinding error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  /**
   * Handoff a source session/conversation to a target channel chat.
   */
  channel.handoffSession.provider(async (params) => {
    try {
      const handoffService = getChannelHandoffService();
      const data = await handoffService.handoffSession(params);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] handoffSession error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.endHandoffSession.provider(async ({ targetExternalSessionId }) => {
    try {
      const handoffService = getChannelHandoffService();
      const data = await handoffService.releaseHandoff(targetExternalSessionId);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] endHandoffSession error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  channel.setHandoffControlMode.provider(async ({ targetExternalSessionId, controlMode }) => {
    try {
      const handoffService = getChannelHandoffService();
      const data = await handoffService.updateHandoffControlMode(targetExternalSessionId, controlMode);
      return { success: true, data };
    } catch (error) {
      console.error('[ChannelBridge] setHandoffControlMode error:', error);
      return { success: false, msg: getErrorMessage(error) };
    }
  });

  console.log('[ChannelBridge] Initialized');
}
