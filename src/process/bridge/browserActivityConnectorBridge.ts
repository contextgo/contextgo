/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { contextEventBus, contextService } from '@process/services/context/contextServiceSingleton';
import { BrowserActivityConnectorService } from '@process/services/space/browser/activity/BrowserActivityConnectorService';
import { BrowserActivityStoreService } from '@process/services/space/browser/activity/BrowserActivityStoreService';

const browserActivityConnectorService = new BrowserActivityConnectorService(
  new BrowserActivityStoreService(),
  contextService,
  contextEventBus
);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export function initBrowserActivityConnectorBridge(): void {
  ipcBridge.browserActivityConnector.ingest.provider(async (payload) => {
    try {
      return {
        success: true,
        data: await browserActivityConnectorService.ingest(payload),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserActivityConnector.listRecent.provider(async ({ spaceId, limit }) => {
    try {
      return {
        success: true,
        data: await browserActivityConnectorService.listRecent(spaceId, limit),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserActivityConnector.getStatus.provider(async ({ spaceId }) => {
    try {
      return {
        success: true,
        data: await browserActivityConnectorService.getStatus(spaceId),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
