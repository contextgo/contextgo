/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import type { TChatConversation, TProviderWithModel } from '@/common/config/storage';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import { uuid } from '@/common/utils';
import { conversationServiceSingleton } from '@/process/services/conversationServiceSingleton';
import { getDatabase } from '@process/services/database';
import { ProcessConfig } from '@process/utils/initStorage';
import crypto from 'crypto';
import type {
  ChannelAgentType,
  IAgentProfile,
  IChannelBinding,
  IChannelSession,
  IChannelUser,
  IChannelRun,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
  PluginType,
} from '../types';
import {
  getChannelBindingTarget,
  getChannelConversationName,
  isSystemFallbackBinding,
  resolveChannelConvType,
} from '../types';

type RemoteChatType = 'direct' | 'group';

const DIRECT_CHAT_TYPES = new Set(['direct', 'dm', 'private', 'p2p', 'user', '1']);
const GROUP_CHAT_TYPES = new Set(['group', 'supergroup', 'channel', 'thread', 'topic', '2']);

function normalizeRemoteChatType(remoteChatType?: string): RemoteChatType | undefined {
  if (!remoteChatType) {
    return undefined;
  }

  const normalized = remoteChatType.toLowerCase();
  if (DIRECT_CHAT_TYPES.has(normalized)) {
    return 'direct';
  }
  if (GROUP_CHAT_TYPES.has(normalized)) {
    return 'group';
  }
  return undefined;
}

export function inferRemoteChatType(params: {
  chatId: string;
  platformUserId: string;
  remoteChatType?: string;
}): RemoteChatType | undefined {
  const explicitType = normalizeRemoteChatType(params.remoteChatType);
  if (explicitType) {
    return explicitType;
  }

  if (params.chatId.startsWith('user:')) {
    return 'direct';
  }

  if (params.chatId.startsWith('group:')) {
    return 'group';
  }

  if (params.chatId === params.platformUserId) {
    return 'direct';
  }

  return undefined;
}

function shouldUseRemoteUserBinding(
  remoteIdentity: Pick<IRemoteIdentity, 'remoteChatId' | 'remoteUserId' | 'remoteChatType'>
): boolean {
  if (!remoteIdentity.remoteUserId) {
    return false;
  }

  return (
    inferRemoteChatType({
      chatId: remoteIdentity.remoteChatId,
      platformUserId: remoteIdentity.remoteUserId,
      remoteChatType: remoteIdentity.remoteChatType,
    }) !== 'group'
  );
}

function readBindingContinuationConfig(binding: IChannelBinding): {
  mode?: 'resume' | 'new_thread';
  resumeConversationId?: string;
} {
  const metadata = binding.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const continuation = (metadata as Record<string, unknown>).continuation;
  if (!continuation || typeof continuation !== 'object') {
    return {};
  }

  const continuationRecord = continuation as Record<string, unknown>;
  return {
    mode:
      continuationRecord.mode === 'new_thread'
        ? 'new_thread'
        : continuationRecord.mode === 'resume'
          ? 'resume'
          : undefined,
    resumeConversationId:
      typeof continuationRecord.resumeConversationId === 'string' && continuationRecord.resumeConversationId
        ? continuationRecord.resumeConversationId
        : undefined,
  };
}

function toProjectedChannelUser(params: {
  remoteIdentityId: string;
  platformUserId: string;
  platformType: PluginType;
  displayName?: string;
  authorizedAt: number;
  lastActive?: number;
  sessionId?: string;
}): IChannelUser {
  return {
    id: params.remoteIdentityId,
    platformUserId: params.platformUserId,
    platformType: params.platformType,
    displayName: params.displayName,
    authorizedAt: params.authorizedAt,
    lastActive: params.lastActive,
    sessionId: params.sessionId,
  };
}

export type ResolvedChannelRoute = {
  connector: IConnectorInstance;
  remoteIdentity: IRemoteIdentity;
  channelUser: IChannelUser;
  binding: IChannelBinding;
  agentProfile: IAgentProfile;
  externalSession: IExternalSession;
  conversation: TChatConversation;
  session: IChannelSession;
};

type ResolveRouteParams = {
  platform: PluginType;
  pluginId?: string;
  platformUserId: string;
  chatId: string;
  platformChatId?: string;
  peerScope?: 'chat' | 'thread';
  parentChatId?: string;
  threadId?: string;
  remoteChatType?: string;
  displayName?: string;
  containerId?: string;
  containerType?: string;
  containerTitle?: string;
  forceNewConversation?: boolean;
  overrideAgentType?: ChannelAgentType;
};

function buildStableId(prefix: string, ...parts: Array<string | undefined>): string {
  const hash = crypto
    .createHash('sha256')
    .update(parts.map((part) => part ?? '').join('|'))
    .digest('hex')
    .slice(0, 16);
  return `${prefix}_${hash}`;
}

function sortBindings(bindings: IChannelBinding[]): IChannelBinding[] {
  return bindings.toSorted((left, right) => right.priority - left.priority || left.createdAt - right.createdAt);
}

function getPreferredBinding(bindings?: IChannelBinding[]): IChannelBinding | undefined {
  if (!bindings?.length) {
    return undefined;
  }

  return sortBindings(bindings.filter((binding) => binding.enabled))[0];
}

function backendToAgentType(backend: string): ChannelAgentType {
  const { convType } = resolveChannelConvType(backend);
  return convType as ChannelAgentType;
}

function buildGoogleAuthGeminiModel(preferred: NonNullable<IAgentProfile['modelRef']>): TProviderWithModel {
  return {
    id: preferred.id || GOOGLE_AUTH_PROVIDER_ID,
    platform: 'gemini-with-google-auth',
    name: preferred.name || 'Gemini',
    baseUrl: preferred.baseUrl ?? '',
    apiKey: '',
    useModel: preferred.useModel,
  };
}

async function resolveProviderModel(preferred?: IAgentProfile['modelRef']): Promise<TProviderWithModel> {
  const providers = await ProcessConfig.get('model.config');
  const providerList = Array.isArray(providers) ? providers : [];

  if (preferred) {
    if (preferred.id === GOOGLE_AUTH_PROVIDER_ID || preferred.platform === 'gemini-with-google-auth') {
      return buildGoogleAuthGeminiModel(preferred);
    }

    const matched = providerList.find(
      (provider) => provider.id === preferred.id && provider.model?.includes(preferred.useModel)
    );
    if (matched) {
      return {
        ...matched,
        useModel: preferred.useModel,
      } as TProviderWithModel;
    }

    if (preferred.platform) {
      const matchedByPlatform = providerList.find(
        (provider) => provider.platform === preferred.platform && provider.model?.includes(preferred.useModel)
      );
      if (matchedByPlatform) {
        return {
          ...matchedByPlatform,
          useModel: preferred.useModel,
        } as TProviderWithModel;
      }
    }
  }

  const geminiProvider = providerList.find(
    (provider) => provider.platform === 'gemini' && provider.apiKey && provider.model?.length
  );
  if (geminiProvider) {
    return {
      ...geminiProvider,
      useModel: geminiProvider.model[0],
    } as TProviderWithModel;
  }

  const anyProvider = providerList.find((provider) => provider.apiKey && provider.model?.length);
  if (anyProvider) {
    return {
      ...anyProvider,
      useModel: anyProvider.model[0],
    } as TProviderWithModel;
  }

  return {
    id: 'gemini_default',
    platform: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    useModel: 'gemini-2.0-flash',
  };
}

function conversationMatchesProfile(conversation: TChatConversation, profile: IAgentProfile): boolean {
  const { convType, convBackend } = resolveChannelConvType(profile.backend);
  if (conversation.type !== convType) {
    return false;
  }

  if (convType === 'acp') {
    const backend = 'backend' in conversation.extra ? conversation.extra.backend : undefined;
    return backend === convBackend;
  }

  return true;
}

export class ChannelRouteResolver {
  async resolveChannelAccount(platform: PluginType, pluginId?: string): Promise<IConnectorInstance> {
    const db = await getDatabase();

    if (pluginId) {
      const direct = db.getConnectorInstance(pluginId);
      if (direct.success && direct.data) {
        return direct.data;
      }

      const legacyMapped = db.getConnectorInstanceByLegacyPluginId(pluginId);
      if (legacyMapped.success && legacyMapped.data) {
        return legacyMapped.data;
      }

      const legacyPlugin = db.getChannelPlugin(pluginId);
      if (legacyPlugin.success && legacyPlugin.data) {
        db.upsertConnectorInstance({
          id: legacyPlugin.data.id,
          platform: legacyPlugin.data.type,
          name: legacyPlugin.data.name,
          enabled: legacyPlugin.data.enabled,
          status: legacyPlugin.data.status,
          credentials: legacyPlugin.data.credentials,
          runtimeConfig: legacyPlugin.data.config,
          legacyPluginId: legacyPlugin.data.id,
          createdAt: legacyPlugin.data.createdAt,
          updatedAt: Date.now(),
        });
        const connector = db.getConnectorInstance(legacyPlugin.data.id);
        if (connector.success && connector.data) {
          return connector.data;
        }
      }
    }

    const connectors = db.getConnectorInstances();
    if (connectors.success && connectors.data) {
      const preferred =
        connectors.data.find((connector) => connector.platform === platform && connector.enabled) ??
        connectors.data.find((connector) => connector.platform === platform);
      if (preferred) {
        return preferred;
      }
    }

    throw new Error(`No connector configured for platform ${platform}`);
  }

  async resolveConnectorInstance(platform: PluginType, pluginId?: string): Promise<IConnectorInstance> {
    return this.resolveChannelAccount(platform, pluginId);
  }

  async resolveAuthorizedRoute(params: ResolveRouteParams): Promise<ResolvedChannelRoute> {
    const db = await getDatabase();
    const connector = await this.resolveChannelAccount(params.platform, params.pluginId);
    const channelUser = await this.ensureChannelUserProjection(
      connector,
      params.platformUserId,
      params.platform,
      params.chatId,
      params.platformChatId,
      params.displayName,
      params.remoteChatType,
      params.peerScope,
      params.parentChatId,
      params.threadId
    );
    const remoteIdentity = await this.ensureRemoteIdentity(
      connector,
      channelUser,
      params.platformUserId,
      params.chatId,
      params.platformChatId,
      params.remoteChatType,
      params.displayName,
      params.peerScope,
      params.parentChatId,
      params.threadId,
      params.containerId,
      params.containerType,
      params.containerTitle
    );

    const binding = await this.resolveBinding({
      connector,
      remoteIdentity,
      platform: params.platform,
    });
    const bindingTarget = getChannelBindingTarget(binding);
    const bindingContinuationConfig = readBindingContinuationConfig(binding);

    let sourceExternalSession: IExternalSession | null = null;
    let agentProfileId = binding.agentProfileId;
    if (bindingTarget.type === 'external_session') {
      const sourceSessionResult = db.getExternalSession(bindingTarget.id);
      if (!sourceSessionResult.success || !sourceSessionResult.data) {
        throw new Error(`External session target ${bindingTarget.id} not found`);
      }
      sourceExternalSession = sourceSessionResult.data;
      agentProfileId = sourceExternalSession.agentProfileId;
    } else {
      agentProfileId = bindingTarget.id;
    }

    const agentProfileResult = db.getAgentProfile(agentProfileId);
    if (!agentProfileResult.success || !agentProfileResult.data) {
      throw new Error(`Agent profile ${agentProfileId} not found`);
    }
    const agentProfile = agentProfileResult.data;

    let externalSession = await this.ensureExternalSession(connector, remoteIdentity, binding, agentProfile);
    const externalSessionTargetMode =
      bindingTarget.type === 'external_session' ? (bindingTarget.mode ?? 'resume') : bindingContinuationConfig.mode;
    const shouldForceNewConversation = params.forceNewConversation || externalSessionTargetMode === 'new_thread';

    const resumeConversationId =
      externalSessionTargetMode === 'resume'
        ? (sourceExternalSession?.activeConversationId ?? bindingContinuationConfig.resumeConversationId)
        : undefined;
    if (resumeConversationId) {
      externalSession = await this.attachConversationToExternalSession(
        externalSession,
        resumeConversationId,
        binding.id,
        sourceExternalSession?.id
      );
    }

    const conversation = await this.ensureConversation({
      platform: params.platform,
      chatId: params.chatId,
      externalSession,
      agentProfile,
      forceNewConversation: shouldForceNewConversation,
    });

    const session: IChannelSession = {
      id: externalSession.id,
      userId: channelUser.id,
      agentType: params.overrideAgentType ?? backendToAgentType(agentProfile.backend),
      conversationId: conversation.id,
      chatId: params.chatId,
      workspace: agentProfile.workspaceRef,
      createdAt: externalSession.createdAt,
      lastActivity: Date.now(),
    };

    db.upsertChannelSession(session);

    return {
      connector,
      remoteIdentity,
      channelUser,
      binding,
      agentProfile,
      externalSession,
      conversation,
      session,
    };
  }

  private async ensureChannelUserProjection(
    connector: IConnectorInstance,
    platformUserId: string,
    platform: PluginType,
    chatId: string,
    platformChatId?: string,
    displayName?: string,
    remoteChatType?: string,
    peerScope?: 'chat' | 'thread',
    parentChatId?: string,
    threadId?: string
  ): Promise<IChannelUser> {
    const db = await getDatabase();
    const resolvedPlatformChatId = platformChatId ?? chatId;
    const exactIdentity = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
    const existingIdentity =
      exactIdentity.success && exactIdentity.data
        ? exactIdentity
        : resolvedPlatformChatId !== chatId
          ? db.getRemoteIdentityByConnectorPlatformChat(connector.id, resolvedPlatformChatId)
          : exactIdentity;

    if (existingIdentity.success && existingIdentity.data) {
      const mirrorUserResult = db.ensureChannelUserMirror({
        remoteIdentityId: existingIdentity.data.id,
        platformUserId,
        platformType: platform,
        displayName: displayName ?? existingIdentity.data.displayName,
        authorizedAt: existingIdentity.data.authorizedAt,
        lastActive: existingIdentity.data.lastActive,
      });
      if (!mirrorUserResult.success || !mirrorUserResult.data) {
        throw new Error(mirrorUserResult.error || 'Failed to create channel user mirror');
      }
      return toProjectedChannelUser({
        remoteIdentityId: existingIdentity.data.id,
        platformUserId: existingIdentity.data.remoteUserId ?? platformUserId,
        platformType: platform,
        displayName: displayName ?? existingIdentity.data.displayName ?? mirrorUserResult.data.displayName,
        authorizedAt: existingIdentity.data.authorizedAt,
        lastActive: existingIdentity.data.lastActive ?? mirrorUserResult.data.lastActive,
        sessionId: mirrorUserResult.data.sessionId,
      });
    }

    const publishedAudienceBinding = db.getChannelBindingsForScope(connector.id, 'remote_chat', chatId);
    if (publishedAudienceBinding.success && publishedAudienceBinding.data.length > 0) {
      return this.createPublishedAudienceProjection({
        connector,
        platformUserId,
        platform,
        chatId,
        platformChatId: resolvedPlatformChatId,
        displayName,
      });
    }

    if (resolvedPlatformChatId !== chatId) {
      const parentAudienceBinding = db.getChannelBindingsForScope(connector.id, 'remote_chat', resolvedPlatformChatId);
      if (parentAudienceBinding.success && parentAudienceBinding.data.length > 0) {
        return this.createPublishedAudienceProjection({
          connector,
          platformUserId,
          platform,
          chatId,
          platformChatId: resolvedPlatformChatId,
          displayName,
        });
      }
    }

    const connectorDefaultBinding = db.getChannelBindingsForScope(connector.id, 'connector_default');
    if (connectorDefaultBinding.success && connectorDefaultBinding.data.length > 0) {
      return this.createPublishedAudienceProjection({
        connector,
        platformUserId,
        platform,
        chatId,
        platformChatId: resolvedPlatformChatId,
        displayName,
      });
    }

    const legacyBootstrapUser = await this.bootstrapLegacyDirectAuthorization({
      connector,
      platformUserId,
      platform,
      chatId,
      platformChatId: resolvedPlatformChatId,
      remoteChatType,
      displayName,
      peerScope,
      parentChatId,
      threadId,
    });
    if (legacyBootstrapUser) {
      return legacyBootstrapUser;
    }

    throw new Error('User not authorized');
  }

  private createPublishedAudienceProjection(params: {
    connector: IConnectorInstance;
    platformUserId: string;
    platform: PluginType;
    chatId: string;
    platformChatId: string;
    displayName?: string;
  }): IChannelUser {
    return toProjectedChannelUser({
      remoteIdentityId: buildStableId(
        'remote_identity_published',
        params.connector.id,
        params.chatId,
        params.platformUserId,
        params.platformChatId
      ),
      platformUserId: params.platformUserId,
      platformType: params.platform,
      displayName: params.displayName,
      authorizedAt: Date.now(),
      lastActive: Date.now(),
    });
  }

  private async bootstrapLegacyDirectAuthorization(params: {
    connector: IConnectorInstance;
    platformUserId: string;
    platform: PluginType;
    chatId: string;
    platformChatId?: string;
    remoteChatType?: string;
    displayName?: string;
    peerScope?: 'chat' | 'thread';
    parentChatId?: string;
    threadId?: string;
  }): Promise<IChannelUser | null> {
    const db = await getDatabase();
    const resolvedChatType = inferRemoteChatType({
      chatId: params.chatId,
      platformUserId: params.platformUserId,
      remoteChatType: params.remoteChatType,
    });
    if (resolvedChatType === 'group') {
      return null;
    }

    const connectors = db.getConnectorInstances();
    if (!connectors.success || !connectors.data) {
      return null;
    }

    const samePlatformConnectorCount = connectors.data.filter(
      (connector) => connector.platform === params.platform
    ).length;
    if (samePlatformConnectorCount > 1) {
      return null;
    }

    const legacyUserResult = db.getLegacyChannelUserByPlatform(params.platformUserId, params.platform);
    if (!legacyUserResult.success || !legacyUserResult.data) {
      return null;
    }

    const now = Date.now();
    const remoteIdentity: IRemoteIdentity = {
      id: `remote_identity_${uuid()}`,
      connectorId: params.connector.id,
      remoteUserId: params.platformUserId,
      remoteChatId: params.chatId,
      platformChatId: params.platformChatId ?? params.chatId,
      remoteChatType: params.remoteChatType ?? resolvedChatType ?? 'direct',
      peerScope: params.peerScope ?? 'chat',
      parentChatId: params.parentChatId,
      threadId: params.threadId,
      displayName: params.displayName ?? legacyUserResult.data.displayName,
      authorizedAt: legacyUserResult.data.authorizedAt,
      lastActive: now,
      legacyUserId: legacyUserResult.data.id,
      metadata: {
        source: 'legacy-direct-chat-bootstrap',
      },
    };
    const upsertIdentityResult = db.upsertRemoteIdentity(remoteIdentity);
    if (!upsertIdentityResult.success) {
      throw new Error(upsertIdentityResult.error || 'Failed to bootstrap legacy authorization');
    }

    const mirrorUserResult = db.ensureChannelUserMirror({
      remoteIdentityId: remoteIdentity.id,
      platformUserId: params.platformUserId,
      platformType: params.platform,
      displayName: remoteIdentity.displayName,
      authorizedAt: remoteIdentity.authorizedAt,
      lastActive: remoteIdentity.lastActive,
      sessionId: legacyUserResult.data.sessionId,
    });
    if (!mirrorUserResult.success || !mirrorUserResult.data) {
      throw new Error(mirrorUserResult.error || 'Failed to create channel user mirror');
    }

    return toProjectedChannelUser({
      remoteIdentityId: remoteIdentity.id,
      platformUserId: remoteIdentity.remoteUserId ?? params.platformUserId,
      platformType: params.platform,
      displayName: remoteIdentity.displayName,
      authorizedAt: remoteIdentity.authorizedAt,
      lastActive: remoteIdentity.lastActive,
      sessionId: mirrorUserResult.data.sessionId,
    });
  }

  private async ensureRemoteIdentity(
    connector: IConnectorInstance,
    channelUser: IChannelUser,
    platformUserId: string,
    chatId: string,
    platformChatId?: string,
    remoteChatType?: string,
    displayName?: string,
    peerScope?: 'chat' | 'thread',
    parentChatId?: string,
    threadId?: string,
    containerId?: string,
    containerType?: string,
    containerTitle?: string
  ): Promise<IRemoteIdentity> {
    const db = await getDatabase();
    const now = Date.now();
    const resolvedPlatformChatId = platformChatId ?? chatId;
    const normalizedPeerScope = peerScope ?? (resolvedPlatformChatId !== chatId ? 'thread' : 'chat');
    const fallbackGroupType = inferRemoteChatType({
      chatId: resolvedPlatformChatId,
      platformUserId,
      remoteChatType,
    });
    const normalizedChatType = remoteChatType ?? fallbackGroupType;

    const byChat = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
    if (byChat.success && byChat.data) {
      const resolvedBindingType = inferRemoteChatType({
        chatId: resolvedPlatformChatId,
        platformUserId,
        remoteChatType: normalizedChatType ?? byChat.data.remoteChatType,
      });
      const nextIdentity: IRemoteIdentity = {
        ...byChat.data,
        remoteUserId: resolvedBindingType === 'group' ? (byChat.data.remoteUserId ?? platformUserId) : platformUserId,
        platformChatId: resolvedPlatformChatId,
        remoteChatType: normalizedChatType ?? byChat.data.remoteChatType,
        peerScope: peerScope ?? byChat.data.peerScope ?? normalizedPeerScope,
        parentChatId: parentChatId ?? byChat.data.parentChatId,
        threadId: threadId ?? byChat.data.threadId,
        displayName: displayName ?? byChat.data.displayName,
        lastActive: now,
        legacyUserId: byChat.data.legacyUserId,
        metadata: {
          ...byChat.data.metadata,
          ...(containerId ? { containerId } : {}),
          ...(containerType ? { containerType } : {}),
          ...(containerTitle ? { containerTitle } : {}),
        },
      };
      db.upsertRemoteIdentity(nextIdentity);
      return nextIdentity;
    }

    const byPlatformChat =
      resolvedPlatformChatId !== chatId
        ? db.getRemoteIdentityByConnectorPlatformChat(connector.id, resolvedPlatformChatId)
        : { success: true, data: null };
    if (byPlatformChat.success && byPlatformChat.data) {
      const resolvedBindingType = inferRemoteChatType({
        chatId: resolvedPlatformChatId,
        platformUserId,
        remoteChatType: normalizedChatType ?? byPlatformChat.data.remoteChatType,
      });
      const remoteIdentity: IRemoteIdentity = {
        id: `remote_identity_${uuid()}`,
        connectorId: connector.id,
        remoteUserId:
          resolvedBindingType === 'group' ? (byPlatformChat.data.remoteUserId ?? platformUserId) : platformUserId,
        remoteChatId: chatId,
        platformChatId: resolvedPlatformChatId,
        remoteChatType: normalizedChatType ?? byPlatformChat.data.remoteChatType,
        peerScope: normalizedPeerScope,
        parentChatId: parentChatId ?? byPlatformChat.data.parentChatId ?? resolvedPlatformChatId,
        threadId,
        displayName: displayName ?? byPlatformChat.data.displayName,
        authorizedAt: byPlatformChat.data.authorizedAt,
        lastActive: now,
        legacyUserId: byPlatformChat.data.legacyUserId,
        metadata: {
          ...byPlatformChat.data.metadata,
          ...(containerId ? { containerId } : {}),
          ...(containerType ? { containerType } : {}),
          ...(containerTitle ? { containerTitle } : {}),
          source: 'channel-runtime-peer',
          parentIdentityId: byPlatformChat.data.id,
        },
      };
      db.upsertRemoteIdentity(remoteIdentity);
      return remoteIdentity;
    }

    const remoteIdentity: IRemoteIdentity = {
      id: `remote_identity_${uuid()}`,
      connectorId: connector.id,
      remoteUserId: platformUserId,
      remoteChatId: chatId,
      platformChatId: resolvedPlatformChatId,
      remoteChatType: normalizedChatType,
      peerScope: normalizedPeerScope,
      parentChatId,
      threadId,
      displayName,
      authorizedAt: channelUser.authorizedAt,
      lastActive: now,
      legacyUserId: channelUser.id.startsWith('assistant_user_') ? channelUser.id : undefined,
      metadata: {
        ...(containerId ? { containerId } : {}),
        ...(containerType ? { containerType } : {}),
        ...(containerTitle ? { containerTitle } : {}),
        source: 'channel-runtime',
      },
    };
    db.upsertRemoteIdentity(remoteIdentity);
    return remoteIdentity;
  }

  private async resolveBinding(params: {
    connector: IConnectorInstance;
    remoteIdentity: IRemoteIdentity;
    platform: PluginType;
    overrideAgentProfileId?: string;
  }): Promise<IChannelBinding> {
    const db = await getDatabase();

    if (params.overrideAgentProfileId) {
      this.assertExistingAgentProfile(db.getAgentProfile(params.overrideAgentProfileId), params.overrideAgentProfileId);

      const now = Date.now();
      const overrideBinding: IChannelBinding = {
        id: buildStableId(
          'binding_override',
          params.connector.id,
          params.remoteIdentity.remoteChatId,
          params.overrideAgentProfileId
        ),
        connectorId: params.connector.id,
        scopeType: 'temporary_override',
        scopeKey: params.remoteIdentity.remoteChatId,
        agentProfileId: params.overrideAgentProfileId,
        priority: 1000,
        enabled: true,
        temporary: true,
        metadata: {
          source: 'agent-select',
          overrideMode: 'agent-profile',
        },
        createdAt: now,
        updatedAt: now,
      };

      db.upsertChannelBinding(overrideBinding);
      return overrideBinding;
    }

    const candidateAudienceKeys = Array.from(
      new Set(
        [
          params.remoteIdentity.remoteChatId,
          params.remoteIdentity.parentChatId,
          params.remoteIdentity.platformChatId,
        ].filter((value): value is string => Boolean(value))
      )
    );

    for (const audienceKey of candidateAudienceKeys) {
      const temporaryOverrides = db.getChannelBindingsForScope(params.connector.id, 'temporary_override', audienceKey);
      const activeTemporaryOverride = temporaryOverrides.success
        ? getPreferredBinding(temporaryOverrides.data)
        : undefined;
      if (activeTemporaryOverride) {
        return activeTemporaryOverride;
      }
    }

    for (const audienceKey of candidateAudienceKeys) {
      const remoteChatBindings = db.getChannelBindingsForScope(params.connector.id, 'remote_chat', audienceKey);
      const preferredRemoteChatBinding = remoteChatBindings.success
        ? getPreferredBinding(remoteChatBindings.data)
        : undefined;
      if (preferredRemoteChatBinding) {
        return preferredRemoteChatBinding;
      }
    }

    if (shouldUseRemoteUserBinding(params.remoteIdentity)) {
      const remoteUserBindings = db.getChannelBindingsForScope(
        params.connector.id,
        'remote_user',
        params.remoteIdentity.remoteUserId
      );
      const preferredRemoteUserBinding = remoteUserBindings.success
        ? getPreferredBinding(remoteUserBindings.data)
        : undefined;
      if (preferredRemoteUserBinding) {
        return preferredRemoteUserBinding;
      }
    }

    const defaultBindings = db.getChannelBindingsForScope(params.connector.id, 'connector_default');
    const existingDefault = defaultBindings.success
      ? getPreferredBinding(defaultBindings.data.filter((binding) => !isSystemFallbackBinding(binding)))
      : undefined;
    if (existingDefault) {
      return existingDefault;
    }

    throw new Error(
      `No Agent publication is configured for channel entry "${params.connector.name}". Open Agent Publish and bind an Agent first.`
    );
  }

  async resolveAgentProfileById(profileId: string): Promise<IAgentProfile> {
    const db = await getDatabase();
    return this.assertExistingAgentProfile(db.getAgentProfile(profileId), profileId);
  }

  private assertExistingAgentProfile(
    result: { success: boolean; data?: IAgentProfile | null; error?: string },
    profileId: string
  ): IAgentProfile {
    if (!result.success) {
      throw new Error(result.error || `Failed to load agent profile ${profileId}`);
    }
    if (!result.data) {
      throw new Error(`Agent profile ${profileId} not found`);
    }

    return result.data;
  }

  private async ensureExternalSession(
    connector: IConnectorInstance,
    remoteIdentity: IRemoteIdentity,
    binding: IChannelBinding,
    agentProfile: IAgentProfile
  ): Promise<IExternalSession> {
    const db = await getDatabase();
    const existing = db.getExternalSessionByConnectorRemote(connector.id, remoteIdentity.id);
    if (existing.success && existing.data) {
      const nextSession: IExternalSession = {
        ...existing.data,
        bindingId: binding.id,
        agentProfileId: agentProfile.id,
        lastActivity: Date.now(),
      };
      db.upsertExternalSession(nextSession);
      return nextSession;
    }

    const session: IExternalSession = {
      id: `external_session_${uuid()}`,
      connectorId: connector.id,
      remoteIdentityId: remoteIdentity.id,
      bindingId: binding.id,
      agentProfileId: agentProfile.id,
      state: 'active',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: {
        source: 'channel-runtime',
      },
    };
    db.upsertExternalSession(session);
    return session;
  }

  private async attachConversationToExternalSession(
    externalSession: IExternalSession,
    conversationId: string,
    bindingId: string,
    sourceExternalSessionId?: string
  ): Promise<IExternalSession> {
    const db = await getDatabase();
    const conversation = db.getConversation(conversationId);
    if (!conversation.success || !conversation.data) {
      return externalSession;
    }

    const now = Date.now();
    const updated: IExternalSession = {
      ...externalSession,
      bindingId,
      activeConversationId: conversationId,
      lastActivity: now,
      metadata: {
        ...externalSession.metadata,
        continuation: {
          resumeConversationId: conversationId,
          sourceExternalSessionId,
          updatedAt: now,
        },
      },
    };
    db.upsertExternalSession(updated);
    return updated;
  }

  private async ensureConversation(params: {
    platform: PluginType;
    chatId: string;
    externalSession: IExternalSession;
    agentProfile: IAgentProfile;
    forceNewConversation?: boolean;
  }): Promise<TChatConversation> {
    const db = await getDatabase();
    const activeConversation =
      params.externalSession.activeConversationId &&
      db.getConversation(params.externalSession.activeConversationId).success
        ? db.getConversation(params.externalSession.activeConversationId).data
        : undefined;

    const shouldRotate =
      params.forceNewConversation ||
      !activeConversation ||
      !conversationMatchesProfile(activeConversation, params.agentProfile);

    if (!shouldRotate && activeConversation) {
      const needsRootRun = !activeConversation.rootRunId;
      const rootRunId = activeConversation.rootRunId ?? `run_${uuid()}`;
      const needsOwnershipTransfer = activeConversation.externalSessionId !== params.externalSession.id;
      if (needsRootRun) {
        await this.ensureRootRun(params.externalSession.id, params.agentProfile, activeConversation.id, rootRunId);
      }
      if (needsRootRun || needsOwnershipTransfer) {
        db.updateConversation(activeConversation.id, {
          externalSessionId: params.externalSession.id,
          rootRunId,
        });
      }
      db.updateExternalSessionActivity(params.externalSession.id, {
        lastActivity: Date.now(),
        activeConversationId: activeConversation.id,
        bindingId: params.externalSession.bindingId,
      });
      if (needsRootRun || needsOwnershipTransfer) {
        return {
          ...activeConversation,
          externalSessionId: params.externalSession.id,
          rootRunId,
        };
      }
      return activeConversation;
    }

    if (activeConversation?.rootRunId) {
      await this.terminateRunTree(activeConversation.rootRunId);
    }

    const conversation = await this.createConversation(params.platform, params.chatId, params.agentProfile);
    const rootRunId = `run_${uuid()}`;
    await this.ensureRootRun(params.externalSession.id, params.agentProfile, conversation.id, rootRunId);

    db.updateConversation(conversation.id, {
      externalSessionId: params.externalSession.id,
      rootRunId,
    });
    db.upsertExternalSession({
      ...params.externalSession,
      activeConversationId: conversation.id,
      agentProfileId: params.agentProfile.id,
      lastActivity: Date.now(),
    });

    return {
      ...conversation,
      externalSessionId: params.externalSession.id,
      rootRunId,
    };
  }

  private async ensureRootRun(
    externalSessionId: string,
    agentProfile: IAgentProfile,
    conversationId: string,
    rootRunId: string
  ): Promise<void> {
    const db = await getDatabase();
    const run: IChannelRun = {
      id: rootRunId,
      externalSessionId,
      rootRunId,
      agentProfileId: agentProfile.id,
      backend: agentProfile.backend,
      conversationId,
      workspaceRef: agentProfile.workspaceRef,
      status: 'running',
      startedAt: Date.now(),
      metadata: {
        kind: 'root',
      },
    };
    db.upsertChannelRun(run);
  }

  private async terminateRunTree(rootRunId: string): Promise<void> {
    const db = await getDatabase();
    const runs = db.getChannelRunsByRootRun(rootRunId);
    if (!runs.success || !runs.data?.length) {
      return;
    }

    const endedAt = Date.now();
    for (const run of runs.data) {
      if (
        run.status === 'finished' ||
        run.status === 'error' ||
        run.status === 'cancelled' ||
        run.status === 'terminated'
      ) {
        continue;
      }
      db.updateChannelRunStatus(run.id, 'terminated', endedAt);
    }
  }

  private async createConversation(
    platform: PluginType,
    chatId: string,
    agentProfile: IAgentProfile
  ): Promise<TChatConversation> {
    const model = await resolveProviderModel(agentProfile.modelRef);
    const { convType, convBackend } = resolveChannelConvType(agentProfile.backend);
    const name = getChannelConversationName(platform, convType, convBackend, chatId);
    const promptProfile = (agentProfile.promptProfile ?? {}) as {
      customAgentId?: string;
      agentName?: string;
      openclawAgentId?: string;
      cliPath?: string;
    };

    if (agentProfile.backend === 'gemini') {
      return conversationServiceSingleton.createConversation({
        type: 'gemini',
        model,
        source: platform,
        name,
        channelChatId: chatId,
        extra: {
          workspace: agentProfile.workspaceRef,
        },
      });
    }

    if (agentProfile.backend === 'codex') {
      return conversationServiceSingleton.createConversation({
        type: 'codex',
        model,
        source: platform,
        name,
        channelChatId: chatId,
        extra: {
          workspace: agentProfile.workspaceRef,
        },
      });
    }

    if (agentProfile.backend === 'openclaw-gateway') {
      return conversationServiceSingleton.createConversation({
        type: 'openclaw-gateway',
        model,
        source: platform,
        name,
        channelChatId: chatId,
        extra: {
          backend: 'openclaw-gateway',
          workspace: agentProfile.workspaceRef,
          customWorkspace: Boolean(agentProfile.workspaceRef),
          cliPath: promptProfile.cliPath,
          agentName: promptProfile.agentName,
          openclawAgentId: promptProfile.openclawAgentId,
          runtimeValidation: {
            expectedWorkspace: agentProfile.workspaceRef,
            expectedBackend: 'openclaw-gateway',
            expectedAgentName: promptProfile.agentName,
            expectedOpenClawAgentId: promptProfile.openclawAgentId,
            expectedCliPath: promptProfile.cliPath,
            switchedAt: Date.now(),
          },
        },
      });
    }

    return conversationServiceSingleton.createConversation({
      type: 'acp',
      model,
      source: platform,
      name,
      channelChatId: chatId,
      extra: {
        workspace: agentProfile.workspaceRef,
        backend: agentProfile.backend as AcpBackendAll,
        customAgentId: promptProfile.customAgentId,
        agentName: promptProfile.agentName,
      },
    });
  }
}

let channelRouteResolverInstance: ChannelRouteResolver | null = null;

export function getChannelRouteResolver(): ChannelRouteResolver {
  if (!channelRouteResolverInstance) {
    channelRouteResolverInstance = new ChannelRouteResolver();
  }
  return channelRouteResolverInstance;
}
