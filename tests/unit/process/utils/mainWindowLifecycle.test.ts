/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const showMessageBoxMock = vi.fn();

describe('mainWindowLifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    showMessageBoxMock.mockReset();

    vi.doMock('electron', () => ({
      dialog: {
        showMessageBox: showMessageBoxMock,
      },
    }));

    vi.doMock('@process/services/i18n', () => ({
      default: {
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
      },
    }));

    vi.doMock('@process/bridge/applicationBridge', () => ({
      setApplicationMainWindow: vi.fn(),
    }));

    vi.doMock('@process/utils/deepLink', () => ({
      setDeepLinkMainWindow: vi.fn(),
    }));

    vi.doMock('@process/utils/tray', () => ({
      setTrayMainWindow: vi.fn(),
    }));
  });

  it('should bind the same window to all main-window consumers', async () => {
    const window = {} as Electron.BrowserWindow;
    const { setApplicationMainWindow } = await import('@process/bridge/applicationBridge');
    const { setDeepLinkMainWindow } = await import('@process/utils/deepLink');
    const { setTrayMainWindow } = await import('@process/utils/tray');
    const { bindMainWindowReferences } = await import('@process/utils/mainWindowLifecycle');

    bindMainWindowReferences(window);

    expect(setTrayMainWindow).toHaveBeenCalledWith(window);
    expect(setDeepLinkMainWindow).toHaveBeenCalledWith(window);
    expect(setApplicationMainWindow).toHaveBeenCalledWith(window);
  });

  it('should show and focus the current main window instead of recreating it', async () => {
    const createWindow = vi.fn();
    const window = {
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    } as unknown as Electron.BrowserWindow;
    const { showOrCreateMainWindow } = await import('@process/utils/mainWindowLifecycle');

    showOrCreateMainWindow({ mainWindow: window, createWindow });

    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(createWindow).not.toHaveBeenCalled();
  });

  it('should recreate the main window when the cached window has been destroyed', async () => {
    const createWindow = vi.fn();
    const destroyedWindow = {
      isDestroyed: vi.fn(() => true),
      isMinimized: vi.fn(),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    } as unknown as Electron.BrowserWindow;
    const { showOrCreateMainWindow } = await import('@process/utils/mainWindowLifecycle');

    showOrCreateMainWindow({ mainWindow: destroyedWindow, createWindow });

    expect(createWindow).toHaveBeenCalledOnce();
    expect(destroyedWindow.restore).not.toHaveBeenCalled();
    expect(destroyedWindow.show).not.toHaveBeenCalled();
    expect(destroyedWindow.focus).not.toHaveBeenCalled();
  });

  it('should show an unresponsive recovery dialog', async () => {
    showMessageBoxMock.mockResolvedValue({ response: 1 });

    const window = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        getURL: vi.fn(() => 'http://localhost:5173/#/guid'),
      },
    } as unknown as Electron.BrowserWindow;
    const { promptMainWindowUnresponsive } = await import('@process/utils/mainWindowLifecycle');

    await expect(promptMainWindowUnresponsive(window)).resolves.toBe('reload');
    expect(showMessageBoxMock).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        type: 'warning',
        buttons: ['Wait', 'Reload'],
      })
    );
  });

  it('should ignore subframe load failures for the recovery dialog', async () => {
    const window = {
      isDestroyed: vi.fn(() => false),
    } as unknown as Electron.BrowserWindow;
    const { promptMainWindowLoadFailure } = await import('@process/utils/mainWindowLifecycle');

    await expect(
      promptMainWindowLoadFailure(window, {
        errorCode: -6,
        errorDescription: 'ERR_FILE_NOT_FOUND',
        validatedURL: 'file:///nested-frame.html',
        isMainFrame: false,
      })
    ).resolves.toBeNull();
    expect(showMessageBoxMock).not.toHaveBeenCalled();
  });

  it('should include render-process diagnostics in the recovery dialog', async () => {
    showMessageBoxMock.mockResolvedValue({ response: 1 });

    const window = {
      isDestroyed: vi.fn(() => false),
    } as unknown as Electron.BrowserWindow;
    const { promptMainWindowRenderProcessGone } = await import('@process/utils/mainWindowLifecycle');

    await expect(
      promptMainWindowRenderProcessGone(window, {
        reason: 'crashed',
        exitCode: 137,
      } as Electron.RenderProcessGoneDetails)
    ).resolves.toBe('reload');
    expect(showMessageBoxMock).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        buttons: ['Wait', 'Reload'],
        detail: expect.stringContaining('"reason": "crashed"'),
      })
    );
  });
});
