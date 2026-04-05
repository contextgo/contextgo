/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BUILTIN_CHANNEL_TYPE_SET,
  getBuiltinChannel,
  isBuiltinChannelType,
  type BuiltinChannelType,
} from '@/common/config/builtinChannels';
import { channel, webui, type IWebUIStatus } from '@/common/adapter/ipcBridge';
import ContextGoScrollArea from '@/renderer/components/base/ContextGoScrollArea';
import {
  getChannelAccountId,
  type IChannelAccount,
  type IChannelAuthorizedTarget,
  type IChannelPluginStatus,
} from '@process/channels/types';
import { Button, Empty, Input, InputNumber, Message, Select, Switch, Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsViewMode } from '../../settingsViewContext';
import ChannelLogo from './ChannelLogo';
import styles from './ChannelModalContent.module.css';
import PublicationBindingPanel from './publication/PublicationBindingPanel';
import type { ChannelConfig } from './types';
import {
  DiscordConfigForm,
  DingTalkConfigForm,
  LarkConfigForm,
  SlackConfigForm,
  TelegramConfigForm,
  WeixinConfigForm,
} from './configForms';

type ExtensionFieldType = 'text' | 'password' | 'select' | 'number' | 'boolean';
type TranslationFn = ReturnType<typeof useTranslation>['t'];

type ExtensionFieldSchema = {
  key: string;
  label: string;
  type: ExtensionFieldType;
  required?: boolean;
  options?: string[];
  default?: string | number | boolean;
};

type ExtensionFieldValues = Record<string, Record<string, string | number | boolean>>;

type SlackDraft = {
  botToken: string;
  appToken: string;
  requireMention: boolean;
};

type DiscordDraft = {
  token: string;
  requireMention: boolean;
};

type ChannelResolvedIds = {
  accountId: string;
  runtimeId: string;
  loadingKey: string;
};

type ChannelFamily = {
  id: string;
  title: string;
  description: string;
  channels: ChannelConfig[];
  readyCount: number;
  pairedCount: number;
};

const BUILTIN_CHANNEL_ORDER: BuiltinChannelType[] = ['telegram', 'slack', 'discord', 'lark', 'dingtalk', 'weixin'];
const EMPTY_SLACK_DRAFT: SlackDraft = { botToken: '', appToken: '', requireMention: true };
const EMPTY_DISCORD_DRAFT: DiscordDraft = { token: '', requireMention: true };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getBuiltinFamilyTitle(type: BuiltinChannelType, t: TranslationFn): string {
  switch (type) {
    case 'telegram':
      return t('settings.channels.telegramTitle', { defaultValue: 'Telegram' });
    case 'slack':
      return t('settings.channels.slackTitle', { defaultValue: 'Slack' });
    case 'discord':
      return t('settings.channels.discordTitle', { defaultValue: 'Discord' });
    case 'lark':
      return t('settings.channels.larkTitle', { defaultValue: 'Lark / Feishu' });
    case 'dingtalk':
      return t('settings.channels.dingtalkTitle', { defaultValue: 'DingTalk' });
    case 'weixin':
      return t('settings.channels.weixinTitle', { defaultValue: 'WeChat' });
  }
}

function getBuiltinFamilyDescription(type: BuiltinChannelType, t: TranslationFn): string {
  switch (type) {
    case 'telegram':
      return t('settings.channels.telegramDesc', { defaultValue: 'Chat with ContextGo assistant via Telegram' });
    case 'slack':
      return t('settings.channels.slackDesc', { defaultValue: 'Chat with ContextGo assistant via Slack' });
    case 'discord':
      return t('settings.channels.discordDesc', { defaultValue: 'Chat with ContextGo assistant via Discord' });
    case 'lark':
      return t('settings.channels.larkDesc', { defaultValue: 'Chat with ContextGo assistant via Lark or Feishu' });
    case 'dingtalk':
      return t('settings.channels.dingtalkDesc', { defaultValue: 'Chat with ContextGo assistant via DingTalk' });
    case 'weixin':
      return t('settings.channels.weixinDesc', { defaultValue: 'Chat with ContextGo assistant via WeChat' });
  }
}

function getChannelDisplayName(
  status: Pick<IChannelPluginStatus, 'id' | 'type' | 'name' | 'isExtension'>,
  t: TranslationFn
): string {
  if (!isBuiltinChannelType(status.type)) {
    return status.name;
  }

  const builtinChannel = getBuiltinChannel(status.type);
  if (!builtinChannel || status.id !== builtinChannel.pluginId) {
    return status.name;
  }

  return status.name.trim().toLowerCase() === 'default' ? getBuiltinFamilyTitle(status.type, t) : status.name;
}

function isImplicitBuiltinInstance(
  status: IChannelPluginStatus,
  channelAccountsById: Map<string, IChannelAccount>
): boolean {
  if (!isBuiltinChannelType(status.type) || status.isExtension) {
    return false;
  }

  const builtinChannel = getBuiltinChannel(status.type);
  if (!builtinChannel || status.id !== builtinChannel.pluginId) {
    return false;
  }

  if (channelAccountsById.has(status.id)) {
    return false;
  }

  return (
    !status.enabled &&
    !status.connected &&
    !status.hasToken &&
    !status.botUsername &&
    !status.lastConnected &&
    status.status === 'stopped'
  );
}

function sortPluginStatuses(a: IChannelPluginStatus, b: IChannelPluginStatus, familyId: string): number {
  const defaultId = getBuiltinChannel(familyId)?.pluginId;
  if (a.id === defaultId && b.id !== defaultId) {
    return -1;
  }
  if (b.id === defaultId && a.id !== defaultId) {
    return 1;
  }
  if (a.enabled !== b.enabled) {
    return a.enabled ? -1 : 1;
  }
  if (a.connected !== b.connected) {
    return a.connected ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function resolveChannelIds(
  status: Pick<IChannelPluginStatus, 'id' | 'runtimeId'>,
  channelAccountsById: Map<string, IChannelAccount>
): ChannelResolvedIds {
  const channelAccount = channelAccountsById.get(status.id);
  const accountId = channelAccount?.id ?? status.id;
  const runtimeId = status.runtimeId ?? channelAccount?.legacyPluginId ?? status.id;

  return {
    accountId,
    runtimeId,
    loadingKey: accountId,
  };
}

function buildNextChannelAccountName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName} ${suffix}`;
  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }
  return candidate;
}

function getEnabledLabel(enabled: boolean, t: TranslationFn): string {
  return enabled
    ? t('settings.channels.publication.enabled', { defaultValue: 'Enabled' })
    : t('settings.channels.publication.disabled', { defaultValue: 'Disabled' });
}

function getConfiguredLabel(configured: boolean, t: TranslationFn): string {
  return configured
    ? t('settings.channels.configured', { defaultValue: 'Configured' })
    : t('settings.channels.notConfigured', { defaultValue: 'Not configured' });
}

function getPairingLabel(pairedCount: number, t: TranslationFn): string {
  return pairedCount > 0
    ? t('settings.channels.pairingDone', {
        defaultValue: 'Paired {{count}}',
        count: pairedCount,
      })
    : t('settings.channels.pairingWaiting', { defaultValue: 'Waiting for pairing' });
}

type ChannelPrimaryState = 'ready' | 'needsConfig' | 'needsEnable' | 'needsPairing';

function getChannelPrimaryState(configured: boolean, enabled: boolean, pairedCount: number): ChannelPrimaryState {
  if (pairedCount > 0) {
    return 'ready';
  }
  if (!configured) {
    return 'needsConfig';
  }
  if (!enabled) {
    return 'needsEnable';
  }
  return 'needsPairing';
}

function getChannelPrimaryStatusLabel(state: ChannelPrimaryState, t: TranslationFn): string {
  switch (state) {
    case 'ready':
      return t('settings.channels.readyStatus', { defaultValue: 'Ready' });
    case 'needsConfig':
      return t('settings.channels.pendingConfigStatus', { defaultValue: 'Needs configuration' });
    case 'needsEnable':
      return t('settings.channels.pendingEnableStatus', { defaultValue: 'Needs enablement' });
    case 'needsPairing':
      return t('settings.channels.pendingPairStatus', { defaultValue: 'Needs pairing' });
  }
}

const ChannelModalContent: React.FC<{ mode?: 'channels' | 'sessions' }> = ({ mode = 'channels' }) => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const isChannelMode = mode === 'channels';
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [pluginStatuses, setPluginStatuses] = useState<IChannelPluginStatus[]>([]);
  const [channelAccounts, setChannelAccounts] = useState<IChannelAccount[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [extensionFieldValues, setExtensionFieldValues] = useState<ExtensionFieldValues>({});
  const [instanceNameDrafts, setInstanceNameDrafts] = useState<Record<string, string>>({});
  const [authorizedTargets, setAuthorizedTargets] = useState<IChannelAuthorizedTarget[]>([]);
  const [webuiStatus, setWebuiStatus] = useState<IWebUIStatus | null>(null);
  const [creationPendingChannelId, setCreationPendingChannelId] = useState<string | null>(null);

  const telegramTokenRef = useRef<Record<string, string>>({});
  const slackConfigRef = useRef<Record<string, SlackDraft>>({});
  const discordConfigRef = useRef<Record<string, DiscordDraft>>({});

  const pluginStatusById = useMemo(
    () => new Map(pluginStatuses.map((status) => [status.id, status] as const)),
    [pluginStatuses]
  );
  const channelAccountsById = useMemo(
    () => new Map(channelAccounts.map((channelAccount) => [channelAccount.id, channelAccount] as const)),
    [channelAccounts]
  );
  const pairedCountByChannelId = useMemo(() => {
    const counts = new Map<string, number>();
    const channelAccountIdsByPlatform = new Map<string, string[]>();

    for (const channelAccount of channelAccounts) {
      const existing = channelAccountIdsByPlatform.get(channelAccount.platform) ?? [];
      existing.push(channelAccount.id);
      channelAccountIdsByPlatform.set(channelAccount.platform, existing);
    }

    for (const target of authorizedTargets) {
      const resolvedChannelAccountId =
        getChannelAccountId(target) ||
        (() => {
          const candidates = channelAccountIdsByPlatform.get(target.platformType) ?? [];
          return candidates.length === 1 ? candidates[0] : undefined;
        })();

      if (!resolvedChannelAccountId) {
        continue;
      }

      counts.set(resolvedChannelAccountId, (counts.get(resolvedChannelAccountId) ?? 0) + 1);
    }

    return counts;
  }, [authorizedTargets, channelAccounts]);

  const loadChannelState = useCallback(async () => {
    try {
      const [pluginResult, channelAccountResult, authorizedTargetsResult] = await Promise.all([
        channel.getPluginStatus.invoke(),
        channel.getChannelAccounts.invoke(),
        channel.getAuthorizedTargets.invoke(),
      ]);

      if (pluginResult.success && pluginResult.data) {
        setPluginStatuses(pluginResult.data);
        setExtensionFieldValues((prev) => {
          const next: ExtensionFieldValues = { ...prev };
          for (const plugin of pluginResult.data.filter((item) => !BUILTIN_CHANNEL_TYPE_SET.has(item.type))) {
            const fields = [
              ...(plugin.extensionMeta?.credentialFields || []),
              ...(plugin.extensionMeta?.configFields || []),
            ] as ExtensionFieldSchema[];
            if (!next[plugin.id]) {
              next[plugin.id] = {};
            }
            for (const field of fields) {
              if (next[plugin.id][field.key] === undefined && field.default !== undefined) {
                next[plugin.id][field.key] = field.default;
              }
            }
          }
          return next;
        });
      }

      if (channelAccountResult.success && channelAccountResult.data) {
        setChannelAccounts(channelAccountResult.data);
      } else {
        setChannelAccounts([]);
      }

      if (authorizedTargetsResult.success && authorizedTargetsResult.data) {
        setAuthorizedTargets(authorizedTargetsResult.data);
      } else {
        setAuthorizedTargets([]);
      }
    } catch (error) {
      console.error('[ChannelSettings] Failed to load channel state:', error);
    }
  }, []);

  const withPluginLoading = useCallback(async (pluginId: string, task: () => Promise<void>) => {
    setLoadingMap((prev) => ({ ...prev, [pluginId]: true }));
    try {
      await task();
    } finally {
      setLoadingMap((prev) => ({ ...prev, [pluginId]: false }));
    }
  }, []);

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }
    void loadChannelState();
  }, [isChannelMode, loadChannelState]);

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }

    const loadWebuiStatus = async () => {
      try {
        const result = await webui.getStatus.invoke();
        if (result?.success && result.data) {
          setWebuiStatus(result.data);
        }
      } catch {
        // Best-effort only.
      }
    };

    void loadWebuiStatus();
  }, [isChannelMode]);

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }

    const unsubscribePluginStatus = channel.pluginStatusChanged.on(({ status }) => {
      setPluginStatuses((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === status.id);
        if (existingIndex < 0) {
          return [...prev, status];
        }

        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...status,
          extensionMeta: status.extensionMeta || next[existingIndex]?.extensionMeta,
        };
        return next;
      });
      setInstanceNameDrafts((prev) => ({
        ...prev,
        [status.id]: prev[status.id] ?? getChannelDisplayName(status, t),
      }));
    });

    const unsubscribeUserAuthorized = channel.userAuthorized.on(() => {
      void channel.getAuthorizedTargets.invoke().then((result) => {
        if (result.success && result.data) {
          setAuthorizedTargets(result.data);
        }
      });
    });

    return () => {
      unsubscribePluginStatus();
      unsubscribeUserAuthorized();
    };
  }, [isChannelMode, t]);

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }
    setInstanceNameDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const status of pluginStatuses) {
        if (next[status.id] !== undefined) {
          continue;
        }
        next[status.id] = getChannelDisplayName(status, t);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isChannelMode, pluginStatuses, t]);

  const setPluginStatusForId = useCallback(
    (pluginId: string, nextStatus: IChannelPluginStatus | null) => {
      if (!nextStatus) {
        return;
      }

      setPluginStatuses((prev) => {
        const index = prev.findIndex((item) => item.id === pluginId);
        if (index < 0) {
          return [...prev, nextStatus];
        }

        const next = [...prev];
        next[index] = {
          ...next[index],
          ...nextStatus,
          extensionMeta: nextStatus.extensionMeta || next[index]?.extensionMeta,
        };
        return next;
      });
      setInstanceNameDrafts((prev) => ({
        ...prev,
        [pluginId]: getChannelDisplayName(nextStatus, t),
      }));
    },
    [t]
  );

  const updateExtensionFieldValue = useCallback((pluginId: string, key: string, value: string | number | boolean) => {
    setExtensionFieldValues((prev) => ({
      ...prev,
      [pluginId]: {
        ...prev[pluginId],
        [key]: value,
      },
    }));
  }, []);

  const renderExtensionConfigForm = useCallback(
    (status: IChannelPluginStatus) => {
      const fields = [
        ...((status.extensionMeta?.credentialFields || []) as ExtensionFieldSchema[]),
        ...((status.extensionMeta?.configFields || []) as ExtensionFieldSchema[]),
      ];
      const values = extensionFieldValues[status.id] || {};

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
          {status.extensionMeta?.description ? (
            <div className='text-13px text-t-secondary leading-relaxed'>{status.extensionMeta.description}</div>
          ) : null}
          {fields.map((field) => {
            const rawValue = values[field.key];
            const label = `${field.label}${field.required ? ' *' : ''}`;

            if (field.type === 'boolean') {
              return (
                <div key={`${status.id}-${field.key}`} className='flex items-center justify-between'>
                  <span className='text-13px text-t-primary'>{label}</span>
                  <Switch
                    checked={Boolean(rawValue)}
                    onChange={(checked) => updateExtensionFieldValue(status.id, field.key, checked)}
                  />
                </div>
              );
            }

            if (field.type === 'number') {
              return (
                <div key={`${status.id}-${field.key}`} className='space-y-6px'>
                  <div className='text-13px text-t-primary'>{label}</div>
                  <InputNumber
                    value={typeof rawValue === 'number' ? rawValue : undefined}
                    onChange={(value) => updateExtensionFieldValue(status.id, field.key, Number(value || 0))}
                    className='w-full'
                  />
                </div>
              );
            }

            if (field.type === 'select') {
              return (
                <div key={`${status.id}-${field.key}`} className='space-y-6px'>
                  <div className='text-13px text-t-primary'>{label}</div>
                  <Select
                    value={typeof rawValue === 'string' ? rawValue : undefined}
                    options={(field.options || []).map((option) => ({ label: option, value: option }))}
                    onChange={(value) => updateExtensionFieldValue(status.id, field.key, String(value))}
                    placeholder={t('settings.channels.extension.selectPlaceholder', { defaultValue: 'Please select' })}
                    allowClear
                  />
                </div>
              );
            }

            return (
              <div key={`${status.id}-${field.key}`} className='space-y-6px'>
                <div className='text-13px text-t-primary'>{label}</div>
                <Input
                  value={typeof rawValue === 'string' ? rawValue : ''}
                  onChange={(value) => updateExtensionFieldValue(status.id, field.key, value)}
                  placeholder={field.label}
                  type={field.type === 'password' ? 'password' : 'text'}
                />
              </div>
            );
          })}
          {webuiStatus?.networkUrl ? <div className='text-12px text-t-tertiary'>{webuiStatus.networkUrl}</div> : null}
        </div>
      );
    },
    [extensionFieldValues, t, updateExtensionFieldValue, webuiStatus]
  );

  const handleToggleExtensionPlugin = useCallback(
    async (status: IChannelPluginStatus, enabled: boolean) => {
      const resolvedIds = resolveChannelIds(status, channelAccountsById);

      await withPluginLoading(resolvedIds.loadingKey, async () => {
        try {
          if (enabled) {
            const fieldValues = extensionFieldValues[status.id] || {};
            const credentialFields = (status.extensionMeta?.credentialFields || []) as ExtensionFieldSchema[];
            const missingField = credentialFields.find((field) => {
              if (!field.required) {
                return false;
              }
              const value = fieldValues[field.key];
              if (field.type === 'boolean') {
                return value === undefined;
              }
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
              pluginId: resolvedIds.runtimeId,
              config: fieldValues,
            });
            if (result.success) {
              Message.success(t('settings.channels.extension.enabled', { defaultValue: 'Channel enabled' }));
              await loadChannelState();
            } else {
              Message.error(
                result.msg ||
                  t('settings.channels.extension.enableFailed', { defaultValue: 'Failed to enable channel' })
              );
            }
            return;
          }

          const result = await channel.disablePlugin.invoke({ pluginId: resolvedIds.runtimeId });
          if (result.success) {
            Message.success(t('settings.channels.extension.disabled', { defaultValue: 'Channel disabled' }));
            await loadChannelState();
          } else {
            Message.error(
              result.msg ||
                t('settings.channels.extension.disableFailed', { defaultValue: 'Failed to disable channel' })
            );
          }
        } catch (error) {
          Message.error(getErrorMessage(error));
        }
      });
    },
    [channelAccountsById, extensionFieldValues, loadChannelState, t, withPluginLoading]
  );

  const renderChannelForm = useCallback(
    (status: IChannelPluginStatus): React.ReactNode => {
      switch (status.type) {
        case 'telegram':
          return (
            <TelegramConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
              onTokenChange={(token) => {
                telegramTokenRef.current[status.id] = token;
              }}
            />
          );
        case 'slack':
          return (
            <SlackConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
              onConfigChange={(config) => {
                slackConfigRef.current[status.id] = config;
              }}
            />
          );
        case 'discord':
          return (
            <DiscordConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
              onConfigChange={(config) => {
                discordConfigRef.current[status.id] = config;
              }}
            />
          );
        case 'lark':
          return (
            <LarkConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
            />
          );
        case 'dingtalk':
          return (
            <DingTalkConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
            />
          );
        case 'weixin':
          return (
            <WeixinConfigForm
              pluginId={status.id}
              pluginStatus={status}
              onStatusChange={(nextStatus) => setPluginStatusForId(status.id, nextStatus)}
            />
          );
        default:
          return renderExtensionConfigForm(status);
      }
    },
    [renderExtensionConfigForm, setPluginStatusForId]
  );

  const families = useMemo<ChannelFamily[]>(() => {
    const familyIds = Array.from(new Set(pluginStatuses.map((status) => String(status.type))));
    const builtinFamilies = BUILTIN_CHANNEL_ORDER.filter((familyId) => familyIds.includes(familyId));
    const extensionFamilies = familyIds
      .filter((familyId) => !BUILTIN_CHANNEL_TYPE_SET.has(familyId))
      .toSorted((a, b) => {
        const aName = pluginStatuses.find((status) => status.type === a)?.name || a;
        const bName = pluginStatuses.find((status) => status.type === b)?.name || b;
        return aName.localeCompare(bName);
      });

    return [...builtinFamilies, ...extensionFamilies].map((familyId) => {
      const familyStatuses = pluginStatuses
        .filter((status) => status.type === familyId)
        .toSorted((a, b) => sortPluginStatuses(a, b, familyId));
      const visibleStatuses = familyStatuses.filter(
        (status) => !isImplicitBuiltinInstance(status, channelAccountsById)
      );
      const fallbackStatus = familyStatuses[0];
      const title = isBuiltinChannelType(familyId)
        ? getBuiltinFamilyTitle(familyId, t)
        : fallbackStatus?.name || familyId;
      const description = isBuiltinChannelType(familyId)
        ? getBuiltinFamilyDescription(familyId, t)
        : fallbackStatus?.extensionMeta?.description ||
          t('settings.channels.extension.defaultDesc', { defaultValue: 'Extension channel plugin' });

      const channels = visibleStatuses.map((status) => {
        const resolvedIds = resolveChannelIds(status, channelAccountsById);

        return {
          id: status.id,
          familyId,
          familyTitle: title,
          familyDescription: description,
          title: getChannelDisplayName(status, t),
          description,
          status: 'active' as const,
          enabled: status.enabled,
          disabled: loadingMap[resolvedIds.loadingKey] || false,
          isConnected: status.connected,
          configured: Boolean(status.hasToken),
          pairedCount: pairedCountByChannelId.get(status.id) ?? 0,
          botUsername: status.botUsername,
          icon: status.extensionMeta?.icon,
          isExtension: status.isExtension,
          content: renderChannelForm(status),
        };
      });

      return {
        id: familyId,
        title,
        description,
        channels,
        readyCount: channels.filter(
          (entry) =>
            getChannelPrimaryState(Boolean(entry.configured), Boolean(entry.enabled), entry.pairedCount ?? 0) ===
            'ready'
        ).length,
        pairedCount: channels.reduce((sum, entry) => sum + (entry.pairedCount ?? 0), 0),
      };
    });
  }, [channelAccountsById, loadingMap, pairedCountByChannelId, pluginStatuses, renderChannelForm, t]);

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }
    setSelectedFamilyId((current) =>
      families.some((family) => family.id === current) ? current : (families[0]?.id ?? '')
    );
  }, [families, isChannelMode]);

  const resolvedFamilyId = useMemo(
    () => (families.some((family) => family.id === selectedFamilyId) ? selectedFamilyId : (families[0]?.id ?? '')),
    [families, selectedFamilyId]
  );

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === resolvedFamilyId) ?? null,
    [families, resolvedFamilyId]
  );

  useEffect(() => {
    if (!isChannelMode) {
      return;
    }
    setSelectedChannelId((current) =>
      selectedFamily?.channels.some((entry) => entry.id === current) ? current : (selectedFamily?.channels[0]?.id ?? '')
    );
  }, [isChannelMode, selectedFamily]);

  const resolvedChannelId = useMemo(
    () =>
      selectedFamily?.channels.some((entry) => entry.id === selectedChannelId)
        ? selectedChannelId
        : (selectedFamily?.channels[0]?.id ?? ''),
    [selectedChannelId, selectedFamily]
  );

  const selectedChannel = useMemo(
    () => selectedFamily?.channels.find((entry) => entry.id === resolvedChannelId) ?? null,
    [resolvedChannelId, selectedFamily]
  );
  const selectedChannelAccount = selectedChannel ? (channelAccountsById.get(selectedChannel.id) ?? null) : null;
  const selectedStatus = selectedChannel ? (pluginStatusById.get(selectedChannel.id) ?? null) : null;
  const selectedLoadingKey = selectedStatus
    ? resolveChannelIds(selectedStatus, channelAccountsById).loadingKey
    : (selectedChannelAccount?.id ?? '');
  const selectedNameDraft = selectedChannel
    ? (instanceNameDrafts[selectedChannel.id] ?? selectedChannelAccount?.name ?? selectedChannel.title)
    : '';
  const selectedPairedCount = selectedChannel?.pairedCount ?? 0;
  const selectedPairingComplete = selectedPairedCount > 0;
  const selectedPrimaryState = selectedChannel
    ? getChannelPrimaryState(Boolean(selectedChannel.configured), Boolean(selectedStatus?.enabled), selectedPairedCount)
    : null;
  const canCreateInstance = !!selectedFamily && isBuiltinChannelType(selectedFamily.id);
  const canDeleteInstance = !!selectedChannelAccount;

  const buildChannelAccountPayload = useCallback(
    (status: IChannelPluginStatus, overrides?: Partial<IChannelAccount>): IChannelAccount => {
      const existing = channelAccountsById.get(status.id);
      if (!existing) {
        throw new Error(`Missing channel account for ${status.id}`);
      }

      const now = Date.now();
      return {
        ...existing,
        name: overrides?.name ?? existing.name,
        enabled: overrides?.enabled ?? existing.enabled ?? status.enabled,
        status: overrides?.status ?? existing.status ?? status.status,
        credentials: overrides?.credentials ?? existing.credentials,
        runtimeConfig: overrides?.runtimeConfig ?? existing.runtimeConfig,
        capabilities: overrides?.capabilities ?? existing.capabilities,
        legacyPluginId: overrides?.legacyPluginId ?? existing.legacyPluginId,
        updatedAt: overrides?.updatedAt ?? now,
      };
    },
    [channelAccountsById]
  );

  useEffect(() => {
    if (!creationPendingChannelId) {
      return;
    }

    if ((pairedCountByChannelId.get(creationPendingChannelId) ?? 0) <= 0) {
      return;
    }

    Message.success(
      t('settings.channels.instanceAddedSuccess', {
        defaultValue: 'Pairing completed. The channel instance is now added.',
      })
    );
    setCreationPendingChannelId(null);
  }, [creationPendingChannelId, pairedCountByChannelId, t]);

  const handleToggleChannel = useCallback(
    async (status: IChannelPluginStatus, enabled: boolean) => {
      if (!isBuiltinChannelType(status.type)) {
        await handleToggleExtensionPlugin(status, enabled);
        return;
      }

      const resolvedIds = resolveChannelIds(status, channelAccountsById);

      await withPluginLoading(resolvedIds.loadingKey, async () => {
        try {
          let config: Record<string, unknown> = {};

          if (enabled) {
            switch (status.type) {
              case 'telegram': {
                const pendingToken = telegramTokenRef.current[status.id]?.trim() || '';
                if (!status.hasToken && !pendingToken) {
                  Message.warning(
                    t('settings.assistant.tokenRequired', { defaultValue: 'Please enter a bot token first' })
                  );
                  return;
                }
                config = pendingToken ? { token: pendingToken } : {};
                break;
              }
              case 'slack': {
                const pendingConfig = slackConfigRef.current[status.id] || EMPTY_SLACK_DRAFT;
                const botToken = pendingConfig.botToken.trim();
                const appToken = pendingConfig.appToken.trim();
                if (!status.hasToken && (!botToken || !appToken)) {
                  Message.warning(
                    t('settings.slack.credentialsRequired', {
                      defaultValue: 'Please enter Slack bot and app tokens',
                    })
                  );
                  return;
                }
                config =
                  botToken && appToken ? { botToken, appToken, requireMention: pendingConfig.requireMention } : {};
                break;
              }
              case 'discord': {
                const pendingConfig = discordConfigRef.current[status.id] || EMPTY_DISCORD_DRAFT;
                const token = pendingConfig.token.trim();
                if (!status.hasToken && !token) {
                  Message.warning(
                    t('settings.discord.tokenRequired', {
                      defaultValue: 'Please enter a Discord bot token',
                    })
                  );
                  return;
                }
                config = token ? { token, requireMention: pendingConfig.requireMention } : {};
                break;
              }
              case 'lark': {
                if (!status.hasToken) {
                  Message.warning(
                    t('settings.lark.credentialsRequired', {
                      defaultValue: 'Please configure Lark credentials first',
                    })
                  );
                  return;
                }
                break;
              }
              case 'dingtalk': {
                if (!status.hasToken) {
                  Message.warning(
                    t('settings.dingtalk.credentialsRequired', {
                      defaultValue: 'Please configure DingTalk credentials first',
                    })
                  );
                  return;
                }
                break;
              }
              case 'weixin': {
                if (!status.hasToken) {
                  Message.warning(
                    t('settings.weixin.loginRequired', {
                      defaultValue: 'Please login with WeChat QR code first',
                    })
                  );
                  return;
                }
                break;
              }
            }

            const result = await channel.enablePlugin.invoke({ pluginId: resolvedIds.runtimeId, config });
            if (!result.success) {
              Message.error(
                result.msg || t('settings.assistant.enableFailed', { defaultValue: 'Failed to enable plugin' })
              );
              return;
            }
            Message.success(t('settings.channels.instanceEnabled', { defaultValue: 'Channel instance enabled' }));
            await loadChannelState();
            return;
          }

          const result = await channel.disablePlugin.invoke({ pluginId: resolvedIds.runtimeId });
          if (!result.success) {
            Message.error(
              result.msg || t('settings.assistant.disableFailed', { defaultValue: 'Failed to disable plugin' })
            );
            return;
          }
          Message.success(t('settings.channels.instanceDisabled', { defaultValue: 'Channel instance disabled' }));
          await loadChannelState();
        } catch (error) {
          Message.error(getErrorMessage(error));
        }
      });
    },
    [channelAccountsById, handleToggleExtensionPlugin, loadChannelState, t, withPluginLoading]
  );

  const handleCreateInstance = useCallback(async () => {
    if (!selectedFamily || !isBuiltinChannelType(selectedFamily.id)) {
      return;
    }

    const nextName = buildNextChannelAccountName(
      selectedFamily.title,
      new Set(selectedFamily.channels.map((entry) => entry.title))
    );

    try {
      const result = await channel.createChannelAccount.invoke({
        platform: selectedFamily.id,
        name: nextName,
      });
      if (!result.success || !result.data?.id) {
        Message.error(
          result.msg ||
            t('settings.channels.instanceCreateFailed', { defaultValue: 'Failed to create channel instance' })
        );
        return;
      }

      const nextId = result.data.id;
      setCreationPendingChannelId(nextId);
      setSelectedFamilyId(selectedFamily.id);
      await loadChannelState();
      setSelectedChannelId(nextId);
    } catch (error) {
      Message.error(getErrorMessage(error));
    }
  }, [loadChannelState, selectedFamily, t]);

  const handleSaveInstance = useCallback(async () => {
    if (!selectedStatus) {
      return;
    }

    const nextName = selectedNameDraft.trim();
    if (!nextName) {
      Message.warning(t('settings.channels.instanceNameRequired', { defaultValue: 'Please enter an instance name' }));
      return;
    }

    await withPluginLoading(selectedLoadingKey, async () => {
      try {
        const channelAccount = buildChannelAccountPayload(selectedStatus, { name: nextName });
        const result = await channel.upsertChannelAccount.invoke({
          channelAccount,
        });
        if (!result.success) {
          Message.error(
            result.msg || t('settings.channels.instanceSaveFailed', { defaultValue: 'Failed to save channel instance' })
          );
          return;
        }
        Message.success(t('settings.channels.instanceSaved', { defaultValue: 'Channel instance saved' }));
        await loadChannelState();
      } catch (error) {
        Message.error(getErrorMessage(error));
      }
    });
  }, [
    buildChannelAccountPayload,
    loadChannelState,
    selectedLoadingKey,
    selectedNameDraft,
    selectedStatus,
    t,
    withPluginLoading,
  ]);

  const handleDeleteInstance = useCallback(async () => {
    if (!selectedStatus || !canDeleteInstance) {
      return;
    }

    await withPluginLoading(selectedLoadingKey, async () => {
      try {
        const result = await channel.deleteChannelAccount.invoke({ channelAccountId: selectedChannelAccount.id });
        if (!result.success) {
          Message.error(
            result.msg ||
              t('settings.channels.instanceDeleteFailed', { defaultValue: 'Failed to delete channel instance' })
          );
          return;
        }
        Message.success(t('settings.channels.instanceDeleted', { defaultValue: 'Channel instance deleted' }));
        await loadChannelState();
      } catch (error) {
        Message.error(getErrorMessage(error));
      }
    });
  }, [
    canDeleteInstance,
    loadChannelState,
    selectedChannelAccount,
    selectedLoadingKey,
    selectedStatus,
    t,
    withPluginLoading,
  ]);

  const pageTitle = mode === 'sessions' ? t('settings.activeSessions') : t('settings.agentEntry');
  const pageDescription =
    mode === 'sessions'
      ? t('settings.activeSessionsDesc', {
          defaultValue:
            'Choose a usable channel account and discovered IM target, then set long-term publication rules.',
        })
      : t('settings.agentEntryDesc', { defaultValue: 'Manage reusable IM channel accounts here.' });
  const useSplitColumnScroll = mode === 'channels' && isPageMode;

  return (
    <ContextGoScrollArea
      className={classNames(isPageMode && 'h-full', useSplitColumnScroll && 'overflow-hidden')}
      disableOverflow={useSplitColumnScroll}
    >
      <div className={classNames('px-[10px] md:px-[18px] pb-20px', useSplitColumnScroll && styles.pageLayout)}>
        <div className={styles.pageHeader}>
          <h2 className='text-20px font-500 text-t-primary m-0'>{pageTitle}</h2>
          <div className='space-y-8px mt-10px'>
            <div className='text-13px text-t-secondary leading-relaxed'>{pageDescription}</div>
          </div>
        </div>

        {mode === 'channels' ? (
          <>
            <div className={styles.shell}>
              <aside className={styles.sidebarCard}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    {t('settings.channels.familyListTitle', { defaultValue: 'Channel types' })}
                  </h3>
                  <div className={styles.sectionDescription}>
                    {t('settings.channels.familyListDescription', {
                      defaultValue: 'Choose one IM type first, then manage its channel instances on the right.',
                    })}
                  </div>
                </div>

                <div className={styles.familyList}>
                  {families.length === 0 ? (
                    <Empty description={t('settings.channels.selectFirst')} />
                  ) : (
                    families.map((family) => {
                      const isActive = family.id === resolvedFamilyId;
                      return (
                        <Button
                          key={family.id}
                          type='text'
                          onClick={() => setSelectedFamilyId(family.id)}
                          className={classNames(styles.familyButton, isActive && styles.familyButtonActive)}
                        >
                          <div className={styles.familyButtonInner}>
                            <ChannelLogo title={family.title} familyId={family.id} size='small' />
                            <div className={styles.familyMeta}>
                              <div className={styles.familyTitleRow}>
                                <div className={styles.familyTitle} title={family.title}>
                                  {family.title}
                                </div>
                                <Tag className={styles.countTag}>{family.channels.length}</Tag>
                              </div>
                              <div className={styles.familyDescription} title={family.description}>
                                {family.description}
                              </div>
                            </div>
                          </div>
                        </Button>
                      );
                    })
                  )}
                </div>
              </aside>

              <section className={styles.detailColumn}>
                {selectedFamily ? (
                  <>
                    <div className={styles.heroCard}>
                      <div className={styles.heroRow}>
                        <div className={styles.heroMain}>
                          <ChannelLogo title={selectedFamily.title} familyId={selectedFamily.id} size='large' />
                          <div className={styles.heroCopy}>
                            <h3 className={styles.heroTitle} title={selectedFamily.title}>
                              {selectedFamily.title}
                            </h3>
                            <div className={styles.heroDescription} title={selectedFamily.description}>
                              {selectedFamily.description}
                            </div>
                            <div className={styles.heroBadges}>
                              <Tag className={styles.metricTag}>
                                {t('settings.channels.instanceListTitle', { defaultValue: 'Instances' })}:{' '}
                                {selectedFamily.channels.length}
                              </Tag>
                              <Tag className={styles.metricTag}>
                                {t('settings.channels.readyCount', { defaultValue: 'Ready' })}:{' '}
                                {selectedFamily.readyCount}
                              </Tag>
                            </div>
                          </div>
                        </div>
                        {canCreateInstance ? (
                          <Button type='primary' onClick={() => void handleCreateInstance()}>
                            {t('settings.channels.addInstance', { defaultValue: 'Add and pair' })}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.instanceCard}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>
                          {t('settings.channels.instanceListTitle', { defaultValue: 'Instances' })}
                        </h3>
                        <div className={styles.sectionDescription}>
                          {t('settings.channels.instanceListDescription', {
                            defaultValue:
                              'Each channel instance has its own configuration, enablement, and pairing flow.',
                          })}
                        </div>
                      </div>

                      <div className={styles.instanceList}>
                        {selectedFamily.channels.length === 0 ? (
                          <div className={styles.instanceEmptyState}>
                            <Empty
                              description={t('settings.channels.emptyInstances', {
                                defaultValue: 'No channel instances yet',
                              })}
                            />
                          </div>
                        ) : (
                          selectedFamily.channels.map((entry) => {
                            const status = pluginStatusById.get(entry.id);
                            const isActive = entry.id === resolvedChannelId;
                            const primaryState = getChannelPrimaryState(
                              Boolean(entry.configured),
                              Boolean(status?.enabled),
                              entry.pairedCount ?? 0
                            );
                            return (
                              <Button
                                key={entry.id}
                                type='text'
                                onClick={() => setSelectedChannelId(entry.id)}
                                className={classNames(styles.instanceButton, isActive && styles.instanceButtonActive)}
                              >
                                <div className={styles.instanceButtonInner}>
                                  <ChannelLogo
                                    title={entry.title}
                                    channelId={entry.id}
                                    familyId={entry.familyId}
                                    icon={entry.icon}
                                    size='small'
                                  />
                                  <div className={styles.instanceMeta}>
                                    <div className={styles.instanceHeadingRow}>
                                      <div className={styles.instanceName} title={entry.title}>
                                        {entry.title}
                                      </div>
                                    </div>
                                    <div className={styles.instanceDescription} title={entry.description}>
                                      {entry.description}
                                    </div>
                                    <div className={styles.instanceMetaRow}>
                                      <Tag className={styles.metricTag}>
                                        {getChannelPrimaryStatusLabel(primaryState, t)}
                                      </Tag>
                                      {entry.pairedCount ? (
                                        <Tag className={styles.pillTag}>{getPairingLabel(entry.pairedCount, t)}</Tag>
                                      ) : null}
                                      {status?.botUsername ? (
                                        <Tag className={styles.usernameTag} title={`@${status.botUsername}`}>
                                          @{status.botUsername}
                                        </Tag>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </Button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {selectedChannel && selectedStatus ? (
                      <div className={styles.detailCard}>
                        <div className={styles.detailHeader}>
                          <div className={styles.detailHeaderMain}>
                            <ChannelLogo
                              title={selectedChannel.title}
                              channelId={selectedChannel.id}
                              familyId={selectedChannel.familyId}
                              icon={selectedChannel.icon}
                              size='large'
                            />
                            <div className={styles.detailHeaderCopy}>
                              <h3 className={styles.detailTitle} title={selectedChannel.title}>
                                {selectedChannel.title}
                              </h3>
                              <div className={styles.detailSubtitle} title={selectedFamily.description}>
                                {selectedFamily.description}
                              </div>
                              {selectedStatus.botUsername ? (
                                <div className={styles.detailBadges}>
                                  <Tag className={styles.usernameTag} title={`@${selectedStatus.botUsername}`}>
                                    @{selectedStatus.botUsername}
                                  </Tag>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className={styles.detailActions}>
                            <Switch
                              checked={selectedStatus.enabled}
                              disabled={loadingMap[selectedLoadingKey]}
                              onChange={(checked) => void handleToggleChannel(selectedStatus, checked)}
                            />
                            <Button onClick={() => void handleSaveInstance()} loading={loadingMap[selectedLoadingKey]}>
                              {t('common.save', { defaultValue: 'Save' })}
                            </Button>
                            {canDeleteInstance ? (
                              <Button
                                status='danger'
                                onClick={() => void handleDeleteInstance()}
                                loading={loadingMap[selectedLoadingKey]}
                              >
                                {t('common.delete', { defaultValue: 'Delete' })}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className={styles.setupCard}>
                          <div className={styles.setupHeader}>
                            <div className={styles.sectionHeader}>
                              <h3 className={styles.sectionTitle}>
                                {t('settings.channels.setupFlowTitle', { defaultValue: 'Setup flow' })}
                              </h3>
                              <div className={styles.sectionDescription}>
                                {selectedPairingComplete
                                  ? t('settings.channels.setupCompleteDescription', {
                                      defaultValue:
                                        'This instance has completed at least one pairing. It now counts as successfully added and can be used for publication.',
                                    })
                                  : t('settings.channels.setupPendingDescription', {
                                      defaultValue:
                                        'Only the instance shell exists so far. Finish configuration, enable the runtime, and approve at least one pairing request in order. The instance is not considered successfully added until pairing succeeds.',
                                    })}
                              </div>
                            </div>
                            {selectedPrimaryState ? (
                              <Tag className={styles.metricTag}>
                                {getChannelPrimaryStatusLabel(selectedPrimaryState, t)}
                              </Tag>
                            ) : null}
                          </div>
                          <div className={styles.setupSteps}>
                            <div className={styles.setupStep}>
                              <div className={styles.setupStepIndex}>1</div>
                              <div className={styles.setupStepBody}>
                                <div className={styles.setupStepTitle}>
                                  {t('settings.channels.setupStepConfigure', {
                                    defaultValue: 'Configure credentials or sign in',
                                  })}
                                </div>
                                <Tag className={styles.statusTag}>
                                  {getConfiguredLabel(Boolean(selectedChannel.configured), t)}
                                </Tag>
                              </div>
                            </div>
                            <div className={styles.setupStep}>
                              <div className={styles.setupStepIndex}>2</div>
                              <div className={styles.setupStepBody}>
                                <div className={styles.setupStepTitle}>
                                  {t('settings.channels.setupStepEnable', {
                                    defaultValue: 'Enable the channel runtime',
                                  })}
                                </div>
                                <Tag className={styles.statusTag}>{getEnabledLabel(selectedStatus.enabled, t)}</Tag>
                              </div>
                            </div>
                            <div className={styles.setupStep}>
                              <div className={styles.setupStepIndex}>3</div>
                              <div className={styles.setupStepBody}>
                                <div className={styles.setupStepTitle}>
                                  {t('settings.channels.setupStepPair', {
                                    defaultValue: 'Approve a pairing request',
                                  })}
                                </div>
                                <Tag className={styles.statusTag}>{getPairingLabel(selectedPairedCount, t)}</Tag>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className='grid gap-12px mt-16px md:grid-cols-[minmax(0,1fr)_160px]'>
                          <div className='space-y-6px'>
                            <div className='text-13px font-600 text-t-primary'>
                              {t('settings.channels.instanceNameLabel', { defaultValue: 'Instance name' })}
                            </div>
                            <Input
                              value={selectedNameDraft}
                              onChange={(value) => {
                                setInstanceNameDrafts((prev) => ({ ...prev, [selectedChannel.id]: value }));
                              }}
                              placeholder={t('settings.channels.instanceNamePlaceholder', {
                                defaultValue: 'Enter instance name',
                              })}
                            />
                          </div>
                          <div className='space-y-6px'>
                            <div className='text-13px font-600 text-t-primary'>
                              {t('settings.channels.instanceStatusLabel', { defaultValue: 'Runtime status' })}
                            </div>
                            <Input value={selectedStatus.status} disabled />
                          </div>
                        </div>

                        <div className='space-y-8px mt-16px'>
                          <div className='text-13px font-600 text-t-primary'>
                            {t('settings.channels.instanceDetailsTitle', { defaultValue: 'Instance details' })}
                          </div>
                          <div className='text-12px text-t-tertiary leading-relaxed'>
                            {selectedPairingComplete
                              ? t('settings.channels.instanceDetailsHint', {
                                  defaultValue:
                                    'This instance has completed pairing and can now be used for transport, authorization, and peer discovery. Formal Agent publication is still managed in Agent Publish.',
                                })
                              : t('settings.channels.instanceDraftHint', {
                                  defaultValue:
                                    'Creating the instance only starts the onboarding flow. Finish credentials or login, enable it, and complete at least one pairing. The instance is only considered added after pairing succeeds, and only then can it be used for publication.',
                                })}
                          </div>
                        </div>

                        <div className='mt-16px'>{selectedChannel.content}</div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Empty description={t('settings.channels.selectFirst')} />
                )}
              </section>
            </div>
          </>
        ) : (
          <div className='mt-18px space-y-16px'>
            <PublicationBindingPanel />
          </div>
        )}
      </div>
    </ContextGoScrollArea>
  );
};

export default ChannelModalContent;
