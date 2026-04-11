/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, mockService } = vi.hoisted(() => ({
  handlers: {} as Record<string, ((payload: unknown) => Promise<unknown>) | undefined>,
  mockService: {
    ingest: vi.fn(),
    listRecent: vi.fn(),
    getStatus: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    browserActivityConnector: {
      ingest: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.ingest = fn)) },
      listRecent: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listRecent = fn)) },
      getStatus: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getStatus = fn)) },
    },
  },
}));

vi.mock('@process/services/context/contextServiceSingleton', () => ({
  contextEventBus: {},
  contextService: {},
}));

vi.mock('@process/services/space/browser/activity/BrowserActivityStoreService', () => ({
  BrowserActivityStoreService: vi.fn(class BrowserActivityStoreServiceMock {}),
}));

vi.mock('@process/services/space/browser/activity/BrowserActivityConnectorService', () => ({
  BrowserActivityConnectorService: vi.fn(
    class BrowserActivityConnectorServiceMock {
      ingest = mockService.ingest;
      listRecent = mockService.listRecent;
      getStatus = mockService.getStatus;
    }
  ),
}));

import { initBrowserActivityConnectorBridge } from '../../../../src/process/bridge/browserActivityConnectorBridge';

describe('browserActivityConnectorBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns ingested browser activity payloads', async () => {
    mockService.ingest.mockResolvedValueOnce({ entry: { id: 'entry-1' }, sourceId: 'source-1', chunkCount: 2 });
    initBrowserActivityConnectorBridge();

    const response = await handlers.ingest?.({
      spaceId: 'space-1',
      url: 'https://example.com',
      title: 'Example',
    });

    expect(mockService.ingest).toHaveBeenCalledWith({
      spaceId: 'space-1',
      url: 'https://example.com',
      title: 'Example',
    });
    expect(response).toEqual({
      success: true,
      data: { entry: { id: 'entry-1' }, sourceId: 'source-1', chunkCount: 2 },
    });
  });

  it('lists recent browser activity for a space', async () => {
    mockService.listRecent.mockResolvedValueOnce([{ id: 'entry-1', spaceId: 'space-1' }]);
    initBrowserActivityConnectorBridge();

    const response = await handlers.listRecent?.({ spaceId: 'space-1', limit: 5 });

    expect(mockService.listRecent).toHaveBeenCalledWith('space-1', 5);
    expect(response).toEqual({
      success: true,
      data: [{ id: 'entry-1', spaceId: 'space-1' }],
    });
  });

  it('returns a failed response when status lookup throws', async () => {
    mockService.getStatus.mockRejectedValueOnce(new Error('status unavailable'));
    initBrowserActivityConnectorBridge();

    const response = await handlers.getStatus?.({ spaceId: 'space-1' });

    expect(response).toEqual({
      success: false,
      msg: 'status unavailable',
    });
  });
});
