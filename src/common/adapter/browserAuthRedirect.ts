/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

const CONTEXTGO_ROOT_HOST = 'contextgo.io';
const CONTEXTGO_HOST_SUFFIX = `.${CONTEXTGO_ROOT_HOST}`;

function isContextGoHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return normalizedHostname === CONTEXTGO_ROOT_HOST || normalizedHostname.endsWith(CONTEXTGO_HOST_SUFFIX);
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
