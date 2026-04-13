/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 窗口控制桥接模块
 * Window Controls Bridge Module
 *
 * 负责处理窗口的最小化、最大化、关闭等控制操作
 * Handles window minimize, maximize, close and other control operations
 */

import { BrowserWindow } from 'electron';
import { ipcBridge } from '@/common';

function resolveWindowControlsTarget(): BrowserWindow | null {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && !focusedWindow.isDestroyed()) {
    return focusedWindow;
  }

  const fallbackWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
  return fallbackWindow ?? null;
}

/**
 * 为指定窗口注册最大化状态监听器
 * Register maximize state listeners for a specific window
 *
 * @param window - 要监听的 BrowserWindow 实例 / BrowserWindow instance to listen to
 */
export function registerWindowMaximizeListeners(window: BrowserWindow): void {
  // 当窗口最大化时通知渲染进程 / Notify renderer when window is maximized
  window.on('maximize', () => {
    ipcBridge.windowControls.maximizedChanged.emit({ isMaximized: true });
  });

  // 当窗口取消最大化时通知渲染进程 / Notify renderer when window is unmaximized
  window.on('unmaximize', () => {
    ipcBridge.windowControls.maximizedChanged.emit({ isMaximized: false });
  });

  // 当窗口进入/退出全屏时通知渲染进程 / Notify renderer when fullscreen state changes
  window.on('enter-full-screen', () => {
    ipcBridge.windowControls.fullScreenChanged.emit({ isFullScreen: true });
  });

  window.on('leave-full-screen', () => {
    ipcBridge.windowControls.fullScreenChanged.emit({ isFullScreen: false });
  });
}

/**
 * 初始化窗口控制桥接
 * Initialize window controls bridge
 *
 * 注册 IPC 处理器以响应来自渲染进程的窗口控制请求
 * Register IPC handlers to respond to window control requests from renderer process
 */
export function initWindowControlsBridge(): void {
  // 最小化窗口 / Minimize window
  ipcBridge.windowControls.minimize.provider(() => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.minimize();
    }
    return Promise.resolve();
  });

  // 最大化窗口 / Maximize window
  ipcBridge.windowControls.maximize.provider(() => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.maximize();
    }
    return Promise.resolve();
  });

  // 取消最大化窗口 / Unmaximize window
  ipcBridge.windowControls.unmaximize.provider(() => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.unmaximize();
    }
    return Promise.resolve();
  });

  // 关闭窗口 / Close window
  ipcBridge.windowControls.close.provider(() => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.close();
    }
    return Promise.resolve();
  });

  // 获取窗口是否最大化状态 / Get window maximized state
  ipcBridge.windowControls.isMaximized.provider(() => {
    const window = resolveWindowControlsTarget();
    return Promise.resolve(window?.isMaximized() ?? false);
  });

  // 获取窗口是否处于全屏状态 / Get window full screen state
  ipcBridge.windowControls.isFullScreen.provider(() => {
    const window = resolveWindowControlsTarget();
    return Promise.resolve(window?.isFullScreen() ?? false);
  });

  // 为所有已存在的窗口注册监听器 / Register listeners for all existing windows
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    registerWindowMaximizeListeners(window);
  });
}
