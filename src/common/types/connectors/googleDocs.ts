export type GoogleDocsConnectorConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  command: string;
  args: string[];
};

export type GoogleDocsConnectorRuntimeStatus = {
  lifecycle: 'stopped' | 'running' | 'error';
  desiredState: 'stopped' | 'running';
  available: boolean;
  note: string;
  hasCredentials: boolean;
  command?: string;
  args?: string[];
  pid?: number;
  tokenCachePath?: string;
  hasCachedToken?: boolean;
  hasRefreshToken?: boolean;
  tokenExpiry?: string;
  tokenScope?: string;
  docCount?: number;
  lastSyncedAt?: string;
  storeDir?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
};

export type GoogleDoc = {
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

export type GoogleDocsStoredDocument = {
  recordId: string;
  documentId: string;
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

export type GoogleDocsStoreStats = {
  docCount: number;
  lastSyncedAt?: string;
  storeDir: string;
};

export type GoogleDocsSyncResult = {
  storedCount: number;
  syncedAt: string;
  storeDir: string;
};
