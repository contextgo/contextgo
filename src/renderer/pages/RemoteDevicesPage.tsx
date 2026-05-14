/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cloud } from '@/common/adapter/ipcBridge';
import type { CloudStatus } from '@/common/types/cloud';
import WebviewHost from '@/renderer/components/media/WebviewHost';
import { useRemoteAccessContext } from '@/renderer/hooks/context/RemoteAccessContext';
import { isElectronDesktop } from '@/renderer/utils/platform';
import {
  buildOfficialDeviceListUrl,
  buildOfficialRemoteDevicesRoute,
  buildOfficialDeviceUrl,
  extractOfficialRemoteDeviceId,
  OFFICIAL_REMOTE_CLIENT_DESKTOP_HOST,
  getCurrentHostRuntimeDetailStatusKey,
  OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY,
  OFFICIAL_REMOTE_WEBVIEW_PARTITION,
  isOfficialRemotePickerView,
  rememberPreferredOfficialRemoteDeviceId,
  resolveHostedOfficialRemoteIntent,
  resolveOfficialRemoteRouteViewMode,
} from '@/renderer/utils/officialRemote';
import { Button } from '@arco-design/web-react';
import { LoadingOne } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const DESKTOP_REMOTE_LOADING_MIN_VISIBLE_MS = 420;
const DESKTOP_REMOTE_LOADING_SETTLE_MS = 280;

const isOfficialDeviceListUrl = (candidateUrl: string, authBaseUrl?: string): boolean => {
  try {
    const normalizedCandidate = new URL(candidateUrl);
    const expected = new URL(buildOfficialDeviceListUrl(authBaseUrl));
    return normalizedCandidate.origin === expected.origin && normalizedCandidate.pathname === expected.pathname;
  } catch {
    return false;
  }
};

const getOfficialRemoteStatusText = (
  cloudStatus: CloudStatus | null,
  loading: boolean,
  translate: (key: string, options?: { defaultValue?: string }) => string
): string => {
  if (loading) {
    return translate('settings.cloud.loading', { defaultValue: 'Checking remote status...' });
  }

  const statusKey = getCurrentHostRuntimeDetailStatusKey(cloudStatus);
  return translate(statusKey, {
    defaultValue: statusKey,
  });
};

const DesktopRemoteLoadingOverlay: React.FC<{
  badge: string;
  title: string;
  subtitle: string;
  statusText: string;
}> = ({ badge, title, subtitle, statusText }) => {
  return (
    <div
      data-testid='official-remote-loading-overlay'
      className='pointer-events-none absolute inset-0 z-20 overflow-hidden'
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, rgb(var(--primary-6)) 11%, var(--color-bg-1) 89%) 0%, color-mix(in srgb, var(--color-fill-1) 82%, var(--color-bg-1) 18%) 52%, color-mix(in srgb, var(--color-bg-2) 92%, var(--color-bg-1) 8%) 100%)',
      }}
    >
      <div
        className='absolute -right-48px -top-56px h-240px w-240px rounded-full blur-3xl'
        style={{
          background: 'rgba(var(--primary-6), 0.16)',
        }}
      />
      <div
        className='absolute -bottom-56px -left-36px h-220px w-220px rounded-full blur-3xl'
        style={{
          background: 'rgba(var(--primary-6), 0.1)',
        }}
      />
      <div className='relative flex size-full items-center justify-center p-20px md:p-32px'>
        <div
          className='grid w-full max-w-1040px gap-18px rounded-32px border p-20px shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-[18px] md:grid-cols-[minmax(0,1.1fr)_360px] md:items-stretch md:gap-24px md:p-28px'
          style={{
            borderColor: 'color-mix(in srgb, var(--color-border-2) 74%, rgb(var(--primary-6)) 26%)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-bg-1) 94%, white 6%) 0%, color-mix(in srgb, var(--color-fill-1) 90%, white 10%) 100%)',
          }}
        >
          <div className='flex min-w-0 flex-col justify-between gap-18px'>
            <div className='flex flex-wrap items-start justify-between gap-12px'>
              <div
                className='inline-flex items-center gap-8px rounded-full px-12px py-8px text-11px font-700 uppercase tracking-[0.18em]'
                style={{
                  color: 'rgb(var(--primary-6))',
                  background: 'rgba(var(--primary-6), 0.08)',
                }}
              >
                <span
                  className='inline-flex h-8px w-8px rounded-full animate-pulse'
                  style={{ background: 'rgb(var(--primary-6))' }}
                />
                {badge}
              </div>
              <div
                className='inline-flex items-center gap-8px rounded-full border px-12px py-8px text-12px font-600 text-t-secondary'
                style={{
                  borderColor: 'var(--color-border-2)',
                  background: 'color-mix(in srgb, var(--color-bg-1) 82%, transparent)',
                }}
              >
                <LoadingOne theme='outline' size={16} className='animate-spin text-primary-6' />
                {statusText}
              </div>
            </div>

            <div className='space-y-12px'>
              <h1 className='m-0 max-w-680px text-28px leading-[1.12] font-700 text-t-primary md:text-34px'>{title}</h1>
              <p className='m-0 max-w-640px text-14px leading-relaxed text-t-secondary md:text-15px'>{subtitle}</p>
            </div>

            <div className='flex flex-wrap items-center gap-10px'>
              <div
                className='rounded-full border px-12px py-8px text-12px font-600 text-t-secondary'
                style={{
                  borderColor: 'var(--color-border-2)',
                  background: 'color-mix(in srgb, var(--color-bg-1) 86%, transparent)',
                }}
              >
                {badge}
              </div>
              <div
                className='rounded-full border px-12px py-8px text-12px font-600'
                style={{
                  color: 'rgb(var(--primary-6))',
                  borderColor: 'rgba(var(--primary-6), 0.24)',
                  background: 'rgba(var(--primary-6), 0.08)',
                }}
              >
                {statusText}
              </div>
            </div>
          </div>

          <div
            className='relative min-h-220px overflow-hidden rounded-28px border p-18px'
            style={{
              borderColor: 'color-mix(in srgb, var(--color-border-2) 72%, rgb(var(--primary-6)) 28%)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, rgb(var(--primary-6)) 8%, var(--color-bg-1) 92%) 0%, color-mix(in srgb, var(--color-fill-1) 82%, var(--color-bg-1) 18%) 100%)',
            }}
          >
            <div
              className='absolute inset-x-16px top-16px h-40px rounded-18px border px-14px'
              style={{
                borderColor: 'rgba(var(--primary-6), 0.14)',
                background: 'color-mix(in srgb, var(--color-bg-1) 82%, transparent)',
              }}
            >
              <div className='flex h-full items-center justify-between gap-10px'>
                <div className='flex items-center gap-8px'>
                  <span className='h-8px w-8px rounded-full bg-danger-5 opacity-75' />
                  <span className='h-8px w-8px rounded-full bg-warning-5 opacity-75' />
                  <span className='h-8px w-8px rounded-full bg-success-5 opacity-75' />
                </div>
                <div className='flex-1 rounded-full bg-[var(--color-fill-2)] h-8px' />
              </div>
            </div>

            <div className='mt-64px flex h-[calc(100%-64px)] flex-col gap-12px'>
              <div
                className='rounded-22px border p-14px shadow-[0_14px_30px_rgba(15,23,42,0.08)]'
                style={{
                  borderColor: 'rgba(var(--primary-6), 0.16)',
                  background: 'color-mix(in srgb, var(--color-bg-1) 92%, white 8%)',
                }}
              >
                <div className='flex items-center justify-between gap-10px'>
                  <div className='min-w-0'>
                    <div className='text-12px font-700 uppercase tracking-[0.16em] text-primary-6'>{badge}</div>
                    <div className='mt-8px text-16px font-700 text-t-primary'>{title}</div>
                  </div>
                  <div className='flex items-center gap-6px'>
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className='h-8px w-8px rounded-full bg-primary-6 animate-bounce'
                        style={{ animationDelay: `${index * 0.14}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className='grid flex-1 grid-cols-[1.05fr_0.95fr] gap-12px'>
                <div
                  className='rounded-22px border p-14px'
                  style={{
                    borderColor: 'var(--color-border-2)',
                    background: 'color-mix(in srgb, var(--color-bg-1) 88%, transparent)',
                  }}
                >
                  <div className='space-y-10px'>
                    <div className='h-12px w-96px rounded-full bg-[rgba(var(--primary-6),0.16)]' />
                    <div className='h-44px rounded-18px bg-[var(--color-fill-2)] animate-pulse' />
                    <div className='grid grid-cols-2 gap-10px'>
                      <div className='h-56px rounded-18px bg-[var(--color-fill-1)] animate-pulse' />
                      <div className='h-56px rounded-18px bg-[var(--color-fill-1)] animate-pulse' />
                    </div>
                  </div>
                </div>

                <div
                  className='rounded-22px border p-14px'
                  style={{
                    borderColor: 'var(--color-border-2)',
                    background: 'color-mix(in srgb, var(--color-bg-1) 84%, transparent)',
                  }}
                >
                  <div className='space-y-10px'>
                    {[56, 72, 40, 68].map((height, index) => (
                      <div
                        key={`${height}-${index}`}
                        className='overflow-hidden rounded-18px bg-[var(--color-fill-1)]'
                        style={{ height }}
                      >
                        <div
                          className='h-full w-2/3 animate-pulse rounded-18px'
                          style={{
                            background:
                              'linear-gradient(90deg, rgba(var(--primary-6), 0.04) 0%, rgba(var(--primary-6), 0.16) 100%)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DesktopRemoteErrorOverlay: React.FC<{
  badge: string;
  title: string;
  subtitle: string;
  detail?: string;
  retryLabel: string;
  backLabel: string;
  onRetry: () => void;
  onBack: () => void;
}> = ({ badge, title, subtitle, detail, retryLabel, backLabel, onRetry, onBack }) => {
  return (
    <div
      data-testid='official-remote-error-overlay'
      className='absolute inset-0 z-30 flex items-center justify-center overflow-hidden p-20px md:p-32px'
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, rgb(var(--danger-6)) 6%, var(--color-bg-1) 94%) 0%, color-mix(in srgb, var(--color-fill-1) 84%, var(--color-bg-1) 16%) 52%, color-mix(in srgb, var(--color-bg-2) 92%, var(--color-bg-1) 8%) 100%)',
      }}
    >
      <div
        className='w-full max-w-720px rounded-32px border p-22px shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-[18px] md:p-28px'
        style={{
          borderColor: 'color-mix(in srgb, var(--color-border-2) 74%, rgb(var(--danger-6)) 26%)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-bg-1) 95%, white 5%) 0%, color-mix(in srgb, var(--color-fill-1) 90%, white 10%) 100%)',
        }}
      >
        <div className='flex flex-wrap items-start justify-between gap-12px'>
          <div
            className='inline-flex items-center gap-8px rounded-full px-12px py-8px text-11px font-700 uppercase tracking-[0.18em]'
            style={{
              color: 'rgb(var(--danger-6))',
              background: 'rgba(var(--danger-6), 0.08)',
            }}
          >
            <span className='inline-flex h-8px w-8px rounded-full' style={{ background: 'rgb(var(--danger-6))' }} />
            {badge}
          </div>
        </div>

        <div className='mt-18px space-y-12px'>
          <h1 className='m-0 text-28px leading-[1.12] font-700 text-t-primary md:text-32px'>{title}</h1>
          <p className='m-0 text-14px leading-relaxed text-t-secondary md:text-15px'>{subtitle}</p>
          {detail ? (
            <div
              className='rounded-20px border px-14px py-12px text-13px leading-relaxed text-t-secondary'
              style={{
                borderColor: 'color-mix(in srgb, var(--color-border-2) 74%, rgb(var(--danger-6)) 26%)',
                background: 'color-mix(in srgb, var(--color-bg-1) 86%, transparent)',
              }}
            >
              {detail}
            </div>
          ) : null}
        </div>

        <div className='mt-20px flex flex-wrap items-center gap-10px'>
          <Button type='primary' onClick={onRetry}>
            {retryLabel}
          </Button>
          <Button onClick={onBack}>{backLabel}</Button>
        </div>
      </div>
    </div>
  );
};

type DesktopRemoteLoadError = {
  code?: number;
  description?: string;
  url: string;
};

const isIgnorableWebviewAbort = (errorCode?: number, errorDescription?: string): boolean => {
  if (errorCode === -3) {
    return true;
  }

  if (!errorDescription) {
    return false;
  }

  return errorDescription.toUpperCase().includes('ERR_ABORTED');
};

const RemoteDevicesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedDeviceId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const deviceId = searchParams.get(OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY)?.trim();
    return deviceId ? deviceId : null;
  }, [location.search]);
  const forcePickerView = useMemo(() => {
    return isOfficialRemotePickerView(new URLSearchParams(location.search));
  }, [location.search]);
  const isDesktopRuntime = isElectronDesktop();
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [desktopRemoteLoadedUrl, setDesktopRemoteLoadedUrl] = useState<string | null>(null);
  const [desktopRemoteLoadError, setDesktopRemoteLoadError] = useState<DesktopRemoteLoadError | null>(null);
  const [desktopRemoteRetryKey, setDesktopRemoteRetryKey] = useState(0);
  const [desktopRemoteLoadingVisible, setDesktopRemoteLoadingVisible] = useState(false);
  const [desktopRemoteLoadingStartedAt, setDesktopRemoteLoadingStartedAt] = useState<number | null>(null);
  const hostedRemoteClient =
    requestedDeviceId && !forcePickerView && isDesktopRuntime ? OFFICIAL_REMOTE_CLIENT_DESKTOP_HOST : undefined;
  const [currentRemoteUrl, setCurrentRemoteUrl] = useState(() =>
    requestedDeviceId && !forcePickerView
      ? buildOfficialDeviceUrl(undefined, requestedDeviceId, { client: hostedRemoteClient })
      : buildOfficialDeviceListUrl(undefined, { forcePicker: forcePickerView })
  );
  const remoteAccess = useRemoteAccessContext();
  const currentCloudDeviceId = cloudStatus?.device?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadCloudStatus = async () => {
      setCloudLoading(true);

      try {
        const result = await cloud.getStatus.invoke();
        if (cancelled) {
          return;
        }

        setCloudStatus(result?.success && result.data ? result.data : null);
      } catch (error) {
        if (!cancelled) {
          console.error('[RemoteDevicesPage] Failed to load cloud status:', error);
          setCloudStatus(null);
        }
      } finally {
        if (!cancelled) {
          setCloudLoading(false);
        }
      }
    };

    void loadCloudStatus();

    const unsubscribe = cloud.statusChanged.on((nextStatus) => {
      setCloudStatus(nextStatus);
      setCloudLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const officialRemoteUrl = useMemo(
    () => buildOfficialDeviceListUrl(cloudStatus?.authBaseUrl),
    [cloudStatus?.authBaseUrl]
  );

  useEffect(() => {
    setCurrentRemoteUrl(
      requestedDeviceId && !forcePickerView
        ? buildOfficialDeviceUrl(cloudStatus?.authBaseUrl, requestedDeviceId, { client: hostedRemoteClient })
        : buildOfficialDeviceListUrl(cloudStatus?.authBaseUrl, { forcePicker: forcePickerView })
    );
  }, [cloudStatus?.authBaseUrl, forcePickerView, hostedRemoteClient, requestedDeviceId]);

  useEffect(() => {
    const activeDeviceId = extractOfficialRemoteDeviceId(currentRemoteUrl);
    if (!activeDeviceId) {
      return;
    }

    rememberPreferredOfficialRemoteDeviceId(activeDeviceId);
  }, [currentRemoteUrl]);

  useEffect(() => {
    const activeUrl = currentRemoteUrl || officialRemoteUrl;
    const routeViewMode = resolveOfficialRemoteRouteViewMode({
      requestedDeviceId,
      currentDeviceId: currentCloudDeviceId,
      isDesktopRuntime,
      forcePickerView,
      cloudStatusResolved: !cloudLoading,
    });

    remoteAccess?.setTarget({
      mode:
        routeViewMode === 'device-list'
          ? 'device-list'
          : routeViewMode === 'remote-device'
            ? isDesktopRuntime
              ? 'remote-host-shell'
              : 'remote-device'
            : 'local',
      currentUrl: activeUrl,
      entryUrl: officialRemoteUrl,
    });

    return () => {
      remoteAccess?.setTarget({
        mode: 'local',
        currentUrl: '',
        entryUrl: officialRemoteUrl,
      });
    };
  }, [
    cloudLoading,
    currentCloudDeviceId,
    currentRemoteUrl,
    forcePickerView,
    isDesktopRuntime,
    officialRemoteUrl,
    remoteAccess,
    requestedDeviceId,
  ]);

  const officialRemoteStatusText = getOfficialRemoteStatusText(cloudStatus, cloudLoading, t);
  const routeViewMode = resolveOfficialRemoteRouteViewMode({
    requestedDeviceId,
    currentDeviceId: currentCloudDeviceId,
    isDesktopRuntime,
    forcePickerView,
    cloudStatusResolved: !cloudLoading,
  });
  const isViewingDeviceList = routeViewMode === 'device-list';
  const isDesktopDirectDeviceView = routeViewMode === 'remote-device';
  const nestedRemoteFallbackRoute = isDesktopRuntime ? '/guid' : buildOfficialRemoteDevicesRoute({ forcePicker: true });
  const hostedSurfaceKey = useMemo(() => {
    if (isDesktopDirectDeviceView) {
      return `official-remote-device:${requestedDeviceId ?? 'unknown'}`;
    }

    return `official-remote-list:${forcePickerView ? 'picker' : 'default'}`;
  }, [forcePickerView, isDesktopDirectDeviceView, requestedDeviceId]);
  const hostedRemoteIntent = useMemo(
    () =>
      resolveHostedOfficialRemoteIntent(currentRemoteUrl || officialRemoteUrl, {
        displayedDeviceId: requestedDeviceId,
      }),
    [currentRemoteUrl, officialRemoteUrl, requestedDeviceId]
  );
  const remoteAccessStateLabel = isViewingDeviceList
    ? t('settings.webui.remoteDevicesNav', { defaultValue: 'Remote Devices' })
    : t('settings.webui.officialRemoteTitle', { defaultValue: 'Official Remote' });
  const desktopRemoteLoadingTitle = t('settings.webui.officialRemoteTitle');
  const desktopRemoteLoadingSubtitle = t('settings.webui.officialRemoteRuntimeHint');
  const desktopRemoteActiveUrl = currentRemoteUrl || officialRemoteUrl;
  const desktopRemoteErrorTitle = t('settings.webui.remoteDeviceLoadFailedTitle', {
    defaultValue: 'Unable to open the remote device',
  });
  const desktopRemoteErrorSubtitle = t('settings.webui.remoteDeviceLoadFailedDescription', {
    defaultValue:
      'The desktop client failed to load the hosted remote page. You can retry or return to the local host.',
  });
  const showDesktopRemoteLoading =
    isDesktopRuntime && isDesktopDirectDeviceView && !desktopRemoteLoadError && desktopRemoteLoadingVisible;
  const desktopRemoteErrorDetail = desktopRemoteLoadError
    ? t('settings.webui.remoteDeviceLoadFailedReason', {
        defaultValue: 'Loading failed: {{reason}}',
        reason:
          desktopRemoteLoadError.description && desktopRemoteLoadError.code !== undefined
            ? `${desktopRemoteLoadError.description} (${desktopRemoteLoadError.code})`
            : desktopRemoteLoadError.description ||
              (desktopRemoteLoadError.code !== undefined ? String(desktopRemoteLoadError.code) : t('common.error')),
      })
    : '';

  useEffect(() => {
    if (!isDesktopRuntime || !isDesktopDirectDeviceView) {
      setDesktopRemoteLoadedUrl(null);
      setDesktopRemoteLoadError(null);
      setDesktopRemoteLoadingVisible(false);
      setDesktopRemoteLoadingStartedAt(null);
      return;
    }

    setDesktopRemoteLoadingVisible(true);
    setDesktopRemoteLoadingStartedAt(Date.now());
  }, [desktopRemoteRetryKey, isDesktopDirectDeviceView, isDesktopRuntime, desktopRemoteActiveUrl]);

  useEffect(() => {
    if (!isDesktopRuntime || !isDesktopDirectDeviceView || desktopRemoteLoadError) {
      return;
    }

    if (desktopRemoteLoadedUrl !== desktopRemoteActiveUrl) {
      setDesktopRemoteLoadingVisible(true);
      return;
    }

    const startedAt = desktopRemoteLoadingStartedAt ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const hideDelay = Math.max(DESKTOP_REMOTE_LOADING_MIN_VISIBLE_MS - elapsed, 0) + DESKTOP_REMOTE_LOADING_SETTLE_MS;
    const timeoutId = window.setTimeout(() => {
      setDesktopRemoteLoadingVisible(false);
    }, hideDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    desktopRemoteActiveUrl,
    desktopRemoteLoadError,
    desktopRemoteLoadedUrl,
    desktopRemoteLoadingStartedAt,
    isDesktopDirectDeviceView,
    isDesktopRuntime,
  ]);

  useEffect(() => {
    if (routeViewMode !== 'local-device') {
      return;
    }

    void navigate('/guid', { replace: true });
  }, [navigate, routeViewMode]);

  useEffect(() => {
    if (!isDesktopDirectDeviceView) {
      return;
    }

    if (hostedRemoteIntent.kind === 'disconnect') {
      void navigate('/guid', { replace: true });
      return;
    }

    if (hostedRemoteIntent.kind === 'device-switch') {
      if (!isDesktopRuntime) {
        remoteAccess?.resetToDeviceList();
      }

      void navigate(nestedRemoteFallbackRoute, { replace: true });
      return;
    }

    if (hostedRemoteIntent.kind === 'device-list') {
      void navigate(buildOfficialRemoteDevicesRoute({ forcePicker: true }), { replace: true });
      return;
    }

    if (hostedRemoteIntent.kind === 'self-open') {
      setCurrentRemoteUrl(
        buildOfficialDeviceUrl(cloudStatus?.authBaseUrl, hostedRemoteIntent.deviceId, {
          client: hostedRemoteClient,
        })
      );
      return;
    }

    const activeUrl = currentRemoteUrl || officialRemoteUrl;
    if (!isOfficialDeviceListUrl(activeUrl, cloudStatus?.authBaseUrl)) {
      return;
    }

    void navigate(buildOfficialRemoteDevicesRoute({ forcePicker: true }), { replace: true });
  }, [
    cloudStatus?.authBaseUrl,
    currentRemoteUrl,
    hostedRemoteIntent,
    isDesktopRuntime,
    isDesktopDirectDeviceView,
    nestedRemoteFallbackRoute,
    navigate,
    officialRemoteUrl,
    remoteAccess,
  ]);

  if (routeViewMode === 'resolving-device' && isDesktopRuntime) {
    return (
      <div className='size-full min-h-0 bg-bg-1 relative overflow-hidden'>
        <DesktopRemoteLoadingOverlay
          badge={remoteAccessStateLabel}
          title={desktopRemoteLoadingTitle}
          subtitle={desktopRemoteLoadingSubtitle}
          statusText={officialRemoteStatusText}
        />
      </div>
    );
  }

  if (routeViewMode === 'local-device') {
    return <div className='size-full min-h-0 bg-bg-1' />;
  }

  if (isDesktopDirectDeviceView) {
    return (
      <div className='official-remote-device-shell relative size-full min-h-0 min-w-0 overflow-hidden bg-bg-1'>
        {showDesktopRemoteLoading ? (
          <DesktopRemoteLoadingOverlay
            badge={remoteAccessStateLabel}
            title={desktopRemoteLoadingTitle}
            subtitle={desktopRemoteLoadingSubtitle}
            statusText={officialRemoteStatusText}
          />
        ) : null}
        {desktopRemoteLoadError ? (
          <DesktopRemoteErrorOverlay
            badge={remoteAccessStateLabel}
            title={desktopRemoteErrorTitle}
            subtitle={desktopRemoteErrorSubtitle}
            detail={desktopRemoteErrorDetail}
            retryLabel={t('common.retry')}
            backLabel={t('settings.webui.backToLocal', { defaultValue: 'Back to Local' })}
            onRetry={() => {
              setDesktopRemoteLoadError(null);
              setDesktopRemoteLoadedUrl(null);
              setDesktopRemoteRetryKey((previous) => previous + 1);
            }}
            onBack={() => {
              void navigate(nestedRemoteFallbackRoute, { replace: true });
            }}
          />
        ) : null}
        <WebviewHost
          key={`${hostedSurfaceKey}:${desktopRemoteRetryKey}`}
          url={desktopRemoteActiveUrl}
          partition={OFFICIAL_REMOTE_WEBVIEW_PARTITION}
          className='size-full min-h-0 min-w-0 bg-bg-1'
          onUrlChange={setCurrentRemoteUrl}
          onDidFinishLoad={() => {
            setDesktopRemoteLoadError(null);
            setDesktopRemoteLoadedUrl(desktopRemoteActiveUrl);
          }}
          onDidFailLoad={(errorCode, errorDescription) => {
            if (isIgnorableWebviewAbort(errorCode, errorDescription)) {
              return;
            }

            setDesktopRemoteLoadingVisible(false);
            setDesktopRemoteLoadedUrl(null);
            setDesktopRemoteLoadError({
              code: errorCode,
              description: errorDescription,
              url: desktopRemoteActiveUrl,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className='secondary-page-frame size-full min-h-0 overflow-hidden'>
      <div className='secondary-page-inner mx-auto flex size-full min-h-0 flex-col gap-12px overflow-hidden'>
        <section className='rounded-18px border border-line bg-fill-1 px-16px py-14px md:px-20px md:py-16px'>
          <div className='flex flex-wrap items-start justify-between gap-12px'>
            <div className='min-w-0 flex-1'>
              <div className='text-11px font-600 uppercase tracking-[0.16em] text-t-tertiary'>
                {remoteAccessStateLabel}
              </div>
              <h1 className='m-0 mt-6px text-20px font-600 text-t-primary'>
                {isViewingDeviceList
                  ? t('settings.webui.officialRemoteTitle')
                  : t('settings.cloud.deviceName', { defaultValue: 'Device' })}
              </h1>
              <p className='m-0 mt-6px max-w-[900px] text-13px leading-relaxed text-t-secondary'>
                {isViewingDeviceList
                  ? t('settings.webui.officialRemoteDesc')
                  : t('settings.webui.officialRemoteRuntimeHint')}
              </p>
              <div className='mt-8px text-12px leading-relaxed text-t-secondary'>{officialRemoteStatusText}</div>
            </div>
            <div className='flex shrink-0 items-center gap-8px'>
              {!isViewingDeviceList ? (
                <Button
                  type='secondary'
                  size='small'
                  onClick={() => {
                    remoteAccess?.resetToDeviceList();
                    void navigate(buildOfficialRemoteDevicesRoute({ forcePicker: true }), { replace: true });
                    setCurrentRemoteUrl(buildOfficialDeviceListUrl(cloudStatus?.authBaseUrl, { forcePicker: true }));
                  }}
                >
                  {t('common.goBack')}
                </Button>
              ) : null}
              {isDesktopRuntime ? (
                <Button
                  type='secondary'
                  size='small'
                  onClick={() => {
                    void navigate('/settings/system');
                  }}
                >
                  {t('common.goToSettings')}
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className='min-h-0 flex-1 overflow-hidden rounded-18px border border-line bg-bg-1'>
          <WebviewHost
            key={hostedSurfaceKey}
            url={currentRemoteUrl || officialRemoteUrl}
            partition={OFFICIAL_REMOTE_WEBVIEW_PARTITION}
            showNavBar
            className='size-full bg-bg-1'
            onUrlChange={setCurrentRemoteUrl}
          />
        </section>
      </div>
    </div>
  );
};

export default RemoteDevicesPage;
