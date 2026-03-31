/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getCloudService } from '@process/services/cloud/CloudService';

export function initCloudBridge(): void {
  const cloudService = getCloudService();
  cloudService.initialize();

  ipcBridge.cloud.getStatus.provider(async () => {
    try {
      return {
        success: true,
        data: await cloudService.getStatus(),
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcBridge.cloud.startLogin.provider(async ({ provider }) => {
    try {
      return {
        success: true,
        data: await cloudService.startLogin(provider),
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcBridge.cloud.logout.provider(async () => {
    try {
      return {
        success: true,
        data: await cloudService.logout(),
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcBridge.cloud.syncNow.provider(async () => {
    try {
      return {
        success: true,
        data: await cloudService.syncNow(),
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
