/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpConversation, cloud } from '@/common/adapter/ipcBridge';
import type { CloudStatus } from '@/common/types/cloud';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { Button } from '@arco-design/web-react';
import { Download, Earth } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../index.module.css';

type QuickActionButtonsProps = {
  onOpenExternalSessions: () => void;
  inactiveBorderColor: string;
  activeShadow: string;
};

type ExternalSessionsQuickStatus = 'checking' | 'ready' | 'empty' | 'error';
const CLOUD_STATUS_CACHE_TTL_MS = 3000;
const EXTERNAL_SESSIONS_CACHE_TTL_MS = 5000;

let cloudStatusCache: {
  status: CloudStatus | null;
  at: number;
} | null = null;
let externalSessionsCache: {
  count: number;
  at: number;
} | null = null;

const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  onOpenExternalSessions,
  inactiveBorderColor,
  activeShadow,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [hoveredQuickAction, setHoveredQuickAction] = useState<'webui' | 'external' | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(cloudStatusCache?.status ?? null);
  const [cloudStatusLoading, setCloudStatusLoading] = useState(!cloudStatusCache);
  const [externalSessionsQuickStatus, setExternalSessionsQuickStatus] = useState<ExternalSessionsQuickStatus>(
    externalSessionsCache ? (externalSessionsCache.count > 0 ? 'ready' : 'empty') : 'checking'
  );
  const [externalSessionCount, setExternalSessionCount] = useState(externalSessionsCache?.count ?? 0);

  useEffect(() => {
    let alive = true;

    const loadCloudStatus = async () => {
      const now = Date.now();
      if (cloudStatusCache && now - cloudStatusCache.at < CLOUD_STATUS_CACHE_TTL_MS) {
        setCloudStatus(cloudStatusCache.status);
        setCloudStatusLoading(false);
        return;
      }

      setCloudStatusLoading(true);

      try {
        const result = await cloud.getStatus.invoke();
        if (!alive) return;
        const nextStatus = result?.success && result.data ? result.data : null;
        setCloudStatus(nextStatus);
        cloudStatusCache = { status: nextStatus, at: Date.now() };
      } catch {
        if (!alive) return;
        setCloudStatus(null);
        cloudStatusCache = { status: null, at: Date.now() };
      } finally {
        if (alive) {
          setCloudStatusLoading(false);
        }
      }
    };

    void loadCloudStatus();

    const unsubscribe = cloud.statusChanged.on(nextStatus => {
      setCloudStatus(nextStatus);
      setCloudStatusLoading(false);
      cloudStatusCache = { status: nextStatus, at: Date.now() };
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadExternalSessions = async (forceRefresh = false) => {
      const now = Date.now();
      if (!forceRefresh && externalSessionsCache && now - externalSessionsCache.at < EXTERNAL_SESSIONS_CACHE_TTL_MS) {
        const nextCount = externalSessionsCache.count;
        setExternalSessionCount(nextCount);
        setExternalSessionsQuickStatus(nextCount > 0 ? 'ready' : 'empty');
        return;
      }

      setExternalSessionsQuickStatus('checking');

      try {
        const result = await acpConversation.listExternalSessions.invoke({ forceRefresh });
        if (!alive) return;
        const nextCount = result?.success ? (result.data?.sessions?.length ?? 0) : 0;
        setExternalSessionCount(nextCount);
        setExternalSessionsQuickStatus(result?.success ? (nextCount > 0 ? 'ready' : 'empty') : 'error');
        externalSessionsCache = { count: nextCount, at: Date.now() };
      } catch {
        if (!alive) return;
        setExternalSessionsQuickStatus('error');
      }
    };

    void loadExternalSessions();

    const handleFocus = () => {
      void loadExternalSessions(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const quickActionStyle = useCallback(
    (isActive: boolean) => ({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: inactiveBorderColor,
      boxShadow: isActive ? activeShadow : 'none',
    }),
    [activeShadow, inactiveBorderColor]
  );

  const handleOpenWebUI = useCallback(() => {
    void navigate('/settings/webui');
  }, [navigate]);

  const officialRemoteStatus = cloudStatus?.officialRemote;
  const officialRemoteRelayRunning = officialRemoteStatus?.running === true;
  const officialRemoteBrowserEntryReady = officialRemoteStatus?.browserEntryReady === true;
  const officialRemoteReady =
    cloudStatus?.officialRemoteReady === true || (officialRemoteRelayRunning && officialRemoteBrowserEntryReady);
  const officialRemoteNeedsLink = Boolean(cloudStatus?.user) && !cloudStatus?.deviceTokenAvailable;
  const officialRemoteNeedsRelogin = officialRemoteStatus?.needsAttention === true;
  const officialRemoteSetupInProgress =
    Boolean(cloudStatus?.user) &&
    cloudStatus?.deviceTokenAvailable &&
    officialRemoteRelayRunning &&
    !officialRemoteBrowserEntryReady;
  const officialRemoteRelayConnecting =
    Boolean(cloudStatus?.user) &&
    cloudStatus?.deviceTokenAvailable &&
    officialRemoteStatus?.desired === true &&
    !officialRemoteRelayRunning;
  const officialRemoteQuickStatusLabel = cloudStatusLoading
    ? t('settings.cloud.loading', { defaultValue: 'Checking remote status...' })
    : !cloudStatus?.user
      ? t('settings.webui.officialRemoteSignedOut', { defaultValue: 'Official Remote is not connected yet.' })
      : officialRemoteReady
        ? t('settings.webui.officialRemoteDeviceReady')
        : officialRemoteNeedsRelogin
          ? t('settings.webui.officialRemoteNeedsRelogin')
          : officialRemoteNeedsLink
            ? t('settings.webui.officialRemoteDevicePending')
            : officialRemoteSetupInProgress
              ? t('settings.webui.officialRemotePreparing')
              : officialRemoteRelayConnecting
                ? t('settings.webui.officialRemoteConnecting')
                : t('settings.webui.officialRemoteUnavailable');
  const officialRemoteMobileStatusLabel = cloudStatusLoading
    ? t('settings.webui.officialRemoteStatusShort.checking', { defaultValue: 'Checking' })
    : !cloudStatus?.user
      ? t('settings.webui.officialRemoteStatusShort.signedOut', { defaultValue: 'Not connected' })
      : officialRemoteReady
        ? t('settings.webui.officialRemoteStatusShort.ready', { defaultValue: 'Ready' })
        : officialRemoteNeedsRelogin
          ? t('settings.webui.officialRemoteStatusShort.relogin', { defaultValue: 'Sign in again' })
          : officialRemoteNeedsLink
            ? t('settings.webui.officialRemoteStatusShort.linking', { defaultValue: 'Linking device' })
            : officialRemoteSetupInProgress
              ? t('settings.webui.officialRemoteStatusShort.preparing', { defaultValue: 'Preparing' })
              : officialRemoteRelayConnecting
                ? t('settings.webui.officialRemoteStatusShort.connecting', { defaultValue: 'Connecting' })
                : t('settings.webui.officialRemoteStatusShort.unavailable', { defaultValue: 'Unavailable' });
  const officialRemoteIconColor = cloudStatusLoading
    ? 'rgb(var(--primary-6))'
    : officialRemoteReady
      ? 'rgb(var(--success-6))'
      : officialRemoteNeedsRelogin
        ? 'rgb(var(--warning-6))'
        : officialRemoteSetupInProgress || officialRemoteRelayConnecting || officialRemoteNeedsLink
          ? 'rgb(var(--primary-6))'
          : 'var(--color-text-4)';
  const externalSessionsStatusLabel =
    externalSessionsQuickStatus === 'ready'
      ? t('guid.externalSessions.readyCount', {
          count: externalSessionCount,
          defaultValue: `${externalSessionCount} sessions ready`,
        })
      : externalSessionsQuickStatus === 'checking'
        ? t('guid.externalSessions.loading', {
            defaultValue: 'Scanning external sessions...',
          })
        : externalSessionsQuickStatus === 'error'
          ? t('guid.externalSessions.loadFailed', {
              defaultValue: 'Failed to scan external sessions.',
            })
          : t('guid.externalSessions.emptyState', {
              defaultValue: 'No external sessions are waiting yet.',
            });
  const externalSessionsMobileStatusLabel =
    externalSessionsQuickStatus === 'ready'
      ? t('guid.externalSessions.readyCountShort', {
          count: externalSessionCount,
          defaultValue: `${externalSessionCount} ready`,
        })
      : externalSessionsQuickStatus === 'checking'
        ? t('guid.externalSessions.loadingShort', {
            defaultValue: 'Scanning',
          })
        : externalSessionsQuickStatus === 'error'
          ? t('guid.externalSessions.loadFailedShort', {
              defaultValue: 'Scan failed',
            })
          : t('guid.externalSessions.emptyStateShort', {
              defaultValue: 'None yet',
            });
  const externalSessionsAffordanceLabel =
    externalSessionsQuickStatus === 'ready'
      ? t('guid.externalSessions.import', { defaultValue: 'Take over' })
      : t('guid.externalSessions.open', { defaultValue: 'Open' });
  const externalSessionsIconColor =
    externalSessionsQuickStatus === 'ready'
      ? 'rgb(var(--success-6))'
      : externalSessionsQuickStatus === 'checking'
        ? 'rgb(var(--primary-6))'
        : externalSessionsQuickStatus === 'error'
          ? 'rgb(var(--warning-6))'
          : 'var(--color-text-3)';
  if (isMobile) {
    return (
      <div className={styles.guidQuickActionsMobile}>
        <div className={styles.guidQuickActionsMobileGrid}>
          <Button type='text' className={styles.guidQuickActionCard} onClick={handleOpenWebUI}>
            <span className={styles.guidQuickActionIcon}>
              <Earth theme='outline' size={20} fill={officialRemoteIconColor} />
            </span>
            <span className={styles.guidQuickActionBody}>
              <span className={styles.guidQuickActionTitle}>
                {t('settings.webui.officialRemoteTitle', { defaultValue: 'Official Remote' })}
              </span>
              <span className={styles.guidQuickActionMeta}>{officialRemoteMobileStatusLabel}</span>
            </span>
            <span className={styles.guidQuickActionAffordance}>
              {t('guid.externalSessions.open', { defaultValue: 'Open' })}
            </span>
          </Button>
          <Button type='text' className={styles.guidQuickActionCard} onClick={onOpenExternalSessions}>
            <span className={styles.guidQuickActionIcon}>
              <Download theme='outline' size={20} fill={externalSessionsIconColor} strokeWidth={3} />
            </span>
            <span className={styles.guidQuickActionBody}>
              <span className={styles.guidQuickActionTitle}>
                {t('guid.externalSessions.title', { defaultValue: 'Continue external sessions' })}
              </span>
              <span className={styles.guidQuickActionMeta}>{externalSessionsMobileStatusLabel}</span>
            </span>
            <span className={styles.guidQuickActionAffordance}>{externalSessionsAffordanceLabel}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute left-50% -translate-x-1/2 flex flex-col justify-center items-center ${styles.guidQuickActions}`}
    >
      <div className='flex justify-center items-center gap-24px'>
        <div
          className='group inline-flex items-center justify-center h-36px min-w-36px max-w-36px px-0 rd-999px bg-fill-0 cursor-pointer overflow-hidden whitespace-nowrap hover:max-w-200px hover:px-14px hover:justify-start hover:gap-8px transition-[max-width,padding,border-radius,box-shadow] duration-420 ease-in-out'
          style={quickActionStyle(hoveredQuickAction === 'webui')}
          onMouseEnter={() => setHoveredQuickAction('webui')}
          onMouseLeave={() => setHoveredQuickAction(null)}
          onClick={handleOpenWebUI}
        >
          <div className='relative w-20px h-20px flex-shrink-0 leading-none'>
            <div className='absolute inset-0 flex items-center justify-center'>
              <Earth
                theme='outline'
                size={20}
                fill='currentColor'
                className='block transition-colors duration-360'
                style={{ color: officialRemoteIconColor }}
              />
            </div>
          </div>
          <span className='opacity-0 max-w-0 overflow-hidden text-14px text-[var(--color-text-2)] group-hover:opacity-100 group-hover:max-w-160px transition-all duration-360 ease-in-out'>
            {t('settings.webui.officialRemoteTitle', { defaultValue: 'Official Remote' })} ·{' '}
            {officialRemoteQuickStatusLabel}
          </span>
        </div>
        <div
          className='group inline-flex items-center justify-center h-36px min-w-36px max-w-36px px-0 rd-999px bg-fill-0 cursor-pointer overflow-hidden whitespace-nowrap hover:max-w-248px hover:px-14px hover:justify-start hover:gap-8px transition-[max-width,padding,border-radius,box-shadow] duration-420 ease-in-out'
          style={quickActionStyle(hoveredQuickAction === 'external')}
          onMouseEnter={() => setHoveredQuickAction('external')}
          onMouseLeave={() => setHoveredQuickAction(null)}
          onClick={onOpenExternalSessions}
        >
          <Download
            theme='outline'
            size={20}
            fill={externalSessionsIconColor}
            strokeWidth={3}
            className='flex-shrink-0 transition-colors duration-300'
          />
          <span className='opacity-0 max-w-0 overflow-hidden text-14px text-[var(--color-text-2)] group-hover:opacity-100 group-hover:max-w-260px transition-all duration-360 ease-in-out'>
            {t('guid.externalSessions.title', { defaultValue: 'Continue external sessions' })} ·{' '}
            {externalSessionsStatusLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickActionButtons;
