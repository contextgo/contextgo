/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cloud } from '@/common/adapter/ipcBridge';
import InfermeshLogo from '@/renderer/assets/logos/brand/infermesh.png';
import type { CloudAuthProviderId, CloudObsidianVaultBinding, CloudStatus } from '@/common/types/cloud';
import { Alert, Avatar, Button, Message, Space, Spin, Tag, Typography } from '@arco-design/web-react';
import { useSelectedSpace } from '@/renderer/hooks/context/useSelectedSpace';
import { CheckOne, LinkCloud } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ObsidianSyncPanel from './ObsidianSyncPanel';

const { Text } = Typography;

const providerLabelKeyMap: Record<CloudAuthProviderId, string> = {
  github: 'settings.cloud.loginWithGithub',
  google: 'settings.cloud.loginWithGoogle',
};

const CloudSyncSection: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoadingProvider, setAuthLoadingProvider] = useState<CloudAuthProviderId | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [obsidianBinding, setObsidianBinding] = useState<CloudObsidianVaultBinding | null>(null);
  const [obsidianLoading, setObsidianLoading] = useState(false);
  const { selectedSpace } = useSelectedSpace();

  const refreshStatus = useCallback(async (): Promise<CloudStatus | null> => {
    setLoading(true);
    try {
      const result = await cloud.getStatus.invoke();
      if (result.success && result.data) {
        setStatus(result.data);
        return result.data;
      }
    } catch (error) {
      console.error('[CloudSyncSection] Failed to load cloud status:', error);
    } finally {
      setLoading(false);
    }

    return null;
  }, []);

  useEffect(() => {
    void refreshStatus();
    const unsubscribe = cloud.statusChanged.on((nextStatus) => {
      setStatus(nextStatus);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshStatus]);

  const handleLogin = useCallback(
    async (provider: CloudAuthProviderId) => {
      setAuthLoadingProvider(provider);
      try {
        const result = await cloud.startLogin.invoke({ provider });
        if (result.success && result.data) {
          setStatus(result.data);
          Message.success(t('settings.cloud.loginSuccess'));
          return;
        }

        console.error('[CloudSyncSection] Cloud login failed:', result.msg);
        const reconciledStatus = await refreshStatus();
        if (reconciledStatus?.user) {
          Message.success(t('settings.cloud.loginSuccess'));
          return;
        }

        Message.error(result.msg || t('settings.cloud.actionFailed'));
      } catch (error) {
        console.error('[CloudSyncSection] Cloud login threw:', error);
        const reconciledStatus = await refreshStatus();
        if (reconciledStatus?.user) {
          Message.success(t('settings.cloud.loginSuccess'));
          return;
        }

        Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
      } finally {
        setAuthLoadingProvider(null);
      }
    },
    [refreshStatus, t]
  );

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const result = await cloud.logout.invoke();
      if (result.success && result.data) {
        setStatus(result.data);
        Message.success(t('settings.cloud.logoutSuccess'));
        return;
      }

      console.error('[CloudSyncSection] Cloud logout failed:', result.msg);
      Message.error(t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[CloudSyncSection] Cloud logout threw:', error);
      Message.error(t('settings.cloud.actionFailed'));
    } finally {
      setLoggingOut(false);
    }
  }, [t]);

  const handleOpenInfermesh = useCallback(async () => {
    try {
      const result = await cloud.openInfermesh.invoke();
      if (result.success && result.data) {
        setStatus(result.data);
        return;
      }

      console.error('[CloudSyncSection] Failed to open InferMesh portal:', result.msg);
      Message.error(result.msg || t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[CloudSyncSection] Failed to open InferMesh portal:', error);
      Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    }
  }, [t]);

  const refreshObsidianSyncStatus = useCallback(async () => {
    if (!status?.authenticated || !selectedSpace?.id) {
      setObsidianBinding(null);
      return null;
    }

    setObsidianLoading(true);
    try {
      const result = await cloud.getObsidianSyncStatus.invoke({ spaceId: selectedSpace.id });
      if (result.success) {
        setObsidianBinding(result.data ?? null);
        return result.data ?? null;
      }
    } catch (error) {
      console.error('[CloudSyncSection] Failed to load Obsidian sync status:', error);
    } finally {
      setObsidianLoading(false);
    }

    return null;
  }, [selectedSpace?.id, status?.authenticated]);

  useEffect(() => {
    void refreshObsidianSyncStatus();
  }, [refreshObsidianSyncStatus]);

  return (
    <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-16px'>
      <div className='flex items-start justify-between gap-12px'>
        <div className='min-w-0'>
          <div className='text-14px font-500 text-t-primary flex items-center gap-8px'>
            <LinkCloud theme='outline' size={16} className='app-icon' />
            <span>{t('settings.cloud.title')}</span>
          </div>
          <div className='text-12px text-t-secondary mt-4px'>{t('settings.cloud.description')}</div>
        </div>
        <Button type='secondary' size='small' loading={loading} onClick={() => void refreshStatus()}>
          {t('common.refresh')}
        </Button>
      </div>

      {loading && (
        <div className='flex items-center gap-12px py-8px'>
          <Spin size={18} />
          <Text type='secondary'>{t('settings.cloud.loading')}</Text>
        </div>
      )}

      {!loading && status?.user && (
        <div className='rounded-12px border border-solid border-border-2 p-16px bg-[var(--color-fill-1)] space-y-12px'>
          <div className='flex items-center gap-12px'>
            <Avatar size={44}>
              {status.user.avatarUrl ? <img src={status.user.avatarUrl} alt={status.user.displayName} /> : null}
            </Avatar>
            <div className='min-w-0 flex-1'>
              <div className='text-14px font-500 text-t-primary truncate'>{status.user.displayName}</div>
              <div className='text-12px text-t-secondary truncate'>{status.user.email}</div>
              <div className='text-12px text-t-tertiary truncate'>@{status.user.username}</div>
            </div>
          </div>

          <Space wrap size={8}>
            <Tag color={status.authenticated ? 'green' : 'orange'}>
              {status.authenticated ? t('settings.cloud.sessionActive') : t('settings.cloud.sessionExpired')}
            </Tag>
            <Tag color={status.deviceTokenAvailable ? 'arcoblue' : 'gray'}>
              {status.deviceTokenAvailable ? t('settings.cloud.deviceLinked') : t('settings.cloud.deviceMissing')}
            </Tag>
          </Space>

          {status.browserSessionExpired ? (
            <Alert type='warning' content={t('settings.cloud.sessionExpiredDesc')} />
          ) : null}

          <div className='rounded-8px bg-[var(--color-bg-2)] px-12px py-10px'>
            <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
              {t('settings.cloud.deviceName')}
            </div>
            <div className='text-13px text-t-primary break-all mt-4px'>
              {status.device?.deviceName || t('settings.cloud.notAvailable')}
            </div>
          </div>

          <div className='rounded-8px bg-[var(--color-bg-2)] px-12px py-10px'>
            <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
              {t('settings.cloud.infermeshAccess')}
            </div>
            <div className='text-13px text-t-primary leading-relaxed mt-4px'>
              {t('settings.cloud.infermeshAccessDesc')}
            </div>
          </div>

          <Space wrap size={8}>
            <Button
              type='primary'
              icon={
                <img
                  src={InfermeshLogo}
                  alt=''
                  aria-hidden='true'
                  className='h-14px w-14px rounded-4px object-contain'
                />
              }
              onClick={() => void handleOpenInfermesh()}
            >
              {t('settings.cloud.openInfermesh')}
            </Button>
            <Button loading={loggingOut} onClick={() => void handleLogout()}>
              {t('settings.cloud.signOut')}
            </Button>
          </Space>
        </div>
      )}

      {!loading && status?.user && selectedSpace?.id && (
        <>
          {obsidianLoading ? (
            <div className='flex items-center gap-12px py-4px'>
              <Spin size={16} />
              <Text type='secondary'>
                {t('settings.cloud.obsidianSync.loading', {
                  defaultValue: 'Checking Obsidian vault sync status...',
                })}
              </Text>
            </div>
          ) : obsidianBinding ? (
            <ObsidianSyncPanel binding={obsidianBinding} />
          ) : (
            <Alert
              type='info'
              content={t('settings.cloud.obsidianSync.noBinding', {
                defaultValue: 'The current Space does not have an Obsidian vault sync binding yet.',
              })}
            />
          )}
        </>
      )}

      {!loading && !status?.user && (
        <div className='rounded-12px border border-dashed border-border-2 p-16px bg-[var(--color-fill-1)] space-y-12px'>
          <div className='text-13px text-t-primary'>{t('settings.cloud.notConnected')}</div>
          <div className='text-12px text-t-secondary'>{t('settings.cloud.notConnectedDesc')}</div>
          <Space wrap size={8}>
            {(['github', 'google'] as CloudAuthProviderId[]).map((provider) => (
              <Button
                key={provider}
                type={provider === 'github' ? 'primary' : 'secondary'}
                loading={authLoadingProvider === provider}
                disabled={Boolean(authLoadingProvider)}
                icon={<CheckOne theme='outline' size={14} className='app-icon' />}
                onClick={() => void handleLogin(provider)}
              >
                {t(providerLabelKeyMap[provider])}
              </Button>
            ))}
            <Button
              type='secondary'
              icon={
                <img
                  src={InfermeshLogo}
                  alt=''
                  aria-hidden='true'
                  className='h-14px w-14px rounded-4px object-contain'
                />
              }
              onClick={() => void handleOpenInfermesh()}
            >
              {t('settings.cloud.openInfermesh')}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default CloudSyncSection;
