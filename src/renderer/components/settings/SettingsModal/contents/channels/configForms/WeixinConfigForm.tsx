/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelAuthorizedTarget, IChannelPairingRequest, IChannelPluginStatus } from '@process/channels/types';
import { channel } from '@/common/adapter/ipcBridge';
import { Alert, Button, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthorizedTargetList } from './AuthorizedTargets';
import { FormPreferenceRow, FormSectionHeader, formLayoutStyles } from './FormLayout';

type LoginState = 'idle' | 'loading_qr' | 'showing_qr' | 'scanned' | 'authorizing' | 'connected';

interface WeixinConfigFormProps {
  pluginId: string;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
}

const getRemainingTime = (expiresAt: number) => {
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60));
  return `${remaining} min`;
};

const WeixinConfigForm: React.FC<WeixinConfigFormProps> = ({ pluginId, pluginStatus, onStatusChange }) => {
  const { t } = useTranslation();
  const runtimeId = pluginStatus?.runtimeId ?? pluginId;
  const channelAccountId = pluginId;

  const [loginState, setLoginState] = useState<LoginState>(pluginStatus?.hasToken ? 'connected' : 'idle');
  const [qrcodeDataUrl, setQrcodeDataUrl] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedTargets, setAuthorizedTargets] = useState<IChannelAuthorizedTarget[]>([]);

  const hasAuthorizedTargets = authorizedTargets.length > 0;
  const hasSignedInWeixin = loginState === 'connected' || Boolean(pluginStatus?.hasToken);

  const getIdentityLabel = useCallback(
    (identity: { displayName?: string; platformUserId?: string; platformType?: string }) => {
      const displayName = identity.displayName?.trim();
      if (
        displayName &&
        displayName.toLowerCase() !== 'wechat' &&
        displayName !== t('settings.weixin.scannerUserLabel', '当前扫码微信')
      ) {
        return displayName;
      }
      return identity.platformUserId?.trim() || t('conversation.unknown', 'Unknown');
    },
    [t]
  );

  useEffect(() => {
    if (pluginStatus?.hasToken && loginState === 'idle') {
      setLoginState('connected');
    }
  }, [pluginStatus, loginState]);

  useEffect(() => {
    setLoginState(pluginStatus?.hasToken ? 'connected' : 'idle');
    setQrcodeDataUrl(null);
  }, [channelAccountId, pluginStatus?.hasToken]);

  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(
          result.data.filter(
            (item) => item.platformType === 'weixin' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[WeixinConfig] Failed to load pending pairings:', error);
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
            (item) => item.platformType === 'weixin' && (!item.connectorId || item.connectorId === channelAccountId)
          )
        );
      }
    } catch (error) {
      console.error('[WeixinConfig] Failed to load authorized targets:', error);
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
      if (request.platformType !== 'weixin' || (request.connectorId && request.connectorId !== channelAccountId))
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
      if (user.platformType !== 'weixin' || (user.connectorId && user.connectorId !== channelAccountId)) {
        return;
      }
      void loadAuthorizedTargets();
      setPendingPairings((prev) => prev.filter((item) => item.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, [channelAccountId, loadAuthorizedTargets]);

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
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
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
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
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
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  const handleLogin = async () => {
    setLoginState('loading_qr');
    setQrcodeDataUrl(null);

    const unsubBridgeQR = channel.weixinLoginQr.on(({ qrcodeUrl: dataUrl }) => {
      setQrcodeDataUrl(dataUrl);
      setLoginState('showing_qr');
    });
    const unsubBridgeScanned = channel.weixinLoginScanned.on(() => {
      setLoginState('scanned');
    });

    try {
      const loginResult = await channel.startWeixinLogin.invoke();
      if (!loginResult.success || !loginResult.data) {
        throw new Error(loginResult.msg || t('settings.weixin.loginError', 'WeChat login failed'));
      }

      const { accountId, botToken, scannerUserId } = loginResult.data;

      const enableResult = await channel.enablePlugin.invoke({
        pluginId: runtimeId,
        config: { accountId, botToken },
      });

      if (!enableResult.success) {
        Message.error(enableResult.msg || t('settings.weixin.enableFailed', 'Failed to enable WeChat plugin'));
        setLoginState('idle');
        return;
      }

      const rollbackEnable = async () => {
        await channel.disablePlugin.invoke({ pluginId: runtimeId }).catch((disableError) => {
          console.warn('[WeixinConfig] Failed to rollback plugin enablement:', disableError);
        });
      };

      if (!scannerUserId) {
        await rollbackEnable();
        Message.error(t('settings.weixin.missingScannerUser', '扫码成功，但未识别到当前微信账号，已取消本次新增'));
        setLoginState('idle');
        return;
      }

      setLoginState('authorizing');

      const authorizeResult = await channel.authorizeRemoteUser.invoke({
        platformUserId: scannerUserId,
        platformType: 'weixin',
        displayName: t('settings.weixin.scannerUserLabel', '当前扫码微信'),
        chatId: scannerUserId,
        pluginId: channelAccountId,
        metadata: {
          source: 'weixin-qr-login',
          loginAccountId: accountId,
        },
      });

      if (!authorizeResult.success) {
        await rollbackEnable();
        Message.error(
          authorizeResult.msg ||
            t('settings.weixin.autoPairFailed', 'WeChat login succeeded, but automatic pairing failed')
        );
        setLoginState('idle');
        return;
      }

      Message.success(t('settings.weixin.loginAndPairSuccess', '微信已连接并完成配对'));

      const statusResult = await channel.getPluginStatus.invoke();
      if (statusResult.success && statusResult.data) {
        const weixinPlugin = statusResult.data.find((item) => item.id === channelAccountId);
        onStatusChange(weixinPlugin || null);
      }
      await loadPendingPairings();
      await loadAuthorizedTargets();
      setLoginState('connected');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('too many')) {
        Message.warning(t('settings.weixin.loginExpired', 'QR code expired, please try again'));
      } else if (msg !== 'Aborted') {
        Message.error(t('settings.weixin.loginError', 'WeChat login failed'));
      }
      setLoginState('idle');
      setQrcodeDataUrl(null);
    } finally {
      unsubBridgeQR();
      unsubBridgeScanned();
    }
  };

  const renderLoginArea = () => {
    if (hasAuthorizedTargets) {
      return (
        <div className={formLayoutStyles.inlineRow}>
          <CheckOne theme='filled' size={16} className='text-green-500' />
          <span className='text-14px text-t-primary'>{t('settings.weixin.connected', '已完成授权，可直接使用')}</span>
          {pluginStatus?.botUsername ? (
            <span className='text-12px text-t-tertiary'>({pluginStatus.botUsername})</span>
          ) : null}
        </div>
      );
    }

    if (hasSignedInWeixin) {
      return (
        <div className={formLayoutStyles.inlineRow}>
          <CheckOne theme='filled' size={16} className='text-green-500' />
          <span className='text-14px text-t-primary'>{t('settings.weixin.pluginEnabled', '微信渠道已连接')}</span>
        </div>
      );
    }

    if (loginState === 'authorizing') {
      return (
        <div className={formLayoutStyles.inlineRow}>
          <Spin size={14} />
          <span className='text-13px text-t-secondary'>
            {t('settings.weixin.authorizing', '正在完成授权配对，请稍候...')}
          </span>
        </div>
      );
    }

    if (loginState === 'showing_qr' || loginState === 'scanned') {
      return (
        <div className={formLayoutStyles.qrPanelRow}>
          <div className={formLayoutStyles.qrPanel}>
            {qrcodeDataUrl ? (
              <img src={qrcodeDataUrl} alt='WeChat QR code' className={formLayoutStyles.qrImage} />
            ) : null}
            {loginState === 'scanned' ? (
              <div className={formLayoutStyles.inlineRow}>
                <Spin size={14} />
                <span className='text-13px text-t-secondary'>
                  {t('settings.weixin.scanned', '已扫码，等待确认并完成授权...')}
                </span>
              </div>
            ) : (
              <span className='text-13px text-t-secondary'>
                {t('settings.weixin.scanPrompt', '请用微信扫描二维码')}
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <Button
        type='primary'
        loading={loginState === 'loading_qr'}
        onClick={() => {
          void handleLogin();
        }}
      >
        {t('settings.weixin.loginButton', '扫码登录并完成授权')}
      </Button>
    );
  };

  return (
    <div className={formLayoutStyles.formRoot}>
      <Alert
        type='warning'
        content={
          <div className='space-y-4px'>
            <div>
              {t(
                'settings.weixin.boundaryNotice',
                '当前微信接入是个人账号桥接，不等价于 Slack、Discord、Lark 这类官方 Bot 平台。'
              )}
            </div>
            <div>
              {t(
                'settings.weixin.discoveryNotice',
                '这里的发布对象发现与命令暴露能力更受限，应更多依赖学习式或手动目标选择。'
              )}
            </div>
          </div>
        }
      />
      <FormPreferenceRow
        label={t('settings.weixin.accountId', '微信账号授权')}
        description={
          loginState === 'idle' || loginState === 'loading_qr'
            ? t('settings.weixin.scanPrompt', '添加实例时会直接完成扫码登录和授权配对')
            : undefined
        }
        stacked
      >
        {renderLoginArea()}
      </FormPreferenceRow>

      {hasSignedInWeixin && !hasAuthorizedTargets ? (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <FormSectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong>{' '}
              {t('settings.weixin.step1', '个人微信实例会在扫码确认后直接完成授权，不需要再单独批准')}
            </p>
            <p className='m-0'>
              <strong>2.</strong> {t('settings.weixin.step2', '授权完成后，下方会显示当前可直接使用的微信账号')}
            </p>
            <p className='m-0'>
              <strong>3.</strong> {t('settings.weixin.step3', '之后就可以直接通过这个微信账号与 AI 助手对话')}
            </p>
          </div>
        </div>
      ) : null}

      {pendingPairings.length > 0 ? (
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
          ) : (
            <div className={formLayoutStyles.statusList}>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className={formLayoutStyles.statusItem}>
                  <div className={formLayoutStyles.statusItemMain}>
                    <div className='space-y-8px'>
                      <div className={formLayoutStyles.inlineRow}>
                        <span className='text-14px font-500 text-t-primary'>{getIdentityLabel(pairing)}</span>
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

export default WeixinConfigForm;
