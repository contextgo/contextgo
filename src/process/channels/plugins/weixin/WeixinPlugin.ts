/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

import { getPlatformServices } from '@/common/platform';
import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { BasePlugin } from '../BasePlugin';
import { toUnifiedIncomingMessage, stripHtml } from './WeixinAdapter';
import { startMonitor } from './WeixinMonitor';
import type { WeixinChatRequest, WeixinChatResponse } from './WeixinMonitor';
import { DEFAULT_WEIXIN_CDN_BASE_URL } from './media/mediaIO';
import { getMimeFromFilename } from './media/mime';

const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;

type PendingMediaResponse = {
  filePath: string;
  fileName?: string;
  mimeType?: string;
};

interface PendingResponse {
  resolve: (response: WeixinChatResponse) => void;
  reject: (error: Error) => void;
  accumulatedText: string;
  mediaResponse?: PendingMediaResponse;
  timer: ReturnType<typeof setTimeout>;
}

export class WeixinPlugin extends BasePlugin {
  readonly type: PluginType = 'weixin';

  private accountId = '';
  private botToken = '';
  private baseUrl = 'https://ilinkai.weixin.qq.com';
  private cdnBaseUrl = DEFAULT_WEIXIN_CDN_BASE_URL;
  private abortController: AbortController | null = null;
  private _stopping = false;
  private pendingResponses = new Map<string, PendingResponse>();
  private activeUsers = new Set<string>();

  // ==================== Lifecycle ====================

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const { accountId, botToken, baseUrl, cdnBaseUrl } = config.credentials ?? {};
    if (!accountId || !botToken) {
      throw new Error('WeChat accountId and botToken are required');
    }
    this.accountId = accountId as string;
    this.botToken = botToken as string;
    this.baseUrl = (baseUrl as string | undefined) ?? 'https://ilinkai.weixin.qq.com';
    this.cdnBaseUrl = (cdnBaseUrl as string | undefined) ?? DEFAULT_WEIXIN_CDN_BASE_URL;
  }

  protected async onStart(): Promise<void> {
    this._stopping = false;
    this.abortController = new AbortController();
    startMonitor({
      baseUrl: this.baseUrl,
      cdnBaseUrl: this.cdnBaseUrl,
      token: this.botToken,
      accountId: this.accountId,
      dataDir: getPlatformServices().paths.getDataDir(),
      agent: { chat: (req) => this.handleChat(req) },
      abortSignal: this.abortController.signal,
      log: (msg) => console.log(msg),
    });
  }

  protected async onStop(): Promise<void> {
    this._stopping = true;

    for (const [chatId, pending] of this.pendingResponses.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Plugin stopped'));
      this.pendingResponses.delete(chatId);
    }

    this.abortController?.abort();
    this.abortController = null;
    this.activeUsers.clear();
  }

  // ==================== BasePlugin interface ====================

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    const pending = this.pendingResponses.get(chatId);
    if (pending) {
      if (message.text) {
        pending.accumulatedText = stripHtml(message.text);
      }
      if (message.type === 'image' && message.imageUrl) {
        pending.mediaResponse = {
          filePath: message.imageUrl,
          mimeType: getMimeFromFilename(message.imageUrl),
        };
      } else if (message.type === 'file' && message.fileUrl) {
        pending.mediaResponse = {
          filePath: message.fileUrl,
          fileName: message.fileName || path.basename(message.fileUrl),
          mimeType: getMimeFromFilename(message.fileName || message.fileUrl),
        };
      }
    }
    return `weixin_pending_${chatId}`;
  }

  async editMessage(chatId: string, _messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    const pending = this.pendingResponses.get(chatId);
    if (!pending) return;

    if (message.text) {
      pending.accumulatedText = message.text;
    }
    if (message.type === 'image' && message.imageUrl) {
      pending.mediaResponse = {
        filePath: message.imageUrl,
        mimeType: getMimeFromFilename(message.imageUrl),
      };
    } else if (message.type === 'file' && message.fileUrl) {
      pending.mediaResponse = {
        filePath: message.fileUrl,
        fileName: message.fileName || path.basename(message.fileUrl),
        mimeType: getMimeFromFilename(message.fileName || message.fileUrl),
      };
    }

    if (message.replyMarkup !== undefined) {
      clearTimeout(pending.timer);
      this.pendingResponses.delete(chatId);
      pending.resolve({
        text: pending.accumulatedText || undefined,
        media: pending.mediaResponse,
      });
    }
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): { username?: string; displayName?: string } | null {
    return { displayName: 'Aion Assistant' };
  }

  // ==================== Promise bridge ====================

  private handleChat(request: WeixinChatRequest): Promise<WeixinChatResponse> {
    if (this._stopping) {
      return Promise.reject(new Error('Plugin stopped'));
    }

    const { conversationId } = request;
    this.activeUsers.add(conversationId);

    const existing = this.pendingResponses.get(conversationId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.reject(new Error('superseded'));
      this.pendingResponses.delete(conversationId);
    }

    return new Promise<WeixinChatResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponses.delete(conversationId);
        reject(new Error('Response timeout'));
      }, RESPONSE_TIMEOUT_MS);

      this.pendingResponses.set(conversationId, {
        resolve,
        reject,
        accumulatedText: '',
        mediaResponse: undefined,
        timer,
      });

      const unified = toUnifiedIncomingMessage(request);
      this.emitMessage(unified)
        .then(() => {
          const pending = this.pendingResponses.get(conversationId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingResponses.delete(conversationId);
            pending.resolve({
              text: pending.accumulatedText || undefined,
              media: pending.mediaResponse,
            });
          }
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          this.pendingResponses.delete(conversationId);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  // ==================== Static ====================

  static async testConnection(accountId: string, _botToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stateDir = getPlatformServices().paths.getDataDir();
      const bufFile = path.join(stateDir, 'weixin-monitor', `${accountId}.buf`);
      fs.accessSync(bufFile);
      return { success: true };
    } catch {
      return { success: false, error: `No sync buf found for accountId: ${accountId}` };
    }
  }
}
