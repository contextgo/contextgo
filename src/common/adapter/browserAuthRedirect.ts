/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

const CONTEXTGO_ROOT_HOST = 'contextgo.io';
const CONTEXTGO_HOST_SUFFIX = `.${CONTEXTGO_ROOT_HOST}`;
const REMOTE_DEVICES_PATH = '/remote/devices';

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
  const match = currentUrl.pathname.match(/^\/device\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
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
  return `${REMOTE_DEVICES_PATH}?remoteNotice=${encodeURIComponent(notice)}`;
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
