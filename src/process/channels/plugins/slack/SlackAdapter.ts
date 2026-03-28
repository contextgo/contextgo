/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Block, KnownBlock } from '@slack/web-api';
import type {
  IActionButton,
  IMessageAction,
  IUnifiedIncomingMessage,
  IUnifiedMessageContent,
  IUnifiedOutgoingMessage,
  IUnifiedUser,
} from '../../types';

export const SLACK_TEXT_LIMIT = 3000;
export const SLACK_ACTION_ID_PREFIX = 'contextgo:action';

type SlackMessageEvent = {
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

type SlackActionValue = {
  action: string;
  params?: Record<string, string>;
};

function mapToActionCategory(prefix: string): 'platform' | 'system' | 'chat' {
  if (prefix === 'pairing') return 'platform';
  if (prefix === 'chat') return 'chat';
  if (prefix === 'action') return 'chat';
  if (prefix === 'system') return 'system';
  return 'system';
}

function decodeSlackEntities(text: string): string {
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
}

export function convertHtmlToSlackMrkdwn(html: string): string {
  let result = decodeSlackEntities(html);

  result = result.replace(/<b>(.+?)<\/b>/gi, '*$1*');
  result = result.replace(/<strong>(.+?)<\/strong>/gi, '*$1*');
  result = result.replace(/<i>(.+?)<\/i>/gi, '_$1_');
  result = result.replace(/<em>(.+?)<\/em>/gi, '_$1_');
  result = result.replace(/<code>(.+?)<\/code>/gi, '`$1`');
  result = result.replace(/<pre><code>([\s\S]+?)<\/code><\/pre>/gi, '```\n$1\n```');
  result = result.replace(/<a href="([^"]+)">(.+?)<\/a>/gi, '<$1|$2>');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/p>/gi, '\n');

  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(/<[^>]+>/g, '');
  }

  return result.trim();
}

function serializeActionValue(action: string, params?: Record<string, string>): string {
  return JSON.stringify({
    action,
    ...(params ? { params } : {}),
  } satisfies SlackActionValue);
}

function parseActionValue(value?: string): IMessageAction | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as SlackActionValue;
    const actionName = parsed.action?.trim();
    if (!actionName) return null;

    const [prefix] = actionName.split('.');
    return {
      type: mapToActionCategory(prefix || 'system'),
      name: actionName,
      params: parsed.params,
    };
  } catch {
    return null;
  }
}

function toUnifiedUser(userId?: string, username?: string, displayName?: string): IUnifiedUser | null {
  if (!userId) return null;
  return {
    id: userId,
    username,
    displayName: displayName || username || `Slack User ${userId.slice(-6)}`,
  };
}

function normalizeText(text: string, botUserId?: string): string {
  const withoutBotMention = botUserId ? text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim() : text.trim();
  return withoutBotMention.replace(/\s+/g, ' ').trim();
}

function buildTextContent(text: string): IUnifiedMessageContent {
  const normalized = text.trim();
  return {
    type: normalized.startsWith('/') ? 'command' : 'text',
    text: normalized,
  };
}

export function toUnifiedIncomingMessage(event: SlackMessageEvent, botUserId?: string): IUnifiedIncomingMessage | null {
  const user = toUnifiedUser(event.user);
  if (!user || !event.channel) return null;

  const text = normalizeText(event.text || '', botUserId);
  return {
    id: event.ts || Date.now().toString(),
    platform: 'slack',
    chatId: event.channel,
    user,
    content: buildTextContent(text),
    timestamp: slackTimestampToMillis(event.ts),
    replyToMessageId: event.thread_ts,
    raw: event,
  };
}

export function toUnifiedActionMessage(payload: SlackActionPayload): IUnifiedIncomingMessage | null {
  const action = parseActionValue(payload.actions?.[0]?.value);
  const user = toUnifiedUser(payload.user?.id, payload.user?.username, payload.user?.name);
  const chatId = payload.channel?.id;
  if (!action || !user || !chatId) return null;

  return {
    id: payload.trigger_id || payload.message?.ts || Date.now().toString(),
    platform: 'slack',
    chatId,
    user,
    content: {
      type: 'action',
      text: action.name,
    },
    timestamp: Date.now(),
    replyToMessageId: payload.message?.ts,
    action,
    raw: payload,
  };
}

function resolveButtonStyle(action: IActionButton): 'primary' | 'danger' | undefined {
  if (action.action === 'system.confirm' && action.params?.value === 'cancel') {
    return 'danger';
  }
  if (action.action === 'system.confirm' || action.action === 'agent.select') {
    return 'primary';
  }
  return undefined;
}

export function toSlackBlocks(message: IUnifiedOutgoingMessage): (Block | KnownBlock)[] | undefined {
  const blocks: Array<Block | KnownBlock> = [];
  const mrkdwnText = convertHtmlToSlackMrkdwn(message.text || '');

  if (mrkdwnText) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: mrkdwnText,
      },
    });
  }

  const buttonRows = message.buttons || message.keyboard;
  if (buttonRows?.length) {
    for (const row of buttonRows) {
      blocks.push({
        type: 'actions',
        elements: row.map((button, index) => (Object.assign({type:`button`,text:{type:`plain_text`,text:button.label,emoji:true},action_id:`${SLACK_ACTION_ID_PREFIX}:${index}:${button.action}`,value:serializeActionValue(button.action,button.params)}, resolveButtonStyle(button)?{style:resolveButtonStyle(button)}:{}))),
      });
    }
  }

  return blocks.length > 0 ? blocks : undefined;
}

export function toSlackSendParams(message: IUnifiedOutgoingMessage): {
  text: string;
  blocks?: (Block | KnownBlock)[];
  threadTs?: string;
} {
  const text = convertHtmlToSlackMrkdwn(message.text || '');
  const blocks = toSlackBlocks(message);
  const fallbackText =
    text ||
    (message.buttons || message.keyboard)?.flat().map((button) => button.label).join(' · ') ||
    'ContextGo response';

  return {
    text: fallbackText,
    ...(blocks ? { blocks } : {}),
    ...(message.replyToMessageId ? { threadTs: message.replyToMessageId } : {}),
  };
}

export function splitSlackMessage(text: string, maxLength: number = SLACK_TEXT_LIMIT): string[] {
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
    const splitIndex = newlineIndex > maxLength * 0.7 ? newlineIndex + 1 : spaceIndex > maxLength * 0.7 ? spaceIndex + 1 : maxLength;
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

export function slackTimestampToMillis(ts?: string): number {
  if (!ts) return Date.now();
  const [secondsPart, fractionalPart = '0'] = ts.split('.');
  const seconds = parseInt(secondsPart, 10);
  const millis = parseInt(fractionalPart.padEnd(3, '0').slice(0, 3), 10);
  if (Number.isNaN(seconds) || Number.isNaN(millis)) return Date.now();
  return seconds * 1000 + millis;
}
