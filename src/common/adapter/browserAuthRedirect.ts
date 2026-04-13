/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { STORAGE_KEYS } from '@/common/config/storageKeys';

const CONTEXTGO_ROOT_HOST = 'contextgo.io';
const CONTEXTGO_HOST_SUFFIX = `.${CONTEXTGO_ROOT_HOST}`;
const OFFICIAL_REMOTE_DEVICE_LIST_PATH = '/remote/devices';
const DEFAULT_HOSTED_DEVICE_HASH_ROUTE = '/guid';

export type HostedRemoteDisconnectNotice =
  | 'device_not_found'
  | 'device_offline'
  | 'session_replaced'
  | 'service_restarted';

function isContextGoHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return normalizedHostname === CONTEXTGO_ROOT_HOST || normalizedHostname.endsWith(CONTEXTGO_HOST_SUFFIX);
}

export function extractRemoteDeviceId(currentHref: string): string | null {
  const currentUrl = new URL(currentHref);
  const match = currentUrl.pathname.match(/^\/device\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const getSafeLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeHostedHashRoute = (routePath: string): string => {
  const trimmedRoute = routePath.trim();
  if (!trimmedRoute || trimmedRoute === '/') {
    return DEFAULT_HOSTED_DEVICE_HASH_ROUTE;
  }

  return trimmedRoute.startsWith('/') ? trimmedRoute : `/${trimmedRoute}`;
};

const isHostedRemoteLaunchRoute = (routePath: string): boolean => {
  const normalizedRoute = normalizeHostedHashRoute(routePath);
  return normalizedRoute === DEFAULT_HOSTED_DEVICE_HASH_ROUTE || normalizedRoute.startsWith('/conversation/');
};

export function buildHostedRemoteDeviceRouteStorageKey(deviceId: string): string {
  return `${STORAGE_KEYS.OFFICIAL_REMOTE_DEVICE_ROUTE_PREFIX}${deviceId.trim()}`;
}

export function readHostedRemoteDeviceRoute(
  deviceId: string,
  storage: Pick<Storage, 'getItem'> | null = getSafeLocalStorage()
): string | null {
  const normalizedDeviceId = deviceId.trim();
  if (!normalizedDeviceId) {
    return null;
  }

  const storedRoute = storage?.getItem(buildHostedRemoteDeviceRouteStorageKey(normalizedDeviceId))?.trim();
  if (!storedRoute) {
    return null;
  }

  const normalizedRoute = normalizeHostedHashRoute(storedRoute);
  return isHostedRemoteLaunchRoute(normalizedRoute) ? normalizedRoute : null;
}

export function rememberHostedRemoteDeviceRoute(
  deviceId: string,
  routePath: string,
  storage: Pick<Storage, 'setItem'> | null = getSafeLocalStorage()
): void {
  const normalizedDeviceId = deviceId.trim();
  if (!normalizedDeviceId) {
    return;
  }

  const normalizedRoute = normalizeHostedHashRoute(routePath);
  if (!isHostedRemoteLaunchRoute(normalizedRoute)) {
    return;
  }

  storage?.setItem(buildHostedRemoteDeviceRouteStorageKey(normalizedDeviceId), normalizedRoute);
}

export function resolveHostedRemoteBootstrapHref(
  currentHref: string,
  storage: Pick<Storage, 'getItem'> | null = getSafeLocalStorage()
): string {
  const remoteDeviceId = extractRemoteDeviceId(currentHref);
  if (!remoteDeviceId) {
    return currentHref;
  }

  const currentUrl = new URL(currentHref);
  const currentHashRoute = currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1).trim() : currentUrl.hash.trim();
  if (currentHashRoute && currentHashRoute !== '/') {
    return currentHref;
  }

  currentUrl.hash = readHostedRemoteDeviceRoute(remoteDeviceId, storage) ?? DEFAULT_HOSTED_DEVICE_HASH_ROUTE;
  return currentUrl.toString();
}

export function buildBrowserBridgeSocketUrl(currentHref: string, defaultPort: number): string {
  const currentUrl = new URL(currentHref);
  const protocol = currentUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const originHost = currentUrl.host || `${currentUrl.hostname}:${defaultPort}`;
  const remoteDeviceId = extractRemoteDeviceId(currentHref);

  if (!remoteDeviceId) {
    return `${protocol}//${originHost}`;
  }

  const socketUrl = new URL('/api/remote/client-connect', `${protocol}//${originHost}`);
  socketUrl.searchParams.set('device_id', remoteDeviceId);
  return socketUrl.toString();
}

export function buildBrowserLoginRedirectPath(currentHref: string): string {
  const currentUrl = new URL(currentHref);
  const isLoginShell = currentUrl.pathname === '/login' || currentUrl.hash.includes('/login');
  if (isLoginShell) {
    return '/login';
  }

  if (!isContextGoHostname(currentUrl.hostname)) {
    return '/login';
  }

  const nextPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildHostedRemoteNoticeRedirectPath(notice: HostedRemoteDisconnectNotice): string {
  return `${OFFICIAL_REMOTE_DEVICE_LIST_PATH}?remoteNotice=${encodeURIComponent(notice)}`;
}

export type HostedRemoteDisconnectResolution =
  | { type: 'redirect'; path: string }
  | { type: 'reconnect' }
  | { type: 'none' };

export function resolveHostedRemoteDisconnect(
  currentHref: string,
  code: number,
  reason: string
): HostedRemoteDisconnectResolution {
  const normalizedReason = reason.trim().toLowerCase();
  if (code === 4401) {
    return { type: 'redirect', path: buildBrowserLoginRedirectPath(currentHref) };
  }

  if (code === 4404) {
    return {
      type: 'redirect',
      path: buildHostedRemoteNoticeRedirectPath(
        normalizedReason.includes('offline') ? 'device_offline' : 'device_not_found'
      ),
    };
  }

  if (code !== 1012) {
    return { type: 'none' };
  }

  if (normalizedReason.includes('session replaced')) {
    return isContextGoHostname(new URL(currentHref).hostname)
      ? { type: 'reconnect' }
      : { type: 'redirect', path: buildHostedRemoteNoticeRedirectPath('session_replaced') };
  }

  if (normalizedReason.includes('restart')) {
    return { type: 'redirect', path: buildHostedRemoteNoticeRedirectPath('service_restarted') };
  }

  if (normalizedReason.includes('disconnected')) {
    return { type: 'redirect', path: buildHostedRemoteNoticeRedirectPath('device_offline') };
  }

  return { type: 'redirect', path: buildHostedRemoteNoticeRedirectPath('service_restarted') };
}

export function resolveHostedRemoteDisconnectRedirectPath(
  currentHref: string,
  code: number,
  reason: string
): string | null {
  const resolution = resolveHostedRemoteDisconnect(currentHref, code, reason);
  return resolution.type === 'redirect' ? resolution.path : null;
}
