/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CONTEXTGO_AUTH_BASE_URL } from '@/common/config/constants';
import type { CloudAuthProviderId } from '@/common/types/cloud';

const CONTEXTGO_ROOT_HOST = 'contextgo.io';
const CONTEXTGO_HOST_SUFFIX = `.${CONTEXTGO_ROOT_HOST}`;
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', 'localhost']);

export const CONTEXTGO_SESSION_COOKIE_NAME = 'contextgo_session';

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

export function buildCloudLogoutUrl(nextUrl: string): string {
  const url = new URL('/api/auth/logout', CONTEXTGO_AUTH_BASE_URL);
  url.searchParams.set('next', nextUrl);
  return url.toString();
}
