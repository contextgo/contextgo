/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { Button, Empty, Input, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Delete, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

interface TelegramConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
  onTokenChange?: (token: string) => void;
}

const TelegramConfigForm: React.FC<TelegramConfigFormProps> = ({
  pluginId,
  pluginStatus,
  onStatusChange,
  onTokenChange,
}) => {
  const { t } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;

  const [telegramToken, setTelegramToken] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [tokenTested, setTokenTested] = useState(false);
  const [testedBotUsername, setTestedBotUsername] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<IChannelUser[]>([]);

  // Load pending pairings
  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(
          result.data.filter(
            (p) => p.platformType === 'telegram' && (!p.connectorId || p.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[ChannelSettings] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, [channelAccountId]);

  // Load authorized users
  const loadAuthorizedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await channel.getAuthorizedUsers.invoke();
      if (result.success && result.data) {
        setAuthorizedUsers(
          result.data.filter(
            (u) => u.platformType === 'telegram' && (!u.connectorId || u.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[ChannelSettings] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [channelAccountId]);

  // Initial load
  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadPendingPairings, loadAuthorizedUsers]);

  // Listen for pairing requests
  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'telegram' || (request.connectorId && request.connectorId !== channelAccountId))
        return;
      setPendingPairings((prev) => {
        const exists = prev.some((p) => p.code === request.code);
        if (exists) return prev;
        return [request, ...prev];
      });
    });
    return () => unsubscribe();
  }, [channelAccountId]);

  // Listen for user authorization
  useEffect(() => {
    const unsubscribe = channel.userAuthorized.on((user) => {
      if (user.platformType !== 'telegram' || (user.connectorId && user.connectorId !== channelAccountId)) return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((p) => p.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId]);

  const refreshChannelStatus = async () => {
    const statusResult = await channel.getPluginStatus.invoke();
    if (statusResult.success && statusResult.data) {
      const telegramPlugin = statusResult.data.find((item) => item.id === channelAccountId);
      onStatusChange(telegramPlugin || null);
    }
  };

  // Test Telegram connection
  const handleTestConnection = async () => {
    if (!telegramToken.trim()) {
      Message.warning(t('settings.assistant.tokenRequired', 'Please enter a bot token'));
      return;
    }

    setTestLoading(true);
    setTokenTested(false);
    setTestedBotUsername(null);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: runtimeId,
        token: telegramToken.trim(),
      });

      if (result.success && result.data?.success) {
        setTokenTested(true);
        setTestedBotUsername(result.data.botUsername || null);
        Message.success(
          t('settings.assistant.connectionSuccess', `Connected! Bot: @${result.data.botUsername || 'unknown'}`)
        );

        // Auto-enable bot after successful test
        await handleAutoEnable();
      } else {
        setTokenTested(false);
        Message.error(result.data?.error || t('settings.assistant.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      setTokenTested(false);
      Message.error(error.message || t('settings.assistant.connectionFailed', 'Connection failed'));
    } finally {
      setTestLoading(false);
    }
  };

  // Auto-enable plugin after successful test
  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: { token: telegramToken.trim() },
      });

      if (result.success) {
        Message.success(t('settings.assistant.pluginEnabled', 'Telegram bot enabled'));
        await refreshChannelStatus();
      }
    } catch (error: any) {
      console.error('[ChannelSettings] Auto-enable failed:', error);
    }
  };

  // Reset token tested state when token changes
  const handleTokenChange = (value: string) => {
    setTelegramToken(value);
    setTokenTested(false);
    setTestedBotUsername(null);
    onTokenChange?.(value);
  };

  // Approve pairing
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

  // Reject pairing
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

  // Revoke user
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

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Calculate remaining time
  const getRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60));
    return `${remaining} min`;
  };

  return (
    <div className={formLayoutStyles.formRoot}>
      <FormPreferenceRow
        label={t('settings.assistant.botToken', 'Bot Token')}
        description={t(
          'settings.assistant.botTokenDesc',
          'Open Telegram, find @BotFather and send /newbot to get your Bot Token.'
        )}
      >
        <div className={formLayoutStyles.inlineRow}>
          {authorizedUsers.length > 0 ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized users before modifying the configuration'
              )}
            >
              <span>
                <Input.Password
                  value={telegramToken}
                  onChange={handleTokenChange}
                  placeholder={
                    authorizedUsers.length > 0 || pluginStatus?.hasToken ? '••••••••••••••••' : '123456:ABC-DEF...'
                  }
                  className={formLayoutStyles.controlInput}
                  visibilityToggle
                  disabled={authorizedUsers.length > 0}
                />
              </span>
            </Tooltip>
          ) : (
            <Input.Password
              value={telegramToken}
              onChange={handleTokenChange}
              placeholder={
                authorizedUsers.length > 0 || pluginStatus?.hasToken ? '••••••••••••••••' : '123456:ABC-DEF...'
              }
              className={formLayoutStyles.controlInput}
              visibilityToggle
              disabled={authorizedUsers.length > 0}
            />
          )}
          {authorizedUsers.length > 0 ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized users before modifying the configuration'
              )}
            >
              <span>
                <Button
                  type='outline'
                  loading={testLoading}
                  onClick={handleTestConnection}
                  disabled={authorizedUsers.length > 0}
                >
                  {t('settings.assistant.testConnection', 'Test')}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              type='outline'
              loading={testLoading}
              onClick={handleTestConnection}
              disabled={authorizedUsers.length > 0}
            >
              {t('settings.assistant.testConnection', 'Test')}
            </Button>
          )}
        </div>
      </FormPreferenceRow>

      {/* Next Steps Guide - show when bot is enabled and no authorized users yet */}
      {pluginStatus?.enabled && pluginStatus?.connected && authorizedUsers.length === 0 && (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <FormSectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong> {t('settings.assistant.step1', 'Open Telegram and search for your bot')}
              {pluginStatus.botUsername && (
                <span className='ml-4px'>
                  <code className='bg-fill-2 px-6px py-2px rd-4px'>@{pluginStatus.botUsername}</code>
                </span>
              )}
            </p>
            <p className='m-0'>
              <strong>2.</strong>{' '}
              {t('settings.assistant.step2', 'Send any message or click /start to initiate pairing')}
            </p>
            <p className='m-0'>
              <strong>3.</strong>{' '}
              {t(
                'settings.assistant.step3',
                'A pairing request will appear below. Click "Approve" to authorize the user.'
              )}
            </p>
            <p className='m-0'>
              <strong>4.</strong>{' '}
              {t('settings.assistant.step4', 'Once approved, you can start chatting with Gemini through Telegram!')}
            </p>
          </div>
        </div>
      )}

      {/* Pending Pairings - show when bot is enabled and no authorized users yet */}
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
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : pendingPairings.length === 0 ? (
            <Empty description={t('settings.assistant.noPendingPairings', 'No pending pairing requests')} />
          ) : (
            <div className={formLayoutStyles.statusList}>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className={formLayoutStyles.statusItem}>
                  <div className={formLayoutStyles.statusItemMain}>
                    <div className={formLayoutStyles.inlineRow}>
                      <span className='text-14px font-500 text-t-primary'>{pairing.displayName || 'Unknown User'}</span>
                      <Tooltip content={t('settings.assistant.copyCode', 'Copy pairing code')}>
                        <Button
                          type='text'
                          size='mini'
                          icon={<Copy size={14} />}
                          onClick={() => copyToClipboard(pairing.code)}
                        />
                      </Tooltip>
                    </div>
                    <div className={formLayoutStyles.metaText}>
                      {t('settings.assistant.pairingCode', 'Code')}:{' '}
                      <code className={`bg-fill-3 px-4px rd-2px ${formLayoutStyles.inlineCode}`}>{pairing.code}</code>
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.expiresIn', 'Expires in')}: {getRemainingTime(pairing.expiresAt)}
                    </div>
                  </div>
                  <div className={formLayoutStyles.statusItemActions}>
                    <Button
                      type='primary'
                      size='small'
                      icon={<CheckOne size={14} />}
                      onClick={() => handleApprovePairing(pairing.code)}
                    >
                      {t('settings.assistant.approve', 'Approve')}
                    </Button>
                    <Button
                      type='secondary'
                      size='small'
                      status='danger'
                      icon={<CloseOne size={14} />}
                      onClick={() => handleRejectPairing(pairing.code)}
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

      {/* Authorized Users - show when there are authorized users */}
      {authorizedUsers.length > 0 && (
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
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : authorizedUsers.length === 0 ? (
            <Empty description={t('settings.assistant.noAuthorizedUsers', 'No authorized users yet')} />
          ) : (
            <div className={formLayoutStyles.statusList}>
              {authorizedUsers.map((user) => (
                <div key={user.id} className={formLayoutStyles.statusItem}>
                  <div className={formLayoutStyles.statusItemMain}>
                    <div className='text-14px font-500 text-t-primary'>{user.displayName || 'Unknown User'}</div>
                    <div className={formLayoutStyles.metaText}>
                      {t('settings.assistant.platform', 'Platform')}: {user.platformType}
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.authorizedAt', 'Authorized')}: {formatTime(user.authorizedAt)}
                    </div>
                  </div>
                  <Tooltip content={t('settings.assistant.revokeAccess', 'Revoke access')}>
                    <Button
                      type='text'
                      status='danger'
                      size='small'
                      icon={<Delete size={16} />}
                      onClick={() => handleRevokeUser(user.id)}
                    />
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramConfigForm;
