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
  OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY,
  OFFICIAL_REMOTE_WEBVIEW_PARTITION,
  isOfficialRemotePickerView,
  rememberPreferredOfficialRemoteDeviceId,
  resolveHostedOfficialRemoteIntent,
  resolveOfficialRemoteRouteViewMode,
} from '@/renderer/utils/officialRemote';
import { Button } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

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

  if (!cloudStatus?.user) {
    return translate('settings.webui.officialRemoteSignedOut');
  }

  if (officialRemoteReady) {
    return translate('settings.webui.officialRemoteDeviceReady');
  }

  if (officialRemoteNeedsRelogin) {
    return translate('settings.webui.officialRemoteNeedsRelogin');
  }

  if (officialRemoteNeedsLink) {
    return translate('settings.webui.officialRemoteDevicePending');
  }

  if (officialRemoteSetupInProgress) {
    return translate('settings.webui.officialRemotePreparing');
  }

  if (officialRemoteRelayConnecting) {
    return translate('settings.webui.officialRemoteConnecting');
  }

  return translate('settings.webui.officialRemoteUnavailable');
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
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [currentRemoteUrl, setCurrentRemoteUrl] = useState(() =>
    requestedDeviceId && !forcePickerView
      ? buildOfficialDeviceUrl(undefined, requestedDeviceId)
      : buildOfficialDeviceListUrl(undefined, { forcePicker: forcePickerView })
  );
  const isDesktopRuntime = isElectronDesktop();
  const remoteAccess = useRemoteAccessContext();
  const currentCloudDeviceId = cloudStatus?.device?.id ?? null;
  const mobileStagedDeviceId = !isDesktopRuntime && forcePickerView ? requestedDeviceId : null;

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
        ? buildOfficialDeviceUrl(cloudStatus?.authBaseUrl, requestedDeviceId)
        : buildOfficialDeviceListUrl(cloudStatus?.authBaseUrl, { forcePicker: forcePickerView })
    );
  }, [cloudStatus?.authBaseUrl, forcePickerView, requestedDeviceId]);

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
        routeViewMode === 'device-list' ? 'device-list' : routeViewMode === 'remote-device' ? 'remote-device' : 'local',
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

  const handleHostedSurfaceDidFinishLoad = useCallback(() => {
    if (!mobileStagedDeviceId) {
      return;
    }

    const activeUrl = currentRemoteUrl || officialRemoteUrl;
    if (!isOfficialDeviceListUrl(activeUrl, cloudStatus?.authBaseUrl)) {
      return;
    }

    void navigate(buildOfficialRemoteDevicesRoute({ preferredDeviceId: mobileStagedDeviceId }), { replace: true });
  }, [cloudStatus?.authBaseUrl, currentRemoteUrl, mobileStagedDeviceId, navigate, officialRemoteUrl]);

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

    if (hostedRemoteIntent.kind === 'device-switch') {
      void navigate(buildOfficialRemoteDevicesRoute({ preferredDeviceId: hostedRemoteIntent.deviceId }), {
        replace: true,
      });
      return;
    }

    if (hostedRemoteIntent.kind === 'device-list') {
      void navigate(buildOfficialRemoteDevicesRoute({ forcePicker: true }), { replace: true });
      return;
    }

    if (hostedRemoteIntent.kind === 'self-open') {
      setCurrentRemoteUrl(buildOfficialDeviceUrl(cloudStatus?.authBaseUrl, hostedRemoteIntent.deviceId));
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
    isDesktopDirectDeviceView,
    navigate,
    officialRemoteUrl,
  ]);

  if (routeViewMode === 'resolving-device' && isDesktopRuntime) {
    return <div className='size-full min-h-0 bg-bg-1' />;
  }

  if (routeViewMode === 'local-device') {
    return <div className='size-full min-h-0 bg-bg-1' />;
  }

  if (isDesktopDirectDeviceView) {
    return (
      <div className='size-full min-h-0 overflow-hidden rounded-18px border border-line bg-bg-1'>
        <WebviewHost
          key={hostedSurfaceKey}
          id='official-remote-devices'
          url={currentRemoteUrl || officialRemoteUrl}
          partition={OFFICIAL_REMOTE_WEBVIEW_PARTITION}
          className='size-full bg-bg-1'
          onDidFinishLoad={handleHostedSurfaceDidFinishLoad}
          onUrlChange={setCurrentRemoteUrl}
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
            id='official-remote-devices'
            url={currentRemoteUrl || officialRemoteUrl}
            partition={OFFICIAL_REMOTE_WEBVIEW_PARTITION}
            showNavBar
            className='size-full bg-bg-1'
            onDidFinishLoad={handleHostedSurfaceDidFinishLoad}
            onUrlChange={setCurrentRemoteUrl}
          />
        </section>
      </div>
    </div>
  );
};

export default RemoteDevicesPage;
