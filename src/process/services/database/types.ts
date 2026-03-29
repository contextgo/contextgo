/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// 复用现有的业务类型定义
import type { ConversationSource, TChatConversation, IConfigStorageRefer, TSpace } from '@/common/config/storage';
import type { TMessage } from '@/common/chat/chatLib';
import type {
  ChannelBindingScopeType,
  ChannelRunStatus,
  IAgentProfile,
  IChannelBinding,
  IChannelRun,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
  PluginStatus,
  PluginType,
} from '@process/channels/types';
import { decryptCredentials } from '@process/channels/utils/credentialCrypto';

/**
 * ======================
 * 数据库专属类型 (新增功能)
 * ======================
 */

/**
 * User account (新增的账户系统)
 */
export interface IUser {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  avatar_path?: string;
  jwt_secret?: string | null;
  created_at: number;
  updated_at: number;
  last_login?: number | null;
}

// Image metadata removed - images are stored in filesystem and referenced via message.resultDisplay

/**
 * ======================
 * 数据库查询辅助类型
 * ======================
 */

/**
 * Database query result wrapper
 */
export interface IQueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Paginated query result
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * ======================
 * 数据库存储格式 (序列化后的格式)
 * ======================
 */

/**
 * Conversation stored in database (序列化后的格式)
 */
export interface IConversationRow {
  id: string;
  user_id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'nanobot' | 'group';
  extra: string; // JSON string of extra data
  model?: string; // JSON string of TProviderWithModel (gemini type has this)
  status?: 'pending' | 'running' | 'finished';
  source?: ConversationSource; // 会话来源 / Conversation source
  channel_chat_id?: string; // Channel chat isolation ID (e.g. user:xxx or group:xxx)
  external_session_id?: string;
  root_run_id?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Connector instance stored in database.
 */
export interface IConnectorInstanceRow {
  id: string;
  platform: string;
  name: string;
  enabled: number;
  status: string;
  credentials: string;
  runtime_config: string;
  capabilities: string;
  legacy_plugin_id: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Remote identity stored in database.
 */
export interface IRemoteIdentityRow {
  id: string;
  connector_id: string;
  remote_user_id: string | null;
  remote_chat_id: string;
  remote_chat_type: string | null;
  display_name: string | null;
  authorized_at: number;
  last_active: number | null;
  metadata: string;
  legacy_user_id: string | null;
}

/**
 * Agent profile stored in database.
 */
export interface IAgentProfileRow {
  id: string;
  name: string;
  backend: string;
  model_ref: string | null;
  workspace_ref: string | null;
  prompt_profile: string;
  tool_policy: string;
  memory_policy: string;
  delegation_policy: string;
  published_from_conversation_id: string | null;
  version: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

/**
 * Channel binding stored in database.
 */
export interface IChannelBindingRow {
  id: string;
  connector_id: string;
  scope_type: string;
  scope_key: string | null;
  agent_profile_id: string;
  priority: number;
  enabled: number;
  temporary: number;
  fallback_agent_profile_id: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
}

/**
 * External session stored in database.
 */
export interface IExternalSessionRow {
  id: string;
  connector_id: string;
  remote_identity_id: string;
  binding_id: string | null;
  agent_profile_id: string;
  active_conversation_id: string | null;
  state: string;
  created_at: number;
  last_activity: number;
  metadata: string;
}

/**
 * Execution run stored in database.
 */
export interface IChannelRunRow {
  id: string;
  external_session_id: string | null;
  parent_run_id: string | null;
  root_run_id: string;
  agent_profile_id: string;
  backend: string;
  conversation_id: string | null;
  workspace_ref: string | null;
  status: string;
  input_message_id: string | null;
  metadata: string;
  started_at: number;
  ended_at: number | null;
}

/**
 * Message stored in database (序列化后的格式)
 */
export interface IMessageRow {
  id: string;
  conversation_id: string;
  msg_id?: string; // 消息来源ID
  type: string; // TMessage['type']
  content: string; // JSON string of message content
  position?: 'left' | 'right' | 'center' | 'pop';
  status?: 'finish' | 'pending' | 'error' | 'work';
  created_at: number;
}

/**
 * Config stored in database (key-value, 用于数据库版本跟踪)
 */
export interface IConfigRow {
  key: string;
  value: string; // JSON string
  updated_at: number;
}

export interface ISpaceRow {
  id: string;
  user_id: string;
  name: string;
  engine: TSpace['engine'];
  description?: string | null;
  is_default: number;
  archived_at?: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * ======================
 * 类型转换函数
 * ======================
 */

/**
 * Convert TChatConversation to database row
 */
export function conversationToRow(conversation: TChatConversation, userId: string): IConversationRow {
  return {
    id: conversation.id,
    user_id: userId,
    name: conversation.name,
    type: conversation.type,
    extra: JSON.stringify(conversation.extra),
    model: 'model' in conversation ? JSON.stringify(conversation.model) : undefined,
    status: conversation.status,
    source: conversation.source,
    channel_chat_id: conversation.channelChatId,
    external_session_id: conversation.externalSessionId,
    root_run_id: conversation.rootRunId,
    created_at: conversation.createTime,
    updated_at: conversation.modifyTime,
  };
}

/**
 * Convert database row to TChatConversation
 */
export function rowToConversation(row: IConversationRow): TChatConversation {
  const base = {
    id: row.id,
    name: row.name,
    desc: undefined as string | undefined,
    createTime: row.created_at,
    modifyTime: row.updated_at,
    status: row.status,
    source: row.source,
    channelChatId: row.channel_chat_id,
    externalSessionId: row.external_session_id,
    rootRunId: row.root_run_id,
  };

  // Gemini type has model field
  if (row.type === 'gemini' && row.model) {
    return {
      ...base,
      type: 'gemini' as const,
      extra: JSON.parse(row.extra),
      model: JSON.parse(row.model),
    } as TChatConversation;
  }

  // ACP type
  if (row.type === 'acp') {
    return {
      ...base,
      type: 'acp' as const,
      extra: JSON.parse(row.extra),
    } as TChatConversation;
  }

  // Codex type
  if (row.type === 'codex') {
    return {
      ...base,
      type: 'codex' as const,
      extra: JSON.parse(row.extra),
    } as TChatConversation;
  }

  // OpenClaw Gateway type
  if (row.type === 'openclaw-gateway') {
    return {
      ...base,
      type: 'openclaw-gateway' as const,
      extra: JSON.parse(row.extra),
    } as TChatConversation;
  }

  // Nanobot type
  if (row.type === 'nanobot') {
    return {
      ...base,
      type: 'nanobot' as const,
      extra: JSON.parse(row.extra),
    } as TChatConversation;
  }

  if (row.type === 'group') {
    return {
      ...base,
      type: 'group' as const,
        extra: JSON.parse(row.extra),
        model: row.model
          ? JSON.parse(row.model)
          : {
            id: 'group-placeholder',
            name: 'Group',
            useModel: 'group',
            platform: 'group',
            baseUrl: '',
            apiKey: '',
          },
    } as TChatConversation;
  }

  // Unknown type - should never happen with valid data
  throw new Error(`Unknown conversation type: ${row.type}`);
}

export function spaceToRow(space: TSpace, userId: string): ISpaceRow {
  return {
    id: space.id,
    user_id: userId,
    name: space.name,
    engine: space.engine,
    description: space.description ?? null,
    is_default: space.isDefault ? 1 : 0,
    archived_at: space.archivedAt ?? null,
    created_at: space.createTime,
    updated_at: space.modifyTime,
  };
}

export function rowToSpace(row: ISpaceRow): TSpace {
  return {
    id: row.id,
    name: row.name,
    engine: row.engine,
    description: row.description ?? undefined,
    isDefault: row.is_default === 1,
    archivedAt: row.archived_at ?? undefined,
    createTime: row.created_at,
    modifyTime: row.updated_at,
  };
}

/**
 * Convert TMessage to database row
 */
export function messageToRow(message: TMessage): IMessageRow {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    msg_id: message.msg_id,
    type: message.type,
    content: JSON.stringify(message.content),
    position: message.position,
    status: message.status,
    created_at: message.createdAt || Date.now(),
  };
}

/**
 * Convert database row to TMessage
 */
export function rowToMessage(row: IMessageRow): TMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    msg_id: row.msg_id,
    type: row.type as TMessage['type'],
    content: JSON.parse(row.content),
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
  } as TMessage;
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export function rowToConnectorInstance(row: IConnectorInstanceRow): IConnectorInstance {
  return {
    id: row.id,
    platform: row.platform as PluginType,
    name: row.name,
    enabled: row.enabled === 1,
    status: row.status as PluginStatus,
    credentials: decryptCredentials(parseJson(row.credentials, {})),
    runtimeConfig: parseJson(row.runtime_config, {}),
    capabilities: parseJson(row.capabilities, {}),
    legacyPluginId: row.legacy_plugin_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function connectorInstanceToRow(connector: IConnectorInstance): IConnectorInstanceRow {
  return {
    id: connector.id,
    platform: connector.platform,
    name: connector.name,
    enabled: connector.enabled ? 1 : 0,
    status: connector.status,
    credentials: JSON.stringify(connector.credentials ?? {}),
    runtime_config: JSON.stringify(connector.runtimeConfig ?? {}),
    capabilities: JSON.stringify(connector.capabilities ?? {}),
    legacy_plugin_id: connector.legacyPluginId ?? null,
    created_at: connector.createdAt,
    updated_at: connector.updatedAt,
  };
}

export function rowToRemoteIdentity(row: IRemoteIdentityRow): IRemoteIdentity {
  return {
    id: row.id,
    connectorId: row.connector_id,
    remoteUserId: row.remote_user_id ?? undefined,
    remoteChatId: row.remote_chat_id,
    remoteChatType: row.remote_chat_type ?? undefined,
    displayName: row.display_name ?? undefined,
    authorizedAt: row.authorized_at,
    lastActive: row.last_active ?? undefined,
    metadata: parseJson(row.metadata, {}),
    legacyUserId: row.legacy_user_id ?? undefined,
  };
}

export function remoteIdentityToRow(identity: IRemoteIdentity): IRemoteIdentityRow {
  return {
    id: identity.id,
    connector_id: identity.connectorId,
    remote_user_id: identity.remoteUserId ?? null,
    remote_chat_id: identity.remoteChatId,
    remote_chat_type: identity.remoteChatType ?? null,
    display_name: identity.displayName ?? null,
    authorized_at: identity.authorizedAt,
    last_active: identity.lastActive ?? null,
    metadata: JSON.stringify(identity.metadata ?? {}),
    legacy_user_id: identity.legacyUserId ?? null,
  };
}

export function rowToAgentProfile(row: IAgentProfileRow): IAgentProfile {
  return {
    id: row.id,
    name: row.name,
    backend: row.backend,
    modelRef: parseJson<IAgentProfile['modelRef']>(row.model_ref, undefined),
    workspaceRef: row.workspace_ref ?? undefined,
    promptProfile: parseJson(row.prompt_profile, {}),
    toolPolicy: parseJson(row.tool_policy, {}),
    memoryPolicy: parseJson(row.memory_policy, {}),
    delegationPolicy: parseJson(row.delegation_policy, {}),
    publishedFromConversationId: row.published_from_conversation_id ?? undefined,
    version: row.version,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function agentProfileToRow(profile: IAgentProfile): IAgentProfileRow {
  return {
    id: profile.id,
    name: profile.name,
    backend: profile.backend,
    model_ref: profile.modelRef ? JSON.stringify(profile.modelRef) : null,
    workspace_ref: profile.workspaceRef ?? null,
    prompt_profile: JSON.stringify(profile.promptProfile ?? {}),
    tool_policy: JSON.stringify(profile.toolPolicy ?? {}),
    memory_policy: JSON.stringify(profile.memoryPolicy ?? {}),
    delegation_policy: JSON.stringify(profile.delegationPolicy ?? {}),
    published_from_conversation_id: profile.publishedFromConversationId ?? null,
    version: profile.version,
    archived: profile.archived ? 1 : 0,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export function rowToChannelBinding(row: IChannelBindingRow): IChannelBinding {
  return {
    id: row.id,
    connectorId: row.connector_id,
    scopeType: row.scope_type as ChannelBindingScopeType,
    scopeKey: row.scope_key ?? undefined,
    agentProfileId: row.agent_profile_id,
    priority: row.priority,
    enabled: row.enabled === 1,
    temporary: row.temporary === 1,
    fallbackAgentProfileId: row.fallback_agent_profile_id ?? undefined,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function channelBindingToRow(binding: IChannelBinding): IChannelBindingRow {
  return {
    id: binding.id,
    connector_id: binding.connectorId,
    scope_type: binding.scopeType,
    scope_key: binding.scopeKey ?? null,
    agent_profile_id: binding.agentProfileId,
    priority: binding.priority,
    enabled: binding.enabled ? 1 : 0,
    temporary: binding.temporary ? 1 : 0,
    fallback_agent_profile_id: binding.fallbackAgentProfileId ?? null,
    metadata: JSON.stringify(binding.metadata ?? {}),
    created_at: binding.createdAt,
    updated_at: binding.updatedAt,
  };
}

export function rowToExternalSession(row: IExternalSessionRow): IExternalSession {
  return {
    id: row.id,
    connectorId: row.connector_id,
    remoteIdentityId: row.remote_identity_id,
    bindingId: row.binding_id ?? undefined,
    agentProfileId: row.agent_profile_id,
    activeConversationId: row.active_conversation_id ?? undefined,
    state: row.state as IExternalSession['state'],
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    metadata: parseJson(row.metadata, {}),
  };
}

export function externalSessionToRow(session: IExternalSession): IExternalSessionRow {
  return {
    id: session.id,
    connector_id: session.connectorId,
    remote_identity_id: session.remoteIdentityId,
    binding_id: session.bindingId ?? null,
    agent_profile_id: session.agentProfileId,
    active_conversation_id: session.activeConversationId ?? null,
    state: session.state,
    created_at: session.createdAt,
    last_activity: session.lastActivity,
    metadata: JSON.stringify(session.metadata ?? {}),
  };
}

export function rowToChannelRun(row: IChannelRunRow): IChannelRun {
  return {
    id: row.id,
    externalSessionId: row.external_session_id ?? undefined,
    parentRunId: row.parent_run_id ?? undefined,
    rootRunId: row.root_run_id,
    agentProfileId: row.agent_profile_id,
    backend: row.backend,
    conversationId: row.conversation_id ?? undefined,
    workspaceRef: row.workspace_ref ?? undefined,
    status: row.status as ChannelRunStatus,
    inputMessageId: row.input_message_id ?? undefined,
    metadata: parseJson(row.metadata, {}),
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
  };
}

export function channelRunToRow(run: IChannelRun): IChannelRunRow {
  return {
    id: run.id,
    external_session_id: run.externalSessionId ?? null,
    parent_run_id: run.parentRunId ?? null,
    root_run_id: run.rootRunId,
    agent_profile_id: run.agentProfileId,
    backend: run.backend,
    conversation_id: run.conversationId ?? null,
    workspace_ref: run.workspaceRef ?? null,
    status: run.status,
    input_message_id: run.inputMessageId ?? null,
    metadata: JSON.stringify(run.metadata ?? {}),
    started_at: run.startedAt,
    ended_at: run.endedAt ?? null,
  };
}

/**
 * ======================
 * 导出类型别名，方便使用
 * ======================
 */

export type {
  // 复用的业务类型
  TChatConversation,
  TMessage,
  IConfigStorageRefer,
  TSpace,
};
