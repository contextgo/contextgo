/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Context } from 'grammy';
import { toUnifiedIncomingMessage } from '@process/channels/plugins/telegram/TelegramAdapter';

describe('toUnifiedIncomingMessage', () => {
  it('keeps transport chatId while exposing a thread-aware peer key', () => {
    const context = {
      message: {
        message_id: 12,
        date: 1710000000,
        message_thread_id: 9,
        chat: {
          id: -100123456,
          type: 'supergroup',
        },
        from: {
          id: 42,
          first_name: 'Aion',
        },
        text: 'hello',
      },
    } as unknown as Context;

    const message = toUnifiedIncomingMessage(context);

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('-100123456');
    expect(message?.peer).toEqual({
      key: '-100123456:thread:9',
      platformChatId: '-100123456',
      parentChatId: '-100123456',
      threadId: '9',
      scope: 'thread',
      chatType: 'thread',
    });
  });

  it('maps callback queries to the same thread-aware peer identity', () => {
    const context = {
      callbackQuery: {
        id: 'callback-1',
        data: 'agent:openclaw-gateway:agent_profile_123',
        from: {
          id: 42,
          first_name: 'Aion',
        },
        message: {
          message_id: 33,
          message_thread_id: 11,
          chat: {
            id: -100123456,
            type: 'supergroup',
          },
        },
      },
    } as unknown as Context;

    const message = toUnifiedIncomingMessage(context);

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('-100123456');
    expect(message?.peer?.key).toBe('-100123456:thread:11');
    expect(message?.content.type).toBe('action');
  });
});
