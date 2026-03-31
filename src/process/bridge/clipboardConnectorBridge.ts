/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ClipboardConnectorService } from '@process/services/space/connectors/clipboard/ClipboardConnectorService';
import { ClipboardStoreService } from '@process/services/space/connectors/clipboard/ClipboardStoreService';

const clipboardConnectorService = new ClipboardConnectorService();
const clipboardStoreService = new ClipboardStoreService();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const emitStatusChanged = async (): Promise<void> => {
  const [status, stats] = await Promise.all([clipboardConnectorService.getStatus(), clipboardStoreService.getStats()]);
  ipcBridge.clipboardConnector.statusChanged.emit({
    ...status,
    ...stats,
  });
};

export function initClipboardConnectorBridge(): void {
  ipcBridge.clipboardConnector.getConfig.provider(async () => {
    try {
      return {
        success: true,
        data: await clipboardConnectorService.getConfig(),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.setConfig.provider(async ({ config }) => {
    try {
      const nextConfig = await clipboardConnectorService.setConfig(config);
      await emitStatusChanged();
      return {
        success: true,
        data: nextConfig,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.getStatus.provider(async () => {
    try {
      const [status, stats] = await Promise.all([
        clipboardConnectorService.getStatus(),
        clipboardStoreService.getStats(),
      ]);
      return {
        success: true,
        data: {
          ...status,
          ...stats,
        },
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.start.provider(async () => {
    try {
      const status = await clipboardConnectorService.start();
      await emitStatusChanged();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.stop.provider(async () => {
    try {
      const status = await clipboardConnectorService.stop();
      await emitStatusChanged();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.sampleNow.provider(async () => {
    try {
      const snapshot = await clipboardConnectorService.sampleNow();
      if (snapshot) {
        await clipboardStoreService.recordManualSnapshot(snapshot);
      }
      await emitStatusChanged();
      return {
        success: true,
        data: snapshot,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.listRecentEvents.provider(async (payload = {}) => {
    const { limit } = payload;
    try {
      return {
        success: true,
        data: [...(await clipboardStoreService.listRecentEvents(limit))],
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.listSummaries.provider(async (payload = {}) => {
    const { limit } = payload;
    try {
      return {
        success: true,
        data: [...(await clipboardStoreService.listSummaries(limit))],
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.clipboardConnector.collectNow.provider(async (payload = {}) => {
    const { summaryDate } = payload;
    try {
      const result = await clipboardStoreService.collectDailySummary(summaryDate);
      await emitStatusChanged();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
