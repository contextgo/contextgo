/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalize the outer shell path used by the hash-based WebUI.
 *
 * Historically authenticated sessions could stay on `/login#/...`, which makes
 * the app look like it is still inside the login page even after entering a
 * protected route. The actual route lives in the hash, so we only need to strip
 * the `/login` shell and keep the hash untouched.
 */
export function normalizeHashRouteShellPath(pathname: string, search: string, hash: string): string | null {
  if (pathname !== '/login') {
    return null;
  }

  return `/${search}${hash}`;
}

export function normalizeHashRouteShellHref(currentHref: string): string {
  const url = new URL(currentHref);
  const normalizedPath = normalizeHashRouteShellPath(url.pathname, url.search, url.hash);

  if (!normalizedPath) {
    return currentHref;
  }

  return `${url.origin}${normalizedPath}`;
}
