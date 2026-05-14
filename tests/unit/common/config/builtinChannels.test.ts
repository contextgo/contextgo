/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_CHANNELS,
  BUILTIN_CHANNEL_TYPES,
  getBuiltinChannel,
  getBuiltinChannelBotName,
  getBuiltinChannelByPluginId,
  isBuiltinChannelType,
} from '@/common/config/builtinChannels';

describe('builtinChannels', () => {
  it('exposes all built-in channel ids in a stable order', () => {
    expect(BUILTIN_CHANNEL_TYPES).toEqual(['telegram', 'slack', 'discord', 'lark', 'dingtalk', 'weixin']);
  });

  it('resolves built-in channels by plugin id and type', () => {
    expect(getBuiltinChannelByPluginId('slack_default')?.type).toBe('slack');
    expect(getBuiltinChannelByPluginId('discord')).toEqual({
      type: 'discord',
      definition: BUILTIN_CHANNELS.discord,
    });
    expect(getBuiltinChannelByPluginId('ext-wecom-bot')).toBeNull();
  });

  it('returns channel metadata and bot display names', () => {
    expect(getBuiltinChannel('lark')?.defaultModelConfigKey).toBe('assistant.lark.defaultModel');
    expect(getBuiltinChannel('weixin')?.agentConfigKey).toBe('assistant.weixin.agent');
    expect(getBuiltinChannelBotName('telegram')).toBe('Telegram Bot');
    expect(getBuiltinChannel('unknown')).toBeNull();
  });

  it('detects built-in channel types', () => {
    expect(isBuiltinChannelType('discord')).toBe(true);
    expect(isBuiltinChannelType('unknown')).toBe(false);
  });
});
