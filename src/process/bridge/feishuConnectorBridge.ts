/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { FeishuConnectorService } from '@process/services/space/connectors/feishu/FeishuConnectorService';

const feishuConnectorService = new FeishuConnectorService();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const emitStatusChanged = async (): Promise<void> => {
  ipcBridge.feishuConnector.statusChanged.emit(await feishuConnectorService.getStatus());
};

export function initFeishuConnectorBridge(): void {
  ipcBridge.feishuConnector.getConfig.provider(async () => {
    try {
      return {
        success: true,
        data: await feishuConnectorService.getConfig(),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.feishuConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await feishuConnectorService.setConfig(config);
      await emitStatusChanged();
      return {
        success: true,
        data: next,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.feishuConnector.getStatus.provider(async () => {
    try {
      return {
        success: true,
        data: await feishuConnectorService.getStatus(),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.feishuConnector.start.provider(async () => {
    try {
      const status = await feishuConnectorService.start();
      await emitStatusChanged();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.feishuConnector.stop.provider(async () => {
    try {
      const status = await feishuConnectorService.stop();
      await emitStatusChanged();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
