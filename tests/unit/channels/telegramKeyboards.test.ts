/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  createAgentSelectionKeyboard,
  extractAction,
} from '../../../src/process/channels/plugins/telegram/TelegramKeyboards';

describe('Telegram keyboard utilities', () => {
  it('extractAction should keep the full payload after first colon', () => {
    expect(extractAction('agent:custom:ext:demo:assistant-1')).toBe('custom:ext:demo:assistant-1');
    expect(extractAction('action:copy')).toBe('copy');
  });

  it('should shorten long agent callback payloads to fit Telegram limits', () => {
    const longAgentKey = 'custom:ext:demo:assistant-with-a-very-long-identifier-1234567890abcdef1234567890abcdef';
    const keyboard = createAgentSelectionKeyboard(
      [{ key: longAgentKey, backend: 'custom', emoji: 'x', name: 'Extended Assistant' }],
      longAgentKey
    );

    const callbackData = keyboard.inline_keyboard[0]?.[0]?.callback_data;

    expect(callbackData).toBeDefined();
    expect(callbackData?.startsWith('agent:')).toBe(true);
    expect(callbackData?.length).toBeLessThanOrEqual(64);
    expect(callbackData).not.toBe(`agent:${longAgentKey}`);
  });
});
