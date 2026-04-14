/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProviderWithModel } from '@/common/config/storage';
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
  /** Runtime/plugin row id used internally by the channel runtime. */
  runtimeId?: string;
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
 * First-class channel account used for ingress/egress routing.
 * This is the target semantic replacement for plugin-centric channel routing.
 */
export interface IChannelAccount {
  id: string;
  platform: PluginType;
  name: string;
  enabled: boolean;
  status: PluginStatus;
  credentials?: IPluginCredentials;
  runtimeConfig?: IPluginConfigOptions;
  configured?: boolean;
  capabilities?: Record<string, unknown>;
  legacyPluginId?: string;
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use IChannelAccount. */
export type IConnectorInstance = IChannelAccount;

/**
 * Remote identity authorized through a specific channel account.
 */
export interface IRemoteIdentity {
  id: string;
  connectorId: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  remoteUserId?: string;
  /** Stable peer/audience key used for routing and session isolation. */
  remoteChatId: string;
  /** Raw platform chat target used for message transport. */
  platformChatId?: string;
  remoteChatType?: string;
  peerScope?: UnifiedPeerScope;
  /** Parent audience key for thread/topic peers, used for fallback routing. */
  parentChatId?: string;
  threadId?: string;
  displayName?: string;
  authorizedAt: number;
  lastActive?: number;
  metadata?: Record<string, unknown>;
  legacyUserId?: string;
}

export type ChannelObjectKind =
  | 'person'
  | 'dm'
  | 'group'
  | 'channel'
  | 'topic'
  | 'thread'
  | 'server'
  | 'space'
  | 'chat';
export type ChannelObjectParentKind = Exclude<ChannelObjectKind, 'person' | 'dm'>;

/**
 * Published reusable agent capability.
 */
export interface IAgentProfile {
  id: string;
  name: string;
  backend: string;
  modelRef?: Pick<TProviderWithModel, 'id' | 'useModel'> &
    Partial<Pick<TProviderWithModel, 'platform' | 'name' | 'baseUrl'>>;
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
export type ChannelContinuationMode = 'resume' | 'new_thread';
export type ChannelContinuationConflictPolicy = 'reject' | 'interrupt';
export type ChannelControlMode = 'desktop_owner' | 'im_owner' | 'im_observer';
export type ChannelPublishObjectDiscoverySource = 'pulled' | 'inbound-learned' | 'manual';

export interface IChannelControlLease {
  externalSessionId: string;
  ownerKey: string;
  controlMode: ChannelControlMode;
  sourceExternalSessionId?: string;
  sourceConversationId?: string;
  continuationMode?: ChannelContinuationMode;
  createdAt: number;
  updatedAt: number;
  releasedAt?: number;
}

/**
 * Explicit routing rule from channel account scope to agent profile.
 */
export interface IChannelBinding {
  id: string;
  connectorId: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
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

export type IChannelPublishObject = {
  nativeObjectType: string;
  nativeObjectId: string;
  parentNativeObjectId?: string;
  displayName?: string;
  discoverySource: ChannelPublishObjectDiscoverySource;
  metadata?: Record<string, unknown>;
};

export type ChannelAudienceScope = 'remote_user' | 'remote_chat';

export interface IChannelAudienceEntry {
  key: string;
  connectorId: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  scopeType: ChannelAudienceScope;
  remoteIdentityId?: string;
  remoteUserId?: string;
  remoteChatId?: string;
  platformChatId?: string;
  remoteChatType?: string;
  peerScope?: UnifiedPeerScope;
  parentChatId?: string;
  threadId?: string;
  displayName?: string;
  objectKey?: string;
  objectKind?: ChannelObjectKind;
  objectTitle?: string;
  objectSubtitle?: string;
  parentObjectKey?: string;
  parentObjectTitle?: string;
  parentObjectKind?: ChannelObjectParentKind;
  title: string;
  subtitle?: string;
  lastActive?: number;
}

export type IChannelBindingCatalog = {
  connectors: IChannelAccount[];
  /** @deprecated Use connectors. */
  channelAccounts?: IChannelAccount[];
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
  audiences: IChannelAudienceEntry[];
};

export type IChannelBindingTarget = {
  type: ChannelBindingTargetType;
  id: string;
  mode?: ChannelContinuationMode;
};

export type IChannelContinuationRequest = {
  sourceConversationId?: string;
  sourceExternalSessionId?: string;
  targetChannelAccountId?: string;
  /** @deprecated Use targetChannelAccountId. */
  targetConnectorId?: string;
  targetChatId: string;
  targetPlatformChatId?: string;
  targetPlatformUserId?: string;
  targetDisplayName?: string;
  targetChatType?: string;
  mode?: ChannelContinuationMode;
  conflictPolicy?: ChannelContinuationConflictPolicy;
  controlMode?: ChannelControlMode;
  temporary?: boolean;
  priority?: number;
};

export type IChannelContinuationResult = {
  bindingId: string;
  targetExternalSessionId: string;
  sourceExternalSessionId?: string;
  conversationId?: string;
  agentProfileId: string;
  mode: ChannelContinuationMode;
};

export type IChannelContinuationReleaseResult = {
  targetExternalSessionId: string;
  releasedBindingId?: string;
  restoredSourceExternalSessionId?: string;
  restoredConversationId?: string;
};

/**
 * Long-lived external chat relationship.
 * The active conversation may rotate on `/new`, but the external session remains stable.
 */
export interface IExternalSession {
  id: string;
  connectorId: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  remoteIdentityId: string;
  bindingId?: string;
  agentProfileId: string;
  activeConversationId?: string;
  state: 'active' | 'paused' | 'archived';
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

export type IExternalSessionControlState = {
  ownerKey?: string;
  controlMode?: ChannelControlMode;
  sourceExternalSessionId?: string;
  sourceConversationId?: string;
  continuationMode?: ChannelContinuationMode;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizePublishObjectString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizePublishObjectDiscoverySource(value: unknown): ChannelPublishObjectDiscoverySource {
  return value === 'pulled' || value === 'inbound-learned' || value === 'manual' ? value : 'manual';
}

function normalizeChannelPublishObject(publishObject: IChannelPublishObject): IChannelPublishObject {
  const metadata = toRecord(publishObject.metadata);

  return {
    nativeObjectType: normalizePublishObjectString(publishObject.nativeObjectType) ?? 'chat',
    nativeObjectId: normalizePublishObjectString(publishObject.nativeObjectId) ?? 'connector-default',
    parentNativeObjectId: normalizePublishObjectString(publishObject.parentNativeObjectId),
    displayName: normalizePublishObjectString(publishObject.displayName),
    discoverySource: normalizePublishObjectDiscoverySource(publishObject.discoverySource),
    metadata: metadata ?? undefined,
  };
}

function inferPublishObjectTypeFromBinding(binding: IChannelBinding, metadata: Record<string, unknown> | null): string {
  const objectKind = normalizePublishObjectString(metadata?.objectKind);
  if (objectKind) {
    return objectKind;
  }

  if (binding.scopeType === 'connector_default') {
    return 'connector_default';
  }

  if (binding.scopeType === 'remote_user') {
    return 'remote_user';
  }

  if (binding.scopeKey?.includes(':thread:')) {
    return 'thread';
  }

  if (binding.scopeKey?.startsWith('user:')) {
    return 'dm';
  }

  if (binding.scopeKey?.startsWith('group:')) {
    return 'group';
  }

  return binding.scopeType === 'remote_chat' ? 'chat' : binding.scopeType;
}

function inferLegacyChannelPublishObject(binding: IChannelBinding): IChannelPublishObject {
  const metadata = toRecord(binding.metadata);
  const scopeKey = normalizePublishObjectString(binding.scopeKey);
  const explicitParentId = normalizePublishObjectString(metadata?.parentObjectKey);
  const explicitDisplayName = normalizePublishObjectString(metadata?.objectTitle);
  const threadMarker = ':thread:';

  if (binding.scopeType === 'connector_default' || !scopeKey) {
    return normalizeChannelPublishObject({
      nativeObjectType: inferPublishObjectTypeFromBinding(binding, metadata),
      nativeObjectId: 'connector-default',
      displayName: explicitDisplayName,
      discoverySource: 'manual',
    });
  }

  if (scopeKey.includes(threadMarker)) {
    const markerIndex = scopeKey.indexOf(threadMarker);
    const parentNativeObjectId = explicitParentId ?? (scopeKey.slice(0, markerIndex) || undefined);
    const nativeObjectId = scopeKey.slice(markerIndex + threadMarker.length) || scopeKey;
    return normalizeChannelPublishObject({
      nativeObjectType: inferPublishObjectTypeFromBinding(binding, metadata),
      nativeObjectId,
      parentNativeObjectId,
      displayName: explicitDisplayName,
      discoverySource: 'manual',
    });
  }

  return normalizeChannelPublishObject({
    nativeObjectType: inferPublishObjectTypeFromBinding(binding, metadata),
    nativeObjectId: scopeKey,
    parentNativeObjectId: explicitParentId,
    displayName: explicitDisplayName,
    discoverySource: 'manual',
  });
}

export function getChannelAccountId(value: { connectorId?: string; channelAccountId?: string }): string | undefined {
  return value.channelAccountId ?? value.connectorId;
}

export function withChannelAccountId<T extends { connectorId?: string; channelAccountId?: string }>(value: T): T {
  const channelAccountId = getChannelAccountId(value);
  if (!channelAccountId) {
    return value;
  }
  return {
    ...value,
    connectorId: channelAccountId,
    channelAccountId,
  };
}

export function getExternalSessionControlState(session: IExternalSession): IExternalSessionControlState {
  const metadata = toRecord(session.metadata);
  const control = toRecord(metadata?.control);

  return {
    ownerKey: typeof control?.ownerKey === 'string' && control.ownerKey ? control.ownerKey : undefined,
    controlMode:
      control?.controlMode === 'desktop_owner' ||
      control?.controlMode === 'im_owner' ||
      control?.controlMode === 'im_observer'
        ? control.controlMode
        : undefined,
    sourceExternalSessionId:
      typeof control?.sourceExternalSessionId === 'string' && control.sourceExternalSessionId
        ? control.sourceExternalSessionId
        : undefined,
    sourceConversationId:
      typeof control?.sourceConversationId === 'string' && control.sourceConversationId
        ? control.sourceConversationId
        : undefined,
    continuationMode: control?.mode === 'resume' || control?.mode === 'new_thread' ? control.mode : undefined,
  };
}

export function getChannelBindingSource(binding: IChannelBinding): string | undefined {
  const metadata = toRecord(binding.metadata);
  return typeof metadata?.source === 'string' && metadata.source ? metadata.source : undefined;
}

export function getChannelBindingPublishObject(binding: IChannelBinding): IChannelPublishObject {
  const metadata = toRecord(binding.metadata);
  const rawPublishObject = toRecord(metadata?.publishObject);
  const nativeObjectType = normalizePublishObjectString(rawPublishObject?.nativeObjectType);
  const nativeObjectId = normalizePublishObjectString(rawPublishObject?.nativeObjectId);

  if (nativeObjectType && nativeObjectId) {
    return normalizeChannelPublishObject({
      nativeObjectType,
      nativeObjectId,
      parentNativeObjectId: normalizePublishObjectString(rawPublishObject?.parentNativeObjectId),
      displayName: normalizePublishObjectString(rawPublishObject?.displayName),
      discoverySource: normalizePublishObjectDiscoverySource(rawPublishObject?.discoverySource),
      metadata: toRecord(rawPublishObject?.metadata) ?? undefined,
    });
  }

  return inferLegacyChannelPublishObject(binding);
}

export function getChannelBindingPublishObjectIdentity(binding: IChannelBinding): string {
  const publishObject = getChannelBindingPublishObject(binding);
  return [publishObject.nativeObjectType, publishObject.nativeObjectId, publishObject.parentNativeObjectId ?? ''].join(
    '::'
  );
}

export function getChannelBindingPublishObjectLabel(binding: IChannelBinding): string {
  const publishObject = getChannelBindingPublishObject(binding);
  return publishObject.displayName ?? publishObject.nativeObjectId;
}

export function withChannelBindingPublishObject(
  binding: IChannelBinding,
  publishObject?: IChannelPublishObject
): IChannelBinding {
  const currentMetadata = toRecord(binding.metadata) ?? {};

  return {
    ...binding,
    metadata: {
      ...currentMetadata,
      publishObject: normalizeChannelPublishObject(publishObject ?? getChannelBindingPublishObject(binding)),
    },
  };
}

export function findConflictingChannelBinding(
  bindings: readonly IChannelBinding[],
  candidate: IChannelBinding
): IChannelBinding | undefined {
  if (candidate.temporary) {
    return undefined;
  }

  const channelAccountId = getChannelAccountId(candidate);
  if (!channelAccountId) {
    return undefined;
  }

  const publishObjectIdentity = getChannelBindingPublishObjectIdentity(candidate);

  return bindings.find((binding) => {
    if (binding.temporary || binding.id === candidate.id) {
      return false;
    }

    return (
      getChannelAccountId(binding) === channelAccountId &&
      getChannelBindingPublishObjectIdentity(binding) === publishObjectIdentity
    );
  });
}

export function isSystemFallbackBinding(binding: IChannelBinding): boolean {
  const source = getChannelBindingSource(binding);
  return source === 'legacy-default' || source === 'system-fallback-runtime';
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
  connectorId?: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  platformUserId: string;
  platformType: PluginType;
  displayName?: string;
  authorizedAt: number;
  lastActive?: number;
  sessionId?: string;
}

export interface IChannelAuthorizedTarget {
  id: string;
  connectorId?: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  platformType: PluginType;
  targetId: string;
  displayName?: string;
  targetType?: string;
  parentTargetId?: string;
  threadId?: string;
  remoteUserId?: string;
  platformChatId?: string;
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

export type IChannelActiveSessionEntry = {
  id: string;
  connectorId?: string;
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
  connectorName?: string;
  /** @deprecated Use connectorName. */
  channelAccountName?: string;
  connectorPlatform?: PluginType;
  /** @deprecated Use connectorPlatform. */
  channelAccountPlatform?: PluginType;
  remoteIdentityId?: string;
  audienceTitle: string;
  audienceKey?: string;
  objectKey?: string;
  objectKind?: ChannelObjectKind;
  objectTitle?: string;
  objectSubtitle?: string;
  parentObjectKey?: string;
  parentObjectTitle?: string;
  parentObjectKind?: ChannelObjectParentKind;
  conversationId?: string;
  workspace?: string;
  agentType: ChannelAgentType;
  createdAt: number;
  lastActivity: number;
  bindingId?: string;
  bindingTemporary?: boolean;
  bindingSource?: string;
  bindingSystemFallback?: boolean;
  ownerKey?: string;
  controlMode?: ChannelControlMode;
  continuationMode?: ChannelContinuationMode;
  continuationSourceExternalSessionId?: string;
  continuationSourceConversationId?: string;
  leaseUpdatedAt?: number;
  leaseReleasedAt?: number;
};

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
  /** @deprecated Use connectorId. */
  channelAccountId?: string;
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
  containerId?: string;
  containerType?: string;
  containerTitle?: string;
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
  threadId?: string;
  replyInThread?: boolean;
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
