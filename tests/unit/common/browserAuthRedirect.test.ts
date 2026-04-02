import { describe, expect, it } from 'vitest';
import {
  buildBrowserLoginRedirectPath,
  buildHostedRemoteNoticeRedirectPath,
  extractRemoteDeviceId,
  resolveHostedRemoteDisconnect,
  resolveHostedRemoteDisconnectRedirectPath,
} from '@/common/adapter/browserAuthRedirect';

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
