/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { homedir } from 'node:os';
import path from 'node:path';

export type FrpProxyConfig = {
  name: string;
  type: string;
  remotePort: number;
};

export type FrpClientConfig = {
  serverAddr: string;
  serverPort: number;
  authMethod: string;
  authToken: string;
  proxy: FrpProxyConfig;
};

const DEFAULT_AUTH_METHOD = 'token';

function parseTomlValue(rawValue: string): string | number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  const numericValue = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numericValue) && String(numericValue) === trimmed) {
    return numericValue;
  }

  return trimmed;
}

export function parseFrpClientConfig(raw: string): FrpClientConfig | null {
  let currentSection = '';
  let serverAddr: string | null = null;
  let serverPort: number | null = null;
  let authMethod = DEFAULT_AUTH_METHOD;
  let authToken: string | null = null;
  let proxyName: string | null = null;
  let proxyType = 'tcp';
  let remotePort: number | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line === '[[proxies]]') {
      currentSection = 'proxies';
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim();
      continue;
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    const parsedValue = parseTomlValue(line.slice(equalIndex + 1));
    const scopedKey = key.includes('.') || !currentSection ? key : `${currentSection}.${key}`;

    switch (scopedKey) {
      case 'serverAddr':
        if (typeof parsedValue === 'string' && parsedValue) {
          serverAddr = parsedValue;
        }
        break;
      case 'serverPort':
        if (typeof parsedValue === 'number') {
          serverPort = parsedValue;
        }
        break;
      case 'auth.method':
        if (typeof parsedValue === 'string' && parsedValue) {
          authMethod = parsedValue;
        }
        break;
      case 'auth.token':
        if (typeof parsedValue === 'string' && parsedValue) {
          authToken = parsedValue;
        }
        break;
      case 'proxies.name':
        if (!proxyName && typeof parsedValue === 'string' && parsedValue) {
          proxyName = parsedValue;
        }
        break;
      case 'proxies.type':
        if (typeof parsedValue === 'string' && parsedValue) {
          proxyType = parsedValue;
        }
        break;
      case 'proxies.remotePort':
        if (remotePort === null && typeof parsedValue === 'number') {
          remotePort = parsedValue;
        }
        break;
      default:
        break;
    }
  }

  if (!serverAddr || !serverPort || !authToken || !proxyName || !remotePort) {
    return null;
  }

  return {
    serverAddr,
    serverPort,
    authMethod,
    authToken,
    proxy: {
      name: proxyName,
      type: proxyType || 'tcp',
      remotePort,
    },
  };
}

export function buildManagedFrpClientConfig(
  config: FrpClientConfig,
  options: {
    localIP: string;
    localPort: number;
  }
): string {
  return [
    `serverAddr = "${config.serverAddr}"`,
    `serverPort = ${config.serverPort}`,
    '',
    `auth.method = "${config.authMethod}"`,
    `auth.token = "${config.authToken}"`,
    '',
    '[[proxies]]',
    `name = "${config.proxy.name}"`,
    `type = "${config.proxy.type}"`,
    `localIP = "${options.localIP}"`,
    `localPort = ${options.localPort}`,
    `remotePort = ${config.proxy.remotePort}`,
    '',
  ].join('\n');
}

export function getDefaultOfficialRemoteFrpConfigPath(homePath = homedir()): string {
  return path.join(homePath, '.config', 'frp', 'contextgo-remote.toml');
}
