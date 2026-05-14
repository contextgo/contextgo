export type BrowserActivitySource = 'browser-extension' | 'manual-import';

export type BrowserActivityEntry = {
  id: string;
  spaceId: string;
  sessionId?: string;
  url: string;
  title: string;
  textContent?: string;
  excerpt?: string;
  domain: string;
  visitedAt: string;
  source: BrowserActivitySource;
  tags: string[];
  metadata?: Record<string, string | number | boolean>;
};

export type BrowserActivityIngestInput = {
  spaceId: string;
  sessionId?: string;
  url: string;
  title: string;
  textContent?: string;
  excerpt?: string;
  visitedAt?: string;
  source?: BrowserActivitySource;
  tags?: string[];
  metadata?: Record<string, string | number | boolean>;
};

export type BrowserActivityIngestResult = {
  entry: BrowserActivityEntry;
  sourceId: string;
  documentId?: string;
  chunkCount: number;
  queuedDigestJobId?: string;
};

export type BrowserActivityConnectorStatus = {
  eventCount: number;
  latestVisitedAt?: string;
  latestDomain?: string;
  latestTitle?: string;
};
