import { ipcBridge } from '@/common';
import { GoogleDocsConnectorService } from '@process/services/space/connectors/googleDocs/GoogleDocsConnectorService';
import { GoogleDocsStoreService } from '@process/services/space/connectors/googleDocs/GoogleDocsStoreService';

const googleDocsConnectorService = new GoogleDocsConnectorService();
const googleDocsStoreService = new GoogleDocsStoreService();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const emitStatusChanged = async (): Promise<void> => {
  const [status, storeStats] = await Promise.all([
    googleDocsConnectorService.getStatus(),
    googleDocsStoreService.getStats(),
  ]);
  ipcBridge.googleDocsConnector.statusChanged.emit({ ...status, ...storeStats });
};

export function initGoogleDocsConnectorBridge(): void {
  ipcBridge.googleDocsConnector.getConfig.provider(async () => {
    try {
      return { success: true, data: await googleDocsConnectorService.getConfig() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await googleDocsConnectorService.setConfig(config);
      await emitStatusChanged();
      return { success: true, data: next };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.getStatus.provider(async () => {
    try {
      const [status, storeStats] = await Promise.all([
        googleDocsConnectorService.getStatus(),
        googleDocsStoreService.getStats(),
      ]);
      return { success: true, data: { ...status, ...storeStats } };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.start.provider(async () => {
    try {
      const status = await googleDocsConnectorService.start();
      await emitStatusChanged();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.stop.provider(async () => {
    try {
      const status = await googleDocsConnectorService.stop();
      await emitStatusChanged();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.listDocs.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await googleDocsConnectorService.listDocuments(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.syncNow.provider(async ({ limit } = {}) => {
    try {
      const docs = await googleDocsConnectorService.listDocuments(limit);
      const result = await googleDocsStoreService.syncDocuments(docs);
      await emitStatusChanged();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });

  ipcBridge.googleDocsConnector.listStoredDocs.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await googleDocsStoreService.listStoredDocuments(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
