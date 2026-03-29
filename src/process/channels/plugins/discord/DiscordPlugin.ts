/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Events, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import type { ButtonInteraction, Message } from 'discord.js';

import type {
  BotInfo,
  IActionButton,
  IChannelPluginConfig,
  IUnifiedOutgoingMessage,
  PluginType,
  IMessageAction,
} from '../../types';
import { BasePlugin } from '../BasePlugin';
import {
  DISCORD_MESSAGE_LIMIT,
  splitDiscordMessage,
  toDiscordMessagePayload,
  toMessageAction,
  toUnifiedActionMessage,
  toUnifiedIncomingMessage,
} from './DiscordAdapter';

type DiscordSendableChannel = {
  send: (options: {
    content: string;
    components?: unknown[];
    allowedMentions?: { parse: string[] };
  }) => Promise<Message>;
  messages: {
    fetch: (messageId: string) => Promise<Message>;
  };
};

type PendingDiscordAction = {
  action: IMessageAction;
  expiresAt: number;
};

const DISCORD_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
const DISCORD_ACTION_ID_PREFIX = 'ctxgo:discord:action';

async function sendChunkedMessages(
  channel: DiscordSendableChannel,
  chunks: string[],
  index = 0,
  lastMessageId = ''
): Promise<string> {
  if (index >= chunks.length) {
    return lastMessageId;
  }

  const sent = await channel.send({
    content: chunks[index],
    allowedMentions: { parse: [] },
  });

  return sendChunkedMessages(channel, chunks, index + 1, sent.id);
}

export class DiscordPlugin extends BasePlugin {
  readonly type: PluginType = 'discord';

  private client: Client | null = null;
  private botInfo: { userId: string; username?: string; displayName: string } | null = null;
  private activeUsers = new Set<string>();
  private requireMention = true;
  private pendingActions = new Map<string, PendingDiscordAction>();

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const token = config.credentials?.token;
    if (!token) {
      throw new Error('Discord bot token is required');
    }

    this.requireMention = config.config?.requireMention !== false;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    this.setupHandlers();
  }

  protected async onStart(): Promise<void> {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }

    const token = this.config?.credentials?.token;
    if (!token) {
      throw new Error('Discord bot token is missing');
    }

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.client?.off(Events.ClientReady, onReady);
        resolve();
      };
      this.client?.once(Events.ClientReady, onReady);
      this.client?.login(token).catch((error) => {
        this.client?.off(Events.ClientReady, onReady);
        reject(error);
      });
    });

    if (!this.client.user) {
      throw new Error('Failed to resolve Discord bot user');
    }

    this.botInfo = {
      userId: this.client.user.id,
      username: this.client.user.username,
      displayName: this.client.user.globalName || this.client.user.username || 'ContextGo',
    };
  }

  protected async onStop(): Promise<void> {
    this.activeUsers.clear();
    this.pendingActions.clear();
    this.botInfo = null;

    if (this.client) {
      this.client.destroy();
    }

    this.client = null;
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    const channel = await this.resolveTextChannel(chatId);
    this.pruneExpiredActions();

    const payload = toDiscordMessagePayload(message, (button) => this.registerActionId(button));

    if (!payload.components && payload.content.length > DISCORD_MESSAGE_LIMIT) {
      const chunks = splitDiscordMessage(payload.content, DISCORD_MESSAGE_LIMIT);
      return sendChunkedMessages(channel, chunks);
    }

    const sent = await channel.send({
      content:
        payload.content.length > DISCORD_MESSAGE_LIMIT
          ? payload.content.slice(0, DISCORD_MESSAGE_LIMIT - 3) + '...'
          : payload.content,
      ...(payload.components ? { components: payload.components } : {}),
      allowedMentions: { parse: [] },
    });

    return sent.id;
  }

  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    const channel = await this.resolveTextChannel(chatId);
    this.pruneExpiredActions();

    const payload = toDiscordMessagePayload(message, (button) => this.registerActionId(button));
    const existingMessage = await channel.messages.fetch(messageId);

    await existingMessage.edit({
      content:
        payload.content.length > DISCORD_MESSAGE_LIMIT
          ? payload.content.slice(0, DISCORD_MESSAGE_LIMIT - 3) + '...'
          : payload.content,
      ...(payload.components ? { components: payload.components } : { components: [] }),
      allowedMentions: { parse: [] },
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
    if (!this.client) return;

    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessageCreate(message);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      await this.handleButtonInteraction(interaction);
    });
  }

  private async handleMessageCreate(message: Message): Promise<void> {
    if (message.author?.bot) return;

    const botUserId = this.client?.user?.id;
    const isDirectMessage = message.guildId == null;
    const isBotMentioned = botUserId ? message.mentions.users.has(botUserId) : false;

    if (!isDirectMessage && this.requireMention && !isBotMentioned) {
      return;
    }

    const unified = toUnifiedIncomingMessage(message, botUserId);
    if (!unified) return;

    this.activeUsers.add(unified.user.id);
    await this.emitMessage(unified);
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const pendingAction = this.pendingActions.get(interaction.customId);
    if (!pendingAction || pendingAction.expiresAt < Date.now()) {
      this.pendingActions.delete(interaction.customId);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'This action has expired. Please send a new message to refresh the buttons.',
          ephemeral: true,
        });
      }
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const unified = toUnifiedActionMessage(interaction, pendingAction.action);
    if (!unified) return;

    this.activeUsers.add(unified.user.id);
    await this.emitMessage(unified);
  }

  private registerActionId(button: IActionButton): string {
    const action = toMessageAction(button);
    const actionId = `${DISCORD_ACTION_ID_PREFIX}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    this.pendingActions.set(actionId, {
      action,
      expiresAt: Date.now() + DISCORD_ACTION_TTL_MS,
    });
    return actionId;
  }

  private pruneExpiredActions(): void {
    const now = Date.now();
    for (const [actionId, entry] of this.pendingActions.entries()) {
      if (entry.expiresAt <= now) {
        this.pendingActions.delete(actionId);
      }
    }
  }

  private async resolveTextChannel(chatId: string): Promise<DiscordSendableChannel> {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }

    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
      throw new Error('Discord channel is not text-based');
    }

    return channel as unknown as DiscordSendableChannel;
  }

  static async testConnection(
    token: string
  ): Promise<{ success: boolean; botInfo?: { username?: string; name?: string }; error?: string }> {
    if (!token.trim()) {
      return { success: false, error: 'Discord bot token is required' };
    }

    try {
      const rest = new REST({ version: '10' }).setToken(token.trim());
      const user = (await rest.get(Routes.user('@me'))) as {
        username?: string;
        global_name?: string;
      };

      return {
        success: true,
        botInfo: {
          username: user.username,
          name: user.global_name || user.username,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Discord connection failed',
      };
    }
  }
}
