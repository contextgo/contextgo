/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BuiltinChannelType } from '@/common/config/builtinChannels';
import { DingTalkPlugin } from '../plugins/dingtalk/DingTalkPlugin';
import { DiscordPlugin } from '../plugins/discord/DiscordPlugin';
import { LarkPlugin } from '../plugins/lark/LarkPlugin';
import { SlackPlugin } from '../plugins/slack/SlackPlugin';
import { TelegramPlugin } from '../plugins/telegram/TelegramPlugin';
import { WeixinPlugin } from '../plugins/weixin/WeixinPlugin';
import type { IPluginConfigOptions, IPluginCredentials } from '../types';
import type { BasePlugin } from '../plugins/BasePlugin';

type EnablePluginInput = Record<string, unknown>;

type BuiltinEnableResult = {
  credentials?: IPluginCredentials;
  config: IPluginConfigOptions;
};

type BuiltinTestResult = {
  success: boolean;
  botUsername?: string;
  error?: string;
};

type BuiltinRuntimeDefinition = {
  pluginClass: new () => BasePlugin;
  buildEnableResult: (
    config: EnablePluginInput,
    existingCredentials?: IPluginCredentials,
    existingRuntimeConfig?: IPluginConfigOptions
  ) => BuiltinEnableResult;
  testConnection?: (
    token: string,
    extraConfig?: Record<string, string | boolean | undefined>
  ) => Promise<BuiltinTestResult>;
};

function cloneRuntimeConfig(existingRuntimeConfig?: IPluginConfigOptions): IPluginConfigOptions {
  return existingRuntimeConfig ? { ...existingRuntimeConfig } : {};
}

export const BUILTIN_CHANNEL_RUNTIME: Record<BuiltinChannelType, BuiltinRuntimeDefinition> = {
  telegram: {
    pluginClass: TelegramPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const token = typeof config.token === 'string' ? config.token : undefined;
      return {
        credentials: token ? { token } : existingCredentials,
        config: cloneRuntimeConfig(existingRuntimeConfig),
      };
    },
    testConnection: async (token) => {
      const result = await TelegramPlugin.testConnection(token);
      return {
        success: result.success,
        botUsername: result.botInfo?.username,
        error: result.error,
      };
    },
  },
  slack: {
    pluginClass: SlackPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const botToken = typeof config.botToken === 'string' ? config.botToken : undefined;
      const appToken = typeof config.appToken === 'string' ? config.appToken : undefined;
      const runtimeConfig = cloneRuntimeConfig(existingRuntimeConfig);
      if (typeof config.requireMention === 'boolean') {
        runtimeConfig.requireMention = config.requireMention;
      }
      return {
        credentials: botToken && appToken ? { botToken, appToken } : existingCredentials,
        config: runtimeConfig,
      };
    },
    testConnection: async (token, extraConfig) => {
      const appToken = typeof extraConfig?.appToken === 'string' ? extraConfig.appToken : undefined;
      const result = await SlackPlugin.testConnection(token, appToken);
      return {
        success: result.success,
        botUsername: result.botInfo?.username,
        error: result.error,
      };
    },
  },
  discord: {
    pluginClass: DiscordPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const token = typeof config.token === 'string' ? config.token : undefined;
      const runtimeConfig = cloneRuntimeConfig(existingRuntimeConfig);
      if (typeof config.requireMention === 'boolean') {
        runtimeConfig.requireMention = config.requireMention;
      }
      return {
        credentials: token ? { token } : existingCredentials,
        config: runtimeConfig,
      };
    },
    testConnection: async (token) => {
      const result = await DiscordPlugin.testConnection(token);
      return {
        success: result.success,
        botUsername: result.botInfo?.username,
        error: result.error,
      };
    },
  },
  lark: {
    pluginClass: LarkPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const appId = typeof config.appId === 'string' ? config.appId : undefined;
      const appSecret = typeof config.appSecret === 'string' ? config.appSecret : undefined;
      const encryptKey = typeof config.encryptKey === 'string' ? config.encryptKey : undefined;
      const verificationToken = typeof config.verificationToken === 'string' ? config.verificationToken : undefined;
      return {
        credentials: appId && appSecret ? { appId, appSecret, encryptKey, verificationToken } : existingCredentials,
        config: cloneRuntimeConfig(existingRuntimeConfig),
      };
    },
    testConnection: async (_token, extraConfig) => {
      const appId = typeof extraConfig?.appId === 'string' ? extraConfig.appId : undefined;
      const appSecret = typeof extraConfig?.appSecret === 'string' ? extraConfig.appSecret : undefined;
      if (!appId || !appSecret) {
        return {
          success: false,
          error: 'App ID and App Secret are required for Lark',
        };
      }
      const result = await LarkPlugin.testConnection(appId, appSecret);
      return {
        success: result.success,
        botUsername: result.botInfo?.name,
        error: result.error,
      };
    },
  },
  dingtalk: {
    pluginClass: DingTalkPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const clientId = typeof config.clientId === 'string' ? config.clientId : undefined;
      const clientSecret = typeof config.clientSecret === 'string' ? config.clientSecret : undefined;
      return {
        credentials: clientId && clientSecret ? { clientId, clientSecret } : existingCredentials,
        config: cloneRuntimeConfig(existingRuntimeConfig),
      };
    },
    testConnection: async (_token, extraConfig) => {
      const clientId = typeof extraConfig?.appId === 'string' ? extraConfig.appId : undefined;
      const clientSecret = typeof extraConfig?.appSecret === 'string' ? extraConfig.appSecret : undefined;
      if (!clientId || !clientSecret) {
        return {
          success: false,
          error: 'Client ID and Client Secret are required for DingTalk',
        };
      }
      const result = await DingTalkPlugin.testConnection(clientId, clientSecret);
      return {
        success: result.success,
        botUsername: result.botInfo?.name,
        error: result.error,
      };
    },
  },
  weixin: {
    pluginClass: WeixinPlugin,
    buildEnableResult: (config, existingCredentials, existingRuntimeConfig) => {
      const accountId = typeof config.accountId === 'string' ? config.accountId : undefined;
      const botToken = typeof config.botToken === 'string' ? config.botToken : undefined;
      return {
        credentials: accountId && botToken ? { accountId, botToken } : existingCredentials,
        config: cloneRuntimeConfig(existingRuntimeConfig),
      };
    },
  },
};
