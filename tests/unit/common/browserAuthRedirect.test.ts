import { describe, expect, it } from 'vitest';
import {
  buildBrowserBridgeSocketUrl,
  buildBrowserLoginRedirectPath,
  buildHostedRemoteDeviceRouteStorageKey,
  buildHostedRemoteNoticeRedirectPath,
  extractRemoteDeviceId,
  readHostedRemoteDeviceRoute,
  rememberHostedRemoteDeviceRoute,
  resolveHostedRemoteBootstrapHref,
  resolveHostedRemoteDisconnect,
  resolveHostedRemoteDisconnectRedirectPath,
} from '@/common/adapter/browserAuthRedirect';

describe('buildBrowserBridgeSocketUrl', () => {
  it('uses explicit remote client relay endpoint for hosted remote pages', () => {
    expect(buildBrowserBridgeSocketUrl('https://remote.contextgo.io/device/device-1#/conversation/abc', 25809)).toBe(
      'wss://remote.contextgo.io/api/remote/client-connect?device_id=device-1'
    );
  });

  it('keeps local webui connections on the root websocket endpoint', () => {
    expect(buildBrowserBridgeSocketUrl('http://127.0.0.1:25809/#/conversation/abc', 25809)).toBe(
      'ws://127.0.0.1:25809'
    );
  });

  it('accepts hosted remote device paths with a trailing slash when composing the socket url', () => {
    expect(buildBrowserBridgeSocketUrl('https://remote.contextgo.io/device/device-1/', 25809)).toBe(
      'wss://remote.contextgo.io/api/remote/client-connect?device_id=device-1'
    );
  });
});

describe('hosted remote device route persistence', () => {
  it('stores hosted device routes under a stable device-specific key', () => {
    expect(buildHostedRemoteDeviceRouteStorageKey('device-1')).toBe('contextgo:official-remote-device-route:device-1');
  });

  it('normalizes and restores the last route for a hosted remote device', () => {
    const storage = new Map<string, string>();

    rememberHostedRemoteDeviceRoute('device-1', 'conversation/abc', {
      setItem: (key, value) => {
        storage.set(key, value);
      },
    });

    expect(
      readHostedRemoteDeviceRoute('device-1', {
        getItem: (key) => storage.get(key) ?? null,
      })
    ).toBe('/conversation/abc');
  });

  it('bootstraps device entry directly to the remembered route when the hosted page has no hash route yet', () => {
    const storage = new Map<string, string>([['contextgo:official-remote-device-route:device-1', '/conversation/abc']]);

    expect(
      resolveHostedRemoteBootstrapHref('https://remote.contextgo.io/device/device-1', {
        getItem: (key) => storage.get(key) ?? null,
      })
    ).toBe('https://remote.contextgo.io/device/device-1#/conversation/abc');
  });

  it('falls back to guid when a hosted device page has no remembered route', () => {
    expect(
      resolveHostedRemoteBootstrapHref('https://remote.contextgo.io/device/device-1', {
        getItem: () => null,
      })
    ).toBe('https://remote.contextgo.io/device/device-1#/guid');
  });

  it('keeps the current href unchanged when the device page already has a hash route', () => {
    expect(resolveHostedRemoteBootstrapHref('https://remote.contextgo.io/device/device-1#/conversation/abc')).toBe(
      'https://remote.contextgo.io/device/device-1#/conversation/abc'
    );
  });
});

describe('buildBrowserLoginRedirectPath', () => {
  it('preserves canonical device routes on contextgo hosts', () => {
    expect(buildBrowserLoginRedirectPath('https://remote.contextgo.io/device/device-1#/conversation/abc')).toBe(
      '/login?next=%2Fdevice%2Fdevice-1%23%2Fconversation%2Fabc'
    );
  });

  it('keeps plain login redirects for non-contextgo hosts', () => {
    expect(buildBrowserLoginRedirectPath('http://127.0.0.1:3000/#/conversation/abc')).toBe('/login');
  });

  it('avoids nesting another next parameter when already on the login shell', () => {
    expect(buildBrowserLoginRedirectPath('https://remote.contextgo.io/login?next=%2Fremote%2Fdevices')).toBe('/login');
  });
});

describe('extractRemoteDeviceId', () => {
  it('reads device id from canonical device paths', () => {
    expect(extractRemoteDeviceId('https://remote.contextgo.io/device/device-1#/conversation/abc')).toBe('device-1');
  });

  it('accepts hosted remote device paths with a trailing slash', () => {
    expect(extractRemoteDeviceId('https://remote.contextgo.io/device/device-1/')).toBe('device-1');
    expect(extractRemoteDeviceId('https://remote.contextgo.io/device/device-1/#/guid')).toBe('device-1');
  });

  it('returns null when the current URL is not a device session page', () => {
    expect(extractRemoteDeviceId('https://remote.contextgo.io/remote/devices')).toBeNull();
  });
});

describe('resolveHostedRemoteDisconnectRedirectPath', () => {
  const currentHref = 'https://remote.contextgo.io/device/device-1#/conversation/abc';

  it('redirects auth failures back through the login shell', () => {
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 4401, 'Authentication required')).toBe(
      '/login?next=%2Fdevice%2Fdevice-1%23%2Fconversation%2Fabc'
    );
  });

  it('maps missing or offline devices back to the device list with a notice', () => {
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 4404, 'Device not found')).toBe(
      buildHostedRemoteNoticeRedirectPath('device_not_found')
    );
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 4404, 'Device offline')).toBe(
      buildHostedRemoteNoticeRedirectPath('device_offline')
    );
  });

  it('treats hosted remote session replacement as a reconnect instead of forcing a list redirect', () => {
    expect(resolveHostedRemoteDisconnect(currentHref, 1012, 'Remote session replaced')).toEqual({
      type: 'reconnect',
    });
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 1012, 'Remote session replaced')).toBeNull();
  });

  it('maps hosted remote restarts to list notices', () => {
    expect(resolveHostedRemoteDisconnect(currentHref, 1012, 'service restart')).toEqual({
      type: 'redirect',
      path: buildHostedRemoteNoticeRedirectPath('service_restarted'),
    });
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 1012, 'service restart')).toBe(
      buildHostedRemoteNoticeRedirectPath('service_restarted')
    );
  });

  it('returns null for close codes that should continue reconnecting', () => {
    expect(resolveHostedRemoteDisconnectRedirectPath(currentHref, 1006, '')).toBeNull();
  });
});
