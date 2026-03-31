export type GoogleDriveConnectorConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  command: string;
  args: string[];
};

export type GoogleDriveConnectorRuntimeStatus = {
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
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
  fileCount?: number;
  lastSyncedAt?: string;
  storeDir?: string;
};

export type GoogleDriveAuthRequest = {
  authUrl: string;
  state: string;
  redirectUri: string;
  tokenCachePath: string;
};

export type GoogleDriveAuthResult = {
  tokenCachePath: string;
  scopeCount: number;
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  modifiedByMeTime?: string;
  webViewLink?: string;
  iconLink?: string;
  driveId?: string;
  parents?: string[];
  ownerNames?: string[];
  sizeBytes?: number;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
};

export type GoogleDriveStoredFile = {
  recordId: string;
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  modifiedByMeTime?: string;
  webViewLink?: string;
  iconLink?: string;
  driveId?: string;
  parents?: string[];
  ownerNames?: string[];
  sizeBytes?: number;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
  syncedAt: string;
};

export type GoogleDriveStoreStats = {
  fileCount: number;
  lastSyncedAt?: string;
  storeDir: string;
};

export type GoogleDriveSyncResult = {
  storedCount: number;
  syncedAt: string;
  storeDir: string;
};
