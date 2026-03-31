/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { GoogleDriveConnectorService } from '@process/services/space/connectors/googleDrive/GoogleDriveConnectorService';
import { GoogleDriveStoreService } from '@process/services/space/connectors/googleDrive/GoogleDriveStoreService';

const googleDriveConnectorService = new GoogleDriveConnectorService();
const googleDriveStoreService = new GoogleDriveStoreService();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const emitStatusChanged = async (): Promise<void> => {
  const [status, storeStats] = await Promise.all([
    googleDriveConnectorService.getStatus(),
    googleDriveStoreService.getStats(),
  ]);
  ipcBridge.googleDriveConnector.statusChanged.emit({
    ...status,
    ...storeStats,
  });
};

export function initGoogleDriveConnectorBridge(): void {
  ipcBridge.googleDriveConnector.getConfig.provider(async () => {
    try {
      return { success: true, data: await googleDriveConnectorService.getConfig() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await googleDriveConnectorService.setConfig(config);
      await emitStatusChanged();
      return { success: true, data: next };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.getStatus.provider(async () => {
    try {
      const [status, storeStats] = await Promise.all([
        googleDriveConnectorService.getStatus(),
        googleDriveStoreService.getStats(),
      ]);
      return { success: true, data: { ...status, ...storeStats } };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.start.provider(async () => {
    try {
      const status = await googleDriveConnectorService.start();
      await emitStatusChanged();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.stop.provider(async () => {
    try {
      const status = await googleDriveConnectorService.stop();
      await emitStatusChanged();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.createAuthRequest.provider(async () => {
    try {
      return { success: true, data: await googleDriveConnectorService.createAuthRequest() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.completeAuth.provider(async (params) => {
    try {
      const result = await googleDriveConnectorService.completeAuth(params);
      await emitStatusChanged();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.listFiles.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await googleDriveConnectorService.listFiles(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.syncNow.provider(async ({ limit } = {}) => {
    try {
      const files = await googleDriveConnectorService.listFiles(limit);
      const result = await googleDriveStoreService.syncFiles(files);
      await emitStatusChanged();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDriveConnector.listStoredFiles.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await googleDriveStoreService.listStoredFiles(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
