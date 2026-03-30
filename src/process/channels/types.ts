/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isBuiltinChannelType, type BuiltinChannelType } from '@/common/config/builtinChannels';

// ==================== Plugin Types ====================

/**
 * Built-in platform types for channel plugins.
 */
export type BuiltinPluginType = BuiltinChannelType;

/**
 * Supported platform types for plugins.
 * Extension-contributed plugins can use any string type (e.g., 'ext-feishu').
 * Built-in types are preserved for type-safe handling in known code paths.
 */
export type PluginType = BuiltinPluginType | (string & {});

/**
 * Plugin connection status
 */
export type PluginStatus =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Plugin credentials (stored encrypted in database)
 * Built-in fields for known platforms + index signature for extension plugins.
 */
export interface IPluginCredentials {
  // Telegram
  token?: string;
  // Slack
  botToken?: string;
  appToken?: string;
  // Lark/Feishu
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  // DingTalk
  clientId?: string;
  clientSecret?: string;
  // Extension plugins: arbitrary credential fields
  [key: string]: string | number | boolean | undefined;
}

/**
 * Check whether a plugin has valid credentials configured.
 * Centralized so every call-site stays in sync when a new platform is added.
 * For extension plugins, any non-empty credential value is considered valid.
 */
export function hasPluginCredentials(type: PluginType, credentials?: IPluginCredentials): boolean {
  if (!credentials) return false;
  if (type === 'slack') return !!(credentials.botToken && credentials.appToken);
  if (type === 'discord') return !!credentials.token;
  if (type === 'lark') return !!(credentials.appId && credentials.appSecret);
  if (type === 'dingtalk') return !!(credentials.clientId && credentials.clientSecret);
  if (type === 'telegram') return !!credentials.token;
  if (type === 'weixin') return !!(credentials.accountId && credentials.botToken);
  // Extension or unknown plugins: check if any credential value is non-empty
  return Object.values(credentials).some((v) => v !== undefined && v !== null && v !== '');
}

/**
 * Plugin configuration options
 */
export interface IPluginConfigOptions {
  mode?: 'polling' | 'webhook' | 'websocket';
  webhookUrl?: string;
  rateLimit?: number; // Max messages per minute
  requireMention?: boolean; // Require @mention in groups
  // Extension plugins may define additional primitive config fields
  [key: string]: string | number | boolean | undefined;
}

/**
 * Plugin configuration stored in database
 */
export interface IChannelPluginConfig {
  id: string;
  type: PluginType;
  name: string;
  enabled: boolean;
  credentials?: IPluginCredentials;
  config?: IPluginConfigOptions;
  status: PluginStatus;
  lastConnected?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Plugin status for IPC communication
 */
export interface IChannelPluginStatus {
  id: string;
  type: PluginType;
  name: string;
  enabled: boolean;
  connected: boolean;
  status: PluginStatus;
  lastConnected?: number;
  error?: string;
  activeUsers: number;
  botUsername?: string;
  /** Whether the plugin has a token configured (token itself is not exposed for security) */
  hasToken?: boolean;
  /** Whether this plugin comes from an extension (not built-in) */
  isExtension?: boolean;
  /** Extension-contributed metadata for dynamic UI rendering */
  extensionMeta?: {
    /** Credential fields required by this extension plugin */
    credentialFields?: Array<{
      key: string;
      label: string;
      type: 'text' | 'password' | 'select' | 'number' | 'boolean';
      required?: boolean;
      options?: string[];
      default?: string | number | boolean;
    }>;
    /** Additional config fields */
    configFields?: Array<{
      key: string;
      label: string;
      type: 'text' | 'password' | 'select' | 'number' | 'boolean';
      required?: boolean;
      options?: string[];
      default?: string | number | boolean;
    }>;
    /** Description of the plugin */
    description?: string;
    /** Extension name this plugin belongs to */
    extensionName?: string;
    /** Icon URL for the extension channel plugin */
    icon?: string;
  };
}

// ==================== Resource Model Types ====================

/**
 * First-class connector instance used for ingress/egress routing.
 * This is the target semantic replacement for plugin-centric channel routing.
 */
export interface IConnectorInstance {
  id: string;
  platform: PluginType;
  name: string;
  enabled: boolean;
  status: PluginStatus;
  credentials?: IPluginCredentials;
  runtimeConfig?: IPluginConfigOptions;
  capabilities?: Record<string, unknown>;
  legacyPluginId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Remote identity authorized through a specific connector instance.
 */
export interface IRemoteIdentity {
  id: string;
  connectorId: string;
  remoteUserId?: string;
  remoteChatId: string;
  remoteChatType?: string;
  displayName?: string;
  authorizedAt: number;
  lastActive?: number;
  metadata?: Record<string, unknown>;
  legacyUserId?: string;
}

/**
 * Published reusable agent capability.
 */
export interface IAgentProfile {
  id: string;
  name: string;
  backend: string;
  modelRef?: {
    id: string;
    useModel: string;
  };
  workspaceRef?: string;
  promptProfile?: Record<string, unknown>;
  toolPolicy?: Record<string, unknown>;
  memoryPolicy?: Record<string, unknown>;
  delegationPolicy?: Record<string, unknown>;
  publishedFromConversationId?: string;
  version: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Binding scope kinds for routing ingress traffic to agent profiles.
 */
export type ChannelBindingScopeType = 'connector_default' | 'remote_user' | 'remote_chat' | 'temporary_override';
export type ChannelBindingTargetType = 'agent_profile' | 'external_session';
export type ChannelHandoffMode = 'resume' | 'new_thread';
export type ChannelHandoffConflictPolicy = 'reject' | 'interrupt';

/**
 * Explicit routing rule from connector scope to agent profile.
 */
export interface IChannelBinding {
  id: string;
  connectorId: string;
  scopeType: ChannelBindingScopeType;
  scopeKey?: string;
  agentProfileId: string;
  priority: number;
  enabled: boolean;
  temporary: boolean;
  fallbackAgentProfileId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type ChannelAudienceScope = 'remote_user' | 'remote_chat';

export interface IChannelAudienceEntry {
  key: string;
  connectorId: string;
  scopeType: ChannelAudienceScope;
  remoteIdentityId?: string;
  remoteUserId?: string;
  remoteChatId?: string;
  remoteChatType?: string;
  parentChatId?: string;
  threadId?: string;
  displayName?: string;
  title: string;
  subtitle?: string;
  lastActive?: number;
}

export type IChannelBindingCatalog = {
  connectors: IConnectorInstance[];
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
  audiences: IChannelAudienceEntry[];
};

export type IChannelBindingTarget = {
  type: ChannelBindingTargetType;
  id: string;
  mode?: ChannelHandoffMode;
};

export type IChannelHandoffRequest = {
  sourceConversationId?: string;
  sourceExternalSessionId?: string;
  targetConnectorId: string;
  targetChatId: string;
  targetPlatformUserId?: string;
  targetDisplayName?: string;
  targetChatType?: string;
  mode?: ChannelHandoffMode;
  conflictPolicy?: ChannelHandoffConflictPolicy;
  temporary?: boolean;
  priority?: number;
};

export type IChannelHandoffResult = {
  bindingId: string;
  targetExternalSessionId: string;
  sourceExternalSessionId?: string;
  conversationId?: string;
  agentProfileId: string;
  mode: ChannelHandoffMode;
};

/**
 * Long-lived external chat relationship.
 * The active conversation may rotate on `/new`, but the external session remains stable.
 */
export interface IExternalSession {
  id: string;
  connectorId: string;
  remoteIdentityId: string;
  bindingId?: string;
  agentProfileId: string;
  activeConversationId?: string;
  state: 'active' | 'paused' | 'archived';
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Resolve binding routing target from metadata.
 * Falls back to `agent_profile` target semantics for existing rows.
 */
export function getChannelBindingTarget(binding: IChannelBinding): IChannelBindingTarget {
  const metadata = toRecord(binding.metadata);
  const routeTarget = toRecord(metadata?.routeTarget);
  const rawType = routeTarget?.type;
  const rawId = routeTarget?.id;
  const rawMode = routeTarget?.mode;

  if (
    rawType === 'external_session' &&
    typeof rawId === 'string' &&
    rawId.trim() &&
    (rawMode === undefined || rawMode === 'resume' || rawMode === 'new_thread')
  ) {
    return {
      type: 'external_session',
      id: rawId,
      mode: rawMode === 'new_thread' ? 'new_thread' : rawMode === 'resume' ? 'resume' : undefined,
    };
  }

  return {
    type: 'agent_profile',
    id: binding.agentProfileId,
  };
}

/**
 * Persist an explicit binding target inside metadata.
 */
export function withChannelBindingTarget(
  binding: IChannelBinding,
  target: IChannelBindingTarget,
  metadataPatch?: Record<string, unknown>
): IChannelBinding {
  const currentMetadata = toRecord(binding.metadata) ?? {};
  const routeTarget: Record<string, unknown> = {
    type: target.type,
    id: target.id,
  };
  if (target.type === 'external_session' && target.mode) {
    routeTarget.mode = target.mode;
  }

  return {
    ...binding,
    metadata: {
      ...currentMetadata,
      ...metadataPatch,
      routeTarget,
    },
  };
}

/**
 * Execution run status.
 */
export type ChannelRunStatus = 'pending' | 'running' | 'finished' | 'error' | 'cancelled' | 'terminated';

/**
 * Root or child execution run.
 */
export interface IChannelRun {
  id: string;
  externalSessionId?: string;
  parentRunId?: string;
  rootRunId: string;
  agentProfileId: string;
  backend: string;
  conversationId?: string;
  workspaceRef?: string;
  status: ChannelRunStatus;
  inputMessageId?: string;
  metadata?: Record<string, unknown>;
  startedAt: number;
  endedAt?: number;
}

// ==================== User Types ====================

/**
 * Authorized user in the assistant system
 */
export interface IChannelUser {
  id: string;
  platformUserId: string;
  platformType: PluginType;
  displayName?: string;
  authorizedAt: number;
  lastActive?: number;
  sessionId?: string;
}

/**
 * Database row for assistant users
 */
export interface IChannelUserRow {
  id: string;
  platform_user_id: string;
  platform_type: string;
  display_name: string | null;
  authorized_at: number;
  last_active: number | null;
  session_id: string | null;
}

// ==================== Session Types ====================

/**
 * Agent types supported in assistant sessions
 */
export type ChannelAgentType = 'gemini' | 'acp' | 'codex' | 'openclaw-gateway';

/**
 * User session in the assistant system
 */
export interface IChannelSession {
  id: string;
  userId: string;
  agentType: ChannelAgentType;
  conversationId?: string;
  workspace?: string;
  chatId?: string; // Channel chat isolation ID (e.g. user:xxx, group:xxx)
  createdAt: number;
  lastActivity: number;
}

/**
 * Database row for assistant sessions
 */
export interface IChannelSessionRow {
  id: string;
  user_id: string;
  agent_type: string;
  conversation_id: string | null;
  workspace: string | null;
  chat_id: string | null; // Channel chat isolation ID
  created_at: number;
  last_activity: number;
}

// ==================== Pairing Types ====================

/**
 * Pairing request status
 */
export type PairingStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Pending pairing request
 */
export interface IChannelPairingRequest {
  code: string;
  platformUserId: string;
  platformType: PluginType;
  connectorId?: string;
  remoteChatId?: string;
  displayName?: string;
  requestedAt: number;
  expiresAt: number;
  status: PairingStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Database row for pairing codes
 */
export interface IChannelPairingCodeRow {
  code: string;
  platform_user_id: string;
  platform_type: string;
  display_name: string | null;
  requested_at: number;
  expires_at: number;
  status: string;
}

// ==================== Message Types ====================

/**
 * Content types for unified messages
 */
export type MessageContentType =
  | 'text'
  | 'photo'
  | 'document'
  | 'voice'
  | 'audio'
  | 'video'
  | 'sticker'
  | 'action'
  | 'command';

/**
 * Unified user information across platforms
 */
export interface IUnifiedUser {
  id: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Attachment types for messages
 */
export type AttachmentType = 'photo' | 'document' | 'voice' | 'audio' | 'video' | 'sticker';

/**
 * Unified attachment information
 */
export interface IUnifiedAttachment {
  type: AttachmentType;
  fileId: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
}

/**
 * Unified message content
 */
export interface IUnifiedMessageContent {
  type: MessageContentType;
  text: string;
  attachments?: IUnifiedAttachment[];
}

/**
 * Unified action in a message
 */
export interface IMessageAction {
  type: ActionCategory;
  name: string;
  params?: Record<string, string>;
}

/**
 * Unified incoming message format (Platform -> System)
 */
export interface IUnifiedIncomingMessage {
  id: string;
  platform: PluginType;
  pluginId?: string;
  /** Platform transport target (used for replying back through the IM connector). */
  chatId: string;
  /** Stable audience/session identity used for routing; may differ from transport chat in topics/threads. */
  peer?: IUnifiedPeer;
  user: IUnifiedUser;
  content: IUnifiedMessageContent;
  timestamp: number;
  replyToMessageId?: string;
  action?: IMessageAction;
  raw?: unknown;
}

export type UnifiedPeerScope = 'chat' | 'thread';

export interface IUnifiedPeer {
  /** Stable routing key for audience/session resolution. */
  key: string;
  /** Raw platform chat target used for send/edit operations. */
  platformChatId: string;
  scope: UnifiedPeerScope;
  parentChatId?: string;
  threadId?: string;
  chatType?: string;
}

/**
 * Parse mode for outgoing messages
 */
export type MessageParseMode = 'plain' | 'markdown' | 'html';

/**
 * Button for inline keyboards
 */
export interface IActionButton {
  label: string;
  action: string;
  params?: Record<string, string>;
}

/**
 * Unified outgoing message format (System -> Platform)
 */
export interface IUnifiedOutgoingMessage {
  type: 'text' | 'image' | 'file' | 'buttons';
  text?: string;
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  buttons?: IActionButton[][];
  keyboard?: IActionButton[][];
  replyMarkup?: unknown;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  replyToMessageId?: string;
  silent?: boolean;
}

/**
 * Bot information for display
 */
export interface BotInfo {
  id: string;
  username?: string;
  displayName: string;
}

// ==================== Action Types ====================

/**
 * Action categories
 */
export type ActionCategory = 'platform' | 'system' | 'chat';

/**
 * Unified action structure
 */
export interface IUnifiedAction {
  action: string;
  category: ActionCategory;
  params?: Record<string, string>;
  context: {
    platform: PluginType;
    userId: string;
    chatId: string;
    messageId?: string;
    sessionId?: string;
  };
}

/**
 * Response behavior for actions
 */
export type ActionResponseBehavior = 'send' | 'edit' | 'answer';

/**
 * Unified action response
 */
export interface IActionResponse {
  text?: string;
  parseMode?: MessageParseMode;
  buttons?: IActionButton[][];
  keyboard?: IActionButton[][];
  behavior: ActionResponseBehavior;
  toast?: string;
  editMessageId?: string;
}

// ==================== Agent Response Types ====================

/**
 * Agent response types for streaming
 */
export type AgentResponseType = 'text' | 'stream_start' | 'stream_chunk' | 'stream_end' | 'error';

/**
 * Agent response structure
 */
export interface IAgentResponse {
  type: AgentResponseType;
  text?: string;
  chunk?: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    model?: string;
    tokensUsed?: number;
    duration?: number;
  };
  suggestedActions?: IActionButton[];
}

// ==================== Type Conversion Helpers ====================

/**
 * Convert database row to IChannelUser
 */
export function rowToChannelUser(row: IChannelUserRow): IChannelUser {
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    platformType: row.platform_type as PluginType,
    displayName: row.display_name ?? undefined,
    authorizedAt: row.authorized_at,
    lastActive: row.last_active ?? undefined,
    sessionId: row.session_id ?? undefined,
  };
}

/**
 * Convert IChannelUser to database row
 */
export function channelUserToRow(user: IChannelUser): IChannelUserRow {
  return {
    id: user.id,
    platform_user_id: user.platformUserId,
    platform_type: user.platformType,
    display_name: user.displayName ?? null,
    authorized_at: user.authorizedAt,
    last_active: user.lastActive ?? null,
    session_id: user.sessionId ?? null,
  };
}

/**
 * Convert database row to IChannelSession
 */
export function rowToChannelSession(row: IChannelSessionRow): IChannelSession {
  return {
    id: row.id,
    userId: row.user_id,
    agentType: row.agent_type as ChannelAgentType,
    conversationId: row.conversation_id ?? undefined,
    workspace: row.workspace ?? undefined,
    chatId: row.chat_id ?? undefined,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
  };
}

/**
 * Convert IChannelSession to database row
 */
export function channelSessionToRow(session: IChannelSession): IChannelSessionRow {
  return {
    id: session.id,
    user_id: session.userId,
    agent_type: session.agentType,
    conversation_id: session.conversationId ?? null,
    workspace: session.workspace ?? null,
    chat_id: session.chatId ?? null,
    created_at: session.createdAt,
    last_activity: session.lastActivity,
  };
}

/**
 * Convert database row to IChannelPairingRequest
 */
export function rowToPairingRequest(row: IChannelPairingCodeRow): IChannelPairingRequest {
  return {
    code: row.code,
    platformUserId: row.platform_user_id,
    platformType: row.platform_type as PluginType,
    displayName: row.display_name ?? undefined,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    status: row.status as PairingStatus,
  };
}

/**
 * Convert IChannelPairingRequest to database row
 */
export function pairingRequestToRow(request: IChannelPairingRequest): IChannelPairingCodeRow {
  return {
    code: request.code,
    platform_user_id: request.platformUserId,
    platform_type: request.platformType,
    display_name: request.displayName ?? null,
    requested_at: request.requestedAt,
    expires_at: request.expiresAt,
    status: request.status,
  };
}

// ==================== Channel Platform Helpers ====================

/**
 * Channel platform type for model configuration.
 * Includes built-in platforms and extension-contributed platforms (string).
 */
export type ChannelPlatform = BuiltinChannelType | (string & {});

/**
 * Type guard to check if a string is a known built-in ChannelPlatform.
 * Extension platform types are valid but not matched here.
 */
export function isBuiltinChannelPlatform(value: string): value is BuiltinChannelType {
  return isBuiltinChannelType(value);
}

/**
 * Type guard to check if a string is a valid ChannelPlatform (including extensions).
 * All non-empty strings are valid channel platforms.
 */
export function isChannelPlatform(value: string): value is ChannelPlatform {
  return value.length > 0;
}

/**
 * Resolve a backend string to conversation type and optional backend qualifier.
 * Centralizes the backend → convType mapping used across channels.
 */
export function resolveChannelConvType(backend: string): {
  convType: string;
  convBackend?: string;
} {
  if (backend === 'codex') return { convType: 'codex' };
  if (backend === 'gemini') return { convType: 'gemini' };
  if (backend === 'openclaw-gateway') return { convType: 'openclaw-gateway' };
  return { convType: 'acp', convBackend: backend };
}

/**
 * Build a structured conversation name for a channel platform.
 * Format: {shortPlatform}-{type}-{backend}-{chatIdPrefix}
 * - platform is shortened: telegram -> tg, dingtalk -> ding, lark -> lark
 * - backend is only included when type === 'acp'
 * - chatIdPrefix is the first 8 characters of chatId
 * - empty segments are omitted
 */
export function getChannelConversationName(
  platform: ChannelPlatform | PluginType,
  type?: string,
  backend?: string,
  chatId?: string
): string {
  const shortPlatform: Record<string, string> = {
    telegram: 'tg',
    slack: 'slack',
    discord: 'discord',
    dingtalk: 'ding',
    weixin: 'wx',
  };
  const parts: string[] = [shortPlatform[platform] ?? platform];
  if (type) parts.push(type);
  if (type === 'acp' && backend) parts.push(backend);
  if (chatId) parts.push(chatId.slice(0, 8));
  return parts.join('-');
}
