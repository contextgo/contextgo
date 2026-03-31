export type GmailConnectorConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  command: string;
  args: string[];
};

export type GmailConnectorRuntimeStatus = {
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
  messageCount?: number;
  lastSyncedAt?: string;
  storeDir?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
};

export type GmailStoredMessage = GmailMessage & {
  recordId: string;
  syncedAt: string;
};

export type GmailSyncResult = {
  storedCount: number;
  syncedAt: string;
  storeDir: string;
};
