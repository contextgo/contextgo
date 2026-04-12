/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackend, AcpBackendAll, AcpBackendConfig } from '@/common/types/acpTypes';
import type { CloudDevice, CloudUser } from '@/common/types/cloud';
import type { VoiceInputConfig } from '@/common/types/voiceInput';
import type { ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import { storage } from '@office-ai/platform';

/**
 * @description 聊天相关的存储
 */
export const ChatStorage = storage.buildStorage<IChatConversationRefer>('agent.chat');

// 聊天消息存储
export const ChatMessageStorage = storage.buildStorage('agent.chat.message');

// 系统配置存储
export const ConfigStorage = storage.buildStorage<IConfigStorageRefer>('agent.config');

// 系统环境变量存储
export const EnvStorage = storage.buildStorage<IEnvStorageRefer>('agent.env');

export interface IConfigStorageRefer {
  'gemini.config': {
    authType: string;
    proxy: string;
    GOOGLE_GEMINI_BASE_URL?: string;
    /** @deprecated Use accountProjects instead. Kept for backward compatibility migration. */
    GOOGLE_CLOUD_PROJECT?: string;
    /** 按 Google 账号存储的 GCP 项目 ID / GCP project IDs stored per Google account */
    accountProjects?: Record<string, string>;
    yoloMode?: boolean;
    /** Preferred session mode for new conversations / 新会话的默认模式 */
    preferredMode?: string;
  };
  'codex.config'?: {
    cliPath?: string;
    yoloMode?: boolean;
  };
  'acp.config': {
    [backend in AcpBackend]?: {
      authMethodId?: string;
      authToken?: string;
      lastAuthTime?: number;
      cliPath?: string;
      yoloMode?: boolean;
      /** Preferred session mode for new conversations / 新会话的默认模式 */
      preferredMode?: string;
      /** Preferred model ID for new conversations / 新会话的默认模型 */
      preferredModelId?: string;
      /** LLM prompt timeout in seconds (default: 300) / LLM 请求超时时间（秒，默认 300） */
      promptTimeout?: number;
    };
  };
  /** Global LLM prompt timeout in seconds (default: 300). Per-backend promptTimeout overrides this. */
  'acp.promptTimeout'?: number;
  'acp.customAgents'?: AcpBackendConfig[];
  // Cached model lists per ACP backend for Guid page pre-selection
  'acp.cachedModels'?: Record<string, import('@/common/types/acpTypes').AcpModelInfo>;
  'model.config': IProvider[];
  language: string;
  theme: string;
  colorScheme: string;
  /** 桌面模式下是否自动启用 WebUI / Auto-enable WebUI in desktop mode */
  'webui.desktop.enabled'?: boolean;
  /** 桌面模式下是否允许远程访问 / Allow remote access in desktop mode */
  'webui.desktop.allowRemote'?: boolean;
  /** 桌面模式下 WebUI 端口 / WebUI port in desktop mode */
  'webui.desktop.port'?: number;
  customCss: string; // 自定义 CSS 样式
  'css.themes': ICssTheme[]; // 自定义 CSS 主题列表 / Custom CSS themes list
  'css.activeThemeId': string; // 当前激活的主题 ID / Currently active theme ID
  'gemini.defaultModel': string | { id: string; useModel: string };
  'assistant.telegram.defaultModel'?: string | { id: string; useModel: string };
  'assistant.slack.defaultModel'?: string | { id: string; useModel: string };
  'assistant.discord.defaultModel'?: string | { id: string; useModel: string };
  'assistant.lark.defaultModel'?: string | { id: string; useModel: string };
  'assistant.dingtalk.defaultModel'?: string | { id: string; useModel: string };
  'assistant.weixin.defaultModel'?: string | { id: string; useModel: string };
  'assistant.telegram.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  'assistant.slack.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  'assistant.discord.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  'assistant.lark.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  'assistant.dingtalk.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  'assistant.weixin.agent'?: { backend: string; name?: string; customAgentId?: string; presetAgentType?: string };
  // 是否在粘贴文件到工作区时询问确认（true = 不再询问）
  'workspace.pasteConfirm'?: boolean;
  // guid 页面上次选择的 agent 类型 / Last selected agent type on guid page
  'guid.lastSelectedAgent'?: string;
  'guid.lastSelectedAssistant'?: string | null;
  // 当前默认选中的 Space，用于新建会话时继承 / Persisted selected Space for new conversation flows
  'space.selectedId'?: string;
  // 迁移标记：修复老版本中助手 enabled 默认值问题 / Migration flag: fix assistant enabled default value issue
  'migration.assistantEnabledFixed'?: boolean;
  // 迁移标记：为 cowork 助手添加默认启用的 skills / Migration flag: add default enabled skills for cowork assistant
  /** @deprecated Use migration.builtinDefaultSkillsAdded_v2 instead */
  'migration.coworkDefaultSkillsAdded'?: boolean;
  // 迁移标记：为所有内置助手添加默认启用的 skills / Migration flag: add default enabled skills for all builtin assistants
  'migration.builtinDefaultSkillsAdded_v2'?: boolean;
  // 迁移标记：为所有内置助手添加默认启用的 hooks / Migration flag: add default enabled hooks for all builtin assistants
  'migration.builtinDefaultHooksAdded_v1'?: boolean;
  // 迁移标记：为所有内置助手添加 promptsI18n / Migration flag: add promptsI18n for all builtin assistants
  'migration.promptsI18nAdded'?: boolean;
  /** Migration flag: Electron desktop config has been imported to server config */
  'migration.electronConfigImported'?: boolean;
  // 关闭窗口时最小化到系统托盘 / Minimize to system tray when closing window
  'system.closeToTray'?: boolean;
  // 任务完成时显示系统通知 / Show system notification when task completes
  'system.notificationEnabled'?: boolean;
  // 定时任务完成时显示系统通知 / Show system notification when scheduled task completes
  'system.scheduleNotificationEnabled'?: boolean;
  // Global voice input configuration / 全局语音输入配置
  'voiceInput.config'?: VoiceInputConfig;
  // ContextGo cloud account cached user profile / ContextGo 云端账号缓存用户信息
  'cloud.user'?: CloudUser;
  // ContextGo cloud current device binding / ContextGo 云端当前设备绑定信息
  'cloud.device'?: CloudDevice;
  // ContextGo cloud device token (ctxdev_...) / ContextGo 云端设备令牌
  'cloud.deviceToken'?: string;
  // ContextGo cloud WebUI cached user profile / ContextGo 云端 WebUI 缓存用户信息
  'cloud.webui.user'?: CloudUser;
  // ContextGo cloud WebUI device binding / ContextGo 云端 WebUI 设备绑定信息
  'cloud.webui.device'?: CloudDevice;
  // ContextGo cloud WebUI device token (ctxdev_...) / ContextGo 云端 WebUI 设备令牌
  'cloud.webui.deviceToken'?: string;
  'command.library'?: ManagedSlashCommandRecord[];
  // Skills Market: whether the bundled builtin skill is enabled
  'skillsMarket.enabled'?: boolean;
  // Space-scoped browser context assets used by agent-browser
  'browser.context.assets'?: TBrowserContextAsset[];
}

export interface IEnvStorageRefer {
  'contextgo.dir': {
    workDir: string;
    cacheDir: string;
  };
}

/**
 * Conversation source type - identifies where the conversation was created
 * 会话来源类型 - 标识会话创建的来源
 */
export type ConversationSource =
  | 'contextgo'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'lark'
  | 'dingtalk'
  | 'weixin'
  | (string & {});

export type DiscussionGroupMode = 'broadcast' | 'relay' | 'debate';

export type CollaborationMode = 'discussion' | 'planner-generator-evaluator';

export type CollaborationParticipantRole = 'participant' | 'planner' | 'generator' | 'evaluator';

export type CollaborationExecutionBoundary =
  | {
      type: 'workspace';
    }
  | {
      type: 'git-repository';
      repositoryRoot: string;
      branch?: string | null;
      gitDir?: string | null;
      remoteUrl?: string | null;
    };

export type GroupCollaborationConfig = {
  mode: CollaborationMode;
  executionBoundary: CollaborationExecutionBoundary;
};

export type GroupOrchestrationKind = 'discussion' | 'workflow';

export type BuiltInGroupParticipantRole = CollaborationParticipantRole | 'writer';

export type GroupParticipantRole = BuiltInGroupParticipantRole | 'custom' | (string & {});

export type WorkflowGroupTemplate = 'planner-writer-evaluator' | 'plan-build-evaluate' | (string & {});

export type WorkflowGroupReviewMode = 'per-iteration' | 'final-only';

export type WorkflowGroupStage = 'planning' | 'writing' | 'evaluating' | 'completed' | 'failed';
export type WorkflowGroupRunnableStage = Exclude<WorkflowGroupStage, 'completed' | 'failed'>;
export type WorkflowGroupRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

export type WorkflowGroupDecision = 'continue' | 'accept' | 'stop';

export type DiscussionGroupParticipantType = 'preset-assistant' | 'cli-agent';

export type GroupParticipant = {
  id: string;
  participantType: DiscussionGroupParticipantType;
  participantKey: string;
  /** @deprecated Kept for backward compatibility with older discussion group data */
  assistantId?: string;
  name: string;
  avatar?: string;
  description?: string;
  childConversationId: string;
  role?: GroupParticipantRole;
};

export type DiscussionGroupParticipant = GroupParticipant;

export type DiscussionGroupOrchestration = {
  kind: 'discussion';
  mode: DiscussionGroupMode;
  rounds: 1 | 2;
};

export type WorkflowGroupOrchestration = {
  kind: 'workflow';
  template: WorkflowGroupTemplate;
  maxIterations: number;
  scoreTarget?: number;
  artifactPath?: string;
  reviewMode?: WorkflowGroupReviewMode;
};

export type GroupOrchestration = DiscussionGroupOrchestration | WorkflowGroupOrchestration;

export type WorkflowGroupStageRecord = {
  stageId: string;
  stage: WorkflowGroupRunnableStage;
  participantId?: string;
  participantRole?: GroupParticipantRole;
  iteration: number;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed' | 'stopped';
};

export type WorkflowGroupRunState = {
  runId: string;
  status: WorkflowGroupRunStatus;
  stage: WorkflowGroupStage;
  activeStageId?: string;
  iteration: number;
  latestScore?: number;
  latestDecision?: WorkflowGroupDecision;
  planningBrief?: string;
  artifactPath?: string;
  activeParticipantId?: string;
  startedAt?: number;
  completedAt?: number;
  stageHistory: WorkflowGroupStageRecord[];
  updatedAt: number;
};

export type ConversationGroupMeta = {
  parentGroupId: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantRole?: GroupParticipantRole;
  hiddenFromHistory?: boolean;
};

type BaseMessageGroupMeta = {
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  childConversationId?: string;
  participantRole?: GroupParticipantRole;
};

export type DiscussionMessageGroupMeta = BaseMessageGroupMeta & {
  kind?: 'discussion';
  mode: DiscussionGroupMode;
  round: number;
};

export type WorkflowMessageGroupMeta = BaseMessageGroupMeta & {
  kind: 'workflow';
  template: WorkflowGroupTemplate;
  stage: WorkflowGroupStage;
  iteration: number;
};

export type MessageGroupMeta = DiscussionMessageGroupMeta | WorkflowMessageGroupMeta;

interface IChatConversation<T, Extra> {
  createTime: number;
  modifyTime: number;
  name: string;
  desc?: string;
  id: string;
  type: T;
  extra: Extra;
  model: TProviderWithModel;
  status?: 'pending' | 'running' | 'finished' | undefined;
  /** 会话来源，默认为 contextgo / Conversation source, defaults to contextgo */
  source?: ConversationSource;
  /** Channel chat isolation ID (e.g. user:xxx, group:xxx) */
  channelChatId?: string;
  /** Durable external session this conversation belongs to, if any */
  externalSessionId?: string;
  /** Root execution run for this conversation, if any */
  rootRunId?: string;
}

export type ConversationSpaceBinding = {
  /** Logical Space identifier for long-lived ownership / 长期上下文归属的逻辑 Space ID */
  spaceId?: string;
  /** Selected mount identifier on the current device/runtime / 当前设备或运行时选中的挂载点 ID */
  mountId?: string;
  /** Physical working directory used by the agent runtime / Agent 运行时使用的物理工作目录 */
  workingDirectory?: string;
  /** Browser context asset bound to this conversation / 绑定到该会话的浏览器上下文资产 ID */
  browserContextAssetId?: string;
};

export type SpaceEngine = 'vault' | (string & {});

export type BrowserContextAssetKind = 'managed' | 'imported-profile' | 'takeover-link';

export type BrowserContextProvider = 'agent-browser';

export type BrowserContextConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked' | 'expired';

export type BrowserContextStorageMode = 'local-encrypted' | 'extension-bridge' | 'session-only';

export type BrowserContextMetadataValue = string | number | boolean | null;

export type TBrowserContextAsset = {
  id: string;
  spaceId: string;
  label: string;
  kind: BrowserContextAssetKind;
  provider: BrowserContextProvider;
  consentStatus: BrowserContextConsentStatus;
  storageMode: BrowserContextStorageMode;
  domains?: string[];
  fingerprintRef?: string;
  profileRef?: string;
  storageRef?: string;
  grantedAt?: number;
  expiresAt?: number;
  revokedAt?: number;
  lastUsedAt?: number;
  metadata?: Record<string, BrowserContextMetadataValue>;
  createTime: number;
  modifyTime: number;
};

export type TSpace = {
  id: string;
  name: string;
  engine: SpaceEngine;
  description?: string;
  members?: SpaceMember[];
  permissionsPolicy?: SpacePermissionsPolicy;
  providerRef?: SpaceProviderRef;
  isDefault?: boolean;
  archivedAt?: number;
  createTime: number;
  modifyTime: number;
};

export type SpaceMemberRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export type SpaceCapability =
  | 'content.edit'
  | 'agent.run'
  | 'memory.review'
  | 'members.manage'
  | 'context.view'
  | 'workflow.reuse';

export type SpaceProviderPermissionRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type SpaceVaultLaunchStrategy = 'obsidian-app' | 'obsidian-uri' | 'system-default';

export type SpaceVaultProviderRef = {
  kind: 'obsidian-vault';
  vaultPath: string;
  vaultName: string;
  landingNotePath?: string;
  launchStrategy?: SpaceVaultLaunchStrategy;
};

export type SpaceLegacyProviderRef = {
  engine: SpaceEngine;
  workspaceId: string;
  homeBoardId?: string;
  homeDocId?: string;
};

export type SpaceProviderRef = SpaceVaultProviderRef | SpaceLegacyProviderRef;

export type SpaceMember = {
  id: string;
  displayName: string;
  secondaryText?: string;
  avatarUrl?: string | null;
  role: SpaceMemberRole;
  status: 'active';
  createTime: number;
  modifyTime: number;
};

export type SpacePermissionsPolicy = {
  roleCapabilities?: Record<SpaceMemberRole, SpaceCapability[]>;
  durableMemoryRoles?: SpaceMemberRole[];
  criticalMemoryReviewRoles?: SpaceMemberRole[];
  providerRoleBindings?: Record<SpaceMemberRole, Record<string, SpaceProviderPermissionRole>>;
};

export type ConversationWorkspaceCompat = {
  /** @deprecated Use workingDirectory instead. Kept for compatibility during workspace terminology migration. */
  workspace?: string;
  /** @deprecated Prefer mountId or workingDirectory. Kept for compatibility with existing runtime flows. */
  customWorkspace?: boolean;
  /** Allow runtime-specific workspace bootstrap even when the workspace is user-selected. */
  nativeWorkspaceBootstrap?: boolean;
};

export type ConversationRequiredWorkspaceCompat = {
  /** @deprecated Required only for legacy conversation shapes. Use workingDirectory instead. */
  workspace: string;
  /** @deprecated Prefer mountId or workingDirectory. Kept only for compatibility with existing runtime flows. */
  customWorkspace?: boolean;
  /** Allow runtime-specific workspace bootstrap even when the workspace is user-selected. */
  nativeWorkspaceBootstrap?: boolean;
};

// Token 使用统计数据类型
export interface TokenUsageData {
  totalTokens: number;
}

export type TChatConversation =
  | IChatConversation<
      'gemini',
      ConversationSpaceBinding &
        ConversationRequiredWorkspaceCompat & {
          webSearchEngine?: 'google' | 'default'; // 搜索引擎配置
          lastTokenUsage?: TokenUsageData; // 上次的 token 使用统计
          contextFileName?: string;
          contextContent?: string;
          // 系统规则支持 / System rules support
          presetRules?: string; // 系统规则，在初始化时注入 / System rules, injected at initialization
          /** 启用的 skills 列表，用于过滤 SkillManager 加载的 skills / Enabled skills list for filtering SkillManager skills */
          enabledSkills?: string[];
          /** 启用的 hooks 列表 / Enabled hooks list */
          enabledHooks?: string[];
          /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
          presetAssistantId?: string;
          /** 是否置顶会话 / Whether this conversation is pinned */
          pinned?: boolean;
          /** 置顶时间戳（毫秒）/ Pin timestamp in milliseconds */
          pinnedAt?: number;
          /** 是否已归档会话 / Whether this conversation is archived */
          archived?: boolean;
          /** 归档时间戳（毫秒）/ Archive timestamp in milliseconds */
          archivedAt?: number;
          /** Persisted session mode for resume support / 持久化的会话模式，用于恢复 */
          sessionMode?: string;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Group child conversation metadata */
          groupMeta?: ConversationGroupMeta;
        }
    >
  | Omit<
      IChatConversation<
        'acp',
        ConversationSpaceBinding &
          ConversationWorkspaceCompat & {
            backend: AcpBackend;
            cliPath?: string;
            agentName?: string;
            customAgentId?: string; // UUID for identifying specific custom agent
            presetContext?: string; // 智能助手的预设规则/提示词 / Preset context from smart assistant
            /** 启用的 skills 列表，用于过滤 SkillManager 加载的 skills / Enabled skills list for filtering SkillManager skills */
            enabledSkills?: string[];
            /** 启用的 hooks 列表 / Enabled hooks list */
            enabledHooks?: string[];
            /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
            presetAssistantId?: string;
            /** 是否置顶会话 / Whether this conversation is pinned */
            pinned?: boolean;
            /** 置顶时间戳（毫秒）/ Pin timestamp in milliseconds */
            pinnedAt?: number;
            /** 是否已归档会话 / Whether this conversation is archived */
            archived?: boolean;
            /** 归档时间戳（毫秒）/ Archive timestamp in milliseconds */
            archivedAt?: number;
            /** ACP 后端的 session UUID，用于会话恢复 / ACP backend session UUID for session resume */
            acpSessionId?: string;
            /** ACP session 最后更新时间 / Last update time of ACP session */
            acpSessionUpdatedAt?: number;
            /** Last context usage from usage_update */
            lastTokenUsage?: TokenUsageData;
            /** Context window capacity from usage_update */
            lastContextLimit?: number;
            /** Persisted session mode for resume support / 持久化的会话模式，用于恢复 */
            sessionMode?: string;
            /** Persisted model ID for resume support / 持久化的模型 ID，用于恢复 */
            currentModelId?: string;
            /** Marks a conversation imported from an external CLI session / 标记该会话由外部 CLI session 导入 */
            externalSessionImported?: boolean;
            /** Skip the first workspace tree hydration until user explicitly requests it / 首次进入时延迟加载工作空间树 */
            deferInitialWorkspaceLoad?: boolean;
            /** Explicit marker for temporary health-check conversations */
            isHealthCheck?: boolean;
            /** Discussion group child conversation metadata */
            groupMeta?: ConversationGroupMeta;
          }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'codex',
        ConversationSpaceBinding &
          ConversationWorkspaceCompat & {
            cliPath?: string;
            sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'; // Codex sandbox permission mode
            presetContext?: string; // 智能助手的预设规则/提示词 / Preset context from smart assistant
            /** 启用的 skills 列表，用于过滤 SkillManager 加载的 skills / Enabled skills list for filtering SkillManager skills */
            enabledSkills?: string[];
            /** 启用的 hooks 列表 / Enabled hooks list */
            enabledHooks?: string[];
            /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
            presetAssistantId?: string;
            /** 是否置顶会话 / Whether this conversation is pinned */
            pinned?: boolean;
            /** 置顶时间戳（毫秒）/ Pin timestamp in milliseconds */
            pinnedAt?: number;
            /** 是否已归档会话 / Whether this conversation is archived */
            archived?: boolean;
            /** 归档时间戳（毫秒）/ Archive timestamp in milliseconds */
            archivedAt?: number;
            /** Persisted session mode for resume support / 持久化的会话模式，用于恢复 */
            sessionMode?: string;
            /** User-selected Codex model from Guid page / 用户在引导页选择的 Codex 模型 */
            codexModel?: string;
            /** Explicit marker for temporary health-check conversations */
            isHealthCheck?: boolean;
            /** Group child conversation metadata */
            groupMeta?: ConversationGroupMeta;
          }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'openclaw-gateway',
        ConversationSpaceBinding &
          ConversationWorkspaceCompat & {
            backend?: AcpBackendAll;
            agentName?: string;
            openclawAgentId?: string;
            /** Gateway configuration */
            gateway?: {
              host?: string;
              port?: number;
              token?: string;
              password?: string;
              useExternalGateway?: boolean;
              cliPath?: string;
            };
            /** Session key for resume */
            sessionKey?: string;
            /** Whether this conversation was imported from an external OpenClaw session */
            externalSessionImported?: boolean;
            /** Whether workspace hydration should be deferred on first open */
            deferInitialWorkspaceLoad?: boolean;
            /** Best-effort history reconcile metadata for imported OpenClaw sessions */
            externalHistorySync?: {
              provider?: 'openclaw-gateway';
              lastSyncedAt?: number;
              lastHistoryMessageAt?: number;
              lastSessionKey?: string;
              lastInsertedCount?: number;
            };
            /** Runtime validation snapshot used for post-switch strong checks */
            runtimeValidation?: {
              expectedSpaceId?: string;
              expectedMountId?: string;
              expectedWorkingDirectory?: string;
              expectedWorkspace?: string;
              expectedBackend?: string;
              expectedAgentName?: string;
              expectedOpenClawAgentId?: string;
              expectedCliPath?: string;
              expectedModel?: string;
              expectedIdentityHash?: string | null;
              switchedAt?: number;
            };
            /** 启用的 skills 列表 / Enabled skills list */
            enabledSkills?: string[];
            /** 启用的 hooks 列表 / Enabled hooks list */
            enabledHooks?: string[];
            /** 预设助手 ID / Preset assistant ID */
            presetAssistantId?: string;
            /** 是否置顶会话 / Whether this conversation is pinned */
            pinned?: boolean;
            /** 置顶时间戳（毫秒）/ Pin timestamp in milliseconds */
            pinnedAt?: number;
            /** 是否已归档会话 / Whether this conversation is archived */
            archived?: boolean;
            /** 归档时间戳（毫秒）/ Archive timestamp in milliseconds */
            archivedAt?: number;
            /** Explicit marker for temporary health-check conversations */
            isHealthCheck?: boolean;
            /** Group child conversation metadata */
            groupMeta?: ConversationGroupMeta;
          }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'nanobot',
        ConversationSpaceBinding &
          ConversationWorkspaceCompat & {
            /** 启用的 skills 列表 / Enabled skills list */
            enabledSkills?: string[];
            /** 启用的 hooks 列表 / Enabled hooks list */
            enabledHooks?: string[];
            /** 预设助手 ID / Preset assistant ID */
            presetAssistantId?: string;
            /** 是否置顶会话 / Whether this conversation is pinned */
            pinned?: boolean;
            /** 置顶时间戳（毫秒）/ Pin timestamp in milliseconds */
            pinnedAt?: number;
            /** 是否已归档会话 / Whether this conversation is archived */
            archived?: boolean;
            /** 归档时间戳（毫秒）/ Archive timestamp in milliseconds */
            archivedAt?: number;
            /** Explicit marker for temporary health-check conversations */
            isHealthCheck?: boolean;
            /** Group child conversation metadata */
            groupMeta?: ConversationGroupMeta;
          }
      >,
      'model'
    >
  | IChatConversation<
      'group',
      ConversationSpaceBinding &
        ConversationWorkspaceCompat & {
          participants: GroupParticipant[];
          orchestration: GroupOrchestration;
          collaboration?: GroupCollaborationConfig;
          runState?: WorkflowGroupRunState;
          /** Whether this conversation is pinned */
          pinned?: boolean;
          /** Pin timestamp in milliseconds */
          pinnedAt?: number;
          /** Whether this conversation is archived */
          archived?: boolean;
          /** Archive timestamp in milliseconds */
          archivedAt?: number;
        }
    >;

export type IChatConversationRefer = {
  'chat.history': TChatConversation[];
};

export type ModelType =
  | 'text' // 文本对话
  | 'vision' // 视觉理解
  | 'function_calling' // 工具调用
  | 'web_search' // 网络搜索
  | 'reasoning' // 推理模型
  | 'embedding' // 嵌入模型
  | 'rerank' // 重排序模型
  | 'excludeFromPrimary'; // 排除：不适合作为主力模型

export type ModelCapability = {
  type: ModelType;
  /**
   * 是否为用户手动选择，如果为true，则表示用户手动选择了该类型，否则表示用户手动禁止了该模型；如果为undefined，则表示使用默认值
   */
  isUserSelected?: boolean;
};

export interface IProvider {
  id: string;
  platform: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string[];
  /**
   * 模型能力标签列表。打了标签就是支持，没打就是不支持
   */
  capabilities?: ModelCapability[];
  /**
   * 上下文token限制，可选字段，只在明确知道时填写
   */
  contextLimit?: number;
  /**
   * 每个模型的协议覆盖配置。映射模型名称到协议字符串。
   * 仅在 platform 为 'new-api' 时使用。
   * Per-model protocol overrides. Maps model name to protocol string.
   * Only used when platform is 'new-api'.
   * e.g. { "gemini-2.5-pro": "gemini", "claude-sonnet-4": "anthropic", "gpt-4o": "openai" }
   */
  modelProtocols?: Record<string, string>;
  /**
   * AWS Bedrock specific configuration
   * Only used when platform is 'bedrock'
   */
  bedrockConfig?: {
    authMethod: 'accessKey' | 'profile';
    region: string;
    // For access key method
    accessKeyId?: string;
    secretAccessKey?: string;
    // For profile method
    profile?: string;
  };
  /**
   * 供应商启用状态，默认为 true
   * Provider enabled state, defaults to true
   */
  enabled?: boolean;
  /**
   * 各个模型的启用状态，默认全部为 true
   * Individual model enabled states, defaults to all true
   */
  modelEnabled?: Record<string, boolean>;
  /**
   * 各个模型的健康检测结果（仅用于 UI 显示，不影响启用状态）
   * Model health check results (for UI display only, does not affect enabled state)
   */
  modelHealth?: Record<
    string,
    {
      status: 'unknown' | 'healthy' | 'unhealthy';
      lastCheck?: number; // 时间戳 / timestamp
      latency?: number; // 延迟时间（毫秒）/ latency in milliseconds
      error?: string; // 错误信息 / error message
    }
  >;
}

export type TProviderWithModel = Omit<IProvider, 'model'> & {
  useModel: string;
};

// MCP Server Configuration Types
export type McpTransportType = 'stdio' | 'sse' | 'http';

export interface IMcpServerTransportStdio {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface IMcpServerTransportSSE {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportHTTP {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportStreamableHTTP {
  type: 'streamable_http';
  url: string;
  headers?: Record<string, string>;
}

export type IMcpServerTransport =
  | IMcpServerTransportStdio
  | IMcpServerTransportSSE
  | IMcpServerTransportHTTP
  | IMcpServerTransportStreamableHTTP;

export interface IMcpServer {
  id: string;
  name: string;
  description?: string;
  enabled: boolean; // 是否已安装到 CLI agents（控制 Switch 状态）
  transport: IMcpServerTransport;
  tools?: IMcpTool[];
  status?: 'connected' | 'disconnected' | 'error' | 'testing'; // 连接状态（同时表示服务可用性）
  lastConnected?: number;
  createdAt: number;
  updatedAt: number;
  originalJson: string; // 存储原始JSON配置，用于编辑时的准确显示
  /** Built-in MCP server managed by ContextGo (hide edit/delete in UI) */
  builtin?: boolean;
}

export interface IMcpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * CSS 主题配置接口 / CSS Theme configuration interface
 * 用于存储用户自定义的 CSS 皮肤 / Used to store user-defined CSS skins
 */
export interface ICssTheme {
  id: string; // 唯一标识 / Unique identifier
  name: string; // 主题名称 / Theme name
  cover?: string; // 封面图片 base64 或 URL / Cover image base64 or URL
  css: string; // CSS 样式代码 / CSS style code
  isPreset?: boolean; // 是否为预设主题 / Whether it's a preset theme
  createdAt: number; // 创建时间 / Creation time
  updatedAt: number; // 更新时间 / Update time
}
