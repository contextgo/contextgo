/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ExternalConnectorCatalogRuntimeService } from '@process/services/space/connectors/catalog/ExternalConnectorCatalogRuntimeService';

const runtimeService = new ExternalConnectorCatalogRuntimeService();

export function initExternalConnectorCatalogBridge(): void {
  ipcBridge.externalConnectorCatalog.getDetails.provider(async ({ connector }) => {
    try {
      const details = await runtimeService.getConnectorDetails(connector);
      return {
        success: true,
        data: details,
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
