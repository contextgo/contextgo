import { describe, expect, it } from 'vitest';
import { buildBrowserLoginRedirectPath } from '@/common/adapter/browserAuthRedirect';

describe('buildBrowserLoginRedirectPath', () => {
  it('preserves the hosted remote session target on contextgo hosts', () => {
    expect(
      buildBrowserLoginRedirectPath('https://remote.contextgo.io/remote/app/?device_id=device-1#/conversation/abc')
    ).toBe('/login?next=%2Fremote%2Fapp%2F%3Fdevice_id%3Ddevice-1%23%2Fconversation%2Fabc');
  });

  it('keeps plain login redirects for non-contextgo hosts', () => {
    expect(buildBrowserLoginRedirectPath('http://127.0.0.1:3000/#/conversation/abc')).toBe('/login');
  });

  it('avoids nesting another next parameter when already on the login shell', () => {
    expect(buildBrowserLoginRedirectPath('https://remote.contextgo.io/login?next=%2Fremote%2Fdevices')).toBe('/login');
  });
});
