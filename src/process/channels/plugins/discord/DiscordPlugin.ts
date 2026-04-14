/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
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
  isThread?: () => boolean;
  threads?: {
    fetch: (threadId: string) => Promise<DiscordSendableChannel | null>;
  };
};

type PendingDiscordAction = {
  action: IMessageAction;
  expiresAt: number;
};

const DISCORD_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
const DISCORD_ACTION_ID_PREFIX = 'ctxgo:discord:action';
const DISPLAY_CACHE_TTL = 10 * 60 * 1000;

type DiscordChatDisplayData = {
  name?: string;
  chatType?: string;
  parentTitle?: string;
  containerId?: string;
  containerType?: string;
  containerTitle?: string;
  source: 'official-pull';
};

type DiscordUserDisplayData = {
  name?: string;
  source: 'official-pull';
};

function getStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

function callBooleanMethod(value: unknown, key: string): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const method = (value as Record<string, unknown>)[key];
  return typeof method === 'function' ? Boolean((method as () => unknown)()) : false;
}

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
  private chatDisplayCache = new Map<string, { expiresAt: number; value: DiscordChatDisplayData | null }>();
  private userDisplayCache = new Map<string, { expiresAt: number; value: DiscordUserDisplayData | null }>();

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
    this.chatDisplayCache.clear();
    this.userDisplayCache.clear();
    this.botInfo = null;

    if (this.client) {
      this.client.destroy();
    }

    this.client = null;
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    const channel = await this.resolveTextChannel(chatId, message.threadId);
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
    const channel = await this.resolveTextChannel(chatId, message.threadId);
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

  private readDisplayCache<T>(
    cache: Map<string, { expiresAt: number; value: T | null }>,
    key: string
  ): T | null | undefined {
    const cached = cache.get(key);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      cache.delete(key);
      return undefined;
    }

    return cached.value;
  }

  private writeDisplayCache<T>(
    cache: Map<string, { expiresAt: number; value: T | null }>,
    key: string,
    value: T | null
  ): T | null {
    cache.set(key, {
      expiresAt: Date.now() + DISPLAY_CACHE_TTL,
      value,
    });
    return value;
  }

  private getChannelChatType(channel: unknown): string | undefined {
    if (callBooleanMethod(channel, 'isThread')) {
      return 'thread';
    }

    if (callBooleanMethod(channel, 'isDMBased')) {
      return 'dm';
    }

    if (getStringProperty(channel, 'guildId')) {
      return 'channel';
    }

    return undefined;
  }

  private async resolveGuildName(guildId?: string): Promise<string | undefined> {
    if (!this.client || !guildId) {
      return undefined;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      return guild.name?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async resolveParentChannelName(parentId?: string): Promise<string | undefined> {
    if (!this.client || !parentId) {
      return undefined;
    }

    try {
      const parentChannel = await this.client.channels.fetch(parentId);
      return getStringProperty(parentChannel, 'name');
    } catch {
      return undefined;
    }
  }

  async getChatDisplayData(chatId: string): Promise<DiscordChatDisplayData | null> {
    if (!this.client || !chatId) {
      return null;
    }

    const cached = this.readDisplayCache(this.chatDisplayCache, chatId);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const channel = await this.client.channels.fetch(chatId);
      if (!channel) {
        return this.writeDisplayCache(this.chatDisplayCache, chatId, null);
      }

      const guildId = getStringProperty(channel, 'guildId');
      const parentId = getStringProperty(channel, 'parentId');
      const [parentTitle, containerTitle] = await Promise.all([
        this.resolveParentChannelName(parentId),
        this.resolveGuildName(guildId),
      ]);

      return this.writeDisplayCache(this.chatDisplayCache, chatId, {
        name: getStringProperty(channel, 'name'),
        chatType: this.getChannelChatType(channel),
        parentTitle,
        containerId: guildId,
        containerType: guildId ? 'server' : undefined,
        containerTitle,
        source: 'official-pull',
      });
    } catch (error) {
      console.warn(`[DiscordPlugin] Failed to load chat display data for ${chatId}:`, error);
      return this.writeDisplayCache(this.chatDisplayCache, chatId, null);
    }
  }

  async getUserDisplayData(userId: string): Promise<DiscordUserDisplayData | null> {
    if (!this.client || !userId) {
      return null;
    }

    const cached = this.readDisplayCache(this.userDisplayCache, userId);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const user = await this.client.users.fetch(userId);
      return this.writeDisplayCache(this.userDisplayCache, userId, {
        name: user.globalName?.trim() || user.username?.trim() || undefined,
        source: 'official-pull',
      });
    } catch (error) {
      console.warn(`[DiscordPlugin] Failed to load user display data for ${userId}:`, error);
      return this.writeDisplayCache(this.userDisplayCache, userId, null);
    }
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

  private async resolveTextChannel(chatId: string, threadId?: string): Promise<DiscordSendableChannel> {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }

    const baseChannel = await this.client.channels.fetch(chatId);
    if (!baseChannel || !baseChannel.isTextBased() || !('send' in baseChannel) || !('messages' in baseChannel)) {
      throw new Error('Discord channel is not text-based');
    }

    const sendableBaseChannel = baseChannel as unknown as DiscordSendableChannel;
    if (!threadId) {
      return sendableBaseChannel;
    }

    if (typeof sendableBaseChannel.threads?.fetch === 'function') {
      const threadChannel = await sendableBaseChannel.threads.fetch(threadId);
      if (threadChannel && (!threadChannel.isThread || threadChannel.isThread()) && 'send' in threadChannel) {
        return threadChannel;
      }
    }

    throw new Error(`Discord thread ${threadId} is not available under channel ${chatId}`);
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
