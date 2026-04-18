/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelAuthorizedTarget, IChannelPairingRequest, IChannelPluginStatus } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { getPublicDocsUrl, PUBLIC_DOC_SLUGS } from '@/common/update/publicUrls';
import { openExternalUrl } from '@/renderer/utils/platform';
import { Button, Empty, Input, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthorizedTargetList } from './AuthorizedTargets';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

interface DingTalkConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
}

const DingTalkConfigForm: React.FC<DingTalkConfigFormProps> = ({ pluginId, pluginStatus, onStatusChange }) => {
  const { t, i18n } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;
  const dingTalkDocsUrl = getPublicDocsUrl(i18n.language, PUBLIC_DOC_SLUGS.connectorsAndChannels);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [touched, setTouched] = useState({ clientId: false, clientSecret: false });
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedTargets, setAuthorizedTargets] = useState<IChannelAuthorizedTarget[]>([]);

  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(
          result.data.filter(
            (item) =>
              item.platformType === 'dingtalk' && (!item.channelAccountId || item.channelAccountId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[DingTalkConfig] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, [channelAccountId]);

  const loadAuthorizedTargets = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await channel.getAuthorizedTargets.invoke();
      if (result.success && result.data) {
        setAuthorizedTargets(
          result.data.filter(
            (item) =>
              item.platformType === 'dingtalk' && (!item.channelAccountId || item.channelAccountId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[DingTalkConfig] Failed to load authorized targets:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [channelAccountId]);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedTargets();
  }, [loadAuthorizedTargets, loadPendingPairings]);

  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (
        request.platformType !== 'dingtalk' ||
        (request.channelAccountId && request.channelAccountId !== channelAccountId)
      )
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
      if (user.platformType !== 'dingtalk' || (user.channelAccountId && user.channelAccountId !== channelAccountId)) {
        return;
      }
      void loadAuthorizedTargets();
      setPendingPairings((prev) => prev.filter((item) => item.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId, loadAuthorizedTargets]);

  const handleTestConnection = async () => {
    setTouched({ clientId: true, clientSecret: true });

    if (!clientId.trim() || !clientSecret.trim()) {
      Message.warning(t('settings.dingtalk.credentialsRequired', 'Please enter Client ID and Client Secret'));
      return;
    }

    setTestLoading(true);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: runtimeId,
        token: '',
        extraConfig: {
          appId: clientId.trim(),
          appSecret: clientSecret.trim(),
        },
      });

      if (result.success && result.data?.success) {
        Message.success(t('settings.dingtalk.connectionSuccess', 'Connected to DingTalk API!'));
        await handleAutoEnable();
      } else {
        Message.error(result.data?.error || t('settings.dingtalk.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      Message.error(error.message || t('settings.dingtalk.connectionFailed', 'Connection failed'));
    } finally {
      setTestLoading(false);
    }
  };

  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
      });

      if (result.success) {
        Message.success(t('settings.dingtalk.pluginEnabled', 'DingTalk bot enabled'));
        const statusResult = await channel.getPluginStatus.invoke();
        if (statusResult.success && statusResult.data) {
          const dingtalkPlugin = statusResult.data.find((item) => item.id === channelAccountId);
          onStatusChange(dingtalkPlugin || null);
        }
      } else {
        console.error('[DingTalkConfig] enablePlugin failed:', result.msg);
        Message.error(result.msg || t('settings.dingtalk.enableFailed', 'Failed to enable DingTalk plugin'));
      }
    } catch (error: any) {
      console.error('[DingTalkConfig] Auto-enable failed:', error);
      Message.error(error.message || t('settings.dingtalk.enableFailed', 'Failed to enable DingTalk plugin'));
    }
  };

  const handleApprovePairing = async (code: string) => {
    try {
      const result = await channel.approvePairing.invoke({ code });
      if (result.success) {
        Message.success(t('settings.assistant.pairingApproved', 'Pairing approved'));
        await loadPendingPairings();
        await loadAuthorizedTargets();
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
        Message.success(t('settings.assistant.userRevoked', 'Target authorization revoked'));
        await loadAuthorizedTargets();
      } else {
        Message.error(result.msg || t('settings.assistant.revokeFailed', 'Failed to revoke authorization'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  const getRemainingTime = (expiresAt: number) => `${Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60))} min`;
  const hasExistingUsers = authorizedTargets.length > 0;

  const renderDocDescription = (suffixKey: string, fallback: string) => (
    <span>
      <a
        className='text-primary hover:underline cursor-pointer text-12px'
        href={dingTalkDocsUrl}
        onClick={(event) => {
          event.preventDefault();
          openExternalUrl(dingTalkDocsUrl).catch(console.error);
        }}
      >
        {t('settings.dingtalk.devConsoleLink', 'DingTalk Open Platform')}
      </a>{' '}
      {t(suffixKey, fallback)}
    </span>
  );

  return (
    <div className={formLayoutStyles.formRoot}>
      <FormPreferenceRow
        label={t('settings.dingtalk.clientId', 'Client ID')}
        description={renderDocDescription('settings.dingtalk.clientIdDescSuffix', 'to get your Client ID')}
        required
      >
        {hasExistingUsers ? (
          <Tooltip
            content={t(
              'settings.assistant.tokenLocked',
              'Please close the Channel and delete all authorized targets before modifying'
            )}
          >
            <span>
              <Input
                value={clientId}
                onChange={(value) => setClientId(value)}
                onBlur={() => setTouched((prev) => ({ ...prev, clientId: true }))}
                placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'dingxxxxxxxxxx'}
                className={formLayoutStyles.controlInput}
                status={touched.clientId && !clientId.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
                disabled
              />
            </span>
          </Tooltip>
        ) : (
          <Input
            value={clientId}
            onChange={(value) => setClientId(value)}
            onBlur={() => setTouched((prev) => ({ ...prev, clientId: true }))}
            placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'dingxxxxxxxxxx'}
            className={formLayoutStyles.controlInput}
            status={touched.clientId && !clientId.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
          />
        )}
      </FormPreferenceRow>

      <FormPreferenceRow
        label={t('settings.dingtalk.clientSecret', 'Client Secret')}
        description={renderDocDescription('settings.dingtalk.clientSecretDescSuffix', 'to get Client Secret')}
        required
      >
        {hasExistingUsers ? (
          <Tooltip
            content={t(
              'settings.assistant.tokenLocked',
              'Please close the Channel and delete all authorized targets before modifying'
            )}
          >
            <span>
              <Input.Password
                value={clientSecret}
                onChange={(value) => setClientSecret(value)}
                onBlur={() => setTouched((prev) => ({ ...prev, clientSecret: true }))}
                placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxx'}
                className={formLayoutStyles.controlInput}
                status={touched.clientSecret && !clientSecret.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
                visibilityToggle
                disabled
              />
            </span>
          </Tooltip>
        ) : (
          <Input.Password
            value={clientSecret}
            onChange={(value) => setClientSecret(value)}
            onBlur={() => setTouched((prev) => ({ ...prev, clientSecret: true }))}
            placeholder={hasExistingUsers || pluginStatus?.hasToken ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxx'}
            className={formLayoutStyles.controlInput}
            status={touched.clientSecret && !clientSecret.trim() && !pluginStatus?.hasToken ? 'error' : undefined}
            visibilityToggle
          />
        )}
      </FormPreferenceRow>

      {!hasExistingUsers && !pluginStatus?.connected ? (
        <div className='flex items-center justify-end gap-8px flex-wrap'>
          {pluginStatus?.hasToken && !clientId.trim() && !clientSecret.trim() ? (
            <span className={formLayoutStyles.actionHint}>
              {t('settings.dingtalk.credentialsSaved', 'Credentials already configured. Enter new values to update.')}
            </span>
          ) : null}
          <Button
            type='primary'
            loading={testLoading}
            onClick={() => void handleTestConnection()}
            disabled={pluginStatus?.hasToken && !clientId.trim() && !clientSecret.trim()}
          >
            {t('settings.dingtalk.testAndConnect', 'Test & Connect')}
          </Button>
        </div>
      ) : null}

      {pluginStatus?.enabled && authorizedTargets.length === 0 ? (
        <div
          className={`rd-12px p-16px border ${pluginStatus?.connected ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : pluginStatus?.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}
        >
          <FormSectionHeader
            title={t('settings.dingtalk.connectionStatus', 'Connection Status')}
            action={
              <span
                className={`text-12px px-8px py-2px rd-4px ${pluginStatus?.connected ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : pluginStatus?.error ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}
              >
                {pluginStatus?.connected
                  ? t('settings.dingtalk.statusConnected', 'Connected')
                  : pluginStatus?.error
                    ? t('settings.dingtalk.statusError', 'Error')
                    : t('settings.dingtalk.statusConnecting', 'Connecting...')}
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
                <strong>1.</strong> {t('settings.dingtalk.step1', 'Open DingTalk and find your bot application')}
              </p>
              <p className='m-0'>
                <strong>2.</strong> {t('settings.dingtalk.step2', 'Send any message to initiate pairing')}
              </p>
              <p className='m-0'>
                <strong>3.</strong>{' '}
                {t(
                  'settings.dingtalk.step3',
                  'A pairing request will appear below. Click "Approve" to authorize the user.'
                )}
              </p>
              <p className='m-0'>
                <strong>4.</strong>{' '}
                {t(
                  'settings.dingtalk.step4',
                  'Once approved, you can start chatting with the AI assistant through DingTalk!'
                )}
              </p>
            </div>
          ) : null}
          {!pluginStatus?.connected && !pluginStatus?.error ? (
            <div className='text-14px text-t-secondary'>
              {t('settings.dingtalk.waitingConnection', 'Connection is being established. Please wait...')}
            </div>
          ) : null}
        </div>
      ) : null}

      {pluginStatus?.enabled && authorizedTargets.length === 0 ? (
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

      <AuthorizedTargetList
        loading={usersLoading}
        targets={authorizedTargets}
        onRefresh={() => void loadAuthorizedTargets()}
        onRevoke={(targetId) => void handleRevokeUser(targetId)}
        t={t}
        hideWhenEmpty
      />
    </div>
  );
};

export default DingTalkConfigForm;
