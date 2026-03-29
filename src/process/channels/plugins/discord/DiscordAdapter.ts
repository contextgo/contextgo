/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ButtonInteraction, Message } from 'discord.js';
import type {
  IActionButton,
  IMessageAction,
  IUnifiedIncomingMessage,
  IUnifiedMessageContent,
  IUnifiedOutgoingMessage,
  IUnifiedUser,
} from '../../types';

export const DISCORD_MESSAGE_LIMIT = 2000;
export const DISCORD_BUTTON_LABEL_LIMIT = 80;

function mapToActionCategory(prefix: string): 'platform' | 'system' | 'chat' {
  if (prefix === 'pairing') return 'platform';
  if (prefix === 'chat') return 'chat';
  if (prefix === 'action') return 'chat';
  if (prefix === 'system') return 'system';
  return 'system';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
}

export function convertHtmlToDiscordMarkdown(html: string): string {
  let result = decodeHtmlEntities(html);

  result = result.replace(/<pre><code>([\s\S]+?)<\/code><\/pre>/gi, '```\n$1\n```');
  result = result.replace(/<b>(.+?)<\/b>/gi, '**$1**');
  result = result.replace(/<strong>(.+?)<\/strong>/gi, '**$1**');
  result = result.replace(/<i>(.+?)<\/i>/gi, '*$1*');
  result = result.replace(/<em>(.+?)<\/em>/gi, '*$1*');
  result = result.replace(/<code>(.+?)<\/code>/gi, '`$1`');
  result = result.replace(/<a href="([^"]+)">(.+?)<\/a>/gi, '$2 ($1)');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/p>/gi, '\n');

  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(/<[^>]+>/g, '');
  }

  return result.trim();
}

function normalizeText(text: string, botUserId?: string): string {
  if (!botUserId) {
    return text.replace(/\s+/g, ' ').trim();
  }

  return text
    .replace(new RegExp(`<@!?${botUserId}>`, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toUnifiedUser(message: Message): IUnifiedUser | null {
  if (!message.author?.id) return null;

  return {
    id: message.author.id,
    username: message.author.username,
    displayName:
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username ||
      `Discord User ${message.author.id.slice(-6)}`,
    avatarUrl: message.author.displayAvatarURL(),
  };
}

function buildTextContent(text: string): IUnifiedMessageContent {
  const normalized = text.trim();
  return {
    type: normalized.startsWith('/') ? 'command' : 'text',
    text: normalized,
  };
}

export function toUnifiedIncomingMessage(message: Message, botUserId?: string): IUnifiedIncomingMessage | null {
  const user = toUnifiedUser(message);
  if (!user) return null;

  return {
    id: message.id,
    platform: 'discord',
    chatId: message.channelId,
    user,
    content: buildTextContent(normalizeText(message.content || '', botUserId)),
    timestamp: message.createdTimestamp,
    replyToMessageId: message.reference?.messageId ?? undefined,
    raw: {
      id: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
    },
  };
}

export function toUnifiedActionMessage(
  interaction: ButtonInteraction,
  action: IMessageAction
): IUnifiedIncomingMessage | null {
  const user = interaction.user;
  if (!user?.id) return null;

  return {
    id: interaction.id,
    platform: 'discord',
    chatId: interaction.channelId,
    user: {
      id: user.id,
      username: user.username,
      displayName:
        interaction.member && 'displayName' in interaction.member
          ? interaction.member.displayName
          : user.globalName || user.username,
      avatarUrl: user.displayAvatarURL(),
    },
    content: {
      type: 'action',
      text: action.name,
    },
    timestamp: Date.now(),
    replyToMessageId: interaction.message.id,
    action,
    raw: {
      id: interaction.id,
      customId: interaction.customId,
      channelId: interaction.channelId,
    },
  };
}

export function toMessageAction(button: IActionButton): IMessageAction {
  const [prefix] = button.action.split('.');
  return {
    type: mapToActionCategory(prefix || 'system'),
    name: button.action,
    ...(button.params ? { params: button.params } : {}),
  };
}

function resolveButtonStyle(button: IActionButton): ButtonStyle {
  if (button.action === 'system.confirm' && button.params?.value === 'cancel') {
    return ButtonStyle.Danger;
  }
  if (button.action === 'system.confirm' || button.action === 'agent.select') {
    return ButtonStyle.Primary;
  }
  return ButtonStyle.Secondary;
}

export function buildDiscordActionRows(
  buttonRows: IActionButton[][],
  getCustomId: (button: IActionButton, rowIndex: number, buttonIndex: number) => string
): Array<ActionRowBuilder<ButtonBuilder>> {
  return buttonRows.slice(0, 5).map((row, rowIndex) => {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    row.slice(0, 5).forEach((button, buttonIndex) => {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(getCustomId(button, rowIndex, buttonIndex))
          .setLabel(button.label.slice(0, DISCORD_BUTTON_LABEL_LIMIT))
          .setStyle(resolveButtonStyle(button))
      );
    });

    return actionRow;
  });
}

export function toDiscordMessagePayload(
  message: IUnifiedOutgoingMessage,
  getCustomId: (button: IActionButton, rowIndex: number, buttonIndex: number) => string
): {
  content: string;
  components?: Array<ActionRowBuilder<ButtonBuilder>>;
} {
  const content = convertHtmlToDiscordMarkdown(message.text || '');
  const buttonRows = message.buttons || message.keyboard;
  const components = buttonRows?.length ? buildDiscordActionRows(buttonRows, getCustomId) : undefined;
  const fallbackContent =
    content ||
    buttonRows
      ?.flat()
      .map((button) => button.label)
      .join(' · ') ||
    'ContextGo response';

  return {
    content: fallbackContent,
    ...(components ? { components } : {}),
  };
}

export function splitDiscordMessage(text: string, maxLength: number = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    const newlineIndex = remaining.lastIndexOf('\n', maxLength);
    const spaceIndex = remaining.lastIndexOf(' ', maxLength);
    const splitIndex =
      newlineIndex > maxLength * 0.7 ? newlineIndex + 1 : spaceIndex > maxLength * 0.7 ? spaceIndex + 1 : maxLength;
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
