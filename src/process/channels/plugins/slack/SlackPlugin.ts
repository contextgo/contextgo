/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';

import type { BotInfo, IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { BasePlugin } from '../BasePlugin';
import {
  SLACK_ACTION_ID_PREFIX,
  SLACK_TEXT_LIMIT,
  splitSlackMessage,
  toSlackSendParams,
  toUnifiedActionMessage,
  toUnifiedIncomingMessage,
} from './SlackAdapter';

type SlackIncomingEvent = {
  ts?: string;
  text?: string;
  user?: string;
  channel?: string;
  channel_type?: string;
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
};

type SlackActionPayload = {
  user?: {
    id?: string;
    username?: string;
    name?: string;
  };
  channel?: {
    id?: string;
    name?: string;
  };
  message?: {
    ts?: string;
    text?: string;
  };
  actions?: Array<{
    value?: string;
  }>;
  trigger_id?: string;
};

export class SlackPlugin extends BasePlugin {
  readonly type: PluginType = 'slack';

  private app: App | null = null;
  private webClient: WebClient | null = null;
  private botInfo: { userId: string; username?: string; displayName: string } | null = null;
  private activeUsers = new Set<string>();
  private requireMention = true;

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const botToken = config.credentials?.botToken;
    const appToken = config.credentials?.appToken;

    if (!botToken || !appToken) {
      throw new Error('Slack botToken and appToken are required');
    }

    this.requireMention = config.config?.requireMention !== false;
    this.webClient = new WebClient(botToken);
    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
    });

    this.setupHandlers();
  }

  protected async onStart(): Promise<void> {
    if (!this.app || !this.webClient) {
      throw new Error('Slack app not initialized');
    }

    const auth = await this.webClient.auth.test();
    this.botInfo = {
      userId: auth.user_id || '',
      username: auth.user,
      displayName: auth.user || auth.team || 'ContextGo',
    };

    if (!this.botInfo.userId) {
      throw new Error('Failed to resolve Slack bot user ID');
    }

    await this.app.start();
  }

  protected async onStop(): Promise<void> {
    this.activeUsers.clear();
    this.botInfo = null;

    if (this.app) {
      await this.app.stop();
    }

    this.app = null;
    this.webClient = null;
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.webClient) {
      throw new Error('Slack client not initialized');
    }

    const payload = toSlackSendParams(message);
    let lastTs = '';

    if (!payload.blocks && payload.text.length > SLACK_TEXT_LIMIT) {
      const chunks = splitSlackMessage(payload.text, SLACK_TEXT_LIMIT);
      for (const chunk of chunks) {
        const result = await this.webClient.chat.postMessage({
          channel: chatId,
          text: chunk,
          ...(payload.threadTs ? { thread_ts: payload.threadTs } : {}),
        });
        lastTs = result.ts || lastTs;
      }
      return lastTs;
    }

    const result = await this.webClient.chat.postMessage({
      channel: chatId,
      text: payload.text,
      ...(payload.blocks ? { blocks: payload.blocks } : {}),
      ...(payload.threadTs ? { thread_ts: payload.threadTs } : {}),
    });

    return result.ts || '';
  }

  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    if (!this.webClient) {
      throw new Error('Slack client not initialized');
    }

    const payload = toSlackSendParams(message);
    const text = payload.text.length > SLACK_TEXT_LIMIT ? payload.text.slice(0, SLACK_TEXT_LIMIT - 3) + '...' : payload.text;

    await this.webClient.chat.update({
      channel: chatId,
      ts: messageId,
      text,
      ...(payload.blocks ? { blocks: payload.blocks } : {}),
    });
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): BotInfo | null {
    if (!this.botInfo) return null;
    return {
      id: this.botInfo.userId,
      username: this.botInfo.username,
      displayName: this.botInfo.displayName,
    };
  }

  private setupHandlers(): void {
    if (!this.app) return;

    this.app.event('app_mention', async ({ event }) => {
      await this.handleMessageEvent(event as unknown as SlackIncomingEvent, true);
    });

    this.app.event('message', async ({ event }) => {
      await this.handleMessageEvent(event as unknown as SlackIncomingEvent, false);
    });

    this.app.action(new RegExp(`^${SLACK_ACTION_ID_PREFIX}`), async ({ ack, body }) => {
      await ack();
      const unified = toUnifiedActionMessage(body as unknown as SlackActionPayload);
      if (!unified) return;
      this.activeUsers.add(unified.user.id);
      await this.emitMessage(unified);
    });
  }

  private async handleMessageEvent(event: SlackIncomingEvent, isMentionEvent: boolean): Promise<void> {
    if (!event.channel || !event.user) return;
    if (event.subtype || event.bot_id) return;
    if (this.botInfo?.userId && event.user === this.botInfo.userId) return;

    const isDirectMessage = event.channel_type === 'im';
    if (!isDirectMessage && !isMentionEvent) {
      if (this.requireMention) {
        return;
      }
      if (this.botInfo?.userId && (event.text || '').includes(`<@${this.botInfo.userId}>`)) {
        return;
      }
    }

    const unified = toUnifiedIncomingMessage(event, this.botInfo?.userId);
    if (!unified) return;

    this.activeUsers.add(unified.user.id);
    await this.emitMessage(unified);
  }

  static async testConnection(
    botToken: string,
    appToken?: string
  ): Promise<{ success: boolean; botInfo?: { username?: string; name?: string }; error?: string }> {
    if (!botToken.trim()) {
      return { success: false, error: 'Slack bot token is required' };
    }
    if (!appToken?.trim()) {
      return { success: false, error: 'Slack app token is required' };
    }

    try {
      const botClient = new WebClient(botToken.trim());
      const auth = await botClient.auth.test();

      const appClient = new WebClient(appToken.trim());
      await appClient.apiCall('apps.connections.open');

      return {
        success: true,
        botInfo: {
          username: auth.user,
          name: auth.team,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Slack connection failed',
      };
    }
  }
}
