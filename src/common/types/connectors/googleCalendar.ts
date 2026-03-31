export type GoogleCalendarConnectorConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  command: string;
  args: string[];
};

export type GoogleCalendarConnectorRuntimeStatus = {
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
  calendarCount?: number;
  lastSyncedAt?: string;
  storeDir?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
};

export type GoogleCalendarEntry = {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  accessRole?: string;
  primary?: boolean;
  backgroundColor?: string;
};

export type GoogleCalendarStoredEntry = GoogleCalendarEntry & {
  recordId: string;
  syncedAt: string;
};

export type GoogleCalendarSyncResult = {
  storedCount: number;
  syncedAt: string;
  storeDir: string;
};
