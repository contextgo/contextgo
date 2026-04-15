import { describe, expect, it } from 'vitest';
import {
  buildOfficialDeviceListUrl,
  buildOfficialRemoteDevicesRoute,
  buildOfficialDeviceUrl,
  getCurrentHostRuntimeStatusKey,
  isCurrentHostRuntimeReady,
  OFFICIAL_REMOTE_DEVICES_ROUTE,
  OFFICIAL_REMOTE_VIEW_LIST,
  OFFICIAL_REMOTE_VIEW_QUERY_KEY,
  OFFICIAL_REMOTE_WEBVIEW_PARTITION,
  extractOfficialRemoteDeviceId,
  isOfficialRemotePickerView,
  readPreferredOfficialRemoteDeviceId,
  rememberPreferredOfficialRemoteDeviceId,
  resolveHostedOfficialRemoteIntent,
  resolveOfficialRemoteRouteViewMode,
  resolveAuthenticatedStartupPath,
  shouldPreferOfficialRemoteShell,
} from '@/renderer/utils/officialRemote';

describe('officialRemote utils', () => {
  it('keeps the in-app route stable for the embedded remote page', () => {
    expect(OFFICIAL_REMOTE_DEVICES_ROUTE).toBe('/remote/devices');
    expect(OFFICIAL_REMOTE_WEBVIEW_PARTITION).toBe('persist:contextgo-cloud-auth');
  });

  it('builds the official device list URL from the provided auth base URL', () => {
    expect(buildOfficialDeviceListUrl('https://remote.example.com///')).toBe(
      'https://remote.example.com/remote/devices'
    );
    expect(buildOfficialDeviceListUrl('https://remote.example.com///', { forcePicker: true })).toBe(
      'https://remote.example.com/remote/devices?view=list'
    );
  });

  it('builds in-app routes for startup and explicit device switching', () => {
    expect(buildOfficialRemoteDevicesRoute()).toBe('/remote/devices');
    expect(buildOfficialRemoteDevicesRoute({ forcePicker: true })).toBe('/remote/devices?view=list');
    expect(buildOfficialRemoteDevicesRoute({ preferredDeviceId: 'device-123', forcePicker: true })).toBe(
      '/remote/devices?deviceId=device-123&view=list'
    );
    expect(
      isOfficialRemotePickerView(new URLSearchParams(`${OFFICIAL_REMOTE_VIEW_QUERY_KEY}=${OFFICIAL_REMOTE_VIEW_LIST}`))
    ).toBe(true);
  });

  it('falls back to the default auth base URL when none is provided', () => {
    expect(buildOfficialDeviceListUrl()).toBe('https://auth.contextgo.io/remote/devices');
  });

  it('builds a direct device URL for the hosted remote runtime', () => {
    expect(buildOfficialDeviceUrl('https://remote.example.com///', 'device-123')).toBe(
      'https://remote.example.com/device/device-123'
    );
  });

  it('extracts a hosted remote device id from a device URL', () => {
    expect(extractOfficialRemoteDeviceId('https://remote.example.com/device/device-123')).toBe('device-123');
    expect(extractOfficialRemoteDeviceId('https://remote.example.com/remote/devices')).toBeNull();
  });

  it('resolves nested hosted remote navigation so the outer desktop can take over device switching', () => {
    expect(
      resolveHostedOfficialRemoteIntent(
        'https://remote.example.com/device/device-123#/remote/devices?deviceId=device-456',
        {
          displayedDeviceId: 'device-123',
        }
      )
    ).toEqual({
      kind: 'device-switch',
      deviceId: 'device-456',
    });

    expect(
      resolveHostedOfficialRemoteIntent('https://remote.example.com/device/device-456', {
        displayedDeviceId: 'device-123',
      })
    ).toEqual({
      kind: 'device-switch',
      deviceId: 'device-456',
    });

    expect(
      resolveHostedOfficialRemoteIntent(
        'https://remote.example.com/device/device-123#/remote/devices?deviceId=device-123',
        {
          displayedDeviceId: 'device-123',
        }
      )
    ).toEqual({
      kind: 'self-open',
      deviceId: 'device-123',
    });

    expect(
      resolveHostedOfficialRemoteIntent('https://remote.example.com/remote/devices?view=list', {
        displayedDeviceId: 'device-123',
      })
    ).toEqual({
      kind: 'device-list',
    });
  });

  it('resolves desktop remote routes by distinguishing current and remote devices', () => {
    expect(
      resolveOfficialRemoteRouteViewMode({
        requestedDeviceId: null,
        currentDeviceId: 'device-local',
        isDesktopRuntime: true,
        forcePickerView: false,
        cloudStatusResolved: true,
      })
    ).toBe('device-list');

    expect(
      resolveOfficialRemoteRouteViewMode({
        requestedDeviceId: 'device-local',
        currentDeviceId: 'device-local',
        isDesktopRuntime: true,
        forcePickerView: false,
        cloudStatusResolved: true,
      })
    ).toBe('local-device');

    expect(
      resolveOfficialRemoteRouteViewMode({
        requestedDeviceId: 'device-remote',
        currentDeviceId: 'device-local',
        isDesktopRuntime: true,
        forcePickerView: false,
        cloudStatusResolved: true,
      })
    ).toBe('remote-device');

    expect(
      resolveOfficialRemoteRouteViewMode({
        requestedDeviceId: 'device-remote',
        currentDeviceId: null,
        isDesktopRuntime: true,
        forcePickerView: false,
        cloudStatusResolved: false,
      })
    ).toBe('resolving-device');
  });

  it('prefers the hosted remote shell on mobile clients and official cloud hosts', () => {
    expect(
      shouldPreferOfficialRemoteShell({
        currentHref: 'https://localhost:4173/#/guid',
        isDesktopRuntime: false,
        isMobileShellRuntime: true,
      })
    ).toBe(true);

    expect(
      shouldPreferOfficialRemoteShell({
        currentHref: 'https://remote.contextgo.io/#/guid',
        isDesktopRuntime: false,
        isMobileShellRuntime: false,
      })
    ).toBe(true);

    expect(
      shouldPreferOfficialRemoteShell({
        currentHref: 'https://localhost:4173/#/guid',
        isDesktopRuntime: false,
        isMobileShellRuntime: false,
      })
    ).toBe(false);

    expect(
      shouldPreferOfficialRemoteShell({
        currentHref: 'https://remote.contextgo.io/device/device-1#/conversation/abc',
        isDesktopRuntime: false,
        isMobileShellRuntime: true,
      })
    ).toBe(false);
  });

  it('resolves authenticated startup to the remembered remote device when remote shell is preferred', () => {
    const storage = new Map<string, string>();
    rememberPreferredOfficialRemoteDeviceId('device-123', {
      setItem: (key, value) => {
        storage.set(key, value);
      },
    });

    expect(
      readPreferredOfficialRemoteDeviceId({
        getItem: (key) => storage.get(key) ?? null,
      })
    ).toBe('device-123');

    expect(
      resolveAuthenticatedStartupPath({
        activeTabId: null,
        openTabIds: [],
        preferOfficialRemoteShell: true,
        preferredRemoteDeviceId: readPreferredOfficialRemoteDeviceId({
          getItem: (key) => storage.get(key) ?? null,
        }),
      })
    ).toBe(buildOfficialRemoteDevicesRoute({ preferredDeviceId: 'device-123' }));
  });

  it('falls back to the current conversation or guid when remote shell is not preferred', () => {
    expect(
      resolveAuthenticatedStartupPath({
        activeTabId: 'conv-1',
        openTabIds: ['conv-1'],
        preferOfficialRemoteShell: false,
      })
    ).toBe('/conversation/conv-1');

    expect(
      resolveAuthenticatedStartupPath({
        activeTabId: null,
        openTabIds: [],
        preferOfficialRemoteShell: false,
      })
    ).toBe('/guid');
  });

  it('derives current-device readiness from hostRuntime even when legacy officialRemote flags lag', () => {
    expect(
      isCurrentHostRuntimeReady({
        apiBaseUrl: 'https://api.contextgo.test',
        authBaseUrl: 'https://remote.contextgo.test',
        authenticated: true,
        browserSessionExpired: false,
        device: null,
        deviceTokenAvailable: true,
        officialRemoteReady: false,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'running',
          mode: 'gui-host',
          platform: 'macos',
          running: true,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: true,
          localUrl: 'http://localhost:25809',
        },
        providers: ['github', 'google'],
        user: null,
      })
    ).toBe(true);

    expect(
      getCurrentHostRuntimeStatusKey({
        apiBaseUrl: 'https://api.contextgo.test',
        authBaseUrl: 'https://remote.contextgo.test',
        authenticated: true,
        browserSessionExpired: false,
        device: null,
        deviceTokenAvailable: true,
        officialRemoteReady: false,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'running',
          mode: 'gui-host',
          platform: 'macos',
          running: true,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: true,
          localUrl: 'http://localhost:25809',
        },
        providers: ['github', 'google'],
        user: null,
      })
    ).toBe('settings.webui.officialRemoteStatusShort.ready');
  });

  it('maps a desired but not-yet-running hostRuntime to the connecting state', () => {
    expect(
      getCurrentHostRuntimeStatusKey({
        apiBaseUrl: 'https://api.contextgo.test',
        authBaseUrl: 'https://remote.contextgo.test',
        authenticated: true,
        browserSessionExpired: false,
        device: {
          id: 'device-1',
          userId: 'user-1',
          deviceName: 'Local Mac',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemoteReady: false,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'stopped',
          mode: 'gui-host',
          platform: 'macos',
          running: false,
          supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
          officialRemoteDesired: true,
          officialRemoteReady: false,
        },
        providers: ['github', 'google'],
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          username: 'dev',
          displayName: 'Dev',
        },
      })
    ).toBe('settings.webui.officialRemoteStatusShort.connecting');
  });
});
