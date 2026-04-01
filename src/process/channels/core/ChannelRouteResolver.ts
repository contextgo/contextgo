/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

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

function readBindingHandoffConfig(binding: IChannelBinding): {
  mode?: 'resume' | 'new_thread';
  resumeConversationId?: string;
} {
  const metadata = binding.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const handoff = (metadata as Record<string, unknown>).handoff;
  if (!handoff || typeof handoff !== 'object') {
    return {};
  }

  const handoffRecord = handoff as Record<string, unknown>;
  return {
    mode: handoffRecord.mode === 'new_thread' ? 'new_thread' : handoffRecord.mode === 'resume' ? 'resume' : undefined,
    resumeConversationId:
      typeof handoffRecord.resumeConversationId === 'string' && handoffRecord.resumeConversationId
        ? handoffRecord.resumeConversationId
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
  remoteChatType?: string;
  displayName?: string;
  forceNewConversation?: boolean;
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

async function resolveProviderModel(preferred?: { id: string; useModel: string }): Promise<TProviderWithModel> {
  const providers = await ProcessConfig.get('model.config');
  const providerList = Array.isArray(providers) ? providers : [];

  if (preferred) {
    const matched = providerList.find(
      (provider) => provider.id === preferred.id && provider.model?.includes(preferred.useModel)
    );
    if (matched) {
      return {
        ...matched,
        useModel: preferred.useModel,
      } as TProviderWithModel;
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
  async resolveConnectorInstance(platform: PluginType, pluginId?: string): Promise<IConnectorInstance> {
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

  async resolveAuthorizedRoute(params: ResolveRouteParams): Promise<ResolvedChannelRoute> {
    const db = await getDatabase();
    const connector = await this.resolveConnectorInstance(params.platform, params.pluginId);
    const channelUser = await this.ensureChannelUserProjection(
      connector,
      params.platformUserId,
      params.platform,
      params.chatId,
      params.displayName,
      params.remoteChatType
    );
    const remoteIdentity = await this.ensureRemoteIdentity(
      connector,
      channelUser,
      params.platformUserId,
      params.chatId,
      params.remoteChatType,
      params.displayName
    );

    const binding = await this.resolveBinding({
      connector,
      remoteIdentity,
      platform: params.platform,
    });
    const bindingTarget = getChannelBindingTarget(binding);
    const bindingHandoffConfig = readBindingHandoffConfig(binding);

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
      bindingTarget.type === 'external_session' ? (bindingTarget.mode ?? 'resume') : bindingHandoffConfig.mode;
    const shouldForceNewConversation = params.forceNewConversation || externalSessionTargetMode === 'new_thread';

    const resumeConversationId =
      externalSessionTargetMode === 'resume'
        ? (sourceExternalSession?.activeConversationId ?? bindingHandoffConfig.resumeConversationId)
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
      agentType: backendToAgentType(agentProfile.backend),
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
    displayName?: string,
    remoteChatType?: string
  ): Promise<IChannelUser> {
    const db = await getDatabase();
    const existingIdentity = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
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

    const legacyBootstrapUser = await this.bootstrapLegacyDirectAuthorization({
      connector,
      platformUserId,
      platform,
      chatId,
      remoteChatType,
      displayName,
    });
    if (legacyBootstrapUser) {
      return legacyBootstrapUser;
    }

    throw new Error('User not authorized');
  }

  private async bootstrapLegacyDirectAuthorization(params: {
    connector: IConnectorInstance;
    platformUserId: string;
    platform: PluginType;
    chatId: string;
    remoteChatType?: string;
    displayName?: string;
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
      remoteChatType: resolvedChatType ?? 'direct',
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
    remoteChatType?: string,
    displayName?: string
  ): Promise<IRemoteIdentity> {
    const db = await getDatabase();
    const now = Date.now();

    const byChat = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
    if (byChat.success && byChat.data) {
      const resolvedChatType =
        inferRemoteChatType({
          chatId,
          platformUserId,
          remoteChatType: remoteChatType ?? byChat.data.remoteChatType,
        }) ?? byChat.data.remoteChatType;
      const nextIdentity: IRemoteIdentity = {
        ...byChat.data,
        remoteUserId: resolvedChatType === 'group' ? (byChat.data.remoteUserId ?? platformUserId) : platformUserId,
        remoteChatType: resolvedChatType,
        displayName: displayName ?? byChat.data.displayName,
        lastActive: now,
        legacyUserId: byChat.data.legacyUserId,
      };
      db.upsertRemoteIdentity(nextIdentity);
      return nextIdentity;
    }

    const resolvedChatType = inferRemoteChatType({ chatId, platformUserId, remoteChatType });
    const remoteIdentity: IRemoteIdentity = {
      id: `remote_identity_${uuid()}`,
      connectorId: connector.id,
      remoteUserId: platformUserId,
      remoteChatId: chatId,
      remoteChatType: resolvedChatType,
      displayName,
      authorizedAt: channelUser.authorizedAt,
      lastActive: now,
      legacyUserId: channelUser.id.startsWith('assistant_user_') ? channelUser.id : undefined,
      metadata: {
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
  }): Promise<IChannelBinding> {
    const db = await getDatabase();

    const temporaryOverrides = db.getChannelBindingsForScope(
      params.connector.id,
      'temporary_override',
      params.remoteIdentity.remoteChatId
    );
    const activeTemporaryOverride = temporaryOverrides.success
      ? getPreferredBinding(temporaryOverrides.data)
      : undefined;
    if (activeTemporaryOverride) {
      return activeTemporaryOverride;
    }

    const remoteChatBindings = db.getChannelBindingsForScope(
      params.connector.id,
      'remote_chat',
      params.remoteIdentity.remoteChatId
    );
    const preferredRemoteChatBinding = remoteChatBindings.success
      ? getPreferredBinding(remoteChatBindings.data)
      : undefined;
    if (preferredRemoteChatBinding) {
      return preferredRemoteChatBinding;
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
        handoff: {
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
