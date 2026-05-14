/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

const SUSPICIOUS_DOCUMENT_RESOURCE_PATTERN = /\.(?:[cm]?js|css|json|map|txt|xml|wasm)(?:$|[?#])/i;
export const EMBEDDED_DOCUMENT_FALLBACK_URL = 'about:blank';

/**
 * Detect whether a URL/path likely points to a raw asset document rather than a renderable page.
 *
 * Repeated renderer "white screen with raw code text" incidents were caused by nested webviews/iframes
 * navigating to bundled JS/CSS/JSON assets. Centralize the guard so all embedded-document surfaces
 * can consistently reject those navigations.
 */
export const isSuspiciousDocumentNavigation = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === 'about:' || parsed.protocol === 'data:') {
      return false;
    }

    return SUSPICIOUS_DOCUMENT_RESOURCE_PATTERN.test(parsed.pathname);
  } catch {
    return SUSPICIOUS_DOCUMENT_RESOURCE_PATTERN.test(targetUrl);
  }
};

/**
 * Convert suspicious embedded-document entry URLs to a safe blank document so the UI does not flash raw asset text.
 */
export const getSafeEmbeddedDocumentUrl = (targetUrl: string, guardEnabled: boolean): string => {
  if (!guardEnabled || !isSuspiciousDocumentNavigation(targetUrl)) {
    return targetUrl;
  }

  return EMBEDDED_DOCUMENT_FALLBACK_URL;
};

/**
 * Allow direct file loading only for actual document files, never for raw bundled assets.
 */
export const shouldLoadHtmlDocumentFromFile = (
  filePath: string | undefined,
  hasRelativeResources: boolean
): boolean => {
  if (!filePath || !hasRelativeResources) {
    return false;
  }

  return !isSuspiciousDocumentNavigation(filePath);
};
