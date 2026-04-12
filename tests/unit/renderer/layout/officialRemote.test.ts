import { describe, expect, it } from 'vitest';
import {
  buildOfficialDeviceListUrl,
  OFFICIAL_REMOTE_DEVICES_ROUTE,
  OFFICIAL_REMOTE_WEBVIEW_PARTITION,
} from '@/renderer/utils/officialRemote';

describe('officialRemote utils', () => {
  it('keeps the in-app route stable for the embedded remote page', () => {
    expect(OFFICIAL_REMOTE_DEVICES_ROUTE).toBe('/remote/devices');
    expect(OFFICIAL_REMOTE_WEBVIEW_PARTITION).toBe('persist:official-remote');
  });

  it('builds the official device list URL from the provided auth base URL', () => {
    expect(buildOfficialDeviceListUrl('https://remote.example.com///')).toBe(
      'https://remote.example.com/remote/devices'
    );
  });

  it('falls back to the default auth base URL when none is provided', () => {
    expect(buildOfficialDeviceListUrl()).toBe('https://auth.contextgo.io/remote/devices');
  });
});
