/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelAuthorizedTarget, IChannelPairingRequest, IChannelPluginStatus } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { Button, Empty, Input, Message, Spin, Switch, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthorizedTargetList } from './AuthorizedTargets';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

type SlackConfigDraft = {
  botToken: string;
  appToken: string;
  requireMention: boolean;
};

interface SlackConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
  onConfigChange?: (config: SlackConfigDraft) => void;
}

const SlackConfigForm: React.FC<SlackConfigFormProps> = ({
  pluginId,
  pluginStatus,
  onStatusChange,
  onConfigChange,
}) => {
  const { t } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;

  const [botToken, setBotToken] = useState('');
  const [appToken, setAppToken] = useState('');
  const [requireMention, setRequireMention] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [credentialsTested, setCredentialsTested] = useState(false);
  const [testedBotUsername, setTestedBotUsername] = useState<string | null>(null);
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
            (item) => item.platformType === 'slack' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[SlackConfig] Failed to load pending pairings:', error);
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
            (item) => item.platformType === 'slack' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[SlackConfig] Failed to load authorized targets:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [channelAccountId]);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedTargets();
  }, [loadAuthorizedTargets, loadPendingPairings]);

  const emitConfigChange = useCallback(
    (nextConfig: SlackConfigDraft) => {
      onConfigChange?.(nextConfig);
    },
    [onConfigChange]
  );

  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'slack' || (request.connectorId && request.connectorId !== channelAccountId)) return;
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
      if (user.platformType !== 'slack' || (user.connectorId && user.connectorId !== channelAccountId)) {
        return;
      }
      void loadAuthorizedTargets();
      setPendingPairings((prev) => prev.filter((item) => item.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId, loadAuthorizedTargets]);

  const handleBotTokenChange = (value: string) => {
    setBotToken(value);
    setCredentialsTested(false);
    setTestedBotUsername(null);
    emitConfigChange({
      botToken: value,
      appToken,
      requireMention,
    });
  };

  const handleAppTokenChange = (value: string) => {
    setAppToken(value);
    setCredentialsTested(false);
    setTestedBotUsername(null);
    emitConfigChange({
      botToken,
      appToken: value,
      requireMention,
    });
  };

  const handleRequireMentionChange = (value: boolean) => {
    setRequireMention(value);
    emitConfigChange({
      botToken,
      appToken,
      requireMention: value,
    });
  };

  const refreshChannelStatus = async () => {
    const statusResult = await channel.getPluginStatus.invoke();
    if (statusResult.success && statusResult.data) {
      const slackPlugin = statusResult.data.find((plugin) => plugin.id === channelAccountId);
      onStatusChange(slackPlugin || null);
    }
  };

  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: {
          botToken: botToken.trim(),
          appToken: appToken.trim(),
          requireMention,
        },
      });

      if (result.success) {
        Message.success(t('settings.slack.pluginEnabled', 'Slack bot enabled'));
        await refreshChannelStatus();
      } else {
        Message.error(result.msg || t('settings.slack.enableFailed', 'Failed to enable Slack plugin'));
      }
    } catch (error: any) {
      console.error('[SlackConfig] Auto-enable failed:', error);
      Message.error(error.message || t('settings.slack.enableFailed', 'Failed to enable Slack plugin'));
    }
  };

  const handleTestConnection = async () => {
    if (!botToken.trim() || !appToken.trim()) {
      Message.warning(t('settings.slack.credentialsRequired', 'Please enter Slack bot and app tokens'));
      return;
    }

    setTestLoading(true);
    setCredentialsTested(false);
    setTestedBotUsername(null);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: runtimeId,
        token: botToken.trim(),
        extraConfig: {
          appToken: appToken.trim(),
        },
      });

      if (result.success && result.data?.success) {
        setCredentialsTested(true);
        setTestedBotUsername(result.data.botUsername || null);
        Message.success(
          t('settings.slack.connectionSuccess', {
            defaultValue: 'Connected! Bot: @{{username}}',
            username: result.data.botUsername || 'unknown',
          })
        );
        await handleAutoEnable();
      } else {
        Message.error(result.data?.error || t('settings.slack.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      Message.error(error.message || t('settings.slack.connectionFailed', 'Connection failed'));
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

  const configLocked = authorizedTargets.length > 0;

  return (
    <div className={formLayoutStyles.formRoot}>
      <FormPreferenceRow
        label={t('settings.slack.botToken', 'Bot User OAuth Token')}
        description={t(
          'settings.slack.botTokenDesc',
          'Create a Slack bot and paste the Bot User OAuth Token (starts with xoxb-).'
        )}
      >
        <div className={formLayoutStyles.inlineRow}>
          {configLocked ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized targets before modifying the configuration'
              )}
            >
              <span>
                <Input.Password
                  value={botToken}
                  onChange={handleBotTokenChange}
                  placeholder={pluginStatus?.hasToken ? '••••••••••••••••' : 'xoxb-...'}
                  className={formLayoutStyles.controlInput}
                  visibilityToggle
                  disabled
                />
              </span>
            </Tooltip>
          ) : (
            <Input.Password
              value={botToken}
              onChange={handleBotTokenChange}
              placeholder={pluginStatus?.hasToken ? '••••••••••••••••' : 'xoxb-...'}
              className={formLayoutStyles.controlInput}
              visibilityToggle
            />
          )}
        </div>
      </FormPreferenceRow>

      <FormPreferenceRow
        label={t('settings.slack.appToken', 'App-Level Token')}
        description={t(
          'settings.slack.appTokenDesc',
          'Enable Socket Mode in Slack and create an app-level token with the connections:write scope (starts with xapp-).'
        )}
      >
        <div className={formLayoutStyles.inlineRow}>
          {configLocked ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized targets before modifying the configuration'
              )}
            >
              <span>
                <Input.Password
                  value={appToken}
                  onChange={handleAppTokenChange}
                  placeholder={pluginStatus?.hasToken ? '••••••••••••••••' : 'xapp-...'}
                  className={formLayoutStyles.controlInput}
                  visibilityToggle
                  disabled
                />
              </span>
            </Tooltip>
          ) : (
            <Input.Password
              value={appToken}
              onChange={handleAppTokenChange}
              placeholder={pluginStatus?.hasToken ? '••••••••••••••••' : 'xapp-...'}
              className={formLayoutStyles.controlInput}
              visibilityToggle
            />
          )}
          {configLocked ? (
            <Tooltip
              content={t(
                'settings.assistant.tokenLocked',
                'Please close the Channel and delete all authorized targets before modifying the configuration'
              )}
            >
              <span>
                <Button type='outline' loading={testLoading} onClick={handleTestConnection} disabled>
                  {t('settings.slack.testAndConnect', 'Test & Connect')}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button type='outline' loading={testLoading} onClick={handleTestConnection}>
              {t('settings.slack.testAndConnect', 'Test & Connect')}
            </Button>
          )}
        </div>
      </FormPreferenceRow>

      <FormPreferenceRow
        label={t('settings.slack.requireMention', 'Require mention in channels')}
        description={t(
          'settings.slack.requireMentionDesc',
          'When enabled, Slack channel messages must mention the bot. Direct messages always work.'
        )}
      >
        <Switch checked={requireMention} onChange={handleRequireMentionChange} disabled={configLocked} />
      </FormPreferenceRow>

      {pluginStatus?.enabled && pluginStatus?.connected && authorizedTargets.length === 0 && (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <FormSectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong>{' '}
              {t('settings.slack.step1', 'Open Slack and find your bot or send it a direct message')}
              {(testedBotUsername || pluginStatus.botUsername) && (
                <span className='ml-4px'>
                  <code className='bg-fill-2 px-6px py-2px rd-4px'>
                    @{testedBotUsername || pluginStatus.botUsername}
                  </code>
                </span>
              )}
            </p>
            <p className='m-0'>
              <strong>2.</strong> {t('settings.slack.step2', 'Send a direct message or mention the bot in a channel')}
            </p>
            <p className='m-0'>
              <strong>3.</strong>{' '}
              {t(
                'settings.slack.step3',
                'A pairing request will appear below. Click "Approve" to authorize the Slack user.'
              )}
            </p>
            <p className='m-0'>
              <strong>4.</strong>{' '}
              {t('settings.slack.step4', 'Once approved, you can chat with the AI assistant directly from Slack.')}
            </p>
          </div>
        </div>
      )}

      {pluginStatus?.enabled && authorizedTargets.length === 0 && (
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
                      status='danger'
                      size='small'
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

      <AuthorizedTargetList
        loading={usersLoading}
        targets={authorizedTargets}
        onRefresh={() => void loadAuthorizedTargets()}
        onRevoke={(targetId) => void handleRevokeUser(targetId)}
        t={t}
      />
      {credentialsTested && testedBotUsername && (
        <div className='text-12px text-green-600 dark:text-green-400'>
          {t('settings.slack.connectionVerified', {
            defaultValue: 'Slack connection verified for @{{username}}',
            username: testedBotUsername,
          })}
        </div>
      )}
    </div>
  );
};

export default SlackConfigForm;
