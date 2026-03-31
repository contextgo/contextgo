import { describe, expect, it } from 'vitest';

import {
  buildOfficialRemoteRelayWebSocketUrl,
  parseOfficialRemoteRelayFrame,
} from '@/process/services/cloud/OfficialRemoteTunnelService';

describe('OfficialRemoteTunnelService relay helpers', () => {
  it('builds a secure websocket relay URL from the cloud API base URL', () => {
    expect(buildOfficialRemoteRelayWebSocketUrl('https://api.contextgo.io')).toBe(
      'wss://api.contextgo.io/api/remote/device-connect'
    );
    expect(buildOfficialRemoteRelayWebSocketUrl('http://127.0.0.1:3001')).toBe(
      'ws://127.0.0.1:3001/api/remote/device-connect'
    );
  });

  it('parses valid relay frames and rejects malformed payloads', () => {
    expect(parseOfficialRemoteRelayFrame('{"type":"hello","deviceId":"device-1"}')).toEqual({
      type: 'hello',
      deviceId: 'device-1',
    });
    expect(parseOfficialRemoteRelayFrame('{"foo":"bar"}')).toBeNull();
    expect(parseOfficialRemoteRelayFrame('not-json')).toBeNull();
  });
});
