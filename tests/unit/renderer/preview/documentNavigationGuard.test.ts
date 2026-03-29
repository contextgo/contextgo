/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EMBEDDED_DOCUMENT_FALLBACK_URL,
  getSafeEmbeddedDocumentUrl,
  isSuspiciousDocumentNavigation,
  shouldLoadHtmlDocumentFromFile,
} from '@/renderer/utils/ui/documentNavigationGuard';
import { describe, expect, it } from 'vitest';

describe('documentNavigationGuard', () => {
  it('treats bundled asset documents as suspicious', () => {
    expect(isSuspiciousDocumentNavigation('file:///Applications/ContextGo.app/assets/zig-abc123.js')).toBe(true);
    expect(isSuspiciousDocumentNavigation('https://example.com/assets/index.json?raw=1')).toBe(true);
    expect(isSuspiciousDocumentNavigation('/tmp/renderer/chunk.css')).toBe(true);
  });

  it('allows normal html-like documents', () => {
    expect(isSuspiciousDocumentNavigation('file:///tmp/index.html')).toBe(false);
    expect(isSuspiciousDocumentNavigation('https://example.com/docs/page')).toBe(false);
    expect(isSuspiciousDocumentNavigation('data:text/html,<h1>ok</h1>')).toBe(false);
    expect(isSuspiciousDocumentNavigation('about:blank')).toBe(false);
  });

  it('blocks direct file loading for suspicious html entry paths', () => {
    expect(shouldLoadHtmlDocumentFromFile('/tmp/index.html', true)).toBe(true);
    expect(shouldLoadHtmlDocumentFromFile('/tmp/zig.js', true)).toBe(false);
    expect(shouldLoadHtmlDocumentFromFile(undefined, true)).toBe(false);
    expect(shouldLoadHtmlDocumentFromFile('/tmp/index.html', false)).toBe(false);
  });

  it('falls back to a blank document for suspicious embedded entry URLs', () => {
    expect(getSafeEmbeddedDocumentUrl('https://example.com/assets/highlight.js', true)).toBe(
      EMBEDDED_DOCUMENT_FALLBACK_URL
    );
    expect(getSafeEmbeddedDocumentUrl('https://example.com/app', true)).toBe('https://example.com/app');
    expect(getSafeEmbeddedDocumentUrl('https://example.com/assets/highlight.js', false)).toBe(
      'https://example.com/assets/highlight.js'
    );
  });
});
