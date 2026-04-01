/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILTIN_CHANNEL_TYPE_SET, BUILTIN_CHANNEL_TYPES } from '@/common/config/builtinChannels';
import type { IChannelPluginStatus } from '@process/channels/types';
import { channel, webui, type IWebUIStatus } from '@/common/adapter/ipcBridge';
import ContextGoScrollArea from '@/renderer/components/base/ContextGoScrollArea';
import { Input, InputNumber, Message, Select, Switch } from '@arco-design/web-react';
import { CheckOne } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsViewMode } from '../../settingsViewContext';
import ChannelItem from './ChannelItem';
import SessionHandoffPanel from './SessionHandoffPanel';
import type { ChannelConfig } from './types';
import PublicationBindingPanel from './publication/PublicationBindingPanel';
import {
  DiscordConfigForm,
  DingTalkConfigForm,
  LarkConfigForm,
  SlackConfigForm,
  TelegramConfigForm,
  WeixinConfigForm,
} from './configForms';

type ExtensionFieldType = 'text' | 'password' | 'select' | 'number' | 'boolean';

type ExtensionFieldSchema = {
  key: string;
  label: string;
  type: ExtensionFieldType;
  required?: boolean;
  options?: string[];
  default?: string | number | boolean;
};

type ExtensionFieldValues = Record<string, Record<string, string | number | boolean>>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Assistant Settings Content Component
 */
const ChannelModalContent: React.FC<{ mode?: 'channels' | 'sessions' }> = ({ mode = 'channels' }) => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  // Plugin state
  const [pluginStatus, setPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [slackPluginStatus, setSlackPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [discordPluginStatus, setDiscordPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [larkPluginStatus, setLarkPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [dingtalkPluginStatus, setDingtalkPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [weixinPluginStatus, setWeixinPluginStatus] = useState<IChannelPluginStatus | null>(null);
  const [enableLoading, setEnableLoading] = useState(false);
  const [slackEnableLoading, setSlackEnableLoading] = useState(false);
  const [discordEnableLoading, setDiscordEnableLoading] = useState(false);
  const [larkEnableLoading, setLarkEnableLoading] = useState(false);
  const [dingtalkEnableLoading, setDingtalkEnableLoading] = useState(false);
  const [weixinEnableLoading, setWeixinEnableLoading] = useState(false);
  const [extensionStatuses, setExtensionStatuses] = useState<Record<string, IChannelPluginStatus>>({});
  const [extensionLoadingMap, setExtensionLoadingMap] = useState<Record<string, boolean>>({});
  const [extensionFieldValues, setExtensionFieldValues] = useState<ExtensionFieldValues>({});
  const [webuiStatus, setWebuiStatus] = useState<IWebUIStatus | null>(null);

  // Track the token entered in TelegramConfigForm so the toggle handler can use it
  const telegramTokenRef = React.useRef<string>('');
  const slackConfigRef = React.useRef<{ botToken: string; appToken: string; requireMention: boolean }>({
    botToken: '',
    appToken: '',
    requireMention: true,
  });
  const discordConfigRef = React.useRef<{ token: string; requireMention: boolean }>({
    token: '',
    requireMention: true,
  });

  // Collapse state - true means collapsed (closed), false means expanded (open)
  const [collapseKeys, setCollapseKeys] = useState<Record<string, boolean>>(
    Object.fromEntries(BUILTIN_CHANNEL_TYPES.map((type) => [type, true]))
  );

  // Load plugin status
  const loadPluginStatus = useCallback(async () => {
    try {
      const result = await channel.getPluginStatus.invoke();
      if (result.success && result.data) {
        const telegramPlugin = result.data.find((p) => p.type === 'telegram');
        const slackPlugin = result.data.find((p) => p.type === 'slack');
        const discordPlugin = result.data.find((p) => p.type === 'discord');
        const larkPlugin = result.data.find((p) => p.type === 'lark');
        const dingtalkPlugin = result.data.find((p) => p.type === 'dingtalk');
        const weixinPlugin = result.data.find((p) => p.type === 'weixin');
        const extensionPlugins = result.data.filter((p) => !BUILTIN_CHANNEL_TYPE_SET.has(p.type));

        setPluginStatus(telegramPlugin || null);
        setSlackPluginStatus(slackPlugin || null);
        setDiscordPluginStatus(discordPlugin || null);
        setLarkPluginStatus(larkPlugin || null);
        setDingtalkPluginStatus(dingtalkPlugin || null);
        setWeixinPluginStatus(weixinPlugin || null);
        setExtensionStatuses(() => {
          const next: Record<string, IChannelPluginStatus> = {};
          for (const plugin of extensionPlugins) {
            next[plugin.type] = plugin;
          }
          return next;
        });

        setExtensionFieldValues((prev) => {
          const next: ExtensionFieldValues = { ...prev };
          for (const plugin of extensionPlugins) {
            const fields = [
              ...(plugin.extensionMeta?.credentialFields || []),
              ...(plugin.extensionMeta?.configFields || []),
            ] as ExtensionFieldSchema[];
            if (!next[plugin.type]) {
              next[plugin.type] = {};
            }
            for (const field of fields) {
              if (next[plugin.type][field.key] === undefined && field.default !== undefined) {
                next[plugin.type][field.key] = field.default;
              }
            }
          }
          return next;
        });
      }
    } catch (error) {
      console.error('[ChannelSettings] Failed to load plugin status:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadPluginStatus();
  }, [loadPluginStatus]);

  useEffect(() => {
    const loadWebuiStatus = async () => {
      try {
        const result = await webui.getStatus.invoke();
        if (result?.success && result.data) {
          setWebuiStatus(result.data);
        }
      } catch {
        // Best-effort only: channel settings should not fail if webui status is unavailable.
      }
    };
    void loadWebuiStatus();
  }, []);

  // Listen for plugin status changes
  useEffect(() => {
    const unsubscribe = channel.pluginStatusChanged.on(({ status }) => {
      if (status.type === 'telegram') {
        setPluginStatus(status);
      } else if (status.type === 'slack') {
        setSlackPluginStatus(status);
      } else if (status.type === 'discord') {
        setDiscordPluginStatus(status);
      } else if (status.type === 'lark') {
        setLarkPluginStatus(status);
      } else if (status.type === 'dingtalk') {
        setDingtalkPluginStatus(status);
      } else if (status.type === 'weixin') {
        setWeixinPluginStatus(status);
      } else if (!BUILTIN_CHANNEL_TYPE_SET.has(status.type)) {
        setExtensionStatuses((prev) => ({
          ...prev,
          [status.type]: {
            ...prev[status.type],
            ...status,
            extensionMeta: status.extensionMeta || prev[status.type]?.extensionMeta,
          },
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Toggle collapse
  const handleToggleCollapse = (channelId: string) => {
    setCollapseKeys((prev) => ({
      ...prev,
      [channelId]: !prev[channelId],
    }));
  };

  // Enable/Disable plugin
  const handleTogglePlugin = async (enabled: boolean) => {
    setEnableLoading(true);
    try {
      if (enabled) {
        // Check if we have a token - either saved in database or entered in the form
        const pendingToken = telegramTokenRef.current.trim();
        if (!pluginStatus?.hasToken && !pendingToken) {
          Message.warning(t('settings.assistant.tokenRequired', 'Please enter a bot token first'));
          setEnableLoading(false);
          return;
        }

        const result = await channel.enablePlugin.invoke({
          pluginId: 'telegram_default',
          config: pendingToken ? { token: pendingToken } : {},
        });

        if (result.success) {
          Message.success(t('settings.assistant.pluginEnabled', 'Telegram bot enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.assistant.enableFailed', 'Failed to enable plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'telegram_default',
        });

        if (result.success) {
          Message.success(t('settings.assistant.pluginDisabled', 'Telegram bot disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.assistant.disableFailed', 'Failed to disable plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setEnableLoading(false);
    }
  };

  const handleToggleSlackPlugin = async (enabled: boolean) => {
    setSlackEnableLoading(true);
    try {
      if (enabled) {
        const pendingBotToken = slackConfigRef.current.botToken.trim();
        const pendingAppToken = slackConfigRef.current.appToken.trim();

        if (!slackPluginStatus?.hasToken && (!pendingBotToken || !pendingAppToken)) {
          Message.warning(t('settings.slack.credentialsRequired', 'Please enter Slack bot and app tokens'));
          setSlackEnableLoading(false);
          return;
        }

        const result = await channel.enablePlugin.invoke({
          pluginId: 'slack_default',
          config:
            pendingBotToken && pendingAppToken
              ? {
                  botToken: pendingBotToken,
                  appToken: pendingAppToken,
                  requireMention: slackConfigRef.current.requireMention,
                }
              : {},
        });

        if (result.success) {
          Message.success(t('settings.slack.pluginEnabled', 'Slack bot enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.slack.enableFailed', 'Failed to enable Slack plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'slack_default',
        });

        if (result.success) {
          Message.success(t('settings.slack.pluginDisabled', 'Slack bot disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.slack.disableFailed', 'Failed to disable Slack plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setSlackEnableLoading(false);
    }
  };

  const handleToggleDiscordPlugin = async (enabled: boolean) => {
    setDiscordEnableLoading(true);
    try {
      if (enabled) {
        const pendingToken = discordConfigRef.current.token.trim();

        if (!discordPluginStatus?.hasToken && !pendingToken) {
          Message.warning(t('settings.discord.tokenRequired', 'Please enter a Discord bot token'));
          setDiscordEnableLoading(false);
          return;
        }

        const result = await channel.enablePlugin.invoke({
          pluginId: 'discord_default',
          config: pendingToken
            ? {
                token: pendingToken,
                requireMention: discordConfigRef.current.requireMention,
              }
            : {},
        });

        if (result.success) {
          Message.success(t('settings.discord.pluginEnabled', 'Discord bot enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.discord.enableFailed', 'Failed to enable Discord plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'discord_default',
        });

        if (result.success) {
          Message.success(t('settings.discord.pluginDisabled', 'Discord bot disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.discord.disableFailed', 'Failed to disable Discord plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setDiscordEnableLoading(false);
    }
  };

  // Enable/Disable Lark plugin
  const handleToggleLarkPlugin = async (enabled: boolean) => {
    setLarkEnableLoading(true);
    try {
      if (enabled) {
        // Check if we have credentials - already saved in database
        if (!larkPluginStatus?.hasToken) {
          Message.warning(t('settings.lark.credentialsRequired', 'Please configure Lark credentials first'));
          setLarkEnableLoading(false);
          return;
        }

        const result = await channel.enablePlugin.invoke({
          pluginId: 'lark_default',
          config: {},
        });

        if (result.success) {
          Message.success(t('settings.lark.pluginEnabled', 'Lark bot enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.lark.enableFailed', 'Failed to enable Lark plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'lark_default',
        });

        if (result.success) {
          Message.success(t('settings.lark.pluginDisabled', 'Lark bot disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.assistant.disableFailed', 'Failed to disable plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setLarkEnableLoading(false);
    }
  };

  // Enable/Disable DingTalk plugin
  const handleToggleDingtalkPlugin = async (enabled: boolean) => {
    setDingtalkEnableLoading(true);
    try {
      if (enabled) {
        if (!dingtalkPluginStatus?.hasToken) {
          Message.warning(t('settings.dingtalk.credentialsRequired', 'Please configure DingTalk credentials first'));
          setDingtalkEnableLoading(false);
          return;
        }

        const result = await channel.enablePlugin.invoke({
          pluginId: 'dingtalk_default',
          config: {},
        });

        if (result.success) {
          Message.success(t('settings.dingtalk.pluginEnabled', 'DingTalk bot enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.dingtalk.enableFailed', 'Failed to enable DingTalk plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'dingtalk_default',
        });

        if (result.success) {
          Message.success(t('settings.dingtalk.pluginDisabled', 'DingTalk bot disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.dingtalk.disableFailed', 'Failed to disable DingTalk plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setDingtalkEnableLoading(false);
    }
  };

  // Enable/Disable WeChat plugin
  const handleToggleWeixinPlugin = async (enabled: boolean) => {
    setWeixinEnableLoading(true);
    try {
      if (enabled) {
        if (!weixinPluginStatus?.hasToken) {
          Message.warning(t('settings.weixin.loginRequired', 'Please login with WeChat QR code first'));
          setWeixinEnableLoading(false);
          return;
        }
        const result = await channel.enablePlugin.invoke({
          pluginId: 'weixin_default',
          config: {},
        });
        if (result.success) {
          Message.success(t('settings.weixin.pluginEnabled', 'WeChat channel enabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.weixin.enableFailed', 'Failed to enable WeChat plugin'));
        }
      } else {
        const result = await channel.disablePlugin.invoke({
          pluginId: 'weixin_default',
        });
        if (result.success) {
          Message.success(t('settings.weixin.pluginDisabled', 'WeChat channel disabled'));
          await loadPluginStatus();
        } else {
          Message.error(result.msg || t('settings.weixin.disableFailed', 'Failed to disable WeChat plugin'));
        }
      }
    } catch (error) {
      Message.error(getErrorMessage(error));
    } finally {
      setWeixinEnableLoading(false);
    }
  };

  const updateExtensionFieldValue = useCallback((pluginType: string, key: string, value: string | number | boolean) => {
    setExtensionFieldValues((prev) => ({
      ...prev,
      [pluginType]: {
        ...prev[pluginType],
        [key]: value,
      },
    }));
  }, []);

  const handleToggleExtensionPlugin = useCallback(
    async (pluginType: string, enabled: boolean) => {
      const status = extensionStatuses[pluginType];
      if (!status) return;

      setExtensionLoadingMap((prev) => ({ ...prev, [pluginType]: true }));
      try {
        if (enabled) {
          const fieldValues = extensionFieldValues[pluginType] || {};
          const credentialFields = (status.extensionMeta?.credentialFields || []) as ExtensionFieldSchema[];
          const missingField = credentialFields.find((field) => {
            if (!field.required) return false;
            const value = fieldValues[field.key];
            if (field.type === 'boolean') return value === undefined;
            return value === undefined || value === '';
          });

          if (missingField) {
            Message.warning(
              t('settings.channels.extension.requiredField', {
                defaultValue: 'Please fill required field: {{field}}',
                field: missingField.label,
              })
            );
            return;
          }

          const result = await channel.enablePlugin.invoke({
            pluginId: status.id || pluginType,
            config: fieldValues,
          });

          if (result.success) {
            Message.success(
              t('settings.channels.extension.enabled', {
                defaultValue: 'Channel enabled',
              })
            );
            await loadPluginStatus();
          } else {
            Message.error(
              result.msg ||
                t('settings.channels.extension.enableFailed', {
                  defaultValue: 'Failed to enable channel',
                })
            );
          }
        } else {
          const result = await channel.disablePlugin.invoke({
            pluginId: status.id || pluginType,
          });
          if (result.success) {
            Message.success(
              t('settings.channels.extension.disabled', {
                defaultValue: 'Channel disabled',
              })
            );
            await loadPluginStatus();
          } else {
            Message.error(
              result.msg ||
                t('settings.channels.extension.disableFailed', {
                  defaultValue: 'Failed to disable channel',
                })
            );
          }
        }
      } catch (error) {
        Message.error(getErrorMessage(error));
      } finally {
        setExtensionLoadingMap((prev) => ({ ...prev, [pluginType]: false }));
      }
    },
    [extensionStatuses, extensionFieldValues, t, loadPluginStatus]
  );

  const renderExtensionConfigForm = useCallback(
    (status: IChannelPluginStatus) => {
      const pluginType = status.type;
      const fields = [
        ...((status.extensionMeta?.credentialFields || []) as ExtensionFieldSchema[]),
        ...((status.extensionMeta?.configFields || []) as ExtensionFieldSchema[]),
      ];
      const values = extensionFieldValues[pluginType] || {};
      const callbackPath = '/ext-wecom-bot/webhook';
      const localCallbackUrl = webuiStatus?.localUrl
        ? `${webuiStatus.localUrl}${callbackPath}`
        : `http://localhost:25808${callbackPath}`;
      const lanCallbackUrl = webuiStatus?.networkUrl ? `${webuiStatus.networkUrl}${callbackPath}` : null;
      const publicBaseUrl =
        typeof values.publicBaseUrl === 'string' ? values.publicBaseUrl.trim().replace(/\/+$/, '') : '';
      const publicCallbackUrl = publicBaseUrl ? `${publicBaseUrl}${callbackPath}` : null;

      if (fields.length === 0) {
        return (
          <div className='text-14px text-t-secondary py-12px'>
            {status.extensionMeta?.description ||
              t('settings.channels.extension.noConfig', {
                defaultValue: 'No extra configuration required.',
              })}
          </div>
        );
      }

      return (
        <div className='space-y-10px py-4px'>
          {status.extensionMeta?.description && (
            <div className='text-13px text-t-secondary leading-relaxed'>{status.extensionMeta.description}</div>
          )}
          {pluginType === 'ext-wecom-bot' && (
            <div className='text-12px leading-relaxed p-10px rd-8px bg-[rgba(var(--orange-6),0.08)] border border-[rgba(var(--orange-6),0.3)] text-t-secondary'>
              <div className='font-500 text-t-primary mb-6px'>企微回调地址说明</div>
              <div>本机 Callback URL: {localCallbackUrl}</div>
              {lanCallbackUrl ? <div>局域网 Callback URL: {lanCallbackUrl}</div> : null}
              {publicCallbackUrl ? <div>公网 Callback URL(配置值): {publicCallbackUrl}</div> : null}
              <div className='mt-6px'>
                仅开启 WebUI 远程访问（LAN）通常不能直接通过企微回调。企微服务器需要可访问的公网 HTTPS 地址。
              </div>
              <div>建议：使用反向代理 + 证书，或 Cloudflare Tunnel / ngrok 映射到本机。</div>
            </div>
          )}
          {fields.map((field) => {
            const rawValue = values[field.key];
            const label = `${field.label}${field.required ? ' *' : ''}`;

            if (field.type === 'boolean') {
              return (
                <div key={`${pluginType}-${field.key}`} className='flex items-center justify-between'>
                  <span className='text-13px text-t-primary'>{label}</span>
                  <Switch
                    checked={Boolean(rawValue)}
                    onChange={(checked) => updateExtensionFieldValue(pluginType, field.key, checked)}
                  />
                </div>
              );
            }

            if (field.type === 'number') {
              return (
                <div key={`${pluginType}-${field.key}`} className='space-y-6px'>
                  <div className='text-13px text-t-primary'>{label}</div>
                  <InputNumber
                    value={typeof rawValue === 'number' ? rawValue : undefined}
                    onChange={(value) => updateExtensionFieldValue(pluginType, field.key, Number(value || 0))}
                    className='w-full'
                  />
                </div>
              );
            }

            if (field.type === 'select') {
              return (
                <div key={`${pluginType}-${field.key}`} className='space-y-6px'>
                  <div className='text-13px text-t-primary'>{label}</div>
                  <Select
                    value={typeof rawValue === 'string' ? rawValue : undefined}
                    options={(field.options || []).map((option) => ({
                      label: option,
                      value: option,
                    }))}
                    onChange={(value) => updateExtensionFieldValue(pluginType, field.key, String(value))}
                    placeholder={t('settings.channels.extension.selectPlaceholder', { defaultValue: 'Please select' })}
                    allowClear
                  />
                </div>
              );
            }

            return (
              <div key={`${pluginType}-${field.key}`} className='space-y-6px'>
                <div className='text-13px text-t-primary'>{label}</div>
                <Input
                  value={typeof rawValue === 'string' ? rawValue : ''}
                  onChange={(value) => updateExtensionFieldValue(pluginType, field.key, value)}
                  placeholder={field.label}
                  type={field.type === 'password' ? 'password' : 'text'}
                />
              </div>
            );
          })}
        </div>
      );
    },
    [extensionFieldValues, t, updateExtensionFieldValue, webuiStatus]
  );

  // Build channel configurations
  const channels: ChannelConfig[] = useMemo(() => {
    const telegramChannel: ChannelConfig = {
      id: 'telegram',
      title: t('settings.channels.telegramTitle', 'Telegram'),
      description: t('settings.channels.telegramDesc', 'Chat with ContextGo assistant via Telegram'),
      status: 'active',
      enabled: pluginStatus?.enabled || false,
      disabled: enableLoading,
      isConnected: pluginStatus?.connected || false,
      botUsername: pluginStatus?.botUsername,
      content: (
        <TelegramConfigForm
          pluginStatus={pluginStatus}
          onStatusChange={setPluginStatus}
          onTokenChange={(token) => {
            telegramTokenRef.current = token;
          }}
        />
      ),
    };

    const larkChannel: ChannelConfig = {
      id: 'lark',
      title: t('settings.channels.larkTitle', 'Lark / Feishu'),
      description: t('settings.channels.larkDesc', 'Chat with ContextGo assistant via Lark or Feishu'),
      status: 'active',
      enabled: larkPluginStatus?.enabled || false,
      disabled: larkEnableLoading,
      isConnected: larkPluginStatus?.connected || false,
      content: <LarkConfigForm pluginStatus={larkPluginStatus} onStatusChange={setLarkPluginStatus} />,
    };

    const slackChannel: ChannelConfig = {
      id: 'slack',
      title: t('settings.channels.slackTitle', 'Slack'),
      description: t('settings.channels.slackDesc', 'Chat with ContextGo assistant via Slack'),
      status: 'active',
      enabled: slackPluginStatus?.enabled || false,
      disabled: slackEnableLoading,
      isConnected: slackPluginStatus?.connected || false,
      botUsername: slackPluginStatus?.botUsername,
      content: (
        <SlackConfigForm
          pluginStatus={slackPluginStatus}
          onStatusChange={setSlackPluginStatus}
          onConfigChange={(config) => {
            slackConfigRef.current = config;
          }}
        />
      ),
    };

    const discordChannel: ChannelConfig = {
      id: 'discord',
      title: t('settings.channels.discordTitle', 'Discord'),
      description: t('settings.channels.discordDesc', 'Chat with ContextGo assistant via Discord'),
      status: 'active',
      enabled: discordPluginStatus?.enabled || false,
      disabled: discordEnableLoading,
      isConnected: discordPluginStatus?.connected || false,
      botUsername: discordPluginStatus?.botUsername,
      content: (
        <DiscordConfigForm
          pluginStatus={discordPluginStatus}
          onStatusChange={setDiscordPluginStatus}
          onConfigChange={(config) => {
            discordConfigRef.current = config;
          }}
        />
      ),
    };

    const dingtalkChannel: ChannelConfig = {
      id: 'dingtalk',
      title: t('settings.channels.dingtalkTitle', 'DingTalk'),
      description: t('settings.channels.dingtalkDesc', 'Chat with ContextGo assistant via DingTalk'),
      status: 'active',
      enabled: dingtalkPluginStatus?.enabled || false,
      disabled: dingtalkEnableLoading,
      isConnected: dingtalkPluginStatus?.connected || false,
      content: <DingTalkConfigForm pluginStatus={dingtalkPluginStatus} onStatusChange={setDingtalkPluginStatus} />,
    };

    const weixinChannel: ChannelConfig = {
      id: 'weixin',
      title: t('settings.channels.weixinTitle', 'WeChat'),
      description: t('settings.channels.weixinDesc', 'Chat with ContextGo assistant via WeChat'),
      status: 'active',
      enabled: weixinPluginStatus?.enabled || false,
      disabled: weixinEnableLoading,
      isConnected: weixinPluginStatus?.connected || false,
      content: <WeixinConfigForm pluginStatus={weixinPluginStatus} onStatusChange={setWeixinPluginStatus} />,
    };

    const extensionChannels: ChannelConfig[] = Object.values(extensionStatuses)
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((status) => ({
        id: status.type,
        title: status.name,
        description:
          status.extensionMeta?.description ||
          t('settings.channels.extension.defaultDesc', {
            defaultValue: 'Extension channel plugin',
          }),
        status: 'active',
        enabled: status.enabled || false,
        disabled: extensionLoadingMap[status.type] || false,
        isConnected: status.connected || false,
        icon: status.extensionMeta?.icon,
        isExtension: true,
        content: renderExtensionConfigForm(status),
      }));

    const extensionTypeSet = new Set(extensionChannels.map((channelConfig) => String(channelConfig.id).toLowerCase()));

    return [
      telegramChannel,
      slackChannel,
      ...(extensionTypeSet.has('discord') ? [] : [discordChannel]),
      larkChannel,
      dingtalkChannel,
      weixinChannel,
      ...extensionChannels,
    ];
  }, [
    pluginStatus,
    slackPluginStatus,
    discordPluginStatus,
    larkPluginStatus,
    dingtalkPluginStatus,
    extensionStatuses,
    extensionLoadingMap,
    enableLoading,
    slackEnableLoading,
    discordEnableLoading,
    larkEnableLoading,
    dingtalkEnableLoading,
    weixinPluginStatus,
    weixinEnableLoading,
    renderExtensionConfigForm,
    t,
  ]);

  // Get toggle handler for each channel
  const getToggleHandler = (channelId: string) => {
    if (channelId === 'telegram') return handleTogglePlugin;
    if (channelId === 'slack') return handleToggleSlackPlugin;
    if (channelId === 'discord') return handleToggleDiscordPlugin;
    if (channelId === 'lark') return handleToggleLarkPlugin;
    if (channelId === 'dingtalk') return handleToggleDingtalkPlugin;
    if (channelId === 'weixin') return handleToggleWeixinPlugin;
    if (extensionStatuses[channelId]) {
      return (enabled: boolean) => {
        void handleToggleExtensionPlugin(channelId, enabled);
      };
    }
    return undefined;
  };
  const channelSetupSteps = [
    t('settings.channels.selectFirst', {
      defaultValue: 'Configure one or more IM channel accounts and enable message access.',
    }),
    t('settings.channels.enableAfterConfig', {
      defaultValue: 'Use Agent Publish to manage formal publication and session handoff.',
    }),
  ];
  const pageTitle = mode === 'sessions' ? t('settings.activeSessions') : t('settings.agentEntry');
  const pageDescription =
    mode === 'sessions'
      ? t('settings.activeSessionsDesc', {
          defaultValue:
            'Manage where Agents are formally published in IM, and hand off live sessions when you need temporary continuation away from desktop.',
        })
      : t('settings.agentEntryDesc', {
          defaultValue:
            'Manage IM channel configurations. Each channel type can have multiple entries, and publishing is handled separately in Agent Publish.',
        });

  return (
    <ContextGoScrollArea className={isPageMode ? 'h-full' : ''}>
      <div className='px-[12px] md:px-[28px]'>
        <h2 className='text-20px font-500 text-t-primary m-0'>{pageTitle}</h2>
        <div className='space-y-8px mt-10px'>
          <div className='text-13px text-t-secondary leading-relaxed'>{pageDescription}</div>
          {mode === 'channels' ? (
            <div className='flex flex-wrap gap-x-12px gap-y-6px'>
              {channelSetupSteps.map((stepLabel, idx) => (
                <div key={stepLabel} className='inline-flex items-center gap-6px'>
                  <span className='inline-flex items-center justify-center w-16px h-16px rd-50% text-10px font-600 bg-[rgba(var(--primary-6),0.12)] text-[rgb(var(--primary-6))]'>
                    {idx + 1}
                  </span>
                  <CheckOne theme='outline' size='12' className='text-[rgb(var(--primary-6))]' />
                  <span className='text-12px text-t-secondary'>{stepLabel}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {mode === 'channels' ? (
          <>
            <div className='mt-18px space-y-4px'>
              <div className='text-15px font-600 text-t-primary'>
                {t('settings.channels.title', {
                  defaultValue: 'Channel Accounts',
                })}
              </div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.channels.guide', {
                  defaultValue:
                    'Connect IM accounts here so agent entries can use them for delivery, pairing, and transport.',
                })}
              </div>
            </div>

            <div className='space-y-12px mt-12px'>
              {channels.map((channelConfig) => (
                <ChannelItem
                  key={channelConfig.id}
                  channel={channelConfig}
                  isCollapsed={collapseKeys[channelConfig.id] || false}
                  onToggleCollapse={() => handleToggleCollapse(channelConfig.id)}
                  onToggleEnabled={getToggleHandler(channelConfig.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <PublicationBindingPanel />
            <SessionHandoffPanel />
          </>
        )}
      </div>
    </ContextGoScrollArea>
  );
};

export default ChannelModalContent;
