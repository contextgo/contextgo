/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider, TProviderWithModel } from '@/common/config/storage';
import { getBuiltinChannel } from '@/common/config/builtinChannels';
import { acpDetector } from '@process/agent/acp/AcpDetector';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import { ProcessConfig } from '@process/utils/initStorage';
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
import { resolveAgentSelectionCallbackToken } from '../utils/agentSelection';
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
import { resolveChannelConvType, type PluginType } from '../types';
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

type DetectedChannelAgent = ReturnType<typeof acpDetector.getDetectedAgents>[number];

type SavedChannelAgentConfig = {
  backend: string;
  name?: string;
  customAgentId?: string;
  presetAgentType?: string;
};

const DEFAULT_CHANNEL_MODEL: TProviderWithModel = {
  id: 'gemini_default',
  platform: 'gemini',
  name: 'Gemini',
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: '',
  useModel: 'gemini-2.0-flash',
};

function toProviderWithModel(provider: IProvider, useModel: string): TProviderWithModel {
  return {
    ...provider,
    useModel,
  };
}

function resolveStoredPreferredModel(value: unknown): { id: string; useModel: string } | undefined {
  if (typeof value === 'string' && value.trim()) {
    return {
      id: DEFAULT_CHANNEL_MODEL.id,
      useModel: value.trim(),
    };
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.useModel !== 'string') {
    return undefined;
  }

  return {
    id: record.id,
    useModel: record.useModel,
  };
}

function resolveChannelAgentSessionType(backend: string): 'gemini' | 'acp' | 'codex' {
  const { convType } = resolveChannelConvType(backend);
  return convType as 'gemini' | 'acp' | 'codex';
}

function resolveChannelAgentEmoji(backend: string): string {
  if (backend === 'claude') {
    return '🧠';
  }
  if (backend === 'gemini') {
    return '✨';
  }
  if (backend === 'codex') {
    return '⌘';
  }
  return '🤖';
}

function buildDetectedAgentSelectionKey(agent: Pick<DetectedChannelAgent, 'backend' | 'customAgentId'>): string {
  if (agent.customAgentId) {
    return `${agent.backend}:${agent.customAgentId}`;
  }
  return agent.backend;
}

function resolveDetectedChannelAgent(agentKey: string): DetectedChannelAgent | null {
  const normalizedKey = resolveAgentSelectionCallbackToken(agentKey)?.key ?? agentKey;
  if (!normalizedKey.trim()) {
    return null;
  }

  const detectedAgents = acpDetector.getDetectedAgents();
  return (
    detectedAgents.find((agent) => {
      const selectionKey = buildDetectedAgentSelectionKey(agent);
      return selectionKey === normalizedKey || agent.backend === normalizedKey;
    }) ?? null
  );
}

function buildMainMenuDecoration(platform: PluginType): Record<string, unknown> {
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

export async function getChannelDefaultModel(platform: PluginType): Promise<TProviderWithModel> {
  const builtinChannel = getBuiltinChannel(platform);

  try {
    const preferred = builtinChannel
      ? resolveStoredPreferredModel(await ProcessConfig.get(builtinChannel.defaultModelConfigKey))
      : undefined;
    const providers = (await ProcessConfig.get('model.config')) as IProvider[] | undefined;
    const providerList = Array.isArray(providers) ? providers : [];

    if (preferred) {
      const matchedProvider = providerList.find(
        (provider) => provider.id === preferred.id && provider.model?.includes(preferred.useModel)
      );
      if (matchedProvider) {
        return toProviderWithModel(matchedProvider, preferred.useModel);
      }
    }

    const geminiProvider = providerList.find(
      (provider) => provider.platform === 'gemini' && provider.apiKey && provider.model?.length
    );
    if (geminiProvider) {
      return toProviderWithModel(geminiProvider, geminiProvider.model[0]);
    }

    const availableProvider = providerList.find((provider) => provider.apiKey && provider.model?.length);
    if (availableProvider) {
      return toProviderWithModel(availableProvider, availableProvider.model[0]);
    }
  } catch {
    return DEFAULT_CHANNEL_MODEL;
  }

  return DEFAULT_CHANNEL_MODEL;
}

export const handleAgentSelect: ActionHandler = async (context, params) => {
  const builtinChannel = getBuiltinChannel(context.platform);
  if (!builtinChannel) {
    return createErrorResponse('Unsupported channel platform');
  }
  if (!context.channelUser) {
    return createErrorResponse('User not authorized');
  }

  const agentKey = typeof params?.agentKey === 'string' ? params.agentKey : '';
  const selectedAgent = resolveDetectedChannelAgent(agentKey);
  if (!selectedAgent) {
    return createErrorResponse('Invalid or unavailable agent');
  }

  const savedAgentConfig: SavedChannelAgentConfig = {
    backend: selectedAgent.backend,
    name: selectedAgent.name,
    ...(selectedAgent.customAgentId ? { customAgentId: selectedAgent.customAgentId } : {}),
    ...(selectedAgent.presetAgentType ? { presetAgentType: selectedAgent.presetAgentType } : {}),
  };

  await ProcessConfig.set(builtinChannel.agentConfigKey, savedAgentConfig);

  const sessionManager = getChannelManager().getSessionManager();
  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  const existingSession = sessionManager.getSession(context.channelUser.id, context.chatId);
  if (existingSession) {
    await getChannelMessageService().clearContext(existingSession.id);
    if (existingSession.conversationId) {
      try {
        workerTaskManager.kill(existingSession.conversationId);
      } catch (error) {
        console.warn('[SystemActions] Failed to kill conversation during agent switch:', error);
      }
    }
  }

  await sessionManager.clearSession(context.channelUser.id, context.chatId);

  const route = await getChannelRouteResolver().resolveAuthorizedRoute({
    platform: context.platform,
    pluginId: context.pluginId,
    platformUserId: context.userId,
    chatId: context.chatId,
    displayName: context.displayName,
    forceNewConversation: true,
    overrideAgentType: resolveChannelAgentSessionType(selectedAgent.backend),
  });

  await sessionManager.storeSession(route.session);
  context.channelUser = route.channelUser;
  context.connector = route.connector;
  context.remoteIdentity = route.remoteIdentity;
  context.channelBinding = route.binding;
  context.agentProfile = route.agentProfile;
  context.externalSession = route.externalSession;
  context.sessionId = route.session.id;
  context.conversationId = route.conversation.id;

  return createSuccessResponse({
    type: 'text',
    text: `Switched to <b>${resolveChannelAgentEmoji(selectedAgent.backend)} ${selectedAgent.name}</b>`,
    parseMode: 'HTML',
    ...buildMainMenuDecoration(context.platform),
  });
};

export const handleAgentShow: ActionHandler = async (context) => {
  const builtinChannel = getBuiltinChannel(context.platform);
  if (!builtinChannel) {
    return createErrorResponse('Unsupported channel platform');
  }

  const savedConfig = (await ProcessConfig.get(builtinChannel.agentConfigKey)) as SavedChannelAgentConfig | undefined;
  const savedKey = savedConfig?.customAgentId
    ? `${savedConfig.backend}:${savedConfig.customAgentId}`
    : savedConfig?.backend;
  const detectedAgent = savedKey ? resolveDetectedChannelAgent(savedKey) : null;
  const backend = detectedAgent?.backend ?? savedConfig?.backend ?? 'gemini';
  const displayName = detectedAgent?.name ?? savedConfig?.name ?? backend;

  return createSuccessResponse({
    type: 'text',
    text: `Current: <b>${resolveChannelAgentEmoji(backend)} ${displayName}</b>`,
    parseMode: 'HTML',
    ...buildMainMenuDecoration(context.platform),
  });
};

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
