/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBuiltinChannel } from '@/common/config/builtinChannels';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import { getChannelMessageService } from '../agent/ChannelMessageService';
import { getChannelManager } from '../core/ChannelManager';
import { getChannelRouteResolver } from '../core/ChannelRouteResolver';
import {
  createHelpKeyboard,
  createMainMenuKeyboard,
  createSessionControlKeyboard,
} from '../plugins/telegram/TelegramKeyboards';
import {
  buildHelpActionButtons,
  buildMainMenuActionButtons,
  buildSessionControlActionButtons,
} from '../utils/actionButtons';
import {
  createFeaturesCard,
  createHelpCard,
  createMainMenuCard,
  createPairingGuideCard,
  createSessionStatusCard,
  createSettingsCard,
  createTipsCard,
} from '../plugins/lark/LarkCards';
import {
  createFeaturesCard as createDingTalkFeaturesCard,
  createHelpCard as createDingTalkHelpCard,
  createMainMenuCard as createDingTalkMainMenuCard,
  createPairingGuideCard as createDingTalkPairingGuideCard,
  createSessionStatusCard as createDingTalkSessionStatusCard,
  createSettingsCard as createDingTalkSettingsCard,
  createTipsCard as createDingTalkTipsCard,
} from '../plugins/dingtalk/DingTalkCards';
import type { PluginType } from '../types';
import type { ActionHandler, IRegisteredAction } from './types';
import { SystemActionNames, createErrorResponse, createSuccessResponse } from './types';

function usesActionButtons(platform: PluginType): boolean {
  return getBuiltinChannel(platform)?.usesActionButtons ?? false;
}

function getPlatformDisplayName(platform: PluginType): string {
  const builtinChannel = getBuiltinChannel(platform);
  if (!builtinChannel) {
    return platform;
  }
  return platform === 'lark' ? 'Lark/Feishu' : builtinChannel.displayName;
}

/**
 * SystemActions - Handlers for system-level actions
 *
 * These actions handle session management, help, and settings.
 * They don't require AI processing - just system operations.
 */

/**
 * Handle session.new - Create a new conversation session
 */
export const handleSessionNew: ActionHandler = async (context) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  if (!context.channelUser) {
    return createErrorResponse('User not authorized');
  }

  // Clear existing session and agent for this user+chat
  const existingSession = sessionManager.getSession(context.channelUser.id, context.chatId);
  if (existingSession) {
    // Clear agent cache in ChannelMessageService
    const messageService = getChannelMessageService();
    await messageService.clearContext(existingSession.id);

    // Kill the worker for the old conversation
    if (existingSession.conversationId) {
      try {
        workerTaskManager.kill(existingSession.conversationId);
      } catch (err) {
        console.warn(`[SystemActions] Failed to kill old conversation:`, err);
      }
    }
  }
  await sessionManager.clearSession(context.channelUser.id, context.chatId);
  let conversationId = existingSession?.conversationId;
  try {
    const route = await getChannelRouteResolver().resolveAuthorizedRoute({
      platform: context.platform,
      pluginId: context.pluginId,
      platformUserId: context.userId,
      chatId: context.chatId,
      displayName: context.displayName,
      forceNewConversation: true,
    });
    await sessionManager.storeSession(route.session);
    conversationId = route.conversation.id;
    context.channelUser = route.channelUser;
    context.connector = route.connector;
    context.remoteIdentity = route.remoteIdentity;
    context.channelBinding = route.binding;
    context.agentProfile = route.agentProfile;
    context.externalSession = route.externalSession;
    context.sessionId = route.session.id;
    context.conversationId = route.conversation.id;
  } catch (error) {
    return createErrorResponse(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const markup =
    context.platform === 'lark'
      ? createMainMenuCard()
      : usesActionButtons(context.platform)
        ? undefined
        : context.platform === 'dingtalk'
          ? createDingTalkMainMenuCard()
          : createMainMenuKeyboard();
  return createSuccessResponse({
    type: 'text',
    text: `🆕 <b>New Conversation Started</b>\n\nConversation ID: <code>${conversationId?.slice(-8) ?? 'unknown'}</code>\n\nThis chat keeps the same channel binding, but future messages will use a fresh conversation context.`,
    parseMode: 'HTML',
    ...(markup ? { replyMarkup: markup } : {}),
    ...(usesActionButtons(context.platform) ? { buttons: buildMainMenuActionButtons() } : {}),
  });
};

/**
 * Handle session.status - Show current session status
 */
export const handleSessionStatus: ActionHandler = async (context) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  const userId = context.channelUser?.id;
  const session = userId ? sessionManager.getSession(userId, context.chatId) : null;

  // Use platform-specific markup
  if (context.platform === 'lark') {
    const sessionData = session
      ? {
          id: session.id,
          agentType: session.agentType,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        }
      : undefined;
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createSessionStatusCard(sessionData),
    });
  }

  if (context.platform === 'dingtalk') {
    const sessionData = session
      ? {
          id: session.id,
          agentType: session.agentType,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        }
      : undefined;
    return createSuccessResponse({
      type: 'text',
      text: '', // DingTalk card includes the text
      replyMarkup: createDingTalkSessionStatusCard(sessionData),
    });
  }

  if (usesActionButtons(context.platform)) {
    if (!session) {
      return createSuccessResponse({
        type: 'text',
        text: '📊 <b>Session Status</b>\n\nNo active session.\n\nSend a message to start a new conversation, or tap the "New Chat" button.',
        parseMode: 'HTML',
        buttons: buildSessionControlActionButtons(),
      });
    }

    const duration = Math.floor((Date.now() - session.createdAt) / 1000 / 60);
    const lastActivity = Math.floor((Date.now() - session.lastActivity) / 1000);

    return createSuccessResponse({
      type: 'text',
      text: [
        '📊 <b>Session Status</b>',
        '',
        `🤖 Agent: <code>${session.agentType}</code>`,
        `⏱ Duration: ${duration} min`,
        `📝 Last activity: ${lastActivity} sec ago`,
        `🔖 Session ID: <code>${session.id.slice(-8)}</code>`,
      ].join('\n'),
      parseMode: 'HTML',
      buttons: buildSessionControlActionButtons(),
    });
  }

  if (!session) {
    return createSuccessResponse({
      type: 'text',
      text: '📊 <b>Session Status</b>\n\nNo active session.\n\nSend a message to start a new conversation, or tap the "New Chat" button.',
      parseMode: 'HTML',
      replyMarkup: createSessionControlKeyboard(),
    });
  }

  const duration = Math.floor((Date.now() - session.createdAt) / 1000 / 60);
  const lastActivity = Math.floor((Date.now() - session.lastActivity) / 1000);

  return createSuccessResponse({
    type: 'text',
    text: [
      '📊 <b>Session Status</b>',
      '',
      `🤖 Agent: <code>${session.agentType}</code>`,
      `⏱ Duration: ${duration} min`,
      `📝 Last activity: ${lastActivity} sec ago`,
      `🔖 Session ID: <code>${session.id.slice(-8)}</code>`,
    ].join('\n'),
    parseMode: 'HTML',
    replyMarkup: createSessionControlKeyboard(),
  });
};

/**
 * Handle help.show - Show help menu
 */
export const handleHelpShow: ActionHandler = async (context) => {
  const platformName = getPlatformDisplayName(context.platform);
  const helpText = [
    '❓ <b>ContextGo Assistant</b>',
    '',
    `A remote assistant to interact with ContextGo via ${platformName}.`,
    '',
    '<b>Common Actions:</b>',
    '• 🆕 New Chat - Start a new session',
    '• 📊 Status - View current session status',
    '• ❓ Help - Show this help message',
    '',
    'Send a message to chat with the AI assistant.',
  ].join('\n');

  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createHelpCard(),
    });
  }
  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkHelpCard(),
    });
  }
  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: helpText,
      parseMode: 'HTML',
      buttons: buildHelpActionButtons(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: helpText,
    parseMode: 'HTML',
    replyMarkup: createHelpKeyboard(),
  });
};

/**
 * Handle help.features - Show feature introduction
 */
export const handleHelpFeatures: ActionHandler = async (context) => {
  const featuresText = [
    '🤖 <b>Features</b>',
    '',
    '<b>AI Chat</b>',
    '• Natural language conversation',
    '• Streaming output, real-time display',
    '• Context memory support',
    '',
    '<b>Session Management</b>',
    '• Single session mode',
    '• Clear context anytime',
    '• View session status',
    '',
    '<b>Message Actions</b>',
    '• Copy reply content',
    '• Regenerate reply',
    '• Continue conversation',
  ].join('\n');

  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createFeaturesCard(),
    });
  }
  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkFeaturesCard(),
    });
  }
  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: featuresText,
      parseMode: 'HTML',
      buttons: buildHelpActionButtons(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: featuresText,
    parseMode: 'HTML',
    replyMarkup: createHelpKeyboard(),
  });
};

/**
 * Handle help.pairing - Show pairing guide
 */
export const handleHelpPairing: ActionHandler = async (context) => {
  const platformName = getPlatformDisplayName(context.platform);
  const pairingGuideText = [
    '🔗 <b>Pairing Guide</b>',
    '',
    '<b>First-time Setup:</b>',
    '1. Send any message to the bot',
    '2. Bot displays pairing code',
    '3. Approve pairing in ContextGo settings',
    '4. Ready to use after pairing',
    '',
    '<b>Notes:</b>',
    '• Pairing code valid for 10 minutes',
    '• ContextGo app must be running',
    `• One ${platformName} account can only pair once`,
  ].join('\n');

  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createPairingGuideCard(),
    });
  }
  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkPairingGuideCard(),
    });
  }
  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: pairingGuideText,
      parseMode: 'HTML',
      buttons: buildHelpActionButtons(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: pairingGuideText,
    parseMode: 'HTML',
    replyMarkup: createHelpKeyboard(),
  });
};

/**
 * Handle help.tips - Show usage tips
 */
export const handleHelpTips: ActionHandler = async (context) => {
  const tipsText = [
    '💬 <b>Tips</b>',
    '',
    '<b>Effective Conversations:</b>',
    '• Be clear and specific',
    '• Feel free to ask follow-ups',
    '• Regenerate if not satisfied',
    '',
    '<b>Quick Actions:</b>',
    '• Use bottom buttons for quick access',
    '• Tap message buttons for actions',
    '• New chat clears history context',
  ].join('\n');

  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createTipsCard(),
    });
  }
  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkTipsCard(),
    });
  }
  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: tipsText,
      parseMode: 'HTML',
      buttons: buildHelpActionButtons(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: tipsText,
    parseMode: 'HTML',
    replyMarkup: createHelpKeyboard(),
  });
};

/**
 * Handle settings.show - Show settings info
 */
export const handleSettingsShow: ActionHandler = async (context) => {
  const settingsText = [
    '⚙️ <b>Settings</b>',
    '',
    'Channel settings need to be configured in the ContextGo app.',
    '',
    'Open ContextGo → Settings → Agent入口 / Agent发布',
  ].join('\n');

  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createSettingsCard(),
    });
  }
  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkSettingsCard(),
    });
  }
  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: settingsText,
      parseMode: 'HTML',
      buttons: buildMainMenuActionButtons(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: settingsText,
    parseMode: 'HTML',
    replyMarkup: createMainMenuKeyboard(),
  });
};

/**
 * All system actions
 */
export const systemActions: IRegisteredAction[] = [
  {
    name: SystemActionNames.SESSION_NEW,
    category: 'system',
    description: 'Create a new conversation session',
    handler: handleSessionNew,
  },
  {
    name: SystemActionNames.SESSION_STATUS,
    category: 'system',
    description: 'Show current session status',
    handler: handleSessionStatus,
  },
  {
    name: SystemActionNames.HELP_SHOW,
    category: 'system',
    description: 'Show help menu',
    handler: handleHelpShow,
  },
  {
    name: SystemActionNames.HELP_FEATURES,
    category: 'system',
    description: 'Show feature introduction',
    handler: handleHelpFeatures,
  },
  {
    name: SystemActionNames.HELP_PAIRING,
    category: 'system',
    description: 'Show pairing guide',
    handler: handleHelpPairing,
  },
  {
    name: SystemActionNames.HELP_TIPS,
    category: 'system',
    description: 'Show usage tips',
    handler: handleHelpTips,
  },
  {
    name: SystemActionNames.SETTINGS_SHOW,
    category: 'system',
    description: 'Show settings info',
    handler: handleSettingsShow,
  },
];
