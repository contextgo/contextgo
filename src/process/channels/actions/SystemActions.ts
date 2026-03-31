/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpDetector } from '@process/agent/acp/AcpDetector';
import {
  BUILTIN_CHANNELS,
  getBuiltinChannel,
  type BuiltinChannelAgentConfigKey,
} from '@/common/config/builtinChannels';
import type { TProviderWithModel } from '@/common/config/storage';
import { ProcessConfig } from '@process/utils/initStorage';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import { getChannelMessageService } from '../agent/ChannelMessageService';
import { getChannelManager } from '../core/ChannelManager';
import { getChannelRouteResolver } from '../core/ChannelRouteResolver';
import {
  createAgentSelectionKeyboard,
  createHelpKeyboard,
  createMainMenuKeyboard,
  createSessionControlKeyboard,
} from '../plugins/telegram/TelegramKeyboards';
import { matchesAgentSelectionCallbackToken } from '../utils/agentSelection';
import {
  buildAgentSelectionActionButtons,
  buildHelpActionButtons,
  buildMainMenuActionButtons,
  buildSessionControlActionButtons,
  type GenericAgentButtonInfo,
} from '../utils/actionButtons';
import {
  createAgentSelectionCard,
  createFeaturesCard,
  createHelpCard,
  createMainMenuCard,
  createPairingGuideCard,
  createSessionStatusCard,
  createSettingsCard,
  createTipsCard,
} from '../plugins/lark/LarkCards';
import {
  createAgentSelectionCard as createDingTalkAgentSelectionCard,
  createFeaturesCard as createDingTalkFeaturesCard,
  createHelpCard as createDingTalkHelpCard,
  createMainMenuCard as createDingTalkMainMenuCard,
  createPairingGuideCard as createDingTalkPairingGuideCard,
  createSessionStatusCard as createDingTalkSessionStatusCard,
  createSettingsCard as createDingTalkSettingsCard,
  createTipsCard as createDingTalkTipsCard,
} from '../plugins/dingtalk/DingTalkCards';
import type { ChannelAgentType, PluginType } from '../types';
import type { ActionHandler, IRegisteredAction } from './types';
import { SystemActionNames, createErrorResponse, createSuccessResponse } from './types';
import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import { ACP_BACKENDS_ALL } from '@/common/types/acpTypes';
import type { AcpBackendAll } from '@/common/types/acpTypes';

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

function backendToOverrideAgentType(backend: string): ChannelAgentType {
  if (backend === 'gemini' || backend === 'codex' || backend === 'openclaw-gateway') {
    return backend;
  }
  return 'acp';
}

/**
 * Get the default model for Channel assistant (Telegram/Lark)
 * Reads from saved config or falls back to default Gemini model
 */

export async function getChannelDefaultModel(platform: PluginType): Promise<TProviderWithModel> {
  try {
    const providers = await ProcessConfig.get('model.config');
    const providerList = providers && Array.isArray(providers) ? providers : [];

    // Helper: find a provider with a valid API key
    const findProviderWithApiKey = (providerId: string, modelName: string): TProviderWithModel | null => {
      const provider = providerList.find((p) => p.id === providerId);
      if (provider?.apiKey && provider.model?.includes(modelName)) {
        return { ...provider, useModel: modelName } as TProviderWithModel;
      }
      return null;
    };

    // Try to get saved model selection
    const savedModel = await ProcessConfig.get(
      getBuiltinChannel(platform)?.defaultModelConfigKey ?? BUILTIN_CHANNELS.telegram.defaultModelConfigKey
    );
    if (savedModel?.id && savedModel?.useModel) {
      // Google Auth is frontend-only (OAuth browser flow), not usable in channels.
      // Fall through to find a provider with a valid API key instead.
      if (savedModel.id === GOOGLE_AUTH_PROVIDER_ID) {
        console.warn(
          `[SystemActions] Google Auth is not supported in channel mode (${platform}), falling back to API key provider`
        );
        // Try to find any Gemini provider with API key for the same model
        const fallback = providerList.find(
          (p) => p.platform === 'gemini' && p.apiKey && p.model?.includes(savedModel.useModel)
        );
        if (fallback) {
          return {
            ...fallback,
            useModel: savedModel.useModel,
          } as TProviderWithModel;
        }
        // Otherwise fall through to general fallback below
      } else {
        // For regular (API-key-based) providers, look up full config
        const result = findProviderWithApiKey(savedModel.id, savedModel.useModel);
        if (result) return result;
      }
    }

    // Fallback: try to get any Gemini provider with a valid API key
    const geminiProvider = providerList.find((p) => p.platform === 'gemini' && p.apiKey && p.model?.length);
    if (geminiProvider) {
      return {
        ...geminiProvider,
        useModel: geminiProvider.model[0],
      } as TProviderWithModel;
    }

    // Last resort: any provider with a valid API key
    const anyProvider = providerList.find((p) => p.apiKey && p.model?.length);
    if (anyProvider) {
      console.warn(`[SystemActions] No Gemini provider with API key, using ${anyProvider.platform} provider`);
      return {
        ...anyProvider,
        useModel: anyProvider.model[0],
      } as TProviderWithModel;
    }
  } catch (error) {
    console.warn('[SystemActions] Failed to get saved model, using default:', error);
  }

  // Default fallback - minimal config for Gemini (no API key — will fail with clear error)
  console.error('[SystemActions] No provider with valid API key found. Channel messages will fail.');
  return {
    id: 'gemini_default',
    platform: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    useModel: 'gemini-2.0-flash',
  };
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
    'Open ContextGo → WebUI → Channels',
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
 * Handle agent.show - Show agent selection keyboard/card
 */
export const handleAgentShow: ActionHandler = async (context) => {
  // Get available agents dynamically
  const availableAgents = getAvailableChannelAgents();
  if (availableAgents.length === 0) {
    return createErrorResponse('No agents available');
  }

  const currentAgentConfig = await getSavedChannelAgentConfig(context.platform);
  const currentAgentKey = buildAgentKey(
    currentAgentConfig.backend,
    currentAgentConfig.customAgentId,
    currentAgentConfig.name
  );
  const currentAgent = availableAgents.find((agent) => agent.key === currentAgentKey);
  const currentAgentDisplayName = currentAgent
    ? getDisplayNameForAgent(currentAgent.backend, currentAgent.name)
    : getDisplayNameForAgent(currentAgentConfig.backend, currentAgentConfig.name);

  // Use platform-specific markup
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createAgentSelectionCard(availableAgents, currentAgentKey),
    });
  }

  if (context.platform === 'dingtalk') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createDingTalkAgentSelectionCard(availableAgents, currentAgentKey),
    });
  }

  if (usesActionButtons(context.platform)) {
    return createSuccessResponse({
      type: 'text',
      text: [
        '🔄 <b>Switch Agent</b>',
        '',
        'Select an AI agent for your conversations:',
        '',
        `Current: <b>${currentAgentDisplayName}</b>`,
      ].join('\n'),
      parseMode: 'HTML',
      buttons: buildAgentSelectionActionButtons(availableAgents, currentAgentKey),
    });
  }

  return createSuccessResponse({
    type: 'text',
    text: [
      '🔄 <b>Switch Agent</b>',
      '',
      'Select an AI agent for your conversations:',
      '',
      `Current: <b>${currentAgentDisplayName}</b>`,
    ].join('\n'),
    parseMode: 'HTML',
    replyMarkup: createAgentSelectionKeyboard(availableAgents, currentAgentKey),
  });
};

/**
 * Handle agent.select - Switch to a different agent
 */
export const handleAgentSelect: ActionHandler = async (context, params) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  if (!context.channelUser) {
    return createErrorResponse('User not authorized');
  }

  const newAgentKey = params?.agentKey;

  // Validate selected agent key
  const availableAgents = getAvailableChannelAgents();
  const selectedAgent = availableAgents.find((agent) =>
    newAgentKey ? matchesAgentSelectionCallbackToken(agent, newAgentKey) : false
  );
  if (!newAgentKey || !selectedAgent) {
    return createErrorResponse('Invalid or unavailable agent');
  }

  const selectedAgentName = getDisplayNameForAgent(selectedAgent.backend, selectedAgent.name);
  const selectedAgentConfig: SavedChannelAgentConfig = {
    backend:
      selectedAgent.backend in ACP_BACKENDS_ALL
        ? (selectedAgent.backend as AcpBackendAll)
        : ('gemini' as AcpBackendAll),
    customAgentId: selectedAgent.customAgentId,
    name: selectedAgent.name,
  };
  const currentAgentConfig = await getSavedChannelAgentConfig(context.platform);
  const currentAgentKey = buildAgentKey(
    currentAgentConfig.backend,
    currentAgentConfig.customAgentId,
    currentAgentConfig.name
  );

  // If same selected agent, no need to switch
  if (currentAgentKey === selectedAgent.key) {
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
      text: `✓ Already using <b>${selectedAgentName}</b>`,
      parseMode: 'HTML',
      ...(markup ? { replyMarkup: markup } : {}),
      ...(usesActionButtons(context.platform) ? { buttons: buildMainMenuActionButtons() } : {}),
    });
  }

  // Persist selected agent backend for this platform
  try {
    await ProcessConfig.set(getChannelAgentConfigPath(context.platform), selectedAgentConfig);
  } catch (error) {
    return createErrorResponse(
      `Failed to save selected agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Get current session (scoped by chatId)
  const existingSession = sessionManager.getSession(context.channelUser.id, context.chatId);
  if (currentAgentKey === selectedAgent.key) {
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
      text: `✓ Already using <b>${selectedAgentName}</b>`,
      parseMode: 'HTML',
      ...(markup ? { replyMarkup: markup } : {}),
      ...(usesActionButtons(context.platform) ? { buttons: buildMainMenuActionButtons() } : {}),
    });
  }

  // Clear existing session and agent (scoped by chatId)
  if (existingSession) {
    const messageService = getChannelMessageService();
    await messageService.clearContext(existingSession.id);

    if (existingSession.conversationId) {
      try {
        workerTaskManager.kill(existingSession.conversationId);
      } catch (err) {
        console.warn(`[SystemActions] Failed to kill old conversation:`, err);
      }
    }
  }
  await sessionManager.clearSession(context.channelUser.id, context.chatId);
  try {
    const route = await getChannelRouteResolver().resolveAuthorizedRoute({
      platform: context.platform,
      pluginId: context.pluginId,
      platformUserId: context.userId,
      chatId: context.chatId,
      displayName: context.displayName,
      forceNewConversation: true,
      overrideAgentType: backendToOverrideAgentType(selectedAgentConfig.backend),
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
  } catch (error) {
    return createErrorResponse(`Failed to switch agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    text: [
      `✓ <b>Switched to ${selectedAgentName}</b>`,
      '',
      'A new conversation has been started.',
      '',
      'Send a message to begin!',
    ].join('\n'),
    parseMode: 'HTML',
    ...(markup ? { replyMarkup: markup } : {}),
    ...(usesActionButtons(context.platform) ? { buttons: buildMainMenuActionButtons() } : {}),
  });
};

type SavedChannelAgentConfig = {
  backend: AcpBackendAll;
  customAgentId?: string;
  name?: string;
  openclawAgentId?: string;
  workspace?: string;
  cliPath?: string;
};

function getChannelAgentConfigPath(platform: PluginType): BuiltinChannelAgentConfigKey {
  return getBuiltinChannel(platform)?.agentConfigKey ?? BUILTIN_CHANNELS.telegram.agentConfigKey;
}

function normalizeChannelAgentConfig(value: unknown): SavedChannelAgentConfig {
  if (!value || typeof value !== 'object') {
    return { backend: 'gemini' };
  }

  const record = value as Record<string, unknown>;
  const backend =
    typeof record.backend === 'string' && record.backend in ACP_BACKENDS_ALL
      ? (record.backend as AcpBackendAll)
      : 'gemini';
  const customAgentId =
    typeof record.customAgentId === 'string' && record.customAgentId.length > 0 ? record.customAgentId : undefined;
  const name = typeof record.name === 'string' && record.name.length > 0 ? record.name : undefined;
  const openclawAgentId =
    typeof record.openclawAgentId === 'string' && record.openclawAgentId.length > 0
      ? record.openclawAgentId
      : undefined;
  const workspace = typeof record.workspace === 'string' && record.workspace.length > 0 ? record.workspace : undefined;
  const cliPath = typeof record.cliPath === 'string' && record.cliPath.length > 0 ? record.cliPath : undefined;

  return { backend, customAgentId, name, openclawAgentId, workspace, cliPath };
}

async function getSavedChannelAgentConfig(platform: PluginType): Promise<SavedChannelAgentConfig> {
  try {
    const savedAgent = await ProcessConfig.get(getChannelAgentConfigPath(platform));
    return normalizeChannelAgentConfig(savedAgent);
  } catch {
    return { backend: 'gemini' };
  }
}

function buildAgentKey(backend: string, customAgentId?: string, name?: string): string {
  if (customAgentId) {
    return `${backend}:${customAgentId}`;
  }
  if (backend === 'custom' && name) {
    return `${backend}:${name}`;
  }
  return backend;
}

function getDisplayNameForAgent(backend: string, name?: string): string {
  if (name && name.length > 0) {
    return `${getAgentEmoji(backend)} ${name}`;
  }
  const fallbackNames: Record<string, string> = {
    gemini: 'Gemini',
    claude: 'Claude',
    codex: 'Codex',
    qwen: 'Qwen',
    codebuddy: 'CodeBuddy',
    opencode: 'OpenCode',
    kimi: 'Kimi',
    copilot: 'Copilot',
    'openclaw-gateway': 'OpenClaw',
    custom: 'Custom Agent',
  };
  return `${getAgentEmoji(backend)} ${fallbackNames[backend] || backend}`;
}

/**
 * Get emoji for agent backend
 */
function getAgentEmoji(backend: string): string {
  const emojis: Record<string, string> = {
    gemini: '🤖',
    claude: '🧠',
    codex: '⚡',
    qwen: '🌊',
    codebuddy: '🧩',
    opencode: '🛠️',
    kimi: '🌙',
    copilot: '🚁',
    cursor: '🎯',
    goose: '🪿',
    droid: '🤖',
    iflow: '🌊',
    qoder: '🧠',
    vibe: '🎵',
    nanobot: '🧬',
    auggie: '🧪',
    custom: '🧩',
    'openclaw-gateway': '🦞',
  };
  return emojis[backend] || '🤖';
}

/**
 * Get available agents for channel selection
 * Filters detected agents to only those supported by channels
 */
function getAvailableChannelAgents(): GenericAgentButtonInfo[] {
  const detectedAgents = acpDetector.getDetectedAgents();
  const availableAgents: GenericAgentButtonInfo[] = [];
  const seenKeys = new Set<string>();

  const addAgent = (backend: string, name: string, customAgentId?: string) => {
    const key = buildAgentKey(backend, customAgentId, name);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    availableAgents.push({
      key,
      backend,
      emoji: getAgentEmoji(backend),
      name,
      customAgentId,
    });
  };

  // Always include Gemini as built-in fallback.
  addAgent('gemini', 'Gemini');

  for (const agent of detectedAgents) {
    if (agent.isPreset) {
      continue;
    }

    const backend = agent.backend;
    if (!backend) {
      continue;
    }

    addAgent(backend, agent.name || backend, agent.customAgentId);
  }

  return availableAgents;
}

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
  {
    name: SystemActionNames.AGENT_SHOW,
    category: 'system',
    description: 'Show agent selection',
    handler: handleAgentShow,
  },
  {
    name: SystemActionNames.AGENT_SELECT,
    category: 'system',
    description: 'Switch to a different agent',
    handler: handleAgentSelect,
  },
];
