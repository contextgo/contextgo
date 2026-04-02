/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { Button, Empty, Input, Message, Spin, Switch, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Delete, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

type DiscordConfigDraft = {
  token: string;
  requireMention: boolean;
};

interface DiscordConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
  onConfigChange?: (config: DiscordConfigDraft) => void;
}

const DiscordConfigForm: React.FC<DiscordConfigFormProps> = ({
  pluginId,
  pluginStatus,
  onStatusChange,
  onConfigChange,
}) => {
  const { t } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;

  const [token, setToken] = useState('');
  const [requireMention, setRequireMention] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testedBotUsername, setTestedBotUsername] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<IChannelUser[]>([]);

  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(
          result.data.filter(
            (item) => item.platformType === 'discord' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[DiscordConfig] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, [channelAccountId]);

  const loadAuthorizedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await channel.getAuthorizedUsers.invoke();
      if (result.success && result.data) {
        setAuthorizedUsers(
          result.data.filter(
            (item) => item.platformType === 'discord' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[DiscordConfig] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [channelAccountId]);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadAuthorizedUsers, loadPendingPairings]);

  const emitConfigChange = useCallback(
    (nextConfig: DiscordConfigDraft) => {
      onConfigChange?.(nextConfig);
    },
    [onConfigChange]
  );

  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'discord' || (request.connectorId && request.connectorId !== channelAccountId))
        return;
      setPendingPairings((prev) => {
        const exists = prev.some((item) => item.code === request.code);
        if (exists) return prev;
        return [request, ...prev];
      });
    });
    return () => unsubscribe();
  }, [channelAccountId]);

  useEffect(() => {
    const unsubscribe = channel.userAuthorized.on((user) => {
      if (user.platformType !== 'discord' || (user.connectorId && user.connectorId !== channelAccountId)) return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((item) => item.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((item) => item.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId]);

  const handleTokenChange = (value: string) => {
    setToken(value);
    setTestedBotUsername(null);
    emitConfigChange({
      token: value,
      requireMention,
    });
  };

  const handleRequireMentionChange = (value: boolean) => {
    setRequireMention(value);
    emitConfigChange({
      token,
      requireMention: value,
    });
  };

  const refreshChannelStatus = async () => {
    const statusResult = await channel.getPluginStatus.invoke();
    if (statusResult.success && statusResult.data) {
      const discordPlugin = statusResult.data.find((plugin) => plugin.id === channelAccountId);
      onStatusChange(discordPlugin || null);
    }
  };

  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: {
          token: token.trim(),
          requireMention,
        },
      });

      if (result.success) {
        Message.success(t('settings.discord.pluginEnabled', 'Discord bot enabled'));
        await refreshChannelStatus();
      } else {
        Message.error(result.msg || t('settings.discord.enableFailed', 'Failed to enable Discord plugin'));
      }
    } catch (error: any) {
      console.error('[DiscordConfig] Auto-enable failed:', error);
      Message.error(error.message || t('settings.discord.enableFailed', 'Failed to enable Discord plugin'));
    }
  };

  const handleTestConnection = async () => {
    if (!token.trim()) {
      Message.warning(t('settings.discord.tokenRequired', 'Please enter a Discord bot token'));
      return;
    }

    setTestLoading(true);
    setTestedBotUsername(null);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: runtimeId,
        token: token.trim(),
      });

      if (result.success && result.data?.success) {
        setTestedBotUsername(result.data.botUsername || null);
        Message.success(
          t('settings.discord.connectionSuccess', {
            defaultValue: 'Connected! Bot: {{username}}',
            username: result.data.botUsername || 'unknown',
          })
        );
        await handleAutoEnable();
      } else {
        Message.error(result.data?.error || t('settings.discord.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      Message.error(error.message || t('settings.discord.connectionFailed', 'Connection failed'));
    } finally {
      setTestLoading(false);
    }
  };

  const handleApprovePairing = async (code: string) => {
    try {
      const result = await channel.approvePairing.invoke({ code });
      if (result.success) {
        Message.success(t('settings.assistant.pairingApproved', 'Pairing approved'));
        await loadPendingPairings();
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.approveFailed', 'Failed to approve pairing'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  const handleRejectPairing = async (code: string) => {
    try {
      const result = await channel.rejectPairing.invoke({ code });
      if (result.success) {
        Message.info(t('settings.assistant.pairingRejected', 'Pairing rejected'));
        await loadPendingPairings();
      } else {
        Message.error(result.msg || t('settings.assistant.rejectFailed', 'Failed to reject pairing'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    try {
      const result = await channel.revokeUser.invoke({ userId });
      if (result.success) {
        Message.success(t('settings.assistant.userRevoked', 'User access revoked'));
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.revokeFailed', 'Failed to revoke user'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();
  const getRemainingTime = (expiresAt: number) => `${Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60))} min`;

  const configLocked = authorizedUsers.length > 0;

  return (
    <div className={formLayoutStyles.formRoot}>
      <FormPreferenceRow
        label={t('settings.discord.botToken', 'Bot Token')}
        description={t(
          'settings.discord.botTokenDesc',
          'Create a Discord bot, enable the Message Content intent, and paste the bot token here.'
        )}
      >
        <div className={formLayoutStyles.inlineRow}>
          {configLocked ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized users before modifying the configuration'
              )}
            >
              <span>
                <Input.Password
                  value={token}
                  onChange={handleTokenChange}
                  placeholder={
                    pluginStatus?.hasToken
                      ? '••••••••••••••••'
                      : t('settings.discord.botTokenPlaceholder', 'Discord bot token')
                  }
                  className={formLayoutStyles.controlInput}
                  visibilityToggle
                  disabled
                />
              </span>
            </Tooltip>
          ) : (
            <Input.Password
              value={token}
              onChange={handleTokenChange}
              placeholder={
                pluginStatus?.hasToken
                  ? '••••••••••••••••'
                  : t('settings.discord.botTokenPlaceholder', 'Discord bot token')
              }
              className={formLayoutStyles.controlInput}
              visibilityToggle
            />
          )}
          {configLocked ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized users before modifying the configuration'
              )}
            >
              <span>
                <Button type='outline' loading={testLoading} onClick={handleTestConnection} disabled>
                  {t('settings.discord.testAndConnect', 'Test & Connect')}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button type='outline' loading={testLoading} onClick={handleTestConnection}>
              {t('settings.discord.testAndConnect', 'Test & Connect')}
            </Button>
          )}
        </div>
      </FormPreferenceRow>

      <FormPreferenceRow
        label={t('settings.discord.requireMention', 'Require mention in servers')}
        description={t(
          'settings.discord.requireMentionDesc',
          'When enabled, Discord server messages must mention the bot. Direct messages always work.'
        )}
      >
        <Switch checked={requireMention} onChange={handleRequireMentionChange} disabled={configLocked} />
      </FormPreferenceRow>

      <div className='text-12px leading-relaxed p-12px rd-8px bg-[rgba(var(--orange-6),0.08)] border border-[rgba(var(--orange-6),0.28)] text-t-secondary'>
        {t(
          'settings.discord.intentNotice',
          'Remember to enable the Message Content intent in the Discord Developer Portal before testing the bot.'
        )}
      </div>

      {pluginStatus?.enabled && pluginStatus?.connected && authorizedUsers.length === 0 && (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <FormSectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong> {t('settings.discord.step1', 'Invite the bot to a Discord server or open a DM')}
              {(testedBotUsername || pluginStatus.botUsername) && (
                <span className='ml-4px'>
                  <code className='bg-fill-2 px-6px py-2px rd-4px'>
                    {testedBotUsername || pluginStatus.botUsername}
                  </code>
                </span>
              )}
            </p>
            <p className='m-0'>
              <strong>2.</strong>{' '}
              {t(
                'settings.discord.step2',
                'Send a DM to the bot, or mention it in a server channel if mention mode is enabled'
              )}
            </p>
            <p className='m-0'>
              <strong>3.</strong>{' '}
              {t(
                'settings.discord.step3',
                'A pairing request will appear below. Click "Approve" to authorize the Discord user.'
              )}
            </p>
            <p className='m-0'>
              <strong>4.</strong>{' '}
              {t('settings.discord.step4', 'Once approved, you can chat with the AI assistant directly from Discord.')}
            </p>
          </div>
        </div>
      )}

      {pluginStatus?.enabled && authorizedUsers.length === 0 && (
        <div className={formLayoutStyles.sectionCard}>
          <FormSectionHeader
            title={t('settings.assistant.pendingPairings', 'Pending Pairing Requests')}
            action={
              <Button
                size='mini'
                type='text'
                icon={<Refresh size={14} />}
                loading={pairingLoading}
                onClick={loadPendingPairings}
              >
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />

          {pairingLoading ? (
            <div className='py-20px text-center'>
              <Spin />
            </div>
          ) : pendingPairings.length === 0 ? (
            <Empty description={t('settings.assistant.noPendingPairings', 'No pending pairing requests')} />
          ) : (
            <div className={formLayoutStyles.statusList}>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className={formLayoutStyles.statusItem}>
                  <div className={formLayoutStyles.statusItemMain}>
                    <div className='space-y-8px'>
                      <div className={formLayoutStyles.inlineRow}>
                        <span className='text-13px text-t-secondary'>
                          {t('settings.assistant.pairingCode', 'Code')}
                        </span>
                        <code className={`bg-fill-3 px-8px py-4px rd-6px text-13px ${formLayoutStyles.inlineCode}`}>
                          {pairing.code}
                        </code>
                        <Button
                          size='mini'
                          type='text'
                          icon={<Copy size={14} />}
                          onClick={() => copyToClipboard(pairing.code)}
                        />
                      </div>
                      <div className='text-13px text-t-primary'>{pairing.displayName || pairing.platformUserId}</div>
                      <div className='text-12px text-t-tertiary'>
                        {t('settings.assistant.expiresIn', 'Expires in')}: {getRemainingTime(pairing.expiresAt)}
                      </div>
                    </div>
                  </div>
                  <div className={formLayoutStyles.statusItemActions}>
                    <Button
                      type='primary'
                      size='small'
                      icon={<CheckOne size={14} />}
                      onClick={() => void handleApprovePairing(pairing.code)}
                    >
                      {t('settings.assistant.approve', 'Approve')}
                    </Button>
                    <Button
                      type='secondary'
                      size='small'
                      status='danger'
                      icon={<CloseOne size={14} />}
                      onClick={() => void handleRejectPairing(pairing.code)}
                    >
                      {t('settings.assistant.reject', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={formLayoutStyles.sectionCard}>
        <FormSectionHeader
          title={t('settings.assistant.authorizedUsers', 'Authorized Users')}
          action={
            <Button
              size='mini'
              type='text'
              icon={<Refresh size={14} />}
              loading={usersLoading}
              onClick={loadAuthorizedUsers}
            >
              {t('common.refresh', 'Refresh')}
            </Button>
          }
        />

        {usersLoading ? (
          <div className='py-20px text-center'>
            <Spin />
          </div>
        ) : authorizedUsers.length === 0 ? (
          <Empty description={t('settings.assistant.noAuthorizedUsers', 'No authorized users yet')} />
        ) : (
          <div className={formLayoutStyles.statusList}>
            {authorizedUsers.map((user) => (
              <div key={user.id} className={formLayoutStyles.statusItem}>
                <div className={formLayoutStyles.statusItemMain}>
                  <div className='space-y-6px'>
                    <div className='text-14px text-t-primary'>{user.displayName || user.platformUserId}</div>
                    <div className='text-12px text-t-tertiary'>
                      {t('settings.assistant.platform', 'Platform')}: {user.platformType}
                    </div>
                    <div className='text-12px text-t-tertiary'>
                      {t('settings.assistant.authorizedAt', 'Authorized')}: {formatTime(user.authorizedAt)}
                    </div>
                  </div>
                </div>
                <div className={formLayoutStyles.statusItemActions}>
                  <Button
                    type='secondary'
                    status='danger'
                    size='small'
                    icon={<Delete size={14} />}
                    onClick={() => void handleRevokeUser(user.id)}
                  >
                    {t('settings.assistant.revokeAccess', 'Revoke access')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordConfigForm;
