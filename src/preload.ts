/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ADAPTER_BRIDGE_EVENT_KEY } from './common/adapter/constant';

/**
 * @description 注入到renderer进程中, 用于与main进程通信
 * */
contextBridge.exposeInMainWorld('electronAPI', {
  emit: (name: string, data: any) => {
    return ipcRenderer
      .invoke(
        ADAPTER_BRIDGE_EVENT_KEY,
        JSON.stringify({
          name: name,
          data: data,
        })
      )
      .catch((error) => {
        console.error('IPC invoke error:', error);
        throw error;
      });
  },
  on: (callback: any) => {
    const handler = (event: any, value: any) => {
      callback({ event, value });
    };
    ipcRenderer.on(ADAPTER_BRIDGE_EVENT_KEY, handler);
    return () => {
      ipcRenderer.off(ADAPTER_BRIDGE_EVENT_KEY, handler);
    };
  },
  // 获取拖拽文件/目录的绝对路径 / Get absolute path for dragged file/directory
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  // 直接 IPC: 打开外部链接 / Direct IPC: Open external URL
  shellOpenExternal: (url: string) => ipcRenderer.invoke('shell-direct-open-external', { url }),
  // WeChat login IPC
  weixinLoginStart: () => ipcRenderer.invoke('weixin:login:start'),
  weixinLoginOnQR: (callback: (data: { qrcodeUrl: string }) => void) => {
    const h = (_event: unknown, data: { qrcodeUrl: string }) => callback(data);
    ipcRenderer.on('weixin:login:qr', h);
    return () => ipcRenderer.off('weixin:login:qr', h);
  },
  weixinLoginOnScanned: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('weixin:login:scanned', h);
    return () => ipcRenderer.off('weixin:login:scanned', h);
  },
  weixinLoginOnDone: (callback: (data: { accountId: string; scannerUserId?: string }) => void) => {
    const h = (_event: unknown, data: { accountId: string; scannerUserId?: string }) => callback(data);
    ipcRenderer.on('weixin:login:done', h);
    return () => ipcRenderer.off('weixin:login:done', h);
  },
});

// 托盘事件监听 - 将 IPC 事件转换为 DOM 事件
// Tray event listeners - convert IPC events to DOM events
const trayEvents = [
  'tray:navigate-to-guid',
  'tray:navigate-to-conversation',
  'tray:open-about',
  'tray:pause-all-tasks',
  'tray:check-update',
];

for (const channel of trayEvents) {
  ipcRenderer.on(channel, (_event, ...args) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: args[0] }));
  });
}
