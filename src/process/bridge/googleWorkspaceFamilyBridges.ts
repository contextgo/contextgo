import { ipcBridge } from '@/common';
import { GoogleSheetsConnectorService } from '@process/services/space/connectors/googleWorkspace/GoogleSheetsConnectorService';
import { GoogleSheetsStoreService } from '@process/services/space/connectors/googleWorkspace/GoogleSheetsStoreService';
import { GmailConnectorService } from '@process/services/space/connectors/googleWorkspace/GmailConnectorService';
import { GmailStoreService } from '@process/services/space/connectors/googleWorkspace/GmailStoreService';
import { GoogleCalendarConnectorService } from '@process/services/space/connectors/googleWorkspace/GoogleCalendarConnectorService';
import { GoogleCalendarStoreService } from '@process/services/space/connectors/googleWorkspace/GoogleCalendarStoreService';

const sheetsService = new GoogleSheetsConnectorService();
const sheetsStore = new GoogleSheetsStoreService();
const gmailService = new GmailConnectorService();
const gmailStore = new GmailStoreService();
const calendarService = new GoogleCalendarConnectorService();
const calendarStore = new GoogleCalendarStoreService();

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function initGoogleSheetsConnectorBridge(): void {
  const emit = async (): Promise<void> => {
    const [status, stats] = await Promise.all([sheetsService.getStatus(), sheetsStore.getStats()]);
    ipcBridge.googleSheetsConnector.statusChanged.emit({ ...status, ...stats });
  };
  ipcBridge.googleSheetsConnector.getConfig.provider(async () => {
    try {
      return { success: true, data: await sheetsService.getConfig() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await sheetsService.setConfig(config);
      await emit();
      return { success: true, data: next };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.getStatus.provider(async () => {
    try {
      const [status, stats] = await Promise.all([sheetsService.getStatus(), sheetsStore.getStats()]);
      return { success: true, data: { ...status, ...stats } };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.start.provider(async () => {
    try {
      const status = await sheetsService.start();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.stop.provider(async () => {
    try {
      const status = await sheetsService.stop();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.listSheets.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await sheetsService.listSpreadsheets(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.syncNow.provider(async ({ limit } = {}) => {
    try {
      const rows = await sheetsService.listSpreadsheets(limit);
      const result = await sheetsStore.syncSpreadsheets(rows);
      await emit();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleSheetsConnector.listStoredSheets.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await sheetsStore.listStoredSpreadsheets(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}

export function initGmailConnectorBridge(): void {
  const emit = async (): Promise<void> => {
    const [status, stats] = await Promise.all([gmailService.getStatus(), gmailStore.getStats()]);
    ipcBridge.gmailConnector.statusChanged.emit({ ...status, ...stats });
  };
  ipcBridge.gmailConnector.getConfig.provider(async () => {
    try {
      return { success: true, data: await gmailService.getConfig() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await gmailService.setConfig(config);
      await emit();
      return { success: true, data: next };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.getStatus.provider(async () => {
    try {
      const [status, stats] = await Promise.all([gmailService.getStatus(), gmailStore.getStats()]);
      return { success: true, data: { ...status, ...stats } };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.start.provider(async () => {
    try {
      const status = await gmailService.start();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.stop.provider(async () => {
    try {
      const status = await gmailService.stop();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.listMessages.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await gmailService.listMessages(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.syncNow.provider(async ({ limit } = {}) => {
    try {
      const rows = await gmailService.listMessages(limit);
      const result = await gmailStore.syncMessages(rows);
      await emit();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.gmailConnector.listStoredMessages.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await gmailStore.listStoredMessages(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}

export function initGoogleCalendarConnectorBridge(): void {
  const emit = async (): Promise<void> => {
    const [status, stats] = await Promise.all([calendarService.getStatus(), calendarStore.getStats()]);
    ipcBridge.googleCalendarConnector.statusChanged.emit({ ...status, ...stats });
  };
  ipcBridge.googleCalendarConnector.getConfig.provider(async () => {
    try {
      return { success: true, data: await calendarService.getConfig() };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.setConfig.provider(async ({ config }) => {
    try {
      const next = await calendarService.setConfig(config);
      await emit();
      return { success: true, data: next };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.getStatus.provider(async () => {
    try {
      const [status, stats] = await Promise.all([calendarService.getStatus(), calendarStore.getStats()]);
      return { success: true, data: { ...status, ...stats } };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.start.provider(async () => {
    try {
      const status = await calendarService.start();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.stop.provider(async () => {
    try {
      const status = await calendarService.stop();
      await emit();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.listCalendars.provider(async () => {
    try {
      return { success: true, data: [...(await calendarService.listCalendars())] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.syncNow.provider(async () => {
    try {
      const rows = await calendarService.listCalendars();
      const result = await calendarStore.syncCalendars(rows);
      await emit();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
  ipcBridge.googleCalendarConnector.listStoredCalendars.provider(async ({ limit } = {}) => {
    try {
      return { success: true, data: [...(await calendarStore.listStoredCalendars(limit))] };
    } catch (error) {
      return { success: false, msg: toErrorMessage(error) };
    }
  });
}
