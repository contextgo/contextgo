/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
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
import { getChannelConversationName, resolveChannelConvType } from '../types';

type SavedAgentConfig = {
  backend: string;
  customAgentId?: string;
  name?: string;
};

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
  displayName?: string;
  forceNewConversation?: boolean;
  overrideAgentType?: ChannelAgentType;
};

const DIRECT_BACKENDS = new Set(['gemini', 'codex', 'openclaw-gateway']);

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

function backendToAgentType(backend: string): ChannelAgentType {
  const { convType } = resolveChannelConvType(backend);
  return convType as ChannelAgentType;
}

async function getSavedAgentConfig(platform: PluginType): Promise<SavedAgentConfig> {
  const key =
    platform === 'lark'
      ? 'assistant.lark.agent'
      : platform === 'dingtalk'
        ? 'assistant.dingtalk.agent'
        : platform === 'weixin'
          ? 'assistant.weixin.agent'
          : 'assistant.telegram.agent';

  const saved = await ProcessConfig.get(key);
  if (saved && typeof saved === 'object' && typeof saved.backend === 'string') {
    return {
      backend: saved.backend,
      customAgentId: typeof saved.customAgentId === 'string' ? saved.customAgentId : undefined,
      name: typeof saved.name === 'string' ? saved.name : undefined,
    };
  }

  return { backend: 'gemini' };
}

async function getSavedDefaultModelRef(platform: PluginType): Promise<{ id: string; useModel: string } | undefined> {
  const key =
    platform === 'lark'
      ? 'assistant.lark.defaultModel'
      : platform === 'dingtalk'
        ? 'assistant.dingtalk.defaultModel'
        : platform === 'weixin'
          ? 'assistant.weixin.defaultModel'
          : 'assistant.telegram.defaultModel';

  const saved = await ProcessConfig.get(key);
  if (
    saved &&
    typeof saved === 'object' &&
    typeof saved.id === 'string' &&
    saved.id &&
    typeof saved.useModel === 'string' &&
    saved.useModel
  ) {
    return {
      id: saved.id,
      useModel: saved.useModel,
    };
  }

  return undefined;
}

async function resolveProviderModel(
  platform: PluginType,
  preferred?: { id: string; useModel: string }
): Promise<TProviderWithModel> {
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

  const saved = await getSavedDefaultModelRef(platform);
  if (saved) {
    const matched = providerList.find(
      (provider) => provider.id === saved.id && provider.model?.includes(saved.useModel)
    );
    if (matched) {
      return {
        ...matched,
        useModel: saved.useModel,
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

function mapAgentTypeToBackend(savedAgent: SavedAgentConfig, agentType?: ChannelAgentType): SavedAgentConfig {
  if (!agentType) {
    return savedAgent;
  }

  if (agentType === 'gemini' || agentType === 'codex' || agentType === 'openclaw-gateway') {
    return { backend: agentType };
  }

  if (!DIRECT_BACKENDS.has(savedAgent.backend)) {
    return savedAgent;
  }

  return {
    backend: 'claude',
    name: 'Claude',
  };
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
      params.displayName
    );
    const remoteIdentity = await this.ensureRemoteIdentity(
      connector,
      channelUser,
      params.platformUserId,
      params.chatId,
      params.displayName
    );

    const binding = await this.resolveBinding({
      connector,
      remoteIdentity,
      platform: params.platform,
      overrideAgentType: params.overrideAgentType,
    });
    const agentProfileResult = db.getAgentProfile(binding.agentProfileId);
    if (!agentProfileResult.success || !agentProfileResult.data) {
      throw new Error(`Agent profile ${binding.agentProfileId} not found`);
    }
    const agentProfile = agentProfileResult.data;

    const externalSession = await this.ensureExternalSession(connector, remoteIdentity, binding, agentProfile);
    const conversation = await this.ensureConversation({
      platform: params.platform,
      chatId: params.chatId,
      externalSession,
      agentProfile,
      forceNewConversation: params.forceNewConversation,
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
    displayName?: string
  ): Promise<IChannelUser> {
    const db = await getDatabase();
    const existingIdentity = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
    if (existingIdentity.success && existingIdentity.data) {
      if (existingIdentity.data.legacyUserId) {
        const legacyUser = db.getChannelUsers().data?.find((user) => user.id === existingIdentity.data?.legacyUserId);
        if (legacyUser) {
          return legacyUser;
        }
      }

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
      return mirrorUserResult.data;
    }

    const isDirectChat = chatId === platformUserId;
    if (!isDirectChat) {
      throw new Error('User not authorized');
    }

    const existingUser = db.getChannelUserByPlatform(platformUserId, platform);
    if (existingUser.success && existingUser.data) {
      if (existingUser.data.id.startsWith('remote_identity_')) {
        throw new Error('User not authorized');
      }

      return existingUser.data;
    }

    throw new Error('User not authorized');
  }

  private async ensureRemoteIdentity(
    connector: IConnectorInstance,
    channelUser: IChannelUser,
    platformUserId: string,
    chatId: string,
    displayName?: string
  ): Promise<IRemoteIdentity> {
    const db = await getDatabase();
    const now = Date.now();

    const byChat = db.getRemoteIdentityByConnectorChat(connector.id, chatId);
    if (byChat.success && byChat.data) {
      const nextIdentity: IRemoteIdentity = {
        ...byChat.data,
        remoteUserId: platformUserId,
        displayName: displayName ?? byChat.data.displayName,
        lastActive: now,
        legacyUserId: channelUser.id,
      };
      db.upsertRemoteIdentity(nextIdentity);
      return nextIdentity;
    }

    const remoteIdentity: IRemoteIdentity = {
      id: `remote_identity_${uuid()}`,
      connectorId: connector.id,
      remoteUserId: platformUserId,
      remoteChatId: chatId,
      displayName,
      authorizedAt: channelUser.authorizedAt,
      lastActive: now,
      legacyUserId: channelUser.id,
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
    overrideAgentType?: ChannelAgentType;
  }): Promise<IChannelBinding> {
    const db = await getDatabase();

    if (params.overrideAgentType) {
      const profile = await this.ensureAgentProfile(
        params.connector,
        params.platform,
        params.overrideAgentType,
        'chat-override'
      );
      const overrideBinding: IChannelBinding = {
        id: buildStableId(
          'binding',
          params.connector.id,
          'remote_chat',
          params.remoteIdentity.remoteChatId,
          'override'
        ),
        connectorId: params.connector.id,
        scopeType: 'remote_chat',
        scopeKey: params.remoteIdentity.remoteChatId,
        agentProfileId: profile.id,
        priority: 100,
        enabled: true,
        temporary: true,
        metadata: {
          source: 'agent-select',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      db.upsertChannelBinding(overrideBinding);
      return overrideBinding;
    }

    const remoteChatBindings = db.getChannelBindingsForScope(
      params.connector.id,
      'remote_chat',
      params.remoteIdentity.remoteChatId
    );
    if (remoteChatBindings.success && remoteChatBindings.data?.length) {
      return sortBindings(remoteChatBindings.data)[0];
    }

    if (params.remoteIdentity.remoteUserId) {
      const remoteUserBindings = db.getChannelBindingsForScope(
        params.connector.id,
        'remote_user',
        params.remoteIdentity.remoteUserId
      );
      if (remoteUserBindings.success && remoteUserBindings.data?.length) {
        return sortBindings(remoteUserBindings.data)[0];
      }
    }

    const defaultBindings = db.getChannelBindingsForScope(params.connector.id, 'connector_default');
    const existingDefault = defaultBindings.success ? sortBindings(defaultBindings.data ?? [])[0] : undefined;
    if (existingDefault) {
      return existingDefault;
    }

    const profile = await this.ensureAgentProfile(params.connector, params.platform, undefined, 'connector-default');
    const defaultBinding: IChannelBinding = {
      id: buildStableId('binding', params.connector.id, 'connector_default'),
      connectorId: params.connector.id,
      scopeType: 'connector_default',
      agentProfileId: profile.id,
      priority: 0,
      enabled: true,
      temporary: false,
      metadata: {
        source: 'legacy-default',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.upsertChannelBinding(defaultBinding);
    return defaultBinding;
  }

  private async ensureAgentProfile(
    connector: IConnectorInstance,
    platform: PluginType,
    overrideAgentType?: ChannelAgentType,
    scope = 'default'
  ): Promise<IAgentProfile> {
    const db = await getDatabase();
    const savedAgent = mapAgentTypeToBackend(await getSavedAgentConfig(platform), overrideAgentType);
    const preferredModelRef = await getSavedDefaultModelRef(platform);
    const model = await resolveProviderModel(platform, preferredModelRef);
    const modelRef = {
      id: model.id,
      useModel: model.useModel,
    };

    const profileId = buildStableId(
      'agent_profile',
      connector.id,
      savedAgent.backend,
      savedAgent.customAgentId,
      modelRef.id,
      modelRef.useModel,
      scope
    );

    const existing = db.getAgentProfile(profileId);
    const name = savedAgent.name ?? `${connector.name} ${savedAgent.backend}`;
    const profile: IAgentProfile = {
      id: profileId,
      name,
      backend: savedAgent.backend,
      modelRef,
      promptProfile: {
        customAgentId: savedAgent.customAgentId,
        agentName: savedAgent.name,
        platform,
        scope,
      },
      toolPolicy: {},
      memoryPolicy: {},
      delegationPolicy: {},
      version: existing.data?.version ?? 1,
      archived: false,
      createdAt: existing.data?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    db.upsertAgentProfile(profile);
    return profile;
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
      if (!activeConversation.externalSessionId || !activeConversation.rootRunId) {
        const rootRunId = activeConversation.rootRunId ?? `run_${uuid()}`;
        await this.ensureRootRun(params.externalSession.id, params.agentProfile, activeConversation.id, rootRunId);
        db.updateConversation(activeConversation.id, {
          externalSessionId: params.externalSession.id,
          rootRunId,
        });
        return {
          ...activeConversation,
          externalSessionId: params.externalSession.id,
          rootRunId,
        };
      }

      db.updateExternalSessionActivity(params.externalSession.id, {
        lastActivity: Date.now(),
        activeConversationId: activeConversation.id,
        bindingId: params.externalSession.bindingId,
      });
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
    const model = await resolveProviderModel(platform, agentProfile.modelRef);
    const { convType, convBackend } = resolveChannelConvType(agentProfile.backend);
    const name = getChannelConversationName(platform, convType, convBackend, chatId);
    const promptProfile = (agentProfile.promptProfile ?? {}) as {
      customAgentId?: string;
      agentName?: string;
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
          workspace: agentProfile.workspaceRef,
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
