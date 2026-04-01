/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IRegisteredAction, ActionHandler } from './types';
import { PlatformActionNames, createSuccessResponse, createErrorResponse } from './types';
import { getPairingService } from '../pairing/PairingService';
import {
  createPairingCodeKeyboard,
  createPairingStatusKeyboard,
  createMainMenuKeyboard,
} from '../plugins/telegram/TelegramKeyboards';
import {
  createPairingCard,
  createPairingStatusCard,
  createMainMenuCard,
  createPairingHelpCard,
} from '../plugins/lark/LarkCards';
import {
  createMainMenuCard as createDingTalkMainMenuCard,
  createPairingCard as createDingTalkPairingCard,
  createPairingStatusCard as createDingTalkPairingStatusCard,
  createPairingHelpCard as createDingTalkPairingHelpCard,
} from '../plugins/dingtalk/DingTalkCards';
import {
  buildMainMenuActionButtons,
  buildPairingCodeActionButtons,
  buildPairingStatusActionButtons,
} from '../utils/actionButtons';

function usesActionButtons(platform: string): boolean {
  return platform === 'slack' || platform === 'discord';
}

/**
 * PlatformActions - Handlers for platform-specific actions
 *
 * Supports both Telegram and Lark platforms with platform-specific UI components.
 * These actions are handled by the plugin itself, not through the Gateway.
 */

// ==================== Platform-specific Markup Helpers ====================

/**
 * Get main menu markup based on platform
 */
function getMainMenuMarkup(platform: string) {
  if (platform === 'lark') {
    return { replyMarkup: createMainMenuCard() };
  }
  if (platform === 'dingtalk') {
    return { replyMarkup: createDingTalkMainMenuCard() };
  }
  if (usesActionButtons(platform)) {
    return { buttons: buildMainMenuActionButtons() };
  }
  return { replyMarkup: createMainMenuKeyboard() };
}

/**
 * Get pairing code markup based on platform
 */
function getPairingCodeMarkup(platform: string, code: string) {
  if (platform === 'lark') {
    return { replyMarkup: createPairingCard(code) };
  }
  if (platform === 'dingtalk') {
    return { replyMarkup: createDingTalkPairingCard(code) };
  }
  if (usesActionButtons(platform)) {
    return { buttons: buildPairingCodeActionButtons() };
  }
  return { replyMarkup: createPairingCodeKeyboard() };
}

/**
 * Get pairing status markup based on platform
 */
function getPairingStatusMarkup(platform: string, code: string) {
  if (platform === 'lark') {
    return { replyMarkup: createPairingStatusCard(code) };
  }
  if (platform === 'dingtalk') {
    return { replyMarkup: createDingTalkPairingStatusCard(code) };
  }
  if (usesActionButtons(platform)) {
    return { buttons: buildPairingStatusActionButtons() };
  }
  return { replyMarkup: createPairingStatusKeyboard() };
}

/**
 * Get pairing help markup based on platform
 */
function getPairingHelpMarkup(platform: string) {
  if (platform === 'lark') {
    return { replyMarkup: createPairingHelpCard() };
  }
  if (platform === 'dingtalk') {
    return { replyMarkup: createDingTalkPairingHelpCard() };
  }
  if (usesActionButtons(platform)) {
    return { buttons: buildPairingCodeActionButtons() };
  }
  return { replyMarkup: createPairingCodeKeyboard() };
}

/**
 * Handle pairing.show - Show pairing code to user
 * Called when user sends /start or first message
 */
export const handlePairingShow: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (await pairingService.isUserAuthorized(context.userId, platform, context.chatId, context.pluginId)) {
    return createSuccessResponse({
      type: 'text',
      text: [
        '✅ <b>Authorized</b>',
        '',
        'Your account is already paired and ready to use.',
        '',
        'Send a message to start chatting, or use the buttons below.',
      ].join('\n'),
      parseMode: 'HTML',
      ...getMainMenuMarkup(platform),
    });
  }

  // Generate pairing code
  try {
    const { code, expiresAt } = await pairingService.generatePairingCode(
      context.userId,
      platform,
      context.displayName,
      context.chatId,
      context.pluginId
    );

    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: [
        '🔗 <b>Device Pairing</b>',
        '',
        'Please approve this pairing request in the ContextGo app:',
        '',
        `<code>${code}</code>`,
        '',
        `⏱ Valid for: ${expiresInMinutes} minutes`,
        '',
        '<b>Steps:</b>',
        '1. Open ContextGo app',
        '2. Go to Settings → Agent入口',
        '3. Click "Approve" in pending pairing requests',
      ].join('\n'),
      parseMode: 'HTML',
      ...getPairingCodeMarkup(platform, code),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(`Failed to generate pairing code: ${message}`);
  }
};

/**
 * Handle pairing.refresh - Refresh pairing code
 */
export const handlePairingRefresh: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (await pairingService.isUserAuthorized(context.userId, platform, context.chatId, context.pluginId)) {
    return createSuccessResponse({
      type: 'text',
      text: '✅ You are already paired. No need to refresh the pairing code.',
      parseMode: 'HTML',
      ...getMainMenuMarkup(platform),
    });
  }

  // Generate new pairing code
  try {
    const { code, expiresAt } = await pairingService.refreshPairingCode(
      context.userId,
      platform,
      context.displayName,
      context.chatId,
      context.pluginId
    );

    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: [
        '🔄 <b>New Pairing Code</b>',
        '',
        `<code>${code}</code>`,
        '',
        `⏱ Valid for: ${expiresInMinutes} minutes`,
        '',
        'Please approve this pairing request in ContextGo settings.',
      ].join('\n'),
      parseMode: 'HTML',
      ...getPairingCodeMarkup(platform, code),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(`Failed to refresh pairing code: ${message}`);
  }
};

/**
 * Handle pairing.check - Check pairing status
 */
export const handlePairingCheck: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (await pairingService.isUserAuthorized(context.userId, platform, context.chatId, context.pluginId)) {
    return createSuccessResponse({
      type: 'text',
      text: [
        '✅ <b>Pairing Successful!</b>',
        '',
        'Your account is now paired and ready to use.',
        '',
        'Send a message to chat with the AI assistant.',
      ].join('\n'),
      parseMode: 'HTML',
      ...getMainMenuMarkup(platform),
    });
  }

  // Check for pending request
  const pendingRequest = await pairingService.getPendingRequestForUser(
    context.userId,
    platform,
    context.chatId,
    context.pluginId
  );

  if (pendingRequest) {
    const expiresInMinutes = Math.ceil((pendingRequest.expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: [
        '⏳ <b>Waiting for Approval</b>',
        '',
        `Pairing code: <code>${pendingRequest.code}</code>`,
        `Time remaining: ${expiresInMinutes} minutes`,
        '',
        'Please approve the pairing request in ContextGo settings.',
      ].join('\n'),
      parseMode: 'HTML',
      ...getPairingStatusMarkup(platform, pendingRequest.code),
    });
  }

  // No pending request - need to generate new code
  return handlePairingShow(context);
};

/**
 * Handle pairing.help - Show pairing help
 */
export const handlePairingHelp: ActionHandler = async (context) => {
  const platform = context.platform;
  const platformName =
    platform === 'lark'
      ? 'Lark/Feishu'
      : platform === 'dingtalk'
        ? 'DingTalk'
        : platform === 'slack'
          ? 'Slack'
          : platform === 'discord'
            ? 'Discord'
            : 'Telegram';

  return createSuccessResponse({
    type: 'text',
    text: [
      '❓ <b>Pairing Help</b>',
      '',
      '<b>What is pairing?</b>',
      `Pairing links your ${platformName} account with the local ContextGo application.`,
      'You need to pair before using the AI assistant.',
      '',
      '<b>Pairing steps:</b>',
      '1. Get pairing code (send any message)',
      '2. Open ContextGo app',
      '3. Go to Settings → Agent入口',
      '4. Click "Approve" in pending requests',
      '',
      '<b>FAQ:</b>',
      '• Pairing code valid for 10 minutes, refresh if expired',
      '• ContextGo app must be running',
      '• Ensure network connection is stable',
    ].join('\n'),
    parseMode: 'HTML',
    ...getPairingHelpMarkup(platform),
  });
};

/**
 * All platform actions
 */
export const platformActions: IRegisteredAction[] = [
  {
    name: PlatformActionNames.PAIRING_SHOW,
    category: 'platform',
    description: 'Show pairing code',
    handler: handlePairingShow,
  },
  {
    name: PlatformActionNames.PAIRING_REFRESH,
    category: 'platform',
    description: 'Refresh pairing code',
    handler: handlePairingRefresh,
  },
  {
    name: PlatformActionNames.PAIRING_CHECK,
    category: 'platform',
    description: 'Check pairing status',
    handler: handlePairingCheck,
  },
  {
    name: PlatformActionNames.PAIRING_HELP,
    category: 'platform',
    description: 'Show pairing help',
    handler: handlePairingHelp,
  },
];
