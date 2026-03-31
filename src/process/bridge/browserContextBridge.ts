/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { BrowserContextAssetService } from '@process/services/space/browser/BrowserContextAssetService';

const browserContextAssetService = new BrowserContextAssetService();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export function initBrowserContextBridge(): void {
  ipcBridge.browserContext.listBySpace.provider(async ({ spaceId, includeRevoked }) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.listBySpace(spaceId, includeRevoked),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.get.provider(async ({ id }) => {
    try {
      const asset = await browserContextAssetService.getAsset(id);
      if (!asset) {
        return { success: false, msg: `Browser context asset not found: ${id}` };
      }
      return { success: true, data: asset };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.create.provider(async (params) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.createAsset(params),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.update.provider(async (params) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.updateAsset(params),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.updateConsent.provider(async (params) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.updateConsent(params),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.revoke.provider(async ({ id }) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.revokeAsset(id),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.browserContext.assertBindable.provider(async ({ id, spaceId }) => {
    try {
      return {
        success: true,
        data: await browserContextAssetService.assertBindableToSpace(spaceId, id),
      };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
