/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CONTEXTGO_AUTH_BASE_URL } from '@/common/config/constants';
import type { CloudAuthProviderId } from '@/common/types/cloud';

const CONTEXTGO_ROOT_HOST = 'contextgo.io';
const CONTEXTGO_HOST_SUFFIX = `.${CONTEXTGO_ROOT_HOST}`;
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', 'localhost']);
const CONTEXTGO_AUTH_ORIGIN = new URL(CONTEXTGO_AUTH_BASE_URL).origin;
const CLOUD_DESKTOP_LOGIN_COMPLETE_PATH = '/desktop-login-complete';

export const CONTEXTGO_SESSION_COOKIE_NAME = 'contextgo_session';
export type CloudLoginNavigationResult =
  | { type: 'success' }
  | { type: 'cancelled' }
  | { type: 'error'; errorCode: string };

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  return LOOPBACK_HOSTNAMES.has(normalizedHostname);
}

export function isContextGoHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return false;
  }

  return normalizedHostname === CONTEXTGO_ROOT_HOST || normalizedHostname.endsWith(CONTEXTGO_HOST_SUFFIX);
}

export function buildCloudOAuthStartUrl(provider: CloudAuthProviderId, nextUrl: string): string {
  const url = new URL(`/api/auth/oauth/${provider}/start`, CONTEXTGO_AUTH_BASE_URL);
  url.searchParams.set('next', nextUrl);
  return url.toString();
}

type BuildCloudDesktopOAuthStartUrlOptions = {
  loopbackCallbackUrl?: string;
};

function buildCloudDesktopLoginReturnUrl(
  provider: CloudAuthProviderId,
  loopbackCallbackUrl?: string
): string {
  const url = new URL(CLOUD_DESKTOP_LOGIN_COMPLETE_PATH, CONTEXTGO_AUTH_BASE_URL);
  url.searchParams.set('provider', provider);

  const normalizedLoopbackCallbackUrl = loopbackCallbackUrl?.trim();
  if (normalizedLoopbackCallbackUrl) {
    url.searchParams.set('loopback', normalizedLoopbackCallbackUrl);
  }

  return url.toString();
}

export function buildCloudDesktopOAuthStartUrl(
  provider: CloudAuthProviderId,
  options?: BuildCloudDesktopOAuthStartUrlOptions
): string {
  const url = new URL(`/api/auth/oauth/${provider}/start`, CONTEXTGO_AUTH_BASE_URL);
  url.searchParams.set('next', buildCloudDesktopLoginReturnUrl(provider, options?.loopbackCallbackUrl));
  url.searchParams.set('desktop', '1');
  return url.toString();
}

export function buildCloudLogoutUrl(nextUrl: string): string {
  const url = new URL('/api/auth/logout', CONTEXTGO_AUTH_BASE_URL);
  url.searchParams.set('next', nextUrl);
  return url.toString();
}

export function getCloudLoginNavigationResult(url: string): CloudLoginNavigationResult | null {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== CONTEXTGO_AUTH_ORIGIN || parsed.pathname !== '/login') {
      return null;
    }

    if (parsed.searchParams.get('success') === '1') {
      return { type: 'success' };
    }

    if (parsed.searchParams.get('cancel') === '1') {
      return { type: 'cancelled' };
    }

    const errorCode = parsed.searchParams.get('oauthError');
    if (errorCode) {
      return {
        type: 'error',
        errorCode,
      };
    }

    return null;
  } catch {
    return null;
  }
}
