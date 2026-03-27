/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenClawAgent, type OpenClawAgentConfig } from '@process/agent/openclaw';
import type { OpenClawSessionSummary } from '@process/agent/openclaw/types';
import { channelEventBus } from '@process/channels/agent/ChannelEventBus';
import { ipcBridge } from '@/common';
import type { IConfirmation, TMessage } from '@/common/chat/chatLib';
import { transformMessage } from '@/common/chat/chatLib';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { IProvider } from '@/common/config/storage';
import type { AcpModelInfo } from '@/common/types/acpTypes';
import { uuid } from '@/common/utils';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import { createHash } from 'node:crypto';
import { getDatabase } from '@process/services/database';
import { addMessage, addOrUpdateMessage } from '@process/utils/message';
import { cronBusyGuard } from '@process/services/cron/CronBusyGuard';
import { ProcessConfig } from '@process/utils/initStorage';
import BaseAgentManager from '@process/task/BaseAgentManager';
import { IpcAgentEventEmitter } from '@process/task/IpcAgentEventEmitter';

const OPENCLAW_HISTORY_SYNC_LIMIT = 500;
const OPENCLAW_HISTORY_SYNC_INTERVAL_MS = 15_000;
const OPENCLAW_HISTORY_DUPLICATE_WINDOW_MS = 15_000;
const OPENCLAW_CONNECTION_ERROR_PREFIXES = ['Gateway disconnected:', 'Connection error:'];

type OpenClawHistoryContentItem = {
  type?: string;
  text?: string;
  thinking?: string;
};

type OpenClawHistoryMessage = {
  role?: string;
  content?: string | OpenClawHistoryContentItem[];
  timestamp?: number;
  senderLabel?: string;
};

type OpenClawHistoryResponse = {
  messages?: OpenClawHistoryMessage[];
};

type ImportedOpenClawHistoryMessage = {
  msgId: string;
  content: string;
  createdAt: number;
  position: 'left' | 'right';
};

type PersistedTextMessage = Extract<TMessage, { type: 'text' }>;

const normalizeImportedMessageText = (content: string): string => content.replace(/\r\n/g, '\n').trim();

const normalizeOpenClawTimestamp = (value: number): number => (value < 1_000_000_000_000 ? value * 1000 : value);

const normalizeLookupValue = (value: string | null | undefined): string => value?.trim().toLowerCase() || '';

const extractOpenClawHistoryText = (content: OpenClawHistoryMessage['content']): string => {
  if (typeof content === 'string') {
    return normalizeImportedMessageText(content);
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => normalizeImportedMessageText(item.text || ''))
    .filter(Boolean)
    .join('\n\n');
};

const isOpenClawControlMessage = (content: string): boolean => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return (
    normalized.startsWith('A new session was started via /new or /reset.') ||
    normalized.startsWith('Sender (untrusted metadata):')
  );
};

const shouldPersistOpenClawStreamMessage = (message: IResponseMessage): boolean => {
  if (message.type === 'agent_status') {
    return false;
  }

  if (message.type !== 'error' || typeof message.data !== 'string') {
    return true;
  }

  const normalized = message.data.trim();
  return !OPENCLAW_CONNECTION_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const getEnabledProviderModels = (provider: IProvider): string[] => {
  const models = Array.isArray(provider.model) ? provider.model : [];
  return models.filter((modelId) => provider.modelEnabled?.[modelId] !== false);
};

const providerMatchesLookup = (provider: IProvider, lookup: string): boolean => {
  if (!lookup) {
    return false;
  }

  const fields = [provider.id, provider.name, provider.platform]
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);
  return fields.some((field) => field === lookup || field.includes(lookup) || lookup.includes(field));
};

const buildOpenClawModelInfo = ({
  providers,
  currentModel,
  providerHint,
  switchSupported,
}: {
  providers: IProvider[];
  currentModel: string | null;
  providerHint: string | null;
  switchSupported: boolean;
}): AcpModelInfo | null => {
  const enabledProviders = providers.filter((provider) => provider.enabled !== false);
  const normalizedCurrentModel = normalizeLookupValue(currentModel);
  const normalizedProviderHint = normalizeLookupValue(providerHint);

  const dedupedModels = new Map<string, { id: string; label: string }>();
  enabledProviders.forEach((provider) => {
    getEnabledProviderModels(provider).forEach((modelId) => {
      const key = normalizeLookupValue(modelId);
      if (!key || dedupedModels.has(key)) {
        return;
      }
      dedupedModels.set(key, { id: modelId, label: modelId });
    });
  });

  if (currentModel && !dedupedModels.has(normalizedCurrentModel)) {
    dedupedModels.set(normalizedCurrentModel, { id: currentModel, label: currentModel });
  }

  const availableModels = Array.from(dedupedModels.values());
  if (!currentModel && availableModels.length === 0) {
    return null;
  }

  return {
    source: 'models',
    currentModelId: currentModel,
    currentModelLabel:
      currentModel ||
      (normalizedProviderHint
        ? enabledProviders.find((provider) => providerMatchesLookup(provider, normalizedProviderHint))?.name || null
        : null),
    availableModels,
    canSwitch:
      switchSupported && availableModels.some((model) => normalizeLookupValue(model.id) !== normalizedCurrentModel),
    switchSupported,
  };
};

const buildOpenClawHistoryMessageId = (
  sessionKey: string,
  position: ImportedOpenClawHistoryMessage['position'],
  createdAt: number,
  content: string
): string => {
  const digest = createHash('sha1')
    .update(
      JSON.stringify({
        provider: 'openclaw-gateway',
        sessionKey,
        position,
        createdAt,
        content: normalizeImportedMessageText(content),
      })
    )
    .digest('hex');
  return `ext:openclaw-gateway:${digest}`;
};

const toImportedOpenClawHistoryMessage = (
  sessionKey: string,
  message: OpenClawHistoryMessage
): ImportedOpenClawHistoryMessage | null => {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }

  const content = extractOpenClawHistoryText(message.content);
  if (!content) {
    return null;
  }

  if (message.role === 'user' && isOpenClawControlMessage(content)) {
    return null;
  }

  const position = message.role === 'user' ? 'right' : 'left';
  const createdAt = typeof message.timestamp === 'number' ? normalizeOpenClawTimestamp(message.timestamp) : Date.now();
  return {
    msgId: buildOpenClawHistoryMessageId(sessionKey, position, createdAt, content),
    content,
    createdAt,
    position,
  };
};

export interface OpenClawAgentManagerData {
  conversation_id: string;
  workspace?: string;
  backend?: AcpBackendAll;
  agentName?: string;
  openclawAgentId?: string;
  externalSessionImported?: boolean;
  externalHistorySync?: {
    provider?: 'openclaw-gateway';
    lastSyncedAt?: number;
    lastHistoryMessageAt?: number;
    lastSessionKey?: string;
    lastInsertedCount?: number;
  };
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
  /** YOLO mode (auto-approve all permissions) */
  yoloMode?: boolean;
}

class OpenClawAgentManager extends BaseAgentManager<OpenClawAgentManagerData> {
  agent!: OpenClawAgent;
  bootstrap: Promise<OpenClawAgent>;
  private isFirstMessage: boolean = true;
  private options: OpenClawAgentManagerData;
  private lastExternalHistorySyncAt = 0;
  private externalHistorySyncPromise: Promise<number> | null = null;

  constructor(data: OpenClawAgentManagerData) {
    super('openclaw-gateway', data, new IpcAgentEventEmitter());
    this.conversation_id = data.conversation_id;
    this.workspace = data.workspace ?? '';
    this.options = data;
    this.status = 'pending';

    this.bootstrap = this.initAgent(data);
  }

  private async initAgent(data: OpenClawAgentManagerData): Promise<OpenClawAgent> {
    const config: OpenClawAgentConfig = {
      id: data.conversation_id,
      workingDir: data.workspace || process.cwd(),
      gateway: data.gateway
        ? {
            ...data.gateway,
            port: data.gateway.port ?? 18789,
          }
        : undefined,
      extra: {
        workspace: data.workspace,
        sessionKey: data.sessionKey,
        openclawAgentId: data.openclawAgentId,
        yoloMode: data.yoloMode,
      },
      onStreamEvent: (message) => this.handleStreamEvent(message),
      onSignalEvent: (message) => this.handleSignalEvent(message),
      onSessionKeyUpdate: (sessionKey) => this.handleSessionKeyUpdate(sessionKey),
    };

    this.agent = new OpenClawAgent(config);

    try {
      await this.agent.start();
      await this.reconcileExternalHistory(true);
      return this.agent;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emitErrorMessage(`Failed to start OpenClaw agent: ${errorMsg}`);
      throw error;
    }
  }

  private handleStreamEvent(message: IResponseMessage): void {
    const msg = { ...message, conversation_id: this.conversation_id };

    // Mark as finished when content is output (visible to user)
    // OpenClaw uses: content, agent_status, acp_tool_call, plan
    const contentTypes = ['content', 'agent_status', 'acp_tool_call', 'plan'];
    if (contentTypes.includes(msg.type)) {
      this.status = 'finished';
    }

    // Persist messages to database
    const tMessage = transformMessage(msg);
    if (tMessage && shouldPersistOpenClawStreamMessage(msg)) {
      // Use addOrUpdateMessage for types that reuse the same msg_id (content streaming, agent_status updates)
      // Use addMessage for non-streaming messages that should be inserted as-is
      if ((msg.type === 'content' || msg.type === 'agent_status') && msg.msg_id) {
        addOrUpdateMessage(this.conversation_id, tMessage);
      } else {
        addMessage(this.conversation_id, tMessage);
      }
    }

    // Emit to frontend
    ipcBridge.openclawConversation.responseStream.emit(msg);
    // Also emit to the unified conversation stream so the generic chat UI can render OpenClaw replies.
    ipcBridge.conversation.responseStream.emit(msg);

    // Emit to Channel global event bus (Telegram/Lark streaming)
    channelEventBus.emitAgentMessage(this.conversation_id, msg);
  }

  private handleSignalEvent(message: IResponseMessage): void {
    const msg = { ...message, conversation_id: this.conversation_id };

    // Handle permission requests
    if (msg.type === 'acp_permission') {
      const permissionData = msg.data as {
        sessionId: string;
        toolCall: {
          toolCallId: string;
          title?: string;
          kind?: string;
          rawInput?: Record<string, unknown>;
        };
        options: Array<{ optionId: string; name: string; kind: string }>;
      };

      // Create confirmation for UI
      const confirmation: IConfirmation = {
        id: permissionData.toolCall.toolCallId,
        callId: permissionData.toolCall.toolCallId,
        title: permissionData.toolCall.title || 'Permission Required',
        description: JSON.stringify(permissionData.toolCall.rawInput || {}),
        options: permissionData.options.map((opt) => ({
          label: opt.name,
          value: opt.optionId,
        })),
      };

      this.addConfirmation(confirmation);
      return;
    }

    // Handle finish event
    if (msg.type === 'finish') {
      cronBusyGuard.setProcessing(this.conversation_id, false);
    }

    // Emit signal events to frontend
    ipcBridge.openclawConversation.responseStream.emit(msg);
    ipcBridge.conversation.responseStream.emit(msg);

    // Forward signals to Channel global event bus
    channelEventBus.emitAgentMessage(this.conversation_id, msg);
  }

  private handleSessionKeyUpdate(sessionKey: string): void {
    this.saveSessionKey(sessionKey);
  }

  /**
   * Persist the resolved session key to the database for resume support.
   * Follows the same pattern as AcpAgentManager.saveAcpSessionId().
   */
  private async saveSessionKey(sessionKey: string): Promise<void> {
    try {
      const db = await getDatabase();
      const result = db.getConversation(this.conversation_id);
      if (result.success && result.data && result.data.type === 'openclaw-gateway') {
        const conversation = result.data;
        const updatedExtra = {
          ...conversation.extra,
          sessionKey,
        };
        db.updateConversation(this.conversation_id, {
          extra: updatedExtra,
        } as Partial<typeof conversation>);
      }
    } catch (error) {
      console.error('[OpenClawAgentManager] Failed to save session key:', error);
    }
  }

  async reconcileExternalHistory(force = false): Promise<number> {
    if (!this.options.externalSessionImported) {
      return 0;
    }

    const now = Date.now();
    if (!force && now - this.lastExternalHistorySyncAt < OPENCLAW_HISTORY_SYNC_INTERVAL_MS) {
      return 0;
    }

    if (this.externalHistorySyncPromise) {
      return await this.externalHistorySyncPromise;
    }

    const syncPromise = this.performExternalHistoryReconcile(force)
      .catch((error) => {
        console.warn('[OpenClawAgentManager] Failed to reconcile imported history:', error);
        return 0;
      })
      .finally(() => {
        this.externalHistorySyncPromise = null;
      });

    this.externalHistorySyncPromise = syncPromise;
    return await syncPromise;
  }

  private async performExternalHistoryReconcile(_force: boolean): Promise<number> {
    const sessionKey = this.agent?.currentSessionKey ?? this.options.sessionKey;
    if (!sessionKey) {
      return 0;
    }

    const historyResponse = (await this.agent.getChatHistory(OPENCLAW_HISTORY_SYNC_LIMIT)) as OpenClawHistoryResponse;
    const historyMessages = Array.isArray(historyResponse.messages) ? historyResponse.messages : [];
    const importedMessages = historyMessages
      .map((message) => toImportedOpenClawHistoryMessage(sessionKey, message))
      .filter((message): message is ImportedOpenClawHistoryMessage => message !== null)
      .toSorted((left, right) => left.createdAt - right.createdAt);

    if (importedMessages.length === 0) {
      this.lastExternalHistorySyncAt = Date.now();
      return 0;
    }

    const db = await getDatabase();
    const existingMessages = db.getConversationMessages(this.conversation_id, 0, 10_000, 'ASC').data;
    const existingByMsgId = new Set<string>();
    const existingTextBySignature = new Map<string, number[]>();
    let latestLocalCreatedAt = 0;

    for (const existingMessage of existingMessages) {
      latestLocalCreatedAt = Math.max(latestLocalCreatedAt, existingMessage.createdAt || 0);

      if (existingMessage.msg_id) {
        existingByMsgId.add(`${existingMessage.type}:${existingMessage.msg_id}`);
      }

      if (existingMessage.type !== 'text' || typeof existingMessage.content?.content !== 'string') {
        continue;
      }

      const normalizedContent = normalizeImportedMessageText(existingMessage.content.content);
      if (!normalizedContent) {
        continue;
      }

      const signature = `${existingMessage.position || 'left'}:${normalizedContent}`;
      const timestamps = existingTextBySignature.get(signature) || [];
      timestamps.push(existingMessage.createdAt || 0);
      existingTextBySignature.set(signature, timestamps);
    }

    const latestLocalCreatedAtBeforeSync = latestLocalCreatedAt;
    const insertedMessages: PersistedTextMessage[] = [];

    for (const importedMessage of importedMessages) {
      const normalizedContent = normalizeImportedMessageText(importedMessage.content);
      if (!normalizedContent) {
        continue;
      }

      const byMsgIdKey = `text:${importedMessage.msgId}`;
      if (existingByMsgId.has(byMsgIdKey)) {
        continue;
      }

      const signature = `${importedMessage.position}:${normalizedContent}`;
      const equivalentTimestamps = existingTextBySignature.get(signature) || [];
      if (
        equivalentTimestamps.some(
          (existingTimestamp) =>
            Math.abs(existingTimestamp - importedMessage.createdAt) <= OPENCLAW_HISTORY_DUPLICATE_WINDOW_MS
        )
      ) {
        continue;
      }

      const message: PersistedTextMessage = {
        id: importedMessage.msgId,
        msg_id: importedMessage.msgId,
        conversation_id: this.conversation_id,
        type: 'text',
        position: importedMessage.position,
        status: 'finish',
        createdAt: importedMessage.createdAt,
        content: {
          content: normalizedContent,
        },
      };

      const insertResult = db.insertMessage(message);
      if (!insertResult.success) {
        console.warn('[OpenClawAgentManager] Failed to insert reconciled history message:', insertResult.error);
        continue;
      }

      insertedMessages.push(message);
      existingByMsgId.add(byMsgIdKey);
      const nextTimestamps = existingTextBySignature.get(signature) || [];
      nextTimestamps.push(importedMessage.createdAt);
      existingTextBySignature.set(signature, nextTimestamps);
      latestLocalCreatedAt = Math.max(latestLocalCreatedAt, importedMessage.createdAt);
    }

    this.lastExternalHistorySyncAt = Date.now();

    if (insertedMessages.length === 0) {
      return 0;
    }

    const latestHistoryMessageAt = insertedMessages.reduce((max, message) => Math.max(max, message.createdAt || 0), 0);
    await this.persistExternalHistorySync(sessionKey, latestHistoryMessageAt, insertedMessages.length);
    this.emitReconciledMessages(insertedMessages, latestLocalCreatedAtBeforeSync);

    ipcBridge.conversation.listChanged.emit({
      conversationId: this.conversation_id,
      action: 'updated',
      source: 'aionui',
    });

    return insertedMessages.length;
  }

  private async persistExternalHistorySync(
    sessionKey: string,
    latestHistoryMessageAt: number,
    insertedCount: number
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const result = db.getConversation(this.conversation_id);
      if (!result.success || !result.data || result.data.type !== 'openclaw-gateway') {
        return;
      }

      db.updateConversation(this.conversation_id, {
        extra: {
          ...result.data.extra,
          sessionKey,
          externalHistorySync: {
            provider: 'openclaw-gateway',
            lastSyncedAt: Date.now(),
            lastHistoryMessageAt: latestHistoryMessageAt,
            lastSessionKey: sessionKey,
            lastInsertedCount: insertedCount,
          },
        },
      } as Partial<typeof result.data>);
    } catch (error) {
      console.warn('[OpenClawAgentManager] Failed to persist external history sync metadata:', error);
    }
  }

  private emitReconciledMessages(messages: PersistedTextMessage[], latestLocalCreatedAtBeforeSync: number): void {
    for (const message of messages) {
      if ((message.createdAt || 0) < latestLocalCreatedAtBeforeSync) {
        continue;
      }

      const responseMessage: IResponseMessage = {
        type: message.position === 'right' ? 'user_content' : 'content',
        conversation_id: this.conversation_id,
        msg_id: message.msg_id || message.id,
        data: message.content.content,
      };

      ipcBridge.openclawConversation.responseStream.emit(responseMessage);
      ipcBridge.conversation.responseStream.emit(responseMessage);
    }
  }

  async sendMessage(data: { content: string; agentContent?: string; files?: string[]; msg_id?: string }) {
    cronBusyGuard.setProcessing(this.conversation_id, true);
    // Set status to running when message is being processed
    this.status = 'running';
    try {
      await this.bootstrap;

      // Save user message to chat history (always use original content, not injected version)
      if (data.msg_id && data.content) {
        const userMessage: TMessage = {
          id: data.msg_id,
          msg_id: data.msg_id,
          type: 'text',
          position: 'right',
          conversation_id: this.conversation_id,
          content: { content: data.content },
          createdAt: Date.now(),
        };
        addMessage(this.conversation_id, userMessage);
      }

      // Send message to agent (use agentContent if provided, e.g. with injected skills)
      const result = await this.agent.sendMessage({
        content: data.agentContent || data.content,
        files: data.files,
        msg_id: data.msg_id,
      });

      return result;
    } catch (error) {
      cronBusyGuard.setProcessing(this.conversation_id, false);
      this.status = 'finished';

      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emitErrorMessage(`Failed to send message: ${errorMsg}`);
      throw error;
    }
  }

  async confirm(id: string, callId: string, data: string) {
    super.confirm(id, callId, data);
    await this.bootstrap;

    // Send confirmation to agent
    await this.agent.confirmMessage({
      confirmKey: data,
      callId,
    });
  }

  private emitErrorMessage(error: string): void {
    const message: IResponseMessage = {
      type: 'error',
      conversation_id: this.conversation_id,
      msg_id: uuid(),
      data: error,
    };

    const tMessage = transformMessage(message);
    if (tMessage) {
      addMessage(this.conversation_id, tMessage);
    }

    ipcBridge.openclawConversation.responseStream.emit(message);
    ipcBridge.conversation.responseStream.emit(message);
  }

  /**
   * Check if yoloMode is already enabled for this OpenClaw agent.
   * Returns true if agent was started with yoloMode.
   */
  async ensureYoloMode(): Promise<boolean> {
    return !!this.options.yoloMode;
  }

  stop() {
    return this.agent?.stop?.() ?? Promise.resolve();
  }

  kill() {
    try {
      this.agent?.kill?.();
    } finally {
      super.kill();
    }
  }

  getDiagnostics() {
    return {
      workspace: this.workspace,
      backend: this.options.backend,
      agentName: this.options.agentName,
      openclawAgentId: this.options.openclawAgentId,
      cliPath: this.options.gateway?.cliPath ?? null,
      gatewayHost: this.options.gateway?.host ?? null,
      gatewayPort: this.options.gateway?.port ?? 18789,
      conversation_id: this.conversation_id,
      isConnected: this.agent?.isConnected ?? false,
      hasActiveSession: this.agent?.hasActiveSession ?? false,
      sessionKey: this.agent?.currentSessionKey ?? null,
    };
  }

  async getRuntimeDetails(): Promise<
    ReturnType<OpenClawAgentManager['getDiagnostics']> & { model?: string | null; modelProvider?: string | null }
  > {
    const diagnostics = this.getDiagnostics();

    try {
      const sessionSummary = await this.agent?.getCurrentSessionSummary?.();
      return {
        ...diagnostics,
        modelProvider: sessionSummary?.modelProvider ?? null,
        model: sessionSummary?.model ?? null,
      };
    } catch (error) {
      console.warn('[OpenClawAgentManager] Failed to resolve current session model:', error);
      return {
        ...diagnostics,
        modelProvider: null,
        model: null,
      };
    }
  }

  private emitModelInfo(modelInfo: AcpModelInfo): void {
    const message: IResponseMessage = {
      type: 'openclaw_model_info',
      conversation_id: this.conversation_id,
      msg_id: uuid(),
      data: modelInfo,
    };

    ipcBridge.openclawConversation.responseStream.emit(message);
    ipcBridge.conversation.responseStream.emit(message);
  }

  async getModelInfo(preferredModelId?: string | null): Promise<AcpModelInfo | null> {
    await this.bootstrap.catch(() => {});
    const sessionSummaryPromise: Promise<OpenClawSessionSummary | null> =
      this.agent?.getCurrentSessionSummary?.().catch((): OpenClawSessionSummary | null => null) ??
      Promise.resolve(null);

    const [providers, sessionSummary] = await Promise.all([
      ProcessConfig.get('model.config').catch((): IProvider[] => []),
      sessionSummaryPromise,
    ]);

    return buildOpenClawModelInfo({
      providers: Array.isArray(providers) ? providers : [],
      currentModel: sessionSummary?.model ?? preferredModelId ?? null,
      providerHint: sessionSummary?.modelProvider ?? null,
      switchSupported: this.agent?.isModelSwitchSupported ?? true,
    });
  }

  async setModel(modelId: string): Promise<AcpModelInfo | null> {
    await this.bootstrap;
    await this.agent.setModel(modelId);
    const modelInfo = await this.getModelInfo(modelId);
    if (modelInfo) {
      this.emitModelInfo(modelInfo);
    }
    return modelInfo;
  }
}

export default OpenClawAgentManager;
