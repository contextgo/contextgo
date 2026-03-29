/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export { BasePlugin } from './BasePlugin';
export type { PluginMessageHandler } from './BasePlugin';

// Telegram plugin
export { TelegramPlugin } from './telegram/TelegramPlugin';
export * from './telegram/TelegramAdapter';
export * from './telegram/TelegramKeyboards';

// Lark plugin
export { LarkPlugin } from './lark/LarkPlugin';

// DingTalk plugin
export { DingTalkPlugin } from './dingtalk/DingTalkPlugin';

// Slack plugin
export { SlackPlugin } from './slack/SlackPlugin';

// Discord plugin
export { DiscordPlugin } from './discord/DiscordPlugin';

// WeChat plugin
export { WeixinPlugin } from './weixin/WeixinPlugin';
