/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrowserWindow } from 'electron';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('deepLink module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('electron', () => ({}));
    vi.doMock('@/common', () => ({
      ipcBridge: {
        deepLink: {
          received: { emit: vi.fn() },
        },
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('electron');
    vi.doUnmock('@/common');
  });

  describe('parseDeepLinkUrl', () => {
    it('should parse simple deep link URL', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      const result = parseDeepLinkUrl('contextgo://add-provider?baseUrl=http://localhost&apiKey=sk-123');

      expect(result).toEqual({
        action: 'add-provider',
        params: { baseUrl: 'http://localhost', apiKey: 'sk-123' },
      });
    });

    it('should parse deep link with path segments', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      const result = parseDeepLinkUrl('contextgo://provider/add?v=1');

      expect(result).toEqual({
        action: 'provider/add',
        params: { v: '1' },
      });
    });

    it('should decode base64 data param and merge into params', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      const data = Buffer.from(JSON.stringify({ baseUrl: 'http://test', apiKey: 'key123' })).toString('base64');
      const result = parseDeepLinkUrl(`contextgo://provider/add?v=1&data=${data}`);

      expect(result).not.toBeNull();
      expect(result!.params.baseUrl).toBe('http://test');
      expect(result!.params.apiKey).toBe('key123');
      expect(result!.params.data).toBeUndefined();
    });

    it('should handle invalid base64 data gracefully', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      const result = parseDeepLinkUrl('contextgo://add?data=not-valid-base64!!!');

      expect(result).not.toBeNull();
      expect(result!.params.data).toBeUndefined();
    });

    it('should return null for non-contextgo protocol', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      expect(parseDeepLinkUrl('https://example.com')).toBeNull();
    });

    it('should return null for invalid URL', async () => {
      const { parseDeepLinkUrl } = await import('@process/utils/deepLink');
      expect(parseDeepLinkUrl('not a url at all')).toBeNull();
    });
  });

  describe('handleDeepLinkUrl', () => {
    it('should queue URL when no window is set', async () => {
      const { handleDeepLinkUrl, getPendingDeepLinkUrl } = await import('@process/utils/deepLink');

      handleDeepLinkUrl('contextgo://test-action?key=val');

      expect(getPendingDeepLinkUrl()).toBe('contextgo://test-action?key=val');
    });

    it('should emit via ipcBridge when window is available', async () => {
      const { ipcBridge } = await import('@/common');
      const { handleDeepLinkUrl, setDeepLinkMainWindow } = await import('@process/utils/deepLink');

      const mockWindow = { isDestroyed: () => false } as unknown as BrowserWindow;
      setDeepLinkMainWindow(mockWindow);

      handleDeepLinkUrl('contextgo://test-action?key=val');

      expect(ipcBridge.deepLink.received.emit).toHaveBeenCalledWith({
        action: 'test-action',
        params: { key: 'val' },
      });
    });

    it('should not emit for invalid URLs', async () => {
      const { ipcBridge } = await import('@/common');
      const { handleDeepLinkUrl, setDeepLinkMainWindow } = await import('@process/utils/deepLink');

      setDeepLinkMainWindow({ isDestroyed: () => false } as unknown as BrowserWindow);
      handleDeepLinkUrl('https://not-deep-link.com');

      expect(ipcBridge.deepLink.received.emit).not.toHaveBeenCalled();
    });

    it('should notify main-process listeners for cloud login deep links', async () => {
      const listener = vi.fn();
      const { handleDeepLinkUrl, onDeepLinkReceived } = await import('@process/utils/deepLink');
      const unsubscribe = onDeepLinkReceived(listener);

      handleDeepLinkUrl('contextgo://cloud-login?code=desktop-code&provider=github');

      expect(listener).toHaveBeenCalledWith({
        action: 'cloud-login',
        params: {
          code: 'desktop-code',
          provider: 'github',
        },
      });

      unsubscribe();
    });
  });

  describe('pending URL state', () => {
    it('should clear pending URL', async () => {
      const { handleDeepLinkUrl, getPendingDeepLinkUrl, clearPendingDeepLinkUrl } =
        await import('@process/utils/deepLink');

      handleDeepLinkUrl('contextgo://test');
      expect(getPendingDeepLinkUrl()).toBe('contextgo://test');

      clearPendingDeepLinkUrl();
      expect(getPendingDeepLinkUrl()).toBeNull();
    });
  });
});
