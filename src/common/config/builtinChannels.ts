/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

type BuiltinChannelDefinition = {
  pluginId: string;
  displayName: string;
  conversationSource: string;
  usesActionButtons: boolean;
};

export const BUILTIN_CHANNELS = {
  telegram: {
    pluginId: 'telegram_default',
    displayName: 'Telegram',
    conversationSource: 'telegram',
    usesActionButtons: false,
  },
  slack: {
    pluginId: 'slack_default',
    displayName: 'Slack',
    conversationSource: 'slack',
    usesActionButtons: true,
  },
  discord: {
    pluginId: 'discord_default',
    displayName: 'Discord',
    conversationSource: 'discord',
    usesActionButtons: true,
  },
  lark: {
    pluginId: 'lark_default',
    displayName: 'Lark',
    conversationSource: 'lark',
    usesActionButtons: false,
  },
  dingtalk: {
    pluginId: 'dingtalk_default',
    displayName: 'DingTalk',
    conversationSource: 'dingtalk',
    usesActionButtons: false,
  },
  weixin: {
    pluginId: 'weixin_default',
    displayName: 'WeChat',
    conversationSource: 'weixin',
    usesActionButtons: false,
  },
} as const satisfies Record<string, BuiltinChannelDefinition>;

export type BuiltinChannelType = keyof typeof BUILTIN_CHANNELS;
export type BuiltinChannelConversationSource = (typeof BUILTIN_CHANNELS)[BuiltinChannelType]['conversationSource'];

export const BUILTIN_CHANNEL_TYPES = Object.keys(BUILTIN_CHANNELS) as BuiltinChannelType[];
export const BUILTIN_CHANNEL_TYPE_SET = new Set<string>(BUILTIN_CHANNEL_TYPES);

export function isBuiltinChannelType(value: string): value is BuiltinChannelType {
  return BUILTIN_CHANNEL_TYPE_SET.has(value);
}

export function getBuiltinChannel(type: string): (typeof BUILTIN_CHANNELS)[BuiltinChannelType] | null {
  if (!isBuiltinChannelType(type)) {
    return null;
  }
  return BUILTIN_CHANNELS[type];
}

export function getBuiltinChannelByPluginId(pluginId: string): {
  type: BuiltinChannelType;
  definition: (typeof BUILTIN_CHANNELS)[BuiltinChannelType];
} | null {
  for (const type of BUILTIN_CHANNEL_TYPES) {
    const definition = BUILTIN_CHANNELS[type];
    if (pluginId === type || pluginId === definition.pluginId || pluginId.startsWith(`${type}_`)) {
      return { type, definition };
    }
  }
  return null;
}

export function getBuiltinChannelBotName(type: BuiltinChannelType): string {
  return `${BUILTIN_CHANNELS[type].displayName} Bot`;
}
