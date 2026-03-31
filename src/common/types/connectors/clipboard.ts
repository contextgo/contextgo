export type ClipboardConnectorMode = 'macos-pasteboard';

export type ClipboardConnectorConfig = {
  enabled: boolean;
  mode: ClipboardConnectorMode;
  pollIntervalMs: number;
  retainFullText: boolean;
  maxTextBytes: number;
  retentionDays: number;
  dedupeWindowSeconds: number;
  ignoreApps: string[];
  ignorePatterns: string[];
};

export type ClipboardConnectorLifecycle = 'stopped' | 'running' | 'error';

export type ClipboardConnectorRuntimeStatus = {
  lifecycle: ClipboardConnectorLifecycle;
  desiredState: 'stopped' | 'running';
  available: boolean;
  runtimeSource: 'connector-repo';
  note: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastSampleAt?: number;
  lastError?: string;
  observerPid?: number;
  observerRepoDir?: string;
  observerCommand?: string;
  eventCount?: number;
  summaryCount?: number;
  lastCapturedAt?: string;
  lastCollectedAt?: string;
  storeDir?: string;
};

export type ClipboardConnectorSnapshot = {
  text: string;
  truncated: boolean;
  textBytes: number;
  capturedAt: number;
  source: 'pbpaste';
};

export type ClipboardStoredEvent = {
  id: string;
  capturedAt: string;
  contentType: string;
  textPreview?: string;
  textHash: string;
  sizeBytes: number;
  sourceApp?: string;
  observerId: string;
  source: 'contextgo-sample' | 'connector-import';
  storedAt: string;
};

export type ClipboardDomainCount = {
  domain: string;
  count: number;
};

export type ClipboardDailySummary = {
  id: string;
  summaryDate: string;
  eventCount: number;
  uniqueHashCount: number;
  topDomains: ClipboardDomainCount[];
  generatedAt: string;
  source: 'contextgo-collect' | 'contextgo-collect+connector-import';
};

export type ClipboardStoreStats = {
  eventCount: number;
  summaryCount: number;
  lastCapturedAt?: string;
  lastCollectedAt?: string;
  storeDir?: string;
};

export type ClipboardCollectResult = {
  summary: ClipboardDailySummary;
  importedEvents: number;
  eventCount: number;
  summaryCount: number;
};
