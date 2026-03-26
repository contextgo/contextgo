/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineKeyboard, Keyboard } from 'grammy';
import crypto from 'crypto';

import type { ChannelAgentType } from '../../types';

type TelegramToolConfirmPayload = {
  callId: string;
  value: string;
  chatId?: string;
  conversationId?: string;
  createdAt: number;
};

const TOOL_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TOOL_CONFIRM_PAYLOADS = 2048;
const toolConfirmPayloads = new Map<string, TelegramToolConfirmPayload>();

function cleanupToolConfirmPayloads(): void {
  const now = Date.now();

  for (const [token, payload] of toolConfirmPayloads.entries()) {
    if (now - payload.createdAt > TOOL_CONFIRM_TTL_MS) {
      toolConfirmPayloads.delete(token);
    }
  }

  while (toolConfirmPayloads.size > MAX_TOOL_CONFIRM_PAYLOADS) {
    const oldestToken = toolConfirmPayloads.keys().next().value;
    if (!oldestToken) {
      break;
    }
    toolConfirmPayloads.delete(oldestToken);
  }
}

function createToolConfirmToken(payload: Omit<TelegramToolConfirmPayload, 'createdAt'>): string {
  cleanupToolConfirmPayloads();

  const token = crypto.randomBytes(6).toString('hex');
  toolConfirmPayloads.set(token, {
    ...payload,
    createdAt: Date.now(),
  });

  return token;
}

export function resolveToolConfirmToken(token: string): Omit<TelegramToolConfirmPayload, 'createdAt'> | null {
  const payload = toolConfirmPayloads.get(token);
  if (!payload) {
    return null;
  }

  if (Date.now() - payload.createdAt > TOOL_CONFIRM_TTL_MS) {
    toolConfirmPayloads.delete(token);
    return null;
  }

  return {
    callId: payload.callId,
    value: payload.value,
    chatId: payload.chatId,
    conversationId: payload.conversationId,
  };
}

/**
 * Telegram Keyboards for Personal Assistant
 *
 * Two types of keyboards:
 * 1. Reply Keyboard - Persistent buttons below input field
 * 2. Inline Keyboard - Buttons attached to messages
 */

// ==================== Reply Keyboards ====================

/**
 * Main menu keyboard shown to authorized users
 * Displayed persistently below the message input
 */
export function createMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text('🆕 New Chat')
    .text('🔄 Agent')
    .row()
    .text('📊 Status')
    .text('❓ Help')
    .resized()
    .persistent();
}

/**
 * Pairing keyboard shown during pairing process
 */
export function createPairingKeyboard(): Keyboard {
  return new Keyboard().text('🔄 Refresh Status').text('❓ Help').resized().persistent();
}

// ==================== Inline Keyboards ====================

/**
 * Agent info for keyboard display
 */
export interface AgentDisplayInfo {
  type: ChannelAgentType;
  emoji: string;
  name: string;
}

/**
 * Agent selection keyboard
 * Shows available agents with current selection marked
 * @param availableAgents - List of available agents to display
 * @param currentAgent - Currently selected agent type
 */
export function createAgentSelectionKeyboard(
  availableAgents: AgentDisplayInfo[],
  currentAgent?: ChannelAgentType
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Add agents in rows of 2
  for (let i = 0; i < availableAgents.length; i++) {
    const agent = availableAgents[i];
    const label = currentAgent === agent.type ? `✓ ${agent.emoji} ${agent.name}` : `${agent.emoji} ${agent.name}`;

    keyboard.text(label, `agent:${agent.type}`);

    // Start new row after every 2 buttons, except for the last one
    if ((i + 1) % 2 === 0 && i < availableAgents.length - 1) {
      keyboard.row();
    }
  }

  return keyboard;
}

/**
 * Action buttons for AI response messages
 */
export function createResponseActionsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Copy', 'action:copy')
    .text('🔄 Regenerate', 'action:regenerate')
    .row()
    .text('💬 Continue', 'action:continue');
}

/**
 * Pairing code display with refresh option
 */
export function createPairingCodeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔄 Refresh Code', 'pairing:refresh').row().text('❓ Pairing Help', 'pairing:help');
}

/**
 * Pairing status check keyboard
 */
export function createPairingStatusKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔄 Check Status', 'pairing:check').text('🔄 Get New Code', 'pairing:refresh');
}

/**
 * Confirmation keyboard (generic)
 */
export function createConfirmationKeyboard(confirmAction: string, cancelAction: string): InlineKeyboard {
  return new InlineKeyboard().text('✅ Confirm', confirmAction).text('❌ Cancel', cancelAction);
}

/**
 * Session control keyboard
 */
export function createSessionControlKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🆕 New Session', 'session:new').text('📊 Session Status', 'session:status');
}

/**
 * Help menu keyboard
 */
export function createHelpKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🤖 Features', 'help:features')
    .text('🔗 Pairing Guide', 'help:pairing')
    .row()
    .text('💬 Tips', 'help:tips');
}

/**
 * Error recovery keyboard
 */
export function createErrorRecoveryKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔄 Retry', 'error:retry').text('🆕 New Session', 'session:new');
}

/**
 * Tool confirmation keyboard for Gemini tool calls
 * @param callId - The tool call ID for tracking
 * @param options - Array of { label, value } options
 */
export function createToolConfirmationKeyboard(
  callId: string,
  options: Array<{ label: string; value: string }>,
  chatId?: string,
  conversationId?: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  // 每行最多显示 2 个按钮
  // Show at most 2 buttons per row
  for (let i = 0; i < options.length; i += 2) {
    if (i > 0) keyboard.row();
    const leftToken = createToolConfirmToken({
      callId,
      value: options[i].value,
      chatId,
      conversationId,
    });
    keyboard.text(options[i].label, `confirm:${leftToken}`);
    if (i + 1 < options.length) {
      const rightToken = createToolConfirmToken({
        callId,
        value: options[i + 1].value,
        chatId,
        conversationId,
      });
      keyboard.text(options[i + 1].label, `confirm:${rightToken}`);
    }
  }
  return keyboard;
}

// ==================== Keyboard Utilities ====================

/**
 * Remove keyboard from message
 * Use when you want to hide the reply keyboard
 */
export function removeKeyboard() {
  return { remove_keyboard: true as const };
}

/**
 * Check if a callback query matches an action pattern
 */
export function matchAction(callbackData: string, actionPrefix: string): boolean {
  return callbackData.startsWith(`${actionPrefix}:`);
}

/**
 * Extract action name from callback data
 * e.g., "action:copy" -> "copy"
 */
export function extractAction(callbackData: string): string {
  const parts = callbackData.split(':');
  return parts.length > 1 ? parts[1] : callbackData;
}

/**
 * Extract action category from callback data
 * e.g., "action:copy" -> "action"
 */
export function extractCategory(callbackData: string): string {
  const parts = callbackData.split(':');
  return parts[0];
}
