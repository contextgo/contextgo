/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { openExternalUrl } from '@/renderer/utils/platform';
import { Button, Empty, Input, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Delete, Down, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

interface LarkConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
}

const LARK_DEV_DOCS_URL = 'https://open.feishu.cn/document/develop-an-echo-bot/introduction';

const LarkConfigForm: React.FC<LarkConfigFormProps> = ({ pluginId, pluginStatus, onStatusChange }) => {
  const { t } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;

  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [encryptKey, setEncryptKey] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [touched, setTouched] = useState({ appId: false, appSecret: false });
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
            (item) => item.platformType === 'lark' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[LarkConfig] Failed to load pending pairings:', error);
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
            (item) => item.platformType === 'lark' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[LarkConfig] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [channelAccountId]);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadAuthorizedUsers, loadPendingPairings]);

  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'lark' || (request.connectorId && request.connectorId !== channelAccountId)) return;
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
      if (user.platformType !== 'lark' || (user.connectorId && user.connectorId !== channelAccountId)) return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((item) => item.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((item) => item.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId]);

  const handleTestConnection = async () => {
    setTouched({ appId: true, appSecret: true });

    if (!appId.trim() || !appSecret.trim()) {
      Message.warning(t('settings.lark.credentialsRequired', 'Please enter App ID and App Secret'));
      return;
    }

    setTestLoading(true);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: runtimeId,
        token: '',
        extraConfig: {
          appId: appId.trim(),
          appSecret: appSecret.trim(),
        },
      });

      if (result.success && result.data?.success) {
        Message.success(t('settings.lark.connectionSuccess', 'Connected to Lark API!'));
        await handleAutoEnable();
      } else {
        Message.error(result.data?.error || t('settings.lark.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      Message.error(error.message || t('settings.lark.connectionFailed', 'Connection failed'));
    } finally {
      setTestLoading(false);
    }
  };

  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: {
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          encryptKey: encryptKey.trim() || undefined,
          verificationToken: verificationToken.trim() || undefined,
        },
      });

      if (result.success) {
        Message.success(t('settings.lark.pluginEnabled', 'Lark bot enabled'));
        const statusResult = await channel.getPluginStatus.invoke();
        if (statusResult.success && statusResult.data) {
          const larkPlugin = statusResult.data.find((item) => item.id === channelAccountId);
          onStatusChange(larkPlugin || null);
        }
      } else {
        console.error('[LarkConfig] enablePlugin failed:', result.msg);
        Message.error(result.msg || t('settings.lark.enableFailed', 'Failed to enable Lark plugin'));
      }
    } catch (error: any) {
      console.error('[LarkConfig] Auto-enable failed:', error);
      Message.error(error.message || t('settings.lark.enableFailed', 'Failed to enable Lark plugin'));
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
  const hasExistingUsers = authorizedUsers.length > 0;

  const renderDocDescription = (suffixKey: string, fallback: string) => (
    <span>
      <a
        className='text-primary hover:underline cursor-pointer text-12px'
        href={LARK_DEV_DOCS_URL}
        onClick={(event) => {
          event.preventDefault();
          openExternalUrl(LARK_DEV_DOCS_URL).catch(console.error);
        }}
      >
        {t('settings.lark.devConsoleLink', 'Feishu Developer Console')}
      </a>{' '}
      {t(suffixKey, fallback)}
    </span>
  );

  return (
    <div className={formLayoutStyles.formRoot}>
      <FormPreferenceRow
        label={t('settings.lark.appId', 'App ID')}
        description={renderDocDescription('settings.lark.appIdDescSuffix', 'to get your App ID')}
        required
      >
        {hasExistingUsers ? (
          <Tooltip
            content={t(
              'settings.assistant.tokenLocked',
              'Please close the Channel and delete all authorized users before modifying the configuration'
            )}
          >
            <span>
              <Input
                value={appId}
                onChange={(value) => setAppId(value)}
                onBlur={() => setTouched((prev) => ({ ...prev, appId: true }))}
                placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'cli_xxxxxxxxxx'}
                className={formLayoutStyles.controlInput}
                status={touched.appId && !appId.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
                disabled
              />
            </span>
          </Tooltip>
        ) : (
          <Input
            value={appId}
            onChange={(value) => setAppId(value)}
            onBlur={() => setTouched((prev) => ({ ...prev, appId: true }))}
            placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'cli_xxxxxxxxxx'}
            className={formLayoutStyles.controlInput}
            status={touched.appId && !appId.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
          />
        )}
      </FormPreferenceRow>

      <FormPreferenceRow
        label={t('settings.lark.appSecret', 'App Secret')}
        description={renderDocDescription('settings.lark.appSecretDescSuffix', 'to get App Secret')}
        required
      >
        {hasExistingUsers ? (
          <Tooltip
            content={t(
              'settings.assistant.tokenLocked',
              'Please close the Channel and delete all authorized users before modifying the configuration'
            )}
          >
            <span>
              <Input.Password
                value={appSecret}
                onChange={(value) => setAppSecret(value)}
                onBlur={() => setTouched((prev) => ({ ...prev, appSecret: true }))}
                placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxx'}
                className={formLayoutStyles.controlInput}
                status={touched.appSecret && !appSecret.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
                visibilityToggle
                disabled
              />
            </span>
          </Tooltip>
        ) : (
          <Input.Password
            value={appSecret}
            onChange={(value) => setAppSecret(value)}
            onBlur={() => setTouched((prev) => ({ ...prev, appSecret: true }))}
            placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxx'}
            className={formLayoutStyles.controlInput}
            status={touched.appSecret && !appSecret.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
            visibilityToggle
          />
        )}
      </FormPreferenceRow>

      <Button
        type='text'
        size='mini'
        className={formLayoutStyles.optionalToggle}
        icon={
          <Down
            theme='outline'
            size={12}
            style={{ transform: showOptional ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        }
        onClick={() => setShowOptional((prev) => !prev)}
      >
        {showOptional
          ? t('settings.lark.hideOptionalFields', 'Hide optional settings')
          : t('settings.lark.showOptionalFields', 'Show optional settings')}
      </Button>

      {showOptional ? (
        <>
          <FormPreferenceRow
            label={t('settings.lark.encryptKey', 'Encrypt Key')}
            description={t(
              'settings.lark.encryptKeyDesc',
              'Optional: For event encryption (from Event Subscription settings)'
            )}
          >
            {hasExistingUsers ? (
              <Tooltip
                content={t(
                  'settings.assistant.tokenLocked',
                  'Please close the Channel and delete all authorized users before modifying the configuration'
                )}
              >
                <span>
                  <Input.Password
                    value={encryptKey}
                    onChange={(value) => setEncryptKey(value)}
                    placeholder={t('settings.lark.optional', 'Optional')}
                    className={formLayoutStyles.controlInput}
                    visibilityToggle
                    disabled
                  />
                </span>
              </Tooltip>
            ) : (
              <Input.Password
                value={encryptKey}
                onChange={(value) => setEncryptKey(value)}
                placeholder={t('settings.lark.optional', 'Optional')}
                className={formLayoutStyles.controlInput}
                visibilityToggle
              />
            )}
          </FormPreferenceRow>

          <FormPreferenceRow
            label={t('settings.lark.verificationToken', 'Verification Token')}
            description={t(
              'settings.lark.verificationTokenDesc',
              'Optional: For event verification (from Event Subscription settings)'
            )}
          >
            {hasExistingUsers ? (
              <Tooltip
                content={t(
                  'settings.assistant.tokenLocked',
                  'Please close the Channel and delete all authorized users before modifying the configuration'
                )}
              >
                <span>
                  <Input.Password
                    value={verificationToken}
                    onChange={(value) => setVerificationToken(value)}
                    placeholder={t('settings.lark.optional', 'Optional')}
                    className={formLayoutStyles.controlInput}
                    visibilityToggle
                    disabled
                  />
                </span>
              </Tooltip>
            ) : (
              <Input.Password
                value={verificationToken}
                onChange={(value) => setVerificationToken(value)}
                placeholder={t('settings.lark.optional', 'Optional')}
                className={formLayoutStyles.controlInput}
                visibilityToggle
              />
            )}
          </FormPreferenceRow>
        </>
      ) : null}

      {!hasExistingUsers && !pluginStatus?.connected ? (
        <div className='flex items-center justify-end gap-8px flex-wrap'>
          {pluginStatus?.hasToken && !appId.trim() && !appSecret.trim() ? (
            <span className={formLayoutStyles.actionHint}>
              {t('settings.lark.credentialsSaved', 'Credentials already configured. Enter new values to update.')}
            </span>
          ) : null}
          <Button
            type='primary'
            loading={testLoading}
            onClick={() => void handleTestConnection()}
            disabled={pluginStatus?.hasToken && !appId.trim() && !appSecret.trim()}
          >
            {t('settings.lark.testAndConnect', 'Test & Connect')}
          </Button>
        </div>
      ) : null}

      {pluginStatus?.enabled && authorizedUsers.length === 0 ? (
        <div
          className={`rd-12px p-16px border ${pluginStatus?.connected ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : pluginStatus?.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}
        >
          <FormSectionHeader
            title={t('settings.lark.connectionStatus', 'Connection Status')}
            action={
              <span
                className={`text-12px px-8px py-2px rd-4px ${pluginStatus?.connected ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : pluginStatus?.error ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}
              >
                {pluginStatus?.connected
                  ? t('settings.lark.statusConnected', 'Connected')
                  : pluginStatus?.error
                    ? t('settings.lark.statusError', 'Error')
                    : t('settings.lark.statusConnecting', 'Connecting...')}
              </span>
            }
          />
          {pluginStatus?.error ? (
            <div className='text-14px text-red-600 dark:text-red-400 mb-12px'>{pluginStatus.error}</div>
          ) : null}
          {pluginStatus?.connected ? (
            <div className='text-14px text-t-secondary space-y-8px'>
              <p className='m-0 font-500'>{t('settings.assistant.nextSteps', 'Next Steps')}:</p>
              <p className='m-0'>
                <strong>1.</strong> {t('settings.lark.step1', 'Open Feishu/Lark and find your bot application')}
              </p>
              <p className='m-0'>
                <strong>2.</strong> {t('settings.lark.step2', 'Send any message to initiate pairing')}
              </p>
              <p className='m-0'>
                <strong>3.</strong>{' '}
                {t(
                  'settings.lark.step3',
                  'A pairing request will appear below. Click "Approve" to authorize the user.'
                )}
              </p>
              <p className='m-0'>
                <strong>4.</strong>{' '}
                {t('settings.lark.step4', 'Once approved, you can start chatting with the AI assistant through Lark!')}
              </p>
            </div>
          ) : null}
          {!pluginStatus?.connected && !pluginStatus?.error ? (
            <div className='text-14px text-t-secondary'>
              {t('settings.lark.waitingConnection', 'WebSocket connection is being established. Please wait...')}
            </div>
          ) : null}
        </div>
      ) : null}

      {pluginStatus?.enabled && authorizedUsers.length === 0 ? (
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
                    <div className='space-y-8px'>
                      <div className={formLayoutStyles.inlineRow}>
                        <span className='text-14px font-500 text-t-primary'>
                          {pairing.displayName || pairing.platformUserId || 'Unknown User'}
                        </span>
                        <Tooltip content={t('settings.assistant.copyCode', 'Copy pairing code')}>
                          <Button
                            size='mini'
                            type='text'
                            icon={<Copy size={14} />}
                            onClick={() => copyToClipboard(pairing.code)}
                          />
                        </Tooltip>
                      </div>
                      <div className={formLayoutStyles.metaText}>
                        {t('settings.assistant.pairingCode', 'Code')}:{' '}
                        <code className={formLayoutStyles.inlineCode}>{pairing.code}</code>
                      </div>
                      <div className={formLayoutStyles.metaText}>
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
      ) : null}

      {authorizedUsers.length > 0 ? (
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
                    <div className='text-14px font-500 text-t-primary'>
                      {user.displayName || user.platformUserId || 'Unknown User'}
                    </div>
                    <div className={formLayoutStyles.metaText}>
                      {t('settings.assistant.platform', 'Platform')}: {user.platformType}
                    </div>
                    <div className={formLayoutStyles.metaText}>
                      {t('settings.assistant.authorizedAt', 'Authorized')}: {formatTime(user.authorizedAt)}
                    </div>
                  </div>
                  <div className={formLayoutStyles.statusItemActions}>
                    <Tooltip content={t('settings.assistant.revokeAccess', 'Revoke access')}>
                      <Button
                        type='text'
                        status='danger'
                        size='small'
                        icon={<Delete size={16} />}
                        onClick={() => void handleRevokeUser(user.id)}
                      />
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default LarkConfigForm;
