export type GoogleSheetsConnectorConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  command: string;
  args: string[];
};

export type GoogleSheetsConnectorRuntimeStatus = {
  lifecycle: 'stopped' | 'running' | 'error';
  desiredState: 'stopped' | 'running';
  available: boolean;
  note: string;
  hasCredentials: boolean;
  hasCachedToken?: boolean;
  hasRefreshToken?: boolean;
  tokenExpiry?: string;
  tokenScope?: string;
  command?: string;
  args?: string[];
  pid?: number;
  tokenCachePath?: string;
  sheetCount?: number;
  lastSyncedAt?: string;
  storeDir?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
};

export type GoogleSheet = {
  id: string;
  title: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  ownerNames?: string[];
  sizeBytes?: number;
  starred?: boolean;
  trashed?: boolean;
};

export type GoogleSheetsStoredSpreadsheet = {
  recordId: string;
  spreadsheetId: string;
  title: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  ownerNames?: string[];
  sizeBytes?: number;
  starred?: boolean;
  trashed?: boolean;
  syncedAt: string;
};

export type GoogleSheetsSyncResult = {
  storedCount: number;
  syncedAt: string;
  storeDir: string;
};
