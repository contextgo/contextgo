/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request } from 'express';
import * as cookie from 'cookie';
import { hostname } from 'node:os';
import type { CloudDevice, CloudUser } from '@/common/types/cloud';
import { CONTEXTGO_API_BASE_URL } from '@/common/config/constants';
import { CONTEXTGO_SESSION_COOKIE_NAME, isContextGoHostname } from '@/common/utils';
import { ProcessConfig } from '@process/utils/initStorage';

type CloudSessionPayload = {
  authenticated?: boolean;
  user?: CloudUser | null;
};

type BoundCloudIdentity = {
  user: CloudUser | null;
  device: CloudDevice | null;
  deviceToken: string | null;
};

type DeviceRegisterPayload = {
  success?: boolean;
  device?: CloudDevice;
  token?: string;
};

type RequestHeadersCarrier = {
  headers: Request['headers'];
};

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return getHeaderValue(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.split(',')[0]?.trim();
  return normalized ? normalized : null;
}

function parseHostname(hostHeader: string | null): string | null {
  if (!hostHeader) {
    return null;
  }

  try {
    return new URL(`http://${hostHeader}`).hostname;
  } catch {
    return null;
  }
}

async function parseSessionPayload(response: Response): Promise<CloudSessionPayload | null> {
  const body = await response.text();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as CloudSessionPayload;
  } catch {
    return null;
  }
}

const SESSION_ENDPOINT = `${CONTEXTGO_API_BASE_URL}/api/auth/session`;

export const CloudSessionService = {
  isCloudRequest(req: RequestHeadersCarrier): boolean {
    const forwardedHost = parseHostname(getHeaderValue(req.headers['x-forwarded-host']));
    const directHost = parseHostname(getHeaderValue(req.headers.host));
    const requestHostname = forwardedHost ?? directHost;
    return Boolean(requestHostname && isContextGoHostname(requestHostname));
  },

  extractCloudSessionToken(req: Pick<Request, 'headers' | 'cookies'>): string | null {
    if (typeof req.cookies === 'object' && req.cookies) {
      const cookieToken = req.cookies[CONTEXTGO_SESSION_COOKIE_NAME];
      if (typeof cookieToken === 'string' && cookieToken.trim() !== '') {
        return cookieToken;
      }
    }

    const cookieHeader = getHeaderValue(req.headers.cookie);
    if (cookieHeader) {
      const cookies = cookie.parse(cookieHeader);
      const cookieToken = cookies[CONTEXTGO_SESSION_COOKIE_NAME];
      if (cookieToken) {
        return cookieToken;
      }
    }

    return null;
  },

  async authenticateRequest(req: Pick<Request, 'headers' | 'cookies'>): Promise<CloudUser | null> {
    if (!CloudSessionService.isCloudRequest(req)) {
      return null;
    }

    const sessionToken = CloudSessionService.extractCloudSessionToken(req);
    if (!sessionToken) {
      return null;
    }

    return CloudSessionService.authenticateSessionToken(sessionToken);
  },

  async authenticateSessionToken(sessionToken: string): Promise<CloudUser | null> {
    const boundIdentity = await readBoundIdentity();
    const sessionUser = await fetchSessionUser(sessionToken);
    if (!sessionUser) {
      return null;
    }

    if (!boundIdentity || !boundIdentity.user || !boundIdentity.deviceToken) {
      try {
        await registerDeviceBinding(sessionToken, sessionUser);
      } catch (error) {
        console.warn('[CloudSession] Failed to auto-bind device:', error);
        return null;
      }
      return sessionUser;
    }

    if (sessionUser.id !== boundIdentity.user.id) {
      return null;
    }

    if (boundIdentity.device && boundIdentity.device.userId !== sessionUser.id) {
      return null;
    }

    return sessionUser;
  },
};

async function readBoundIdentity(): Promise<BoundCloudIdentity | null> {
  const [user, device, deviceToken] = await Promise.all([
    ProcessConfig.get('cloud.user'),
    ProcessConfig.get('cloud.device'),
    ProcessConfig.get('cloud.deviceToken'),
  ]);

  if (!user && !device && !deviceToken) {
    return null;
  }

  return {
    user: user ?? null,
    device: device ?? null,
    deviceToken: deviceToken ?? null,
  };
}

async function fetchSessionUser(sessionToken: string): Promise<CloudUser | null> {
  try {
    const response = await fetch(SESSION_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: `${CONTEXTGO_SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await parseSessionPayload(response);
    if (!payload?.authenticated || !payload.user) {
      return null;
    }

    return payload.user;
  } catch (error) {
    console.warn('[CloudSession] Failed to validate browser session:', error);
    return null;
  }
}

function buildDevicePlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return process.platform;
  }
}

function buildDeviceName(): string {
  return `ContextGo WebUI on ${hostname()}`;
}

async function registerDeviceBinding(sessionToken: string, sessionUser: CloudUser): Promise<void> {
  const response = await fetch(`${CONTEXTGO_API_BASE_URL}/api/devices/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: `${CONTEXTGO_SESSION_COOKIE_NAME}=${sessionToken}`,
    },
    body: JSON.stringify({
      deviceName: buildDeviceName(),
      platform: buildDevicePlatform(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloud device auto-binding failed with status ${response.status}`);
  }

  const payload = (await parseSessionPayload(response)) as DeviceRegisterPayload | null;
  if (!payload?.success || !payload.device || !payload.token) {
    throw new Error('Cloud device auto-binding returned an invalid payload');
  }

  await Promise.all([
    ProcessConfig.set('cloud.user', sessionUser),
    ProcessConfig.set('cloud.device', payload.device),
    ProcessConfig.set('cloud.deviceToken', payload.token),
  ]);
}
