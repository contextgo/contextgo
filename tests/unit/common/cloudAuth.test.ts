import { describe, expect, it } from 'vitest';
import { buildCloudOAuthStartUrl, isContextGoHostname } from '@/common/utils';

describe('cloud auth helpers', () => {
  it('recognizes contextgo root and subdomains as cloud hosts', () => {
    expect(isContextGoHostname('contextgo.io')).toBe(true);
    expect(isContextGoHostname('remote.contextgo.io')).toBe(true);
    expect(isContextGoHostname('device-1.remote.contextgo.io')).toBe(true);
  });

  it('rejects non-contextgo hostnames', () => {
    expect(isContextGoHostname('example.com')).toBe(false);
    expect(isContextGoHostname('contextgo.io.evil.example')).toBe(false);
  });

  it('builds oauth start URLs with absolute next values', () => {
    const url = new URL(buildCloudOAuthStartUrl('github', 'https://remote.contextgo.io/login'));

    expect(url.origin).toBe('https://auth.contextgo.io');
    expect(url.pathname).toBe('/api/auth/oauth/github/start');
    expect(url.searchParams.get('next')).toBe('https://remote.contextgo.io/login');
  });
});
