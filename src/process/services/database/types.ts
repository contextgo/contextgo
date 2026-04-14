/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// 复用现有的业务类型定义
import type {
  ConversationSource,
  IConfigStorageRefer,
  PersistedConversationType,
  TChatConversation,
  TSpace,
} from '@/common/config/storage';
import type { TMessage } from '@/common/chat/chatLib';
import type {
  ChannelBindingScopeType,
  ChannelControlMode,
  ChannelRunStatus,
  IAgentProfile,
  IChannelBinding,
  IChannelControlLease,
  IChannelRun,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
  PluginStatus,
  PluginType,
} from '@process/channels/types';
import { hasPluginCredentials } from '@process/channels/types';
import { decryptCredentials } from '@process/channels/utils/credentialCrypto';
import type {
  ChunkRecord,
  DocumentSnapshot,
  MemoryCandidateEntry,
  MemoryEntry,
  ProfileSegment,
  SourceRecord,
} from '../../../../packages/context-engine/src/domain';
import type { ContextOperation } from '../../../../packages/context-engine/src/operations';

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
  type: PersistedConversationType;
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
  platform_chat_id: string | null;
  remote_chat_type: string | null;
  peer_scope: string | null;
  parent_chat_id: string | null;
  thread_id: string | null;
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
  space_id: string | null;
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

export interface IChannelControlLeaseRow {
  external_session_id: string;
  owner_key: string;
  control_mode: ChannelControlMode;
  source_external_session_id: string | null;
  source_conversation_id: string | null;
  continuation_mode: string | null;
  created_at: number;
  updated_at: number;
  released_at: number | null;
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
  members_json?: string | null;
  permissions_policy_json?: string | null;
  provider_ref_json?: string | null;
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
    members_json: JSON.stringify(space.members ?? []),
    permissions_policy_json: JSON.stringify(space.permissionsPolicy ?? {}),
    provider_ref_json: JSON.stringify(space.providerRef ?? null),
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
    members: parseJson(row.members_json, []),
    permissionsPolicy: parseJson(row.permissions_policy_json, {}),
    providerRef: parseJson(row.provider_ref_json, undefined),
    isDefault: row.is_default === 1,
    archivedAt: row.archived_at ?? undefined,
    createTime: row.created_at,
    modifyTime: row.updated_at,
  };
}

export interface IContextSourceRow {
  id: string;
  space_id: string;
  thread_id: string | null;
  artifact_id: string | null;
  kind: SourceRecord['kind'];
  title: string | null;
  canonical_uri: string | null;
  checksum: string | null;
  tags: string;
  status: SourceRecord['status'];
  created_at: string;
  updated_at: string;
}

export interface IContextDocumentRow {
  id: string;
  space_id: string;
  source_id: string;
  mime_type: string;
  storage_uri: string;
  title: string | null;
  checksum: string;
  token_count: number;
  status: DocumentSnapshot['status'];
  created_at: string;
}

export interface IContextChunkRow {
  id: string;
  space_id: string;
  document_id: string;
  sequence: number;
  text: string;
  token_count: number;
  content_hash: string;
  tier: ChunkRecord['tier'];
  embedding_key: string | null;
}

export interface IContextMemoryRow {
  id: string;
  space_id: string;
  kind: MemoryEntry['kind'];
  summary: string;
  detail: string | null;
  source_ids: string;
  chunk_ids: string;
  confidence: number;
  tier: MemoryEntry['tier'];
  priority: MemoryEntry['priority'];
  state: MemoryEntry['state'];
  superseded_by_id: string | null;
  expires_at: string | null;
  last_accessed_at: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IContextMemoryCandidateRow {
  id: string;
  space_id: string;
  thread_id: string | null;
  kind: MemoryCandidateEntry['kind'];
  tier: MemoryCandidateEntry['tier'];
  summary: string;
  detail: string | null;
  source_ids: string;
  chunk_ids: string;
  confidence: number;
  priority: MemoryCandidateEntry['priority'];
  evidence_count: number;
  repeated_across_sources: number;
  recent_reference_count: number;
  user_confirmed: number;
  manually_pinned: number;
  execution_backed: number;
  contradiction_detected: number;
  promotion_score: number;
  promotion_rationale: string;
  destination: MemoryCandidateEntry['destination'];
  state: MemoryCandidateEntry['state'];
  review_status: MemoryCandidateEntry['reviewStatus'];
  promoted_memory_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IContextProfileRow {
  id: string;
  space_id: string;
  key: string;
  summary: string;
  memory_ids: string;
  confidence: number;
  state: ProfileSegment['state'];
  created_at: string;
  updated_at: string;
}

export interface IContextOperationRow {
  id: string;
  space_id: string;
  thread_id: string | null;
  replica_id: string | null;
  actor_kind: ContextOperation['actor']['kind'];
  actor_id: string;
  type: ContextOperation['type'];
  entity_id: string;
  payload: string;
  created_at: string;
}

export function contextSourceToRow(source: SourceRecord): IContextSourceRow {
  return {
    id: source.id,
    space_id: source.spaceId,
    thread_id: source.threadId ?? null,
    artifact_id: source.artifactId ?? null,
    kind: source.kind,
    title: source.title ?? null,
    canonical_uri: source.canonicalUri ?? null,
    checksum: source.checksum ?? null,
    tags: JSON.stringify(source.tags ?? []),
    status: source.status,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

export function rowToContextSource(row: IContextSourceRow): SourceRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    threadId: row.thread_id ?? undefined,
    artifactId: row.artifact_id ?? undefined,
    kind: row.kind,
    title: row.title ?? undefined,
    canonicalUri: row.canonical_uri ?? undefined,
    checksum: row.checksum ?? undefined,
    tags: parseJson(row.tags, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function contextDocumentToRow(snapshot: DocumentSnapshot): IContextDocumentRow {
  return {
    id: snapshot.id,
    space_id: snapshot.spaceId,
    source_id: snapshot.sourceId,
    mime_type: snapshot.mimeType,
    storage_uri: snapshot.storageUri,
    title: snapshot.title ?? null,
    checksum: snapshot.checksum,
    token_count: snapshot.tokenCount,
    status: snapshot.status,
    created_at: snapshot.createdAt,
  };
}

export function rowToContextDocument(row: IContextDocumentRow): DocumentSnapshot {
  return {
    id: row.id,
    spaceId: row.space_id,
    sourceId: row.source_id,
    mimeType: row.mime_type,
    storageUri: row.storage_uri,
    title: row.title ?? undefined,
    checksum: row.checksum,
    tokenCount: row.token_count,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function contextChunkToRow(chunk: ChunkRecord): IContextChunkRow {
  return {
    id: chunk.id,
    space_id: chunk.spaceId,
    document_id: chunk.documentId,
    sequence: chunk.sequence,
    text: chunk.text,
    token_count: chunk.tokenCount,
    content_hash: chunk.contentHash,
    tier: chunk.tier,
    embedding_key: chunk.embeddingKey ?? null,
  };
}

export function rowToContextChunk(row: IContextChunkRow): ChunkRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    documentId: row.document_id,
    sequence: row.sequence,
    text: row.text,
    tokenCount: row.token_count,
    contentHash: row.content_hash,
    tier: row.tier,
    embeddingKey: row.embedding_key ?? undefined,
  };
}

export function contextMemoryCandidateToRow(candidate: MemoryCandidateEntry): IContextMemoryCandidateRow {
  return {
    id: candidate.id,
    space_id: candidate.spaceId,
    thread_id: candidate.threadId ?? null,
    kind: candidate.kind,
    tier: candidate.tier,
    summary: candidate.summary,
    detail: candidate.detail ?? null,
    source_ids: JSON.stringify(candidate.sourceIds ?? []),
    chunk_ids: JSON.stringify(candidate.chunkIds ?? []),
    confidence: candidate.confidence,
    priority: candidate.priority,
    evidence_count: candidate.evidenceCount,
    repeated_across_sources: candidate.repeatedAcrossSources,
    recent_reference_count: candidate.recentReferenceCount,
    user_confirmed: candidate.userConfirmed ? 1 : 0,
    manually_pinned: candidate.manuallyPinned ? 1 : 0,
    execution_backed: candidate.executionBacked ? 1 : 0,
    contradiction_detected: candidate.contradictionDetected ? 1 : 0,
    promotion_score: candidate.promotionScore,
    promotion_rationale: JSON.stringify(candidate.promotionRationale ?? []),
    destination: candidate.destination,
    state: candidate.state,
    review_status: candidate.reviewStatus,
    promoted_memory_id: candidate.promotedMemoryId ?? null,
    reviewed_at: candidate.reviewedAt ?? null,
    reviewed_by: candidate.reviewedBy ?? null,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt,
  };
}

export function rowToContextMemoryCandidate(row: IContextMemoryCandidateRow): MemoryCandidateEntry {
  return {
    id: row.id,
    spaceId: row.space_id,
    threadId: row.thread_id ?? undefined,
    kind: row.kind,
    tier: row.tier,
    summary: row.summary,
    detail: row.detail ?? undefined,
    sourceIds: parseJson(row.source_ids, []),
    chunkIds: parseJson(row.chunk_ids, []),
    confidence: row.confidence,
    priority: row.priority,
    evidenceCount: row.evidence_count,
    repeatedAcrossSources: row.repeated_across_sources,
    recentReferenceCount: row.recent_reference_count,
    userConfirmed: row.user_confirmed === 1,
    manuallyPinned: row.manually_pinned === 1,
    executionBacked: row.execution_backed === 1,
    contradictionDetected: row.contradiction_detected === 1,
    promotionScore: row.promotion_score,
    promotionRationale: parseJson(row.promotion_rationale, []),
    destination: row.destination,
    state: row.state,
    reviewStatus: row.review_status,
    promotedMemoryId: row.promoted_memory_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function contextMemoryToRow(memory: MemoryEntry): IContextMemoryRow {
  return {
    id: memory.id,
    space_id: memory.spaceId,
    kind: memory.kind,
    summary: memory.summary,
    detail: memory.detail ?? null,
    source_ids: JSON.stringify(memory.sourceIds ?? []),
    chunk_ids: JSON.stringify(memory.chunkIds ?? []),
    confidence: memory.confidence,
    tier: memory.tier,
    priority: memory.priority,
    state: memory.state,
    superseded_by_id: memory.supersededById ?? null,
    expires_at: memory.expiresAt ?? null,
    last_accessed_at: memory.lastAccessedAt ?? null,
    last_confirmed_at: memory.lastConfirmedAt ?? null,
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
  };
}

export function rowToContextMemory(row: IContextMemoryRow): MemoryEntry {
  return {
    id: row.id,
    spaceId: row.space_id,
    kind: row.kind,
    summary: row.summary,
    detail: row.detail ?? undefined,
    sourceIds: parseJson(row.source_ids, []),
    chunkIds: parseJson(row.chunk_ids, []),
    confidence: row.confidence,
    tier: row.tier,
    priority: row.priority,
    state: row.state,
    supersededById: row.superseded_by_id ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    lastAccessedAt: row.last_accessed_at ?? undefined,
    lastConfirmedAt: row.last_confirmed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function contextProfileToRow(profile: ProfileSegment): IContextProfileRow {
  return {
    id: profile.id,
    space_id: profile.spaceId,
    key: profile.key,
    summary: profile.summary,
    memory_ids: JSON.stringify(profile.memoryIds ?? []),
    confidence: profile.confidence,
    state: profile.state,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export function rowToContextProfile(row: IContextProfileRow): ProfileSegment {
  return {
    id: row.id,
    spaceId: row.space_id,
    key: row.key,
    summary: row.summary,
    memoryIds: parseJson(row.memory_ids, []),
    confidence: row.confidence,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function contextOperationToRow(operation: ContextOperation): IContextOperationRow {
  return {
    id: operation.id,
    space_id: operation.spaceId,
    thread_id: operation.threadId ?? null,
    replica_id: operation.replicaId ?? null,
    actor_kind: operation.actor.kind,
    actor_id: operation.actor.id,
    type: operation.type,
    entity_id: operation.entityId,
    payload: JSON.stringify(operation.payload ?? {}),
    created_at: operation.createdAt,
  };
}

export function rowToContextOperation(row: IContextOperationRow): ContextOperation {
  return {
    id: row.id,
    spaceId: row.space_id,
    threadId: row.thread_id ?? undefined,
    replicaId: row.replica_id ?? undefined,
    actor: {
      kind: row.actor_kind,
      id: row.actor_id,
    },
    type: row.type,
    entityId: row.entity_id,
    payload: parseJson(row.payload, {}),
    createdAt: row.created_at,
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
  const credentials = decryptCredentials(parseJson(row.credentials, {}));

  return {
    id: row.id,
    platform: row.platform as PluginType,
    name: row.name,
    enabled: row.enabled === 1,
    status: row.status as PluginStatus,
    credentials,
    runtimeConfig: parseJson(row.runtime_config, {}),
    configured: hasPluginCredentials(row.platform as PluginType, credentials),
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
    platformChatId: row.platform_chat_id ?? undefined,
    remoteChatType: row.remote_chat_type ?? undefined,
    peerScope: row.peer_scope === 'thread' || row.peer_scope === 'chat' ? row.peer_scope : undefined,
    parentChatId: row.parent_chat_id ?? undefined,
    threadId: row.thread_id ?? undefined,
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
    platform_chat_id: identity.platformChatId ?? null,
    remote_chat_type: identity.remoteChatType ?? null,
    peer_scope: identity.peerScope ?? null,
    parent_chat_id: identity.parentChatId ?? null,
    thread_id: identity.threadId ?? null,
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
    spaceId: row.space_id ?? undefined,
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
    space_id: profile.spaceId ?? null,
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

export function rowToChannelControlLease(row: IChannelControlLeaseRow): IChannelControlLease {
  return {
    externalSessionId: row.external_session_id,
    ownerKey: row.owner_key,
    controlMode: row.control_mode,
    sourceExternalSessionId: row.source_external_session_id ?? undefined,
    sourceConversationId: row.source_conversation_id ?? undefined,
    continuationMode:
      row.continuation_mode === 'resume' || row.continuation_mode === 'new_thread' ? row.continuation_mode : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    releasedAt: row.released_at ?? undefined,
  };
}

export function channelControlLeaseToRow(lease: IChannelControlLease): IChannelControlLeaseRow {
  return {
    external_session_id: lease.externalSessionId,
    owner_key: lease.ownerKey,
    control_mode: lease.controlMode,
    source_external_session_id: lease.sourceExternalSessionId ?? null,
    source_conversation_id: lease.sourceConversationId ?? null,
    continuation_mode: lease.continuationMode ?? null,
    created_at: lease.createdAt,
    updated_at: lease.updatedAt,
    released_at: lease.releasedAt ?? null,
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
