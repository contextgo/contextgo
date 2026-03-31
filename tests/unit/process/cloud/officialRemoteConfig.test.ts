/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  buildManagedFrpClientConfig,
  getDefaultOfficialRemoteFrpConfigPath,
  parseFrpClientConfig,
} from '@process/services/cloud/officialRemoteConfig';

describe('officialRemoteConfig', () => {
  it('parses the current FRP client config format', () => {
    const parsed = parseFrpClientConfig(`
serverAddr = "35.220.138.222"
serverPort = 7000

auth.method = "token"
auth.token = "secret-token"

[[proxies]]
name = "contextgo-webui-mbp"
type = "tcp"
localIP = "host.docker.internal"
localPort = 25809
remotePort = 18080
`);

    expect(parsed).toEqual({
      serverAddr: '35.220.138.222',
      serverPort: 7000,
      authMethod: 'token',
      authToken: 'secret-token',
      proxy: {
        name: 'contextgo-webui-mbp',
        type: 'tcp',
        remotePort: 18080,
      },
    });
  });

  it('returns null for invalid FRP client config', () => {
    expect(parseFrpClientConfig('serverAddr = "missing-required-fields"')).toBeNull();
  });

  it('builds a managed FRP client config with overridden local endpoint', () => {
    const managed = buildManagedFrpClientConfig(
      {
        serverAddr: '35.220.138.222',
        serverPort: 7000,
        authMethod: 'token',
        authToken: 'secret-token',
        proxy: {
          name: 'contextgo-webui-mbp',
          type: 'tcp',
          remotePort: 18080,
        },
      },
      {
        localIP: '127.0.0.1',
        localPort: 25808,
      }
    );

    expect(managed).toContain('serverAddr = "35.220.138.222"');
    expect(managed).toContain('auth.token = "secret-token"');
    expect(managed).toContain('localIP = "127.0.0.1"');
    expect(managed).toContain('localPort = 25808');
    expect(managed).toContain('remotePort = 18080');
    expect(managed).not.toContain('host.docker.internal');
  });

  it('builds the default official remote config path under ~/.config/frp', () => {
    expect(getDefaultOfficialRemoteFrpConfigPath('/tmp/test-home')).toBe(
      '/tmp/test-home/.config/frp/contextgo-remote.toml'
    );
  });
});
