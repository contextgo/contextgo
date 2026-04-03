/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConfirmation } from '@/common/chat/chatLib';
import { bridge } from '@office-ai/platform';
import type { OpenDialogOptions } from 'electron';
import type { McpSource } from '../../process/services/mcpServices/McpProtocol';
import type { AcpBackend, AcpBackendAll, AcpModelInfo, PresetAgentType } from '../types/acpTypes';
import type { HookInfo, HookOutputRoutingConfig } from '../types/hookTypes';
import type { ExternalSessionSummary, ImportExternalSessionParams } from '../types/externalSessions';
import type { SlashCommandItem } from '../chat/slash/types';
import type {
  BrowserContextConsentStatus,
  BrowserContextStorageMode,
  IMcpServer,
  IProvider,
  TChatConversation,
  TSpace,
  TBrowserContextAsset,
  TProviderWithModel,
  ICssTheme,
  ConversationSpaceBinding,
  ConversationWorkspaceCompat,
  ConversationGroupMeta,
  DiscussionGroupParticipant,
  DiscussionGroupParticipantType,
  GroupCollaborationConfig,
  GroupOrchestration,
  GroupParticipantRole,
  WorkflowGroupRunState,
  SpaceMember,
  SpacePermissionsPolicy,
} from '../config/storage';
import type { PreviewHistoryTarget, PreviewSnapshotInfo } from '../types/preview';
import type { CloudAuthProviderId, CloudStatus } from '../types/cloud';
import type {
  UpdateCheckRequest,
  UpdateCheckResult,
  UpdateDownloadProgressEvent,
  UpdateDownloadRequest,
  UpdateDownloadResult,
  AutoUpdateStatus,
} from '../update/updateTypes';
import type { ProtocolDetectionRequest, ProtocolDetectionResponse } from '../utils/protocolDetector';
import type {
  ClipboardCollectResult,
  ClipboardConnectorConfig,
  ClipboardConnectorRuntimeStatus,
  ClipboardConnectorSnapshot,
  ClipboardDailySummary,
  ClipboardStoredEvent,
} from '../types/connectors/clipboard';
import type { FeishuConnectorConfig, FeishuConnectorRuntimeStatus } from '../types/connectors/feishu';
import type {
  GoogleDriveAuthRequest,
  GoogleDriveAuthResult,
  GoogleDriveConnectorConfig,
  GoogleDriveConnectorRuntimeStatus,
  GoogleDriveFile,
  GoogleDriveStoredFile,
  GoogleDriveSyncResult,
} from '../types/connectors/googleDrive';
import type {
  GoogleDoc,
  GoogleDocsConnectorConfig,
  GoogleDocsConnectorRuntimeStatus,
  GoogleDocsStoredDocument,
  GoogleDocsSyncResult,
} from '../types/connectors/googleDocs';
import type {
  GoogleSheet,
  GoogleSheetsConnectorConfig,
  GoogleSheetsConnectorRuntimeStatus,
  GoogleSheetsStoredSpreadsheet,
  GoogleSheetsSyncResult,
} from '../types/connectors/googleSheets';
import type {
  GmailConnectorConfig,
  GmailConnectorRuntimeStatus,
  GmailMessage,
  GmailStoredMessage,
  GmailSyncResult,
} from '../types/connectors/gmail';
import type {
  GoogleCalendarConnectorConfig,
  GoogleCalendarConnectorRuntimeStatus,
  GoogleCalendarEntry,
  GoogleCalendarStoredEntry,
  GoogleCalendarSyncResult,
} from '../types/connectors/googleCalendar';

export const shell = {
  openFile: bridge.buildProvider<void, string>('open-file'), // 使用系统默认程序打开文件
  showItemInFolder: bridge.buildProvider<void, string>('show-item-in-folder'), // 打开文件夹
  openExternal: bridge.buildProvider<void, string>('open-external'), // 使用系统默认程序打开外部链接
  revealPath: bridge.buildProvider<{ resolvedPath: string; exists: boolean }, string>('reveal-path'), // 定位文件或目录
};

export const space = {
  list: bridge.buildProvider<TSpace[], void>('space.list'),
  get: bridge.buildProvider<TSpace | undefined, { id: string }>('space.get'),
  ensureDefault: bridge.buildProvider<TSpace, void>('space.ensure-default'),
  create: bridge.buildProvider<TSpace, { name: string; description?: string }>('space.create'),
  update: bridge.buildProvider<
    TSpace | undefined,
    { id: string; updates: Partial<Pick<TSpace, 'name' | 'description' | 'members' | 'permissionsPolicy'>> }
  >('space.update'),
  getContext: bridge.buildProvider<
    { memories: IContextMemoryView[]; profiles: IContextProfileView[] },
    { spaceId: string }
  >('space.get-context'),
};

//通用会话能力
export const conversation = {
  create: bridge.buildProvider<TChatConversation, ICreateConversationParams>('create-conversation'), // 创建对话
  createWithConversation: bridge.buildProvider<
    TChatConversation,
    {
      conversation: TChatConversation;
      sourceConversationId?: string;
      migrateCron?: boolean;
      sourceWorkspace?: string;
    }
  >('create-conversation-with-conversation'), // Create new conversation from history (supports migration) / 通过历史会话创建新对话（支持迁移）
  get: bridge.buildProvider<TChatConversation, { id: string }>('get-conversation'), // 获取对话信息
  getAssociateConversation: bridge.buildProvider<TChatConversation[], { conversation_id: string }>(
    'get-associated-conversation'
  ), // 获取关联对话
  remove: bridge.buildProvider<boolean, { id: string }>('remove-conversation'), // 删除对话
  update: bridge.buildProvider<boolean, { id: string; updates: Partial<TChatConversation>; mergeExtra?: boolean }>(
    'update-conversation'
  ), // 更新对话信息
  reset: bridge.buildProvider<void, IResetConversationParams>('reset-conversation'), // 重置对话
  warmup: bridge.buildProvider<void, { conversation_id: string }>('conversation.warmup'), // 预热对话 bootstrap
  stop: bridge.buildProvider<IBridgeResponse<{}>, { conversation_id: string }>('chat.stop.stream'), // 停止会话
  sendMessage: bridge.buildProvider<IBridgeResponse<{}>, ISendMessageParams>('chat.send.message'), // 发送消息（统一接口）
  getSlashCommands: bridge.buildProvider<
    IBridgeResponse<{ commands: SlashCommandItem[] }>,
    { conversation_id: string }
  >('conversation.get-slash-commands'),
  confirmMessage: bridge.buildProvider<IBridgeResponse, IConfirmMessageParams>('conversation.confirm.message'), // 通用确认消息
  responseStream: bridge.buildEmitter<IResponseMessage>('chat.response.stream'), // 接收消息（统一接口）
  turnCompleted: bridge.buildEmitter<IConversationTurnCompletedEvent>('conversation.turn.completed'),
  listChanged: bridge.buildEmitter<IConversationListChangedEvent>('conversation.list-changed'),
  getWorkspace: bridge.buildProvider<
    IDirOrFile[],
    {
      conversation_id: string;
      /** @deprecated Use workingDirectory. The bridge channel name is kept for compatibility. */
      workspace: string;
      workingDirectory?: string;
      path: string;
      search?: string;
    }
  >('conversation.get-workspace'),
  responseSearchWorkSpace: bridge.buildProvider<void, { file: number; dir: number; match?: IDirOrFile }>(
    'conversation.response.search.workspace'
  ),
  reloadContext: bridge.buildProvider<IBridgeResponse, { conversation_id: string }>('conversation.reload-context'),
  listMemoryCandidates: bridge.buildProvider<
    IBridgeResponse<{ candidates: IContextMemoryCandidateView[] }>,
    { conversation_id?: string; spaceId?: string; state?: string; reviewStatus?: string }
  >('conversation.list-memory-candidates'),
  reviewMemoryCandidate: bridge.buildProvider<
    IBridgeResponse<{ candidate?: IContextMemoryCandidateView }>,
    { candidateId: string; action: 'approve' | 'reject'; reviewerId?: string }
  >('conversation.review-memory-candidate'),
  promoteMemoryCandidate: bridge.buildProvider<
    IBridgeResponse<{ candidate?: IContextMemoryCandidateView }>,
    { candidateId: string; destination: 'document' | 'board'; reviewerId?: string }
  >('conversation.promote-memory-candidate'),
  confirmation: {
    add: bridge.buildEmitter<IConfirmation<any> & { conversation_id: string }>('confirmation.add'),
    update: bridge.buildEmitter<IConfirmation<any> & { conversation_id: string }>('confirmation.update'),
    confirm: bridge.buildProvider<
      IBridgeResponse,
      { conversation_id: string; msg_id: string; data: any; callId: string }
    >('confirmation.confirm'),
    list: bridge.buildProvider<IConfirmation<any>[], { conversation_id: string }>('confirmation.list'),
    remove: bridge.buildEmitter<{ conversation_id: string; id: string }>('confirmation.remove'),
  },
  // Session-level approval memory for "always allow" decisions
  // 会话级别的权限记忆，用于 "always allow" 决策
  approval: {
    // Check if action is approved (keys are parsed from action+commandType in backend)
    // 检查操作是否已批准（keys 由后端从 action+commandType 解析）
    check: bridge.buildProvider<boolean, { conversation_id: string; action: string; commandType?: string }>(
      'approval.check'
    ),
  },
};

// Gemini对话相关接口 - 复用统一的conversation接口
export const geminiConversation = {
  sendMessage: conversation.sendMessage,
  confirmMessage: bridge.buildProvider<IBridgeResponse, IConfirmMessageParams>('input.confirm.message'),
  responseStream: conversation.responseStream,
};

// CDP status interface
export interface ICdpStatus {
  /** Whether CDP is currently enabled */
  enabled: boolean;
  /** Current CDP port (null if disabled or not started) */
  port: number | null;
  /** Whether CDP was enabled at startup (requires restart to change) */
  startupEnabled: boolean;
  /** All active CDP instances from registry */
  instances: Array<{
    pid: number;
    port: number;
    cwd: string;
    startTime: number;
  }>;
  /** Whether CDP is enabled in the persisted config file (may differ from runtime) */
  configEnabled: boolean;
  /** Whether the app is running in development mode */
  isDevMode: boolean;
}

// CDP config interface
export interface ICdpConfig {
  /** Whether CDP is enabled */
  enabled?: boolean;
  /** Preferred port number */
  port?: number;
}

export const application = {
  restart: bridge.buildProvider<void, void>('restart-app'), // 重启应用
  openDevTools: bridge.buildProvider<boolean, void>('open-dev-tools'), // 打开/关闭开发者工具，返回操作后的状态
  isDevToolsOpened: bridge.buildProvider<boolean, void>('is-dev-tools-opened'), // 获取 DevTools 当前状态
  reportRendererError: bridge.buildProvider<
    void,
    {
      type: 'error' | 'unhandledrejection' | 'react-error-boundary';
      message: string;
      stack?: string;
      href?: string;
      timestamp?: string;
    }
  >('app.report-renderer-error'), // 上报 renderer 未捕获异常到主进程日志
  systemInfo: bridge.buildProvider<
    { cacheDir: string; workDir: string; logDir: string; platform: string; arch: string },
    void
  >('system.info'), // 获取系统信息
  getPath: bridge.buildProvider<string, { name: 'desktop' | 'home' | 'downloads' }>('app.get-path'), // 获取系统路径
  updateSystemInfo: bridge.buildProvider<IBridgeResponse, { cacheDir: string; workDir: string }>('system.update-info'), // 更新系统信息
  getZoomFactor: bridge.buildProvider<number, void>('app.get-zoom-factor'),
  setZoomFactor: bridge.buildProvider<number, { factor: number }>('app.set-zoom-factor'),
  // CDP (Chrome DevTools Protocol) management
  getCdpStatus: bridge.buildProvider<IBridgeResponse<ICdpStatus>, void>('app.get-cdp-status'), // 获取 CDP 状态
  updateCdpConfig: bridge.buildProvider<IBridgeResponse<ICdpConfig>, Partial<ICdpConfig>>('app.update-cdp-config'), // 更新 CDP 配置
  // Bridge Main Process logs to Renderer F12 Console
  logStream: bridge.buildEmitter<{ level: 'log' | 'warn' | 'error'; tag: string; message: string; data?: unknown }>(
    'app.log-stream'
  ),
  // DevTools state change notification
  devToolsStateChanged: bridge.buildEmitter<{ isOpen: boolean }>('app.devtools-state-changed'),
};

export const cloud = {
  getStatus: bridge.buildProvider<IBridgeResponse<CloudStatus>, void>('cloud.get-status'),
  startLogin: bridge.buildProvider<IBridgeResponse<CloudStatus>, { provider: CloudAuthProviderId }>(
    'cloud.start-login'
  ),
  ensureOfficialRemoteReady: bridge.buildProvider<IBridgeResponse<CloudStatus>, void>(
    'cloud.ensure-official-remote-ready'
  ),
  openInfermesh: bridge.buildProvider<IBridgeResponse<CloudStatus>, void>('cloud.open-infermesh'),
  logout: bridge.buildProvider<IBridgeResponse<CloudStatus>, void>('cloud.logout'),
  statusChanged: bridge.buildEmitter<CloudStatus>('cloud.status-changed'),
};

export interface ICreateBrowserContextAssetParams {
  spaceId: string;
  label: string;
  kind: TBrowserContextAsset['kind'];
  consentStatus?: BrowserContextConsentStatus;
  storageMode?: BrowserContextStorageMode;
  domains?: string[];
  fingerprintRef?: string;
  profileRef?: string;
  storageRef?: string;
  grantedAt?: number;
  expiresAt?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface IUpdateBrowserContextConsentParams {
  id: string;
  consentStatus: BrowserContextConsentStatus;
  grantedAt?: number;
  expiresAt?: number;
}

export interface IUpdateBrowserContextAssetParams {
  id: string;
  label?: string;
  domains?: string[];
  fingerprintRef?: string;
  profileRef?: string;
  storageRef?: string;
  expiresAt?: number;
  lastUsedAt?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export const clipboardConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<ClipboardConnectorConfig>, void>('clipboard-connector.get-config'),
  setConfig: bridge.buildProvider<
    IBridgeResponse<ClipboardConnectorConfig>,
    { config: Partial<ClipboardConnectorConfig> }
  >('clipboard-connector.set-config'),
  getStatus: bridge.buildProvider<IBridgeResponse<ClipboardConnectorRuntimeStatus>, void>(
    'clipboard-connector.get-status'
  ),
  start: bridge.buildProvider<IBridgeResponse<ClipboardConnectorRuntimeStatus>, void>('clipboard-connector.start'),
  stop: bridge.buildProvider<IBridgeResponse<ClipboardConnectorRuntimeStatus>, void>('clipboard-connector.stop'),
  sampleNow: bridge.buildProvider<IBridgeResponse<ClipboardConnectorSnapshot | null>, void>(
    'clipboard-connector.sample-now'
  ),
  statusChanged: bridge.buildEmitter<ClipboardConnectorRuntimeStatus>('clipboard-connector.status-changed'),
  listRecentEvents: bridge.buildProvider<IBridgeResponse<ClipboardStoredEvent[]>, { limit?: number }>(
    'clipboard-connector.list-recent-events'
  ),
  listSummaries: bridge.buildProvider<IBridgeResponse<ClipboardDailySummary[]>, { limit?: number }>(
    'clipboard-connector.list-summaries'
  ),
  collectNow: bridge.buildProvider<IBridgeResponse<ClipboardCollectResult>, { summaryDate?: string }>(
    'clipboard-connector.collect-now'
  ),
};

export const feishuConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<FeishuConnectorConfig>, void>('feishu-connector.get-config'),
  setConfig: bridge.buildProvider<IBridgeResponse<FeishuConnectorConfig>, { config: Partial<FeishuConnectorConfig> }>(
    'feishu-connector.set-config'
  ),
  getStatus: bridge.buildProvider<IBridgeResponse<FeishuConnectorRuntimeStatus>, void>('feishu-connector.get-status'),
  start: bridge.buildProvider<IBridgeResponse<FeishuConnectorRuntimeStatus>, void>('feishu-connector.start'),
  stop: bridge.buildProvider<IBridgeResponse<FeishuConnectorRuntimeStatus>, void>('feishu-connector.stop'),
  statusChanged: bridge.buildEmitter<FeishuConnectorRuntimeStatus>('feishu-connector.status-changed'),
};

export const googleSheetsConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<GoogleSheetsConnectorConfig>, void>(
    'google-sheets-connector.get-config'
  ),
  setConfig: bridge.buildProvider<
    IBridgeResponse<GoogleSheetsConnectorConfig>,
    { config: Partial<GoogleSheetsConnectorConfig> }
  >('google-sheets-connector.set-config'),
  getStatus: bridge.buildProvider<IBridgeResponse<GoogleSheetsConnectorRuntimeStatus>, void>(
    'google-sheets-connector.get-status'
  ),
  start: bridge.buildProvider<IBridgeResponse<GoogleSheetsConnectorRuntimeStatus>, void>(
    'google-sheets-connector.start'
  ),
  stop: bridge.buildProvider<IBridgeResponse<GoogleSheetsConnectorRuntimeStatus>, void>('google-sheets-connector.stop'),
  listSheets: bridge.buildProvider<IBridgeResponse<GoogleSheet[]>, { limit?: number }>(
    'google-sheets-connector.list-sheets'
  ),
  syncNow: bridge.buildProvider<IBridgeResponse<GoogleSheetsSyncResult>, { limit?: number }>(
    'google-sheets-connector.sync-now'
  ),
  listStoredSheets: bridge.buildProvider<IBridgeResponse<GoogleSheetsStoredSpreadsheet[]>, { limit?: number }>(
    'google-sheets-connector.list-stored-sheets'
  ),
  statusChanged: bridge.buildEmitter<GoogleSheetsConnectorRuntimeStatus>('google-sheets-connector.status-changed'),
};

export const gmailConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<GmailConnectorConfig>, void>('gmail-connector.get-config'),
  setConfig: bridge.buildProvider<IBridgeResponse<GmailConnectorConfig>, { config: Partial<GmailConnectorConfig> }>(
    'gmail-connector.set-config'
  ),
  getStatus: bridge.buildProvider<IBridgeResponse<GmailConnectorRuntimeStatus>, void>('gmail-connector.get-status'),
  start: bridge.buildProvider<IBridgeResponse<GmailConnectorRuntimeStatus>, void>('gmail-connector.start'),
  stop: bridge.buildProvider<IBridgeResponse<GmailConnectorRuntimeStatus>, void>('gmail-connector.stop'),
  listMessages: bridge.buildProvider<IBridgeResponse<GmailMessage[]>, { limit?: number }>(
    'gmail-connector.list-messages'
  ),
  syncNow: bridge.buildProvider<IBridgeResponse<GmailSyncResult>, { limit?: number }>('gmail-connector.sync-now'),
  listStoredMessages: bridge.buildProvider<IBridgeResponse<GmailStoredMessage[]>, { limit?: number }>(
    'gmail-connector.list-stored-messages'
  ),
  statusChanged: bridge.buildEmitter<GmailConnectorRuntimeStatus>('gmail-connector.status-changed'),
};

export const googleCalendarConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<GoogleCalendarConnectorConfig>, void>(
    'google-calendar-connector.get-config'
  ),
  setConfig: bridge.buildProvider<
    IBridgeResponse<GoogleCalendarConnectorConfig>,
    { config: Partial<GoogleCalendarConnectorConfig> }
  >('google-calendar-connector.set-config'),
  getStatus: bridge.buildProvider<IBridgeResponse<GoogleCalendarConnectorRuntimeStatus>, void>(
    'google-calendar-connector.get-status'
  ),
  start: bridge.buildProvider<IBridgeResponse<GoogleCalendarConnectorRuntimeStatus>, void>(
    'google-calendar-connector.start'
  ),
  stop: bridge.buildProvider<IBridgeResponse<GoogleCalendarConnectorRuntimeStatus>, void>(
    'google-calendar-connector.stop'
  ),
  listCalendars: bridge.buildProvider<IBridgeResponse<GoogleCalendarEntry[]>, void>(
    'google-calendar-connector.list-calendars'
  ),
  syncNow: bridge.buildProvider<IBridgeResponse<GoogleCalendarSyncResult>, void>('google-calendar-connector.sync-now'),
  listStoredCalendars: bridge.buildProvider<IBridgeResponse<GoogleCalendarStoredEntry[]>, { limit?: number }>(
    'google-calendar-connector.list-stored-calendars'
  ),
  statusChanged: bridge.buildEmitter<GoogleCalendarConnectorRuntimeStatus>('google-calendar-connector.status-changed'),
};

export const googleDocsConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<GoogleDocsConnectorConfig>, void>('google-docs-connector.get-config'),
  setConfig: bridge.buildProvider<
    IBridgeResponse<GoogleDocsConnectorConfig>,
    { config: Partial<GoogleDocsConnectorConfig> }
  >('google-docs-connector.set-config'),
  getStatus: bridge.buildProvider<IBridgeResponse<GoogleDocsConnectorRuntimeStatus>, void>(
    'google-docs-connector.get-status'
  ),
  start: bridge.buildProvider<IBridgeResponse<GoogleDocsConnectorRuntimeStatus>, void>('google-docs-connector.start'),
  stop: bridge.buildProvider<IBridgeResponse<GoogleDocsConnectorRuntimeStatus>, void>('google-docs-connector.stop'),
  listDocs: bridge.buildProvider<IBridgeResponse<GoogleDoc[]>, { limit?: number }>('google-docs-connector.list-docs'),
  syncNow: bridge.buildProvider<IBridgeResponse<GoogleDocsSyncResult>, { limit?: number }>(
    'google-docs-connector.sync-now'
  ),
  listStoredDocs: bridge.buildProvider<IBridgeResponse<GoogleDocsStoredDocument[]>, { limit?: number }>(
    'google-docs-connector.list-stored-docs'
  ),
  statusChanged: bridge.buildEmitter<GoogleDocsConnectorRuntimeStatus>('google-docs-connector.status-changed'),
};

export const googleDriveConnector = {
  getConfig: bridge.buildProvider<IBridgeResponse<GoogleDriveConnectorConfig>, void>(
    'google-drive-connector.get-config'
  ),
  setConfig: bridge.buildProvider<
    IBridgeResponse<GoogleDriveConnectorConfig>,
    { config: Partial<GoogleDriveConnectorConfig> }
  >('google-drive-connector.set-config'),
  getStatus: bridge.buildProvider<IBridgeResponse<GoogleDriveConnectorRuntimeStatus>, void>(
    'google-drive-connector.get-status'
  ),
  start: bridge.buildProvider<IBridgeResponse<GoogleDriveConnectorRuntimeStatus>, void>('google-drive-connector.start'),
  stop: bridge.buildProvider<IBridgeResponse<GoogleDriveConnectorRuntimeStatus>, void>('google-drive-connector.stop'),
  statusChanged: bridge.buildEmitter<GoogleDriveConnectorRuntimeStatus>('google-drive-connector.status-changed'),
  createAuthRequest: bridge.buildProvider<IBridgeResponse<GoogleDriveAuthRequest>, void>(
    'google-drive-connector.create-auth-request'
  ),
  completeAuth: bridge.buildProvider<
    IBridgeResponse<GoogleDriveAuthResult>,
    { callbackUrl?: string; code?: string; state?: string }
  >('google-drive-connector.complete-auth'),
  listFiles: bridge.buildProvider<IBridgeResponse<GoogleDriveFile[]>, { limit?: number }>(
    'google-drive-connector.list-files'
  ),
  syncNow: bridge.buildProvider<IBridgeResponse<GoogleDriveSyncResult>, { limit?: number }>(
    'google-drive-connector.sync-now'
  ),
  listStoredFiles: bridge.buildProvider<IBridgeResponse<GoogleDriveStoredFile[]>, { limit?: number }>(
    'google-drive-connector.list-stored-files'
  ),
};

export const browserContext = {
  listBySpace: bridge.buildProvider<
    IBridgeResponse<TBrowserContextAsset[]>,
    { spaceId: string; includeRevoked?: boolean }
  >('browser-context.list-by-space'),
  get: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, { id: string }>('browser-context.get'),
  create: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, ICreateBrowserContextAssetParams>(
    'browser-context.create'
  ),
  update: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, IUpdateBrowserContextAssetParams>(
    'browser-context.update'
  ),
  updateConsent: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, IUpdateBrowserContextConsentParams>(
    'browser-context.update-consent'
  ),
  revoke: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, { id: string }>('browser-context.revoke'),
  assertBindable: bridge.buildProvider<IBridgeResponse<TBrowserContextAsset>, { id: string; spaceId: string }>(
    'browser-context.assert-bindable'
  ),
};

// Manual (opt-in) updates via GitHub Releases
export const update = {
  /** Ask the renderer to open the update UI (e.g. from app menu). */
  open: bridge.buildEmitter<{ source?: 'menu' | 'about' }>('update.open'),
  /** Check GitHub releases and return latest version info. */
  check: bridge.buildProvider<IBridgeResponse<UpdateCheckResult>, UpdateCheckRequest>('update.check'),
  /** Download a chosen release asset (explicit user action). */
  download: bridge.buildProvider<IBridgeResponse<UpdateDownloadResult>, UpdateDownloadRequest>('update.download'),
  /** Download progress events emitted by main process. */
  downloadProgress: bridge.buildEmitter<UpdateDownloadProgressEvent>('update.download.progress'),
};

// Auto-updater (electron-updater) API
export const autoUpdate = {
  /** Check for updates using electron-updater */
  check: bridge.buildProvider<
    IBridgeResponse<{ updateInfo?: { version: string; releaseDate?: string; releaseNotes?: string } }>,
    { includePrerelease?: boolean }
  >('auto-update.check'),
  /** Download update using electron-updater */
  download: bridge.buildProvider<IBridgeResponse, void>('auto-update.download'),
  /** Quit and install the downloaded update */
  quitAndInstall: bridge.buildProvider<void, void>('auto-update.quit-and-install'),
  /** Auto-update status events */
  status: bridge.buildEmitter<AutoUpdateStatus>('auto-update.status'),
};

export const starOffice = {
  detectUrl: bridge.buildProvider<
    IBridgeResponse<{ url: string | null }>,
    { preferredUrl?: string; force?: boolean; timeoutMs?: number }
  >('star-office.detect-url'),
};

export const dialog = {
  showOpen: bridge.buildProvider<
    string[] | undefined,
    | { defaultPath?: string; properties?: OpenDialogOptions['properties']; filters?: OpenDialogOptions['filters'] }
    | undefined
  >('show-open'), // 打开文件/文件夹选择窗口
};
export const fs = {
  getFilesByDir: bridge.buildProvider<Array<IDirOrFile>, { dir: string; root: string }>('get-file-by-dir'), // 获取指定文件夹下所有文件夹和文件列表
  getImageBase64: bridge.buildProvider<string, { path: string }>('get-image-base64'), // 获取图片base64
  fetchRemoteImage: bridge.buildProvider<string, { url: string }>('fetch-remote-image'), // 远程图片转base64
  readFile: bridge.buildProvider<string, { path: string }>('read-file'), // 读取文件内容（UTF-8）
  readFileBuffer: bridge.buildProvider<ArrayBuffer, { path: string }>('read-file-buffer'), // 读取二进制文件为 ArrayBuffer
  getGitRepositoryInfo: bridge.buildProvider<
    IBridgeResponse<IGitRepositoryInfo>,
    {
      path: string;
    }
  >('get-git-repository-info'),
  createTempFile: bridge.buildProvider<string, { fileName: string }>('create-temp-file'), // 创建临时文件
  writeFile: bridge.buildProvider<boolean, { path: string; data: Uint8Array | string }>('write-file'), // 写入文件
  createZip: bridge.buildProvider<
    boolean,
    {
      path: string;
      requestId?: string;
      files: Array<{
        /** Path inside zip (supports nested paths like "topic-1/workspace/a.txt") */
        name: string;
        /** Text or binary content to write into zip */
        content?: string | Uint8Array;
        /** Absolute file path on disk, zip bridge will read and pack it */
        sourcePath?: string;
      }>;
    }
  >('create-zip-file'), // 创建 zip 文件
  cancelZip: bridge.buildProvider<boolean, { requestId: string }>('cancel-zip-file'), // 取消 zip 创建任务
  getFileMetadata: bridge.buildProvider<IFileMetadata, { path: string }>('get-file-metadata'), // 获取文件元数据
  copyFilesToWorkspace: bridge.buildProvider<
    // 返回成功与部分失败的详细状态，便于前端提示用户 / Return details for successful and failed copies for better UI feedback
    IBridgeResponse<{ copiedFiles: string[]; failedFiles?: Array<{ path: string; error: string }> }>,
    { filePaths: string[]; workspace: string; sourceRoot?: string }
  >('copy-files-to-workspace'), // 复制文件到工作空间 (Copy files into workspace)
  removeEntry: bridge.buildProvider<IBridgeResponse, { path: string }>('remove-entry'), // 删除文件或文件夹
  renameEntry: bridge.buildProvider<IBridgeResponse<{ newPath: string }>, { path: string; newName: string }>(
    'rename-entry'
  ), // 重命名文件或文件夹
  readBuiltinRule: bridge.buildProvider<string, { fileName: string }>('read-builtin-rule'), // 读取内置 rules 文件
  readBuiltinSkill: bridge.buildProvider<string, { fileName: string }>('read-builtin-skill'), // 读取内置 skills 文件
  // 助手规则文件操作 / Assistant rule file operations
  readAssistantRule: bridge.buildProvider<string, { assistantId: string; locale?: string }>('read-assistant-rule'), // 读取助手规则文件
  writeAssistantRule: bridge.buildProvider<boolean, { assistantId: string; content: string; locale?: string }>(
    'write-assistant-rule'
  ), // 写入助手规则文件
  deleteAssistantRule: bridge.buildProvider<boolean, { assistantId: string }>('delete-assistant-rule'), // 删除助手规则文件
  // 助手技能文件操作 / Assistant skill file operations
  readAssistantSkill: bridge.buildProvider<string, { assistantId: string; locale?: string }>('read-assistant-skill'), // 读取助手技能文件
  writeAssistantSkill: bridge.buildProvider<boolean, { assistantId: string; content: string; locale?: string }>(
    'write-assistant-skill'
  ), // 写入助手技能文件
  deleteAssistantSkill: bridge.buildProvider<boolean, { assistantId: string }>('delete-assistant-skill'), // 删除助手技能文件
  // 获取可用 skills 列表 / List available skills from skills directory
  listAvailableSkills: bridge.buildProvider<
    Array<{ name: string; description: string; location: string; isCustom: boolean }>,
    void
  >('list-available-skills'),
  // 获取可用 hooks 列表 / List available hooks from hooks directory
  listAvailableHooks: bridge.buildProvider<HookInfo[], void>('list-available-hooks'),
  // 符号链接方式导入 hook / Import hook via symlink
  importHookWithSymlink: bridge.buildProvider<IBridgeResponse<{ hookName: string }>, { hookPath: string }>(
    'import-hook-with-symlink'
  ),
  // 安装内置 hook 到用户目录 / Install builtin hook into user hooks directory
  installBuiltinHook: bridge.buildProvider<IBridgeResponse<{ hookName: string }>, { hookName: string }>(
    'install-builtin-hook'
  ),
  // 删除自定义 hook / Delete custom hook
  deleteHook: bridge.buildProvider<IBridgeResponse, { hookName: string }>('delete-hook'),
  // 获取 hook 存储路径 / Get hook storage paths
  getHookPaths: bridge.buildProvider<{ userHooksDir: string }, void>('get-hook-paths'),
  // 更新 hook 输出路由配置 / Update hook output routing settings
  updateHookManifest: bridge.buildProvider<
    IBridgeResponse<{ hookName: string }>,
    { hookName: string; config: HookOutputRoutingConfig }
  >('update-hook-manifest'),
  // 读取 skill 信息（不导入）/ Read skill info without importing
  readSkillInfo: bridge.buildProvider<IBridgeResponse<{ name: string; description: string }>, { skillPath: string }>(
    'read-skill-info'
  ),
  // 导入 skill 目录 / Import skill directory
  importSkill: bridge.buildProvider<IBridgeResponse<{ skillName: string }>, { skillPath: string }>('import-skill'),
  // 扫描目录下的 skills / Scan directory for skills
  scanForSkills: bridge.buildProvider<
    IBridgeResponse<Array<{ name: string; description: string; path: string }>>,
    { folderPath: string }
  >('scan-for-skills'),
  // 检测常见的 skills 路径 / Detect common skills paths
  detectCommonSkillPaths: bridge.buildProvider<IBridgeResponse<Array<{ name: string; path: string }>>, void>(
    'detect-common-skill-paths'
  ),
  // 检测外部 skills 并统计数量（用于 Skills Hub）/ Detect external skills with counts (for Skills Hub)
  detectAndCountExternalSkills: bridge.buildProvider<
    IBridgeResponse<
      Array<{
        name: string;
        path: string;
        source: string;
        skills: Array<{ name: string; description: string; path: string }>;
      }>
    >,
    void
  >('detect-and-count-external-skills'),
  // 符号链接方式导入 skill / Import skill via symlink
  importSkillWithSymlink: bridge.buildProvider<IBridgeResponse<{ skillName: string }>, { skillPath: string }>(
    'import-skill-with-symlink'
  ),
  // 删除自定义 skill / Delete custom skill
  deleteSkill: bridge.buildProvider<IBridgeResponse, { skillName: string }>('delete-skill'),
  // 获取技能存储路径 / Get skill storage paths
  getSkillPaths: bridge.buildProvider<{ userSkillsDir: string; builtinSkillsDir: string }, void>('get-skill-paths'),
  // 将 skill 同步导出到外部目录 / Export skill to external directory via symlink
  exportSkillWithSymlink: bridge.buildProvider<IBridgeResponse, { skillPath: string; targetDir: string }>(
    'export-skill-with-symlink'
  ),
  // 自定义外部技能路径管理 / Custom external skill paths management
  getCustomExternalPaths: bridge.buildProvider<Array<{ name: string; path: string }>, void>(
    'get-custom-external-paths'
  ),
  addCustomExternalPath: bridge.buildProvider<IBridgeResponse, { name: string; path: string }>(
    'add-custom-external-path'
  ),
  removeCustomExternalPath: bridge.buildProvider<IBridgeResponse, { path: string }>('remove-custom-external-path'),
  // Skill Market: remote catalog search and package install
  searchSkillMarket: bridge.buildProvider<
    IBridgeResponse<{
      brandName: string;
      view: 'curated' | 'full';
      defaultView: 'curated' | 'full';
      items: Array<{
        id: string;
        name: string;
        displayName: string;
        version: string;
        author: string;
        description: string;
        categories: string[];
        tags: string[];
        themes: string[];
        industries: string[];
        primaryCapability?: string;
        selectionReason?: string;
        homepage?: string;
        readmeUrl?: string;
        archives: Array<{ source: string; relativePath: string; label?: string }>;
        popularity: number;
        qualityScore: number;
        installs: number;
        stars: number;
      }>;
      total: number;
      totalAvailable: number;
      siteUrl: string;
      pageSize: number;
      featuredCount: number;
      categories: string[];
      sources: Record<string, number>;
      stats: {
        total: number;
        categories: string[];
        sources: Record<string, number>;
        sourceTotal: number;
        reducedCount: number;
        reductionRatio: number;
        clusterCount: number;
        topIndustries: Array<{ id: string; label: string; count: number }>;
        topCapabilities: Array<{ label: string; count: number }>;
        generatedAt?: string;
      };
      industryIndex: Array<{
        id: string;
        label: string;
        summary: string;
        problems: string[];
        useCases: string[];
        outcomes: string[];
        workflow: string[];
        count: number;
        topThemes: string[];
        bundleIds: string[];
        recommendedSkills: Array<{
          id: string;
          name: string;
          displayName: string;
          version: string;
          author: string;
          description: string;
          categories: string[];
          tags: string[];
          themes: string[];
          industries: string[];
          primaryCapability?: string;
          selectionReason?: string;
          homepage?: string;
          readmeUrl?: string;
          archives: Array<{ source: string; relativePath: string; label?: string }>;
          popularity: number;
          qualityScore: number;
          installs: number;
          stars: number;
        }>;
      }>;
      bundles: Array<{
        id: string;
        title: string;
        summary: string;
        industries: string[];
        forTeams: string;
        deliverables: string[];
        valuePoints: string[];
        steps: Array<{
          label: string;
          themes: string[];
          skillIds: string[];
          skills: Array<{
            id: string;
            name: string;
            displayName: string;
            version: string;
            author: string;
            description: string;
            categories: string[];
            tags: string[];
            themes: string[];
            industries: string[];
            primaryCapability?: string;
            selectionReason?: string;
            homepage?: string;
            readmeUrl?: string;
            archives: Array<{ source: string; relativePath: string; label?: string }>;
            popularity: number;
            qualityScore: number;
            installs: number;
            stars: number;
          }>;
        }>;
        skills: Array<{
          id: string;
          name: string;
          displayName: string;
          version: string;
          author: string;
          description: string;
          categories: string[];
          tags: string[];
          themes: string[];
          industries: string[];
          primaryCapability?: string;
          selectionReason?: string;
          homepage?: string;
          readmeUrl?: string;
          archives: Array<{ source: string; relativePath: string; label?: string }>;
          popularity: number;
          qualityScore: number;
          installs: number;
          stars: number;
        }>;
      }>;
    }>,
    {
      query?: string;
      limit?: number;
      offset?: number;
      forceRefresh?: boolean;
      view?: 'curated' | 'full';
      industryId?: string;
    }
  >('search-skill-market'),
  installSkillMarketSkill: bridge.buildProvider<
    IBridgeResponse<{ skillName: string; installedPath: string; archiveUrl: string }>,
    { skillId: string; archive?: { source: string; relativePath: string; label?: string } }
  >('install-skill-market-skill'),
  // Skills Market: inject/remove the bundled builtin skill
  enableSkillsMarket: bridge.buildProvider<IBridgeResponse, void>('enable-skills-market'),
  disableSkillsMarket: bridge.buildProvider<IBridgeResponse, void>('disable-skills-market'),
};

export const fileWatch = {
  startWatch: bridge.buildProvider<IBridgeResponse, { filePath: string }>('file-watch-start'), // 开始监听文件变化
  stopWatch: bridge.buildProvider<IBridgeResponse, { filePath: string }>('file-watch-stop'), // 停止监听文件变化
  stopAllWatches: bridge.buildProvider<IBridgeResponse, void>('file-watch-stop-all'), // 停止所有文件监听
  fileChanged: bridge.buildEmitter<{ filePath: string; eventType: string }>('file-changed'), // 文件变化事件
};

// 文件流式更新（Agent 写入文件时实时推送内容）/ File streaming updates (real-time content push when agent writes)
export const fileStream = {
  contentUpdate: bridge.buildEmitter<{
    filePath: string; // 文件绝对路径 / Absolute file path
    content: string; // 新内容 / New content
    workspace: string; // 工作空间根目录 / Workspace root directory
    relativePath: string; // 相对路径 / Relative path
    operation: 'write' | 'delete'; // 操作类型 / Operation type
  }>('file-stream-content-update'), // Agent 写入文件时的流式内容更新 / Streaming content update when agent writes file
};

export const googleAuth = {
  login: bridge.buildProvider<IBridgeResponse<{ account: string }>, { proxy?: string }>('google.auth.login'),
  logout: bridge.buildProvider<void, {}>('google.auth.logout'),
  status: bridge.buildProvider<IBridgeResponse<{ account: string }>, { proxy?: string }>('google.auth.status'),
};

// 订阅状态查询：用于动态决定是否展示 gemini-3.1-pro-preview / subscription check for Gemini models
export const gemini = {
  subscriptionStatus: bridge.buildProvider<
    IBridgeResponse<{ isSubscriber: boolean; tier?: string; lastChecked: number; message?: string }>,
    { proxy?: string }
  >('gemini.subscription-status'),
};

// AWS Bedrock 相关接口 / AWS Bedrock interfaces
export const bedrock = {
  testConnection: bridge.buildProvider<
    IBridgeResponse<{ msg?: string }>,
    {
      bedrockConfig: {
        authMethod: 'accessKey' | 'profile';
        region: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        profile?: string;
      };
    }
  >('bedrock.test-connection'),
};

export const mode = {
  fetchModelList: bridge.buildProvider<
    IBridgeResponse<{ mode: Array<string | { id: string; name: string }>; fix_base_url?: string }>,
    {
      base_url?: string;
      api_key: string;
      try_fix?: boolean;
      platform?: string;
      bedrockConfig?: {
        authMethod: 'accessKey' | 'profile';
        region: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        profile?: string;
      };
    }
  >('mode.get-model-list'),
  saveModelConfig: bridge.buildProvider<IBridgeResponse, IProvider[]>('mode.save-model-config'),
  getModelConfig: bridge.buildProvider<IProvider[], void>('mode.get-model-config'),
  /** 协议检测接口 - 自动检测 API 端点使用的协议类型 / Protocol detection - auto-detect API protocol type */
  detectProtocol: bridge.buildProvider<IBridgeResponse<ProtocolDetectionResponse>, ProtocolDetectionRequest>(
    'mode.detect-protocol'
  ),
};

// ACP对话相关接口 - 复用统一的conversation接口
export const acpConversation = {
  sendMessage: conversation.sendMessage,
  responseStream: conversation.responseStream,
  detectCliPath: bridge.buildProvider<IBridgeResponse<{ path?: string }>, { backend: AcpBackend }>(
    'acp.detect-cli-path'
  ),
  getAvailableAgents: bridge.buildProvider<
    IBridgeResponse<
      Array<{
        backend: AcpBackend;
        name: string;
        cliPath?: string;
        resolvedCliPath?: string;
        customAgentId?: string;
        openclawAgentId?: string;
        isDefault?: boolean;
        isPreset?: boolean;
        context?: string;
        avatar?: string;
        workspace?: string;
        runtimeSource?: 'builtin' | 'detected' | 'configured';
        // Allow extension-contributed adapter IDs in addition to built-in PresetAgentType values
        presetAgentType?: PresetAgentType | string;
        supportedTransports?: string[];
        isExtension?: boolean;
        extensionName?: string;
      }>
    >,
    void
  >('acp.get-available-agents'),
  listExternalSessions: bridge.buildProvider<
    IBridgeResponse<{ sessions: ExternalSessionSummary[] }>,
    { forceRefresh?: boolean }
  >('acp.list-external-sessions'),
  importExternalSession: bridge.buildProvider<
    IBridgeResponse<{ conversation: TChatConversation }>,
    ImportExternalSessionParams
  >('acp.import-external-session'),
  checkEnv: bridge.buildProvider<{ env: Record<string, string> }, void>('acp.check.env'),
  refreshCustomAgents: bridge.buildProvider<IBridgeResponse, void>('acp.refresh-custom-agents'),
  refreshDetectedAgents: bridge.buildProvider<IBridgeResponse, void>('acp.refresh-detected-agents'),
  installManagedRuntime: bridge.buildProvider<
    IBridgeResponse<{ backend: AcpBackend; command: string; stdout?: string; stderr?: string }>,
    { backend: AcpBackend }
  >('acp.install-managed-runtime'),
  getManagedRuntimeConfigLocation: bridge.buildProvider<
    IBridgeResponse<{ backend: AcpBackend; configPath: string; exists: boolean } | null>,
    { backend: AcpBackend }
  >('acp.get-managed-runtime-config-location'),
  checkAgentHealth: bridge.buildProvider<
    IBridgeResponse<{ available: boolean; latency?: number; error?: string }>,
    { backend: AcpBackend }
  >('acp.check-agent-health'),
  // Set session mode for ACP agents (claude, qwen, etc.)
  // 设置 ACP 代理的会话模式（claude、qwen 等）
  setMode: bridge.buildProvider<IBridgeResponse<{ mode: string }>, { conversationId: string; mode: string }>(
    'acp.set-mode'
  ),
  // Get current session mode for ACP agents
  // 获取 ACP 代理的当前会话模式
  getMode: bridge.buildProvider<IBridgeResponse<{ mode: string; initialized: boolean }>, { conversationId: string }>(
    'acp.get-mode'
  ),
  // Get model info for ACP agents (model name and available models)
  // 获取 ACP 代理的模型信息（模型名称和可用模型）
  getModelInfo: bridge.buildProvider<IBridgeResponse<{ modelInfo: AcpModelInfo | null }>, { conversationId: string }>(
    'acp.get-model-info'
  ),
  // Probe model info for an ACP backend without creating a visible conversation
  // 预探测 ACP 后端的模型信息，不创建可见会话
  probeModelInfo: bridge.buildProvider<IBridgeResponse<{ modelInfo: AcpModelInfo | null }>, { backend: AcpBackend }>(
    'acp.probe-model-info'
  ),
  // Set model for ACP agents
  // 设置 ACP 代理的模型
  setModel: bridge.buildProvider<
    IBridgeResponse<{ modelInfo: AcpModelInfo | null }>,
    { conversationId: string; modelId: string }
  >('acp.set-model'),
  // Get non-model config options for ACP agents (e.g., reasoning effort)
  // 获取 ACP 代理的非模型配置选项（如推理级别）
  getConfigOptions: bridge.buildProvider<
    IBridgeResponse<{ configOptions: import('../types/acpTypes').AcpSessionConfigOption[] }>,
    { conversationId: string }
  >('acp.get-config-options'),
  // Set a config option value for ACP agents (e.g., reasoning effort)
  // 设置 ACP 代理的配置选项值（如推理级别）
  setConfigOption: bridge.buildProvider<
    IBridgeResponse<{ configOptions: import('../types/acpTypes').AcpSessionConfigOption[] }>,
    { conversationId: string; configId: string; value: string }
  >('acp.set-config-option'),
};

// MCP 服务相关接口
export const mcpService = {
  getAgentMcpConfigs: bridge.buildProvider<
    IBridgeResponse<Array<{ source: McpSource; servers: IMcpServer[] }>>,
    Array<{ backend: AcpBackend; name: string; cliPath?: string }>
  >('mcp.get-agent-configs'),
  testMcpConnection: bridge.buildProvider<
    IBridgeResponse<{
      success: boolean;
      tools?: Array<{ name: string; description?: string }>;
      error?: string;
      needsAuth?: boolean;
      authMethod?: 'oauth' | 'basic';
      wwwAuthenticate?: string;
    }>,
    IMcpServer
  >('mcp.test-connection'),
  syncMcpToAgents: bridge.buildProvider<
    IBridgeResponse<{ success: boolean; results: Array<{ agent: string; success: boolean; error?: string }> }>,
    { mcpServers: IMcpServer[]; agents: Array<{ backend: AcpBackend; name: string; cliPath?: string }> }
  >('mcp.sync-to-agents'),
  removeMcpFromAgents: bridge.buildProvider<
    IBridgeResponse<{ success: boolean; results: Array<{ agent: string; success: boolean; error?: string }> }>,
    { mcpServerName: string; agents: Array<{ backend: AcpBackend; name: string; cliPath?: string }> }
  >('mcp.remove-from-agents'),
  // OAuth 相关接口
  checkOAuthStatus: bridge.buildProvider<
    IBridgeResponse<{ isAuthenticated: boolean; needsLogin: boolean; error?: string }>,
    IMcpServer
  >('mcp.check-oauth-status'),
  loginMcpOAuth: bridge.buildProvider<
    IBridgeResponse<{ success: boolean; error?: string }>,
    { server: IMcpServer; config?: any }
  >('mcp.login-oauth'),
  logoutMcpOAuth: bridge.buildProvider<IBridgeResponse, string>('mcp.logout-oauth'),
  getAuthenticatedServers: bridge.buildProvider<IBridgeResponse<string[]>, void>('mcp.get-authenticated-servers'),
};

// Codex 对话相关接口 - 复用统一的conversation接口
export const codexConversation = {
  sendMessage: conversation.sendMessage,
  responseStream: conversation.responseStream,
};

// OpenClaw 对话相关接口 - 复用统一的conversation接口
export const openclawConversation = {
  sendMessage: conversation.sendMessage,
  responseStream: bridge.buildEmitter<IResponseMessage>('openclaw.response.stream'),
  getModelInfo: bridge.buildProvider<IBridgeResponse<{ modelInfo: AcpModelInfo | null }>, { conversation_id: string }>(
    'openclaw.get-model-info'
  ),
  setModel: bridge.buildProvider<
    IBridgeResponse<{ modelInfo: AcpModelInfo | null }>,
    { conversation_id: string; modelId: string }
  >('openclaw.set-model'),
  getRuntime: bridge.buildProvider<
    IBridgeResponse<{
      conversationId: string;
      runtime: {
        workspace?: string;
        backend?: string;
        agentName?: string;
        openclawAgentId?: string;
        cliPath?: string;
        modelProvider?: string | null;
        model?: string;
        sessionKey?: string | null;
        isConnected?: boolean;
        hasActiveSession?: boolean;
        identityHash?: string | null;
      };
      expected?: {
        expectedWorkspace?: string;
        expectedBackend?: string;
        expectedAgentName?: string;
        expectedOpenClawAgentId?: string;
        expectedCliPath?: string;
        expectedModel?: string;
        expectedIdentityHash?: string | null;
        switchedAt?: number;
      };
    }>,
    { conversation_id: string }
  >('openclaw.get-runtime'),
};

// Database operations
export const database = {
  getConversationMessages: bridge.buildProvider<
    import('@/common/chat/chatLib').TMessage[],
    { conversation_id: string; page?: number; pageSize?: number }
  >('database.get-conversation-messages'),
  getUserConversations: bridge.buildProvider<
    import('@/common/config/storage').TChatConversation[],
    { page?: number; pageSize?: number }
  >('database.get-user-conversations'),
  searchConversationMessages: bridge.buildProvider<
    import('../types/database').IMessageSearchResponse,
    { keyword: string; page?: number; pageSize?: number }
  >('database.search-conversation-messages'),
};

export const previewHistory = {
  list: bridge.buildProvider<PreviewSnapshotInfo[], { target: PreviewHistoryTarget }>('preview-history.list'),
  save: bridge.buildProvider<PreviewSnapshotInfo, { target: PreviewHistoryTarget; content: string }>(
    'preview-history.save'
  ),
  getContent: bridge.buildProvider<
    { snapshot: PreviewSnapshotInfo; content: string } | null,
    { target: PreviewHistoryTarget; snapshotId: string }
  >('preview-history.get-content'),
};

// 预览面板相关接口 / Preview panel API
export const preview = {
  // Agent 触发打开预览（如 chrome-devtools 导航到 URL）/ Agent triggers open preview (e.g., chrome-devtools navigates to URL)
  open: bridge.buildEmitter<{
    content: string; // URL 或内容 / URL or content
    contentType: import('../types/preview').PreviewContentType; // 内容类型 / Content type
    metadata?: {
      title?: string;
      fileName?: string;
    };
  }>('preview.open'),
};

export const document = {
  convert: bridge.buildProvider<
    import('../types/conversion').DocumentConversionResponse,
    import('../types/conversion').DocumentConversionRequest
  >('document.convert'),
};

// Deep link protocol handling / 深度链接协议处理
export const deepLink = {
  /** Emitted when app is opened via contextgo:// protocol URL */
  received: bridge.buildEmitter<{
    action: string; // e.g. 'add-provider'
    params: Record<string, string>; // parsed query params
  }>('deep-link.received'),
};

// 窗口控制相关接口 / Window controls API
export const windowControls = {
  minimize: bridge.buildProvider<void, void>('window-controls:minimize'),
  maximize: bridge.buildProvider<void, void>('window-controls:maximize'),
  unmaximize: bridge.buildProvider<void, void>('window-controls:unmaximize'),
  close: bridge.buildProvider<void, void>('window-controls:close'),
  isMaximized: bridge.buildProvider<boolean, void>('window-controls:is-maximized'),
  isFullScreen: bridge.buildProvider<boolean, void>('window-controls:is-full-screen'),
  maximizedChanged: bridge.buildEmitter<{ isMaximized: boolean }>('window-controls:maximized-changed'),
  fullScreenChanged: bridge.buildEmitter<{ isFullScreen: boolean }>('window-controls:full-screen-changed'),
};

// 系统设置接口 / System settings API
export const systemSettings = {
  getCloseToTray: bridge.buildProvider<boolean, void>('system-settings:get-close-to-tray'),
  setCloseToTray: bridge.buildProvider<void, { enabled: boolean }>('system-settings:set-close-to-tray'),
  getNotificationEnabled: bridge.buildProvider<boolean, void>('system-settings:get-notification-enabled'),
  setNotificationEnabled: bridge.buildProvider<void, { enabled: boolean }>('system-settings:set-notification-enabled'),
  getCronNotificationEnabled: bridge.buildProvider<boolean, void>('system-settings:get-cron-notification-enabled'),
  setCronNotificationEnabled: bridge.buildProvider<void, { enabled: boolean }>(
    'system-settings:set-cron-notification-enabled'
  ),
  changeLanguage: bridge.buildProvider<void, { language: string }>('system-settings:change-language'),
  // Broadcast language change to all renderers (desktop + WebUI) for real-time sync
  languageChanged: bridge.buildEmitter<{ language: string }>('system-settings:language-changed'),
};

export const voiceInput = {
  getConfig: bridge.buildProvider<import('../types/voiceInput').VoiceInputConfig, void>('voice-input:get-config'),
  setConfig: bridge.buildProvider<
    import('../types/voiceInput').VoiceInputConfig,
    { config: import('../types/voiceInput').VoiceInputConfig }
  >('voice-input:set-config'),
  getState: bridge.buildProvider<import('../types/voiceInput').VoiceInputState, void>('voice-input:get-state'),
  getStats: bridge.buildProvider<import('../types/voiceInput').VoiceInputStats, void>('voice-input:get-stats'),
  getExternalOptions: bridge.buildProvider<import('../types/voiceInput').VoiceInputExternalOption[], void>(
    'voice-input:get-external-options'
  ),
  requestPermissions: bridge.buildProvider<import('../types/voiceInput').VoiceInputPermissions, void>(
    'voice-input:request-permissions'
  ),
  startManualCapture: bridge.buildProvider<void, void>('voice-input:start-manual-capture'),
  stopManualCapture: bridge.buildProvider<void, void>('voice-input:stop-manual-capture'),
  getOpenWhisperState: bridge.buildProvider<import('../types/voiceInput').VoiceInputOpenWhisperState, void>(
    'voice-input:get-open-whisper-state'
  ),
  installOpenWhisperRuntime: bridge.buildProvider<import('../types/voiceInput').VoiceInputOpenWhisperState, void>(
    'voice-input:install-open-whisper-runtime'
  ),
  installOpenWhisperModel: bridge.buildProvider<
    import('../types/voiceInput').VoiceInputOpenWhisperState,
    { modelId?: import('../types/voiceInput').VoiceInputOpenWhisperModelId }
  >('voice-input:install-open-whisper-model'),
  listRecords: bridge.buildProvider<import('../types/voiceInput').VoiceInputRecord[], { limit?: number }>(
    'voice-input:list-records'
  ),
  stateChanged: bridge.buildEmitter<import('../types/voiceInput').VoiceInputState>('voice-input:state-changed'),
};

// 系统通知接口 / System notification API
export type INotificationOptions = {
  title: string;
  body: string;
  icon?: string;
  conversationId?: string;
};

export const notification = {
  show: bridge.buildProvider<void, INotificationOptions>('notification.show'),
  clicked: bridge.buildEmitter<{ conversationId?: string }>('notification.clicked'),
};

// 任务管理接口 / Task management API
export const task = {
  stopAll: bridge.buildProvider<{ success: boolean; count: number }, void>('task.stop-all'),
  getRunningCount: bridge.buildProvider<{ success: boolean; count: number }, void>('task.get-running-count'),
};

// WebUI 服务管理接口 / WebUI service management API
export interface IWebUIStatus {
  running: boolean;
  port: number;
  allowRemote: boolean;
  localUrl: string;
  networkUrl?: string;
  lanIP?: string; // 局域网 IP，用于构建远程访问 URL / LAN IP for building remote access URL
  adminUsername: string;
  initialPassword?: string;
  localAccessEnabled: boolean;
  localAccessAllowRemote: boolean;
}

export const webui = {
  // 获取 WebUI 状态 / Get WebUI status
  getStatus: bridge.buildProvider<IBridgeResponse<IWebUIStatus>, void>('webui.get-status'),
  // 更新本地访问偏好 / Update local access preferences
  updatePreferences: bridge.buildProvider<IBridgeResponse<IWebUIStatus>, { allowRemote?: boolean; port?: number }>(
    'webui.update-preferences'
  ),
  // 启动 WebUI / Start WebUI
  start: bridge.buildProvider<
    IBridgeResponse<{ port: number; localUrl: string; networkUrl?: string; lanIP?: string; initialPassword?: string }>,
    { port?: number; allowRemote?: boolean }
  >('webui.start'),
  // 停止 WebUI / Stop WebUI
  stop: bridge.buildProvider<IBridgeResponse, void>('webui.stop'),
  // 修改密码（不需要当前密码）/ Change password (no current password required)
  changePassword: bridge.buildProvider<IBridgeResponse, { newPassword: string }>('webui.change-password'),
  changeUsername: bridge.buildProvider<IBridgeResponse<{ username: string }>, { newUsername: string }>(
    'webui.change-username'
  ),
  // 重置密码（生成新随机密码）/ Reset password (generate new random password)
  resetPassword: bridge.buildProvider<IBridgeResponse<{ newPassword: string }>, void>('webui.reset-password'),
  // 生成二维码登录 token / Generate QR login token
  generateQRToken: bridge.buildProvider<IBridgeResponse<{ token: string; expiresAt: number; qrUrl: string }>, void>(
    'webui.generate-qr-token'
  ),
  // 验证二维码 token / Verify QR token
  verifyQRToken: bridge.buildProvider<IBridgeResponse<{ sessionToken: string; username: string }>, { qrToken: string }>(
    'webui.verify-qr-token'
  ),
  // 状态变更事件 / Status changed event
  statusChanged: bridge.buildEmitter<{ running: boolean; port?: number; localUrl?: string; networkUrl?: string }>(
    'webui.status-changed'
  ),
  // 密码重置结果事件（绕过 provider 返回值问题）/ Password reset result event (workaround for provider return value issue)
  resetPasswordResult: bridge.buildEmitter<{ success: boolean; newPassword?: string; msg?: string }>(
    'webui.reset-password-result'
  ),
};

// Cron job management API / 定时任务管理接口
export const cron = {
  // Query
  listJobs: bridge.buildProvider<ICronJob[], void>('cron.list-jobs'),
  listJobsByConversation: bridge.buildProvider<ICronJob[], { conversationId: string }>(
    'cron.list-jobs-by-conversation'
  ),
  getJob: bridge.buildProvider<ICronJob | null, { jobId: string }>('cron.get-job'),
  // CRUD
  addJob: bridge.buildProvider<ICronJob, ICreateCronJobParams>('cron.add-job'),
  updateJob: bridge.buildProvider<ICronJob, { jobId: string; updates: Partial<ICronJob> }>('cron.update-job'),
  removeJob: bridge.buildProvider<void, { jobId: string }>('cron.remove-job'),
  // Events
  onJobCreated: bridge.buildEmitter<ICronJob>('cron.job-created'),
  onJobUpdated: bridge.buildEmitter<ICronJob>('cron.job-updated'),
  onJobRemoved: bridge.buildEmitter<{ jobId: string }>('cron.job-removed'),
  onJobExecuted: bridge.buildEmitter<{ jobId: string; status: 'ok' | 'error' | 'skipped' | 'missed'; error?: string }>(
    'cron.job-executed'
  ),
};

// Cron job types for IPC
export type ICronSchedule =
  | { kind: 'at'; atMs: number; description: string }
  | { kind: 'every'; everyMs: number; description: string }
  | { kind: 'cron'; expr: string; tz?: string; description: string };

export interface ICronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: ICronSchedule;
  target: { payload: { kind: 'message'; text: string } };
  metadata: {
    conversationId: string;
    conversationTitle?: string;
    workspacePath?: string;
    agentType: AcpBackendAll;
    createdBy: 'user' | 'agent';
    createdAt: number;
    updatedAt: number;
  };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: 'ok' | 'error' | 'skipped' | 'missed';
    lastError?: string;
    runCount: number;
    retryCount: number;
    maxRetries: number;
  };
}

export interface ICreateCronJobParams {
  name: string;
  schedule: ICronSchedule;
  message: string;
  conversationId: string;
  conversationTitle?: string;
  workspacePath?: string;
  agentType: AcpBackendAll;
  createdBy: 'user' | 'agent';
}

interface ISendMessageParams {
  input: string;
  msg_id: string;
  conversation_id: string;
  files?: string[];
  loading_id?: string;
  /** Skill names to inject into the message (used by agents with file-reading ability) */
  injectSkills?: string[];
}

// Unified confirm message params for all agents (Gemini, ACP, Codex)
export interface IConfirmMessageParams {
  confirmKey: string;
  msg_id: string;
  conversation_id: string;
  callId: string;
}

export type NonGroupConversationType = 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'nanobot';
export type ConversationType = NonGroupConversationType | 'group';

export interface ICreateConversationExtra {
  /** Logical Space identifier for long-lived ownership / 长期上下文归属的逻辑 Space ID */
  spaceId?: ConversationSpaceBinding['spaceId'];
  /** Selected mount identifier on the current device/runtime / 当前设备或运行时选中的挂载点 ID */
  mountId?: ConversationSpaceBinding['mountId'];
  /** Physical working directory used by the agent runtime / Agent 运行时使用的物理工作目录 */
  workingDirectory?: ConversationSpaceBinding['workingDirectory'];
  /** @deprecated Use workingDirectory instead. Kept for compatibility during workspace terminology migration. */
  workspace?: ConversationWorkspaceCompat['workspace'];
  /** @deprecated Prefer mountId or workingDirectory. Kept for compatibility with existing runtime flows. */
  customWorkspace?: ConversationWorkspaceCompat['customWorkspace'];
  defaultFiles?: string[];
  backend?: AcpBackendAll;
  cliPath?: string;
  webSearchEngine?: 'google' | 'default';
  agentName?: string;
  customAgentId?: string;
  openclawAgentId?: string;
  context?: string;
  contextFileName?: string; // For gemini preset agents
  // System rules for smart assistants
  presetRules?: string; // system rules injected at initialization
  /** Enabled skills list for filtering SkillManager skills */
  enabledSkills?: string[];
  /** Enabled hooks list for future HookRuntime or native projection */
  enabledHooks?: string[];
  /**
   * Preset context/rules to inject into the first message.
   * Used by smart assistants to provide custom prompts/rules.
   * For Gemini: injected via contextContent
   * For ACP/Codex: injected via <system_instruction> tag in first message
   */
  presetContext?: string;
  /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
  presetAssistantId?: string;
  /** Initial session mode selected on Guid page (from AgentModeSelector) */
  sessionMode?: string;
  /** User-selected Codex model from Guid page */
  codexModel?: string;
  /** Pre-selected ACP model from Guid page (cached model list) */
  currentModelId?: string;
  /** ACP session UUID for restoring an externally created session */
  acpSessionId?: string;
  /** Last external ACP session update timestamp */
  acpSessionUpdatedAt?: number;
  /** OpenClaw session key for restoring an externally created session */
  sessionKey?: string;
  /** Whether this conversation was imported from an external CLI session */
  externalSessionImported?: boolean;
  /** Whether workspace hydration should be deferred on first open */
  deferInitialWorkspaceLoad?: boolean;
  /** Runtime validation snapshot used for post-switch strong checks (OpenClaw) */
  runtimeValidation?: {
    /** Logical Space expected by the runtime binding */
    expectedSpaceId?: string;
    /** Device-local Mount expected by the runtime binding */
    expectedMountId?: string;
    /** Physical working directory expected by the runtime */
    expectedWorkingDirectory?: string;
    /** @deprecated Use expectedWorkingDirectory instead. */
    expectedWorkspace?: string;
    expectedBackend?: string;
    expectedAgentName?: string;
    expectedOpenClawAgentId?: string;
    expectedCliPath?: string;
    expectedModel?: string;
    expectedIdentityHash?: string | null;
    switchedAt?: number;
  };
  /** Explicit marker for temporary health-check conversations */
  isHealthCheck?: boolean;
  /** Group child conversation metadata */
  groupMeta?: ConversationGroupMeta;
  /** Group participants */
  participants?: Array<IGroupParticipantCreateParams | DiscussionGroupParticipant>;
  /** Group orchestration */
  orchestration?: GroupOrchestration;
  /** Group collaboration mode + execution boundary */
  collaboration?: GroupCollaborationConfig;
  /** Workflow runtime state for long-running group runs */
  runState?: WorkflowGroupRunState;
}

export interface ICreateConversationParams {
  type: ConversationType;
  id?: string;
  name?: string;
  model: TProviderWithModel;
  extra: ICreateConversationExtra;
}

export type IAssistantConversationCreateParams = ICreateConversationParams & {
  type: NonGroupConversationType;
};

export interface IGroupParticipantCreateParams {
  id: string;
  participantType: DiscussionGroupParticipantType;
  participantKey: string;
  /** @deprecated Kept for backward compatibility with older preset-based discussion groups */
  assistantId?: string;
  name: string;
  avatar?: string;
  description?: string;
  role?: GroupParticipantRole;
  conversation: IAssistantConversationCreateParams;
}

export type IDiscussionGroupParticipantCreateParams = IGroupParticipantCreateParams;

export type IGroupConversationCreateParams = ICreateConversationParams & {
  type: 'group';
  extra: ICreateConversationExtra & {
    participants: IGroupParticipantCreateParams[];
  };
};

export type IDiscussionGroupCreateParams = IGroupConversationCreateParams;
interface IResetConversationParams {
  id?: string;
  gemini?: {
    clearCachedCredentialFile?: boolean;
  };
}

// 获取文件夹或文件列表
export interface IDirOrFile {
  name: string;
  fullPath: string;
  relativePath: string;
  isDir: boolean;
  isFile: boolean;
  children?: Array<IDirOrFile>;
}

export interface IGitRepositoryInfo {
  isRepository: boolean;
  repositoryRoot?: string;
  branch?: string | null;
  gitDir?: string | null;
  remoteUrl?: string | null;
}

// 文件元数据接口
export interface IFileMetadata {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
  isDirectory?: boolean;
}

export interface IResponseMessage {
  type: string;
  data: unknown;
  msg_id: string;
  conversation_id: string;
}

export interface IContextMemoryCandidateView {
  id: string;
  spaceId: string;
  threadId?: string;
  kind: string;
  tier: string;
  summary: string;
  detail?: string;
  confidence: number;
  priority: string;
  destination: string;
  state: string;
  reviewStatus: string;
  promotionScore: number;
  promotionRationale: readonly string[];
  promotedMemoryId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IContextMemoryView {
  id: string;
  spaceId: string;
  kind: string;
  tier: string;
  summary: string;
  detail?: string;
  confidence: number;
  priority: string;
  state: string;
  updatedAt: string;
}

export interface IContextProfileView {
  id: string;
  spaceId: string;
  key: string;
  summary: string;
  confidence: number;
  state: string;
  updatedAt: string;
}

export interface IConversationTurnCompletedEvent {
  sessionId: string;
  status: 'pending' | 'running' | 'finished';
  state:
    | 'ai_generating'
    | 'ai_waiting_input'
    | 'ai_waiting_confirmation'
    | 'initializing'
    | 'stopped'
    | 'error'
    | 'unknown';
  detail: string;
  canSendMessage: boolean;
  runtime: {
    hasTask: boolean;
    taskStatus?: 'pending' | 'running' | 'finished';
    isProcessing: boolean;
    pendingConfirmations: number;
    dbStatus?: 'pending' | 'running' | 'finished';
  };
  workspace: string;
  model: {
    platform: string;
    name: string;
    useModel: string;
  };
  lastMessage: {
    id?: string;
    type?: string;
    content: unknown;
    status?: string | null;
    createdAt: number;
  };
}

export interface IConversationListChangedEvent {
  conversationId: string;
  action: 'created' | 'updated' | 'deleted';
  source?: string;
}
interface IBridgeResponse<D = {}> {
  success: boolean;
  data?: D;
  msg?: string;
}

// ==================== Extensions API ====================

export interface IExtensionInfo {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  source: string;
  directory: string;
  /** Whether the extension is currently enabled */
  enabled: boolean;
  /** Overall permission risk level */
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  /** Whether the extension has lifecycle hooks */
  hasLifecycle: boolean;
}

/** Permission summary for extension management UI (Figma-inspired) */
export interface IExtensionPermissionSummary {
  name: string;
  description: string;
  level: 'safe' | 'moderate' | 'dangerous';
  granted: boolean;
}

/** Settings tab contributed by an extension, consumed by settings UI */
export interface IExtensionSettingsTab {
  id: string;
  name: string;
  icon?: string;
  /** aion-asset:// local page or external https:// URL */
  entryUrl: string;
  /** Position anchor relative to a built-in or other extension tab */
  position?: { anchor: string; placement: 'before' | 'after' };
  /** Fallback numeric order when multiple tabs share the same anchor+placement. Lower = first */
  order: number;
  _extensionName: string;
}

/** WebUI contributions exposed for diagnostics/e2e validation */
export interface IExtensionWebuiContribution {
  extensionName: string;
  apiRoutes: Array<{ path: string; auth: boolean }>;
  staticAssets: Array<{ urlPrefix: string; directory: string }>;
}

export type AgentActivityState = 'idle' | 'writing' | 'researching' | 'executing' | 'syncing' | 'error';

export interface IExtensionAgentActivityEvent {
  conversationId: string;
  at: number;
  kind: 'status' | 'tool' | 'message';
  text: string;
}

export interface IExtensionAgentActivityItem {
  id: string;
  backend: string;
  agentName: string;
  state: AgentActivityState;
  runtimeStatus: 'pending' | 'running' | 'finished' | 'unknown';
  conversations: number;
  activeConversations: number;
  lastActiveAt: number;
  lastStatus?: string;
  currentTask?: string;
  recentEvents: IExtensionAgentActivityEvent[];
}

export interface IExtensionAgentActivitySnapshot {
  generatedAt: number;
  totalConversations: number;
  runningConversations: number;
  agents: IExtensionAgentActivityItem[];
}

export const extensions = {
  /** Get all extension-contributed CSS themes */
  getThemes: bridge.buildProvider<ICssTheme[], void>('extensions.get-themes'),
  /** Get summary of all loaded extensions */
  getLoadedExtensions: bridge.buildProvider<IExtensionInfo[], void>('extensions.get-loaded-extensions'),
  /** Get all extension-contributed assistants */
  getAssistants: bridge.buildProvider<Record<string, unknown>[], void>('extensions.get-assistants'),
  /** Get all extension-contributed agents (autonomous agent presets) */
  getAgents: bridge.buildProvider<Record<string, unknown>[], void>('extensions.get-agents'),
  /** Get all extension-contributed ACP adapters */
  getAcpAdapters: bridge.buildProvider<Record<string, unknown>[], void>('extensions.get-acp-adapters'),
  /** Get all extension-contributed MCP servers */
  getMcpServers: bridge.buildProvider<Record<string, unknown>[], void>('extensions.get-mcp-servers'),
  /** Get all extension-contributed skills */
  getSkills: bridge.buildProvider<Array<{ name: string; description: string; location: string }>, void>(
    'extensions.get-skills'
  ),
  /** Get all extension-contributed settings tabs */
  getSettingsTabs: bridge.buildProvider<IExtensionSettingsTab[], void>('extensions.get-settings-tabs'),
  /** Get extension-contributed webui routes/assets metadata */
  getWebuiContributions: bridge.buildProvider<IExtensionWebuiContribution[], void>(
    'extensions.get-webui-contributions'
  ),
  /** Snapshot of all agent activities, for extension settings tabs */
  getAgentActivitySnapshot: bridge.buildProvider<IExtensionAgentActivitySnapshot, void>(
    'extensions.get-agent-activity-snapshot'
  ),
  /** Get merged extension i18n translations for a specific locale (falls back to en-US) */
  getExtI18nForLocale: bridge.buildProvider<Record<string, unknown>, { locale: string }>(
    'extensions.get-ext-i18n-for-locale'
  ),

  // --- Extension Management API (NocoBase-inspired) ---
  /** Enable a disabled extension */
  enableExtension: bridge.buildProvider<IBridgeResponse, { name: string }>('extensions.enable'),
  /** Disable an extension */
  disableExtension: bridge.buildProvider<IBridgeResponse, { name: string; reason?: string }>('extensions.disable'),
  /** Get permission summary for an extension (Figma-inspired) */
  getPermissions: bridge.buildProvider<IExtensionPermissionSummary[], { name: string }>('extensions.get-permissions'),
  /** Get overall risk level for an extension */
  getRiskLevel: bridge.buildProvider<string, { name: string }>('extensions.get-risk-level'),
  /** Extension state change events (push to renderer when enable/disable happens) */
  stateChanged: bridge.buildEmitter<{ name: string; enabled: boolean; reason?: string }>('extensions.state-changed'),
};

// ==================== Channel API ====================

import type {
  IChannelActiveSessionEntry,
  IAgentProfile,
  IChannelBindingCatalog,
  IChannelBinding,
  ChannelControlMode,
  IChannelContinuationRequest,
  IChannelContinuationReleaseResult,
  IChannelContinuationResult,
  IChannelPairingRequest,
  IChannelPluginStatus,
  IChannelSession,
  IChannelUser,
  IChannelAccount,
  IConnectorInstance,
} from '@process/channels/types';

export const channel = {
  // Plugin Management
  getPluginStatus: bridge.buildProvider<IBridgeResponse<IChannelPluginStatus[]>, void>('channel.get-plugin-status'),
  enablePlugin: bridge.buildProvider<IBridgeResponse, { pluginId: string; config: Record<string, unknown> }>(
    'channel.enable-plugin'
  ),
  disablePlugin: bridge.buildProvider<IBridgeResponse, { pluginId: string }>('channel.disable-plugin'),
  testPlugin: bridge.buildProvider<
    IBridgeResponse<{ success: boolean; botUsername?: string; error?: string }>,
    { pluginId: string; token: string; extraConfig?: Record<string, string | boolean | undefined> }
  >('channel.test-plugin'),

  // Pairing Management
  getPendingPairings: bridge.buildProvider<IBridgeResponse<IChannelPairingRequest[]>, void>(
    'channel.get-pending-pairings'
  ),
  approvePairing: bridge.buildProvider<IBridgeResponse, { code: string }>('channel.approve-pairing'),
  rejectPairing: bridge.buildProvider<IBridgeResponse, { code: string }>('channel.reject-pairing'),
  authorizeRemoteUser: bridge.buildProvider<
    IBridgeResponse,
    {
      platformUserId: string;
      platformType: string;
      displayName?: string;
      chatId?: string;
      pluginId?: string;
      metadata?: Record<string, unknown>;
    }
  >('channel.authorize-remote-user'),
  startWeixinLogin: bridge.buildProvider<
    IBridgeResponse<{ accountId: string; botToken: string; baseUrl: string; scannerUserId?: string }>,
    void
  >('channel.start-weixin-login'),

  // User Management
  getAuthorizedUsers: bridge.buildProvider<IBridgeResponse<IChannelUser[]>, void>('channel.get-authorized-users'),
  revokeUser: bridge.buildProvider<IBridgeResponse, { userId: string }>('channel.revoke-user'),

  // Session Management (MVP: read-only view)
  getActiveSessions: bridge.buildProvider<IBridgeResponse<IChannelSession[]>, void>('channel.get-active-sessions'),
  getActiveSessionCatalog: bridge.buildProvider<IBridgeResponse<IChannelActiveSessionEntry[]>, void>(
    'channel.get-active-session-catalog'
  ),

  // Channel Account Management
  getChannelAccounts: bridge.buildProvider<IBridgeResponse<IChannelAccount[]>, void>('channel.get-channel-accounts'),
  createChannelAccount: bridge.buildProvider<
    IBridgeResponse<{ id: string }>,
    { platform: IChannelAccount['platform']; name: string }
  >('channel.create-channel-account'),
  upsertChannelAccount: bridge.buildProvider<IBridgeResponse, { channelAccount: IChannelAccount }>(
    'channel.upsert-channel-account'
  ),
  deleteChannelAccount: bridge.buildProvider<IBridgeResponse, { channelAccountId: string }>(
    'channel.delete-channel-account'
  ),
  // Deprecated compatibility aliases
  getConnectorInstances: bridge.buildProvider<IBridgeResponse<IConnectorInstance[]>, void>(
    'channel.get-connector-instances'
  ),
  upsertConnectorInstance: bridge.buildProvider<IBridgeResponse, { connector: IConnectorInstance }>(
    'channel.upsert-connector-instance'
  ),
  deleteConnectorInstance: bridge.buildProvider<IBridgeResponse, { connectorId: string }>(
    'channel.delete-connector-instance'
  ),

  // Binding Management
  getBindingCatalog: bridge.buildProvider<
    IBridgeResponse<IChannelBindingCatalog>,
    { channelAccountId?: string; connectorId?: string }
  >('channel.get-binding-catalog'),
  getBindings: bridge.buildProvider<
    IBridgeResponse<IChannelBinding[]>,
    { channelAccountId?: string; connectorId?: string } | void
  >('channel.get-bindings'),
  upsertBinding: bridge.buildProvider<IBridgeResponse, { binding: IChannelBinding }>('channel.upsert-binding'),
  deleteBinding: bridge.buildProvider<IBridgeResponse, { bindingId: string }>('channel.delete-binding'),
  prepareConversationPublication: bridge.buildProvider<IBridgeResponse<IAgentProfile>, { conversationId: string }>(
    'channel.prepare-conversation-publication'
  ),
  // Deprecated compatibility alias
  prepareConversationAgentProfile: bridge.buildProvider<IBridgeResponse<IAgentProfile>, { conversationId: string }>(
    'channel.prepare-conversation-agent-profile'
  ),
  continuationSession: bridge.buildProvider<IBridgeResponse<IChannelContinuationResult>, IChannelContinuationRequest>(
    'channel.continuation-session'
  ),
  endContinuationSession: bridge.buildProvider<
    IBridgeResponse<IChannelContinuationReleaseResult>,
    { targetExternalSessionId: string }
  >('channel.end-continuation-session'),
  setContinuationControlMode: bridge.buildProvider<
    IBridgeResponse<IChannelContinuationReleaseResult>,
    { targetExternalSessionId: string; controlMode: ChannelControlMode }
  >('channel.set-continuation-control-mode'),

  // Events
  pairingRequested: bridge.buildEmitter<IChannelPairingRequest>('channel.pairing-requested'),
  pluginStatusChanged: bridge.buildEmitter<{ pluginId: string; status: IChannelPluginStatus }>(
    'channel.plugin-status-changed'
  ),
  userAuthorized: bridge.buildEmitter<IChannelUser>('channel.user-authorized'),
  weixinLoginQr: bridge.buildEmitter<{ qrcodeUrl: string }>('channel.weixin-login-qr'),
  weixinLoginScanned: bridge.buildEmitter<Record<string, never>>('channel.weixin-login-scanned'),
};
