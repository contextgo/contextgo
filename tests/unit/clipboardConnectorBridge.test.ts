/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, emitters, mockService, mockStoreService } = vi.hoisted(() => ({
  handlers: {} as Record<string, ((payload: unknown) => Promise<unknown>) | undefined>,
  emitters: {
    statusChanged: vi.fn(),
  },
  mockService: {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    sampleNow: vi.fn(),
  },
  mockStoreService: {
    getStats: vi.fn(),
    recordManualSnapshot: vi.fn(),
    listRecentEvents: vi.fn(),
    listSummaries: vi.fn(),
    collectDailySummary: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    clipboardConnector: {
      getConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getConfig = fn)) },
      setConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.setConfig = fn)) },
      getStatus: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getStatus = fn)) },
      start: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.start = fn)) },
      stop: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.stop = fn)) },
      sampleNow: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.sampleNow = fn)) },
      listRecentEvents: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listRecentEvents = fn)) },
      listSummaries: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listSummaries = fn)) },
      collectNow: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.collectNow = fn)) },
      statusChanged: { emit: emitters.statusChanged },
    },
  },
}));

vi.mock('@process/services/space/connectors/clipboard/ClipboardConnectorService', () => ({
  ClipboardConnectorService: vi.fn(
    class ClipboardConnectorServiceMock {
      getConfig = mockService.getConfig;
      setConfig = mockService.setConfig;
      getStatus = mockService.getStatus;
      start = mockService.start;
      stop = mockService.stop;
      sampleNow = mockService.sampleNow;
    }
  ),
}));


vi.mock('@process/services/space/connectors/clipboard/ClipboardStoreService', () => ({
  ClipboardStoreService: vi.fn(
    class ClipboardStoreServiceMock {
      getStats = mockStoreService.getStats;
      recordManualSnapshot = mockStoreService.recordManualSnapshot;
      listRecentEvents = mockStoreService.listRecentEvents;
      listSummaries = mockStoreService.listSummaries;
      collectDailySummary = mockStoreService.collectDailySummary;
    }
  ),
}));

import { initClipboardConnectorBridge } from '../../src/process/bridge/clipboardConnectorBridge';

describe('clipboardConnectorBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns clipboard config', async () => {
    mockService.getConfig.mockResolvedValueOnce({ enabled: false, mode: 'macos-pasteboard' });
    initClipboardConnectorBridge();

    const response = await handlers.getConfig?.({});

    expect(response).toEqual({
      success: true,
      data: { enabled: false, mode: 'macos-pasteboard' },
    });
  });

  it('updates config and emits status', async () => {
    mockService.setConfig.mockResolvedValueOnce({ enabled: true, mode: 'macos-pasteboard' });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'stopped', desiredState: 'stopped' });
    mockStoreService.getStats.mockResolvedValueOnce({ eventCount: 1, summaryCount: 0 });
    initClipboardConnectorBridge();

    const response = await handlers.setConfig?.({
      config: { enabled: true },
    });

    expect(mockService.setConfig).toHaveBeenCalledWith({ enabled: true });
    expect(emitters.statusChanged).toHaveBeenCalledWith({ lifecycle: 'stopped', desiredState: 'stopped', eventCount: 1, summaryCount: 0 });
    expect(response).toEqual({
      success: true,
      data: { enabled: true, mode: 'macos-pasteboard' },
    });
  });

  it('starts the runtime and emits the returned status', async () => {
    mockService.start.mockResolvedValueOnce({ lifecycle: 'running', desiredState: 'running' });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'running', desiredState: 'running' });
    mockStoreService.getStats.mockResolvedValueOnce({ eventCount: 0, summaryCount: 0 });
    initClipboardConnectorBridge();

    const response = await handlers.start?.({});

    expect(emitters.statusChanged).toHaveBeenCalledWith({ lifecycle: 'running', desiredState: 'running', eventCount: 0, summaryCount: 0 });
    expect(response).toEqual({
      success: true,
      data: { lifecycle: 'running', desiredState: 'running' },
    });
  });


  it('returns recent events from ContextGo store', async () => {
    mockStoreService.listRecentEvents.mockResolvedValueOnce([{ id: 'evt-1', textPreview: 'hello' }]);
    initClipboardConnectorBridge();

    const response = await handlers.listRecentEvents?.({ limit: 5 });

    expect(response).toEqual({
      success: true,
      data: [{ id: 'evt-1', textPreview: 'hello' }],
    });
  });

  it('collects daily summaries through the ContextGo store service', async () => {
    mockStoreService.collectDailySummary.mockResolvedValueOnce({ eventCount: 2, summaryCount: 1, importedEvents: 1, summary: { id: 'sum-1' } });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'running', desiredState: 'running' });
    mockStoreService.getStats.mockResolvedValueOnce({ eventCount: 2, summaryCount: 1 });
    initClipboardConnectorBridge();

    const response = await handlers.collectNow?.({ summaryDate: '2026-03-30' });

    expect(mockStoreService.collectDailySummary).toHaveBeenCalledWith('2026-03-30');
    expect(response).toEqual({
      success: true,
      data: { eventCount: 2, summaryCount: 1, importedEvents: 1, summary: { id: 'sum-1' } },
    });
  });

  it('returns failures from sampleNow', async () => {
    mockService.sampleNow.mockRejectedValueOnce(new Error('sample failed'));
    initClipboardConnectorBridge();

    const response = await handlers.sampleNow?.({});

    expect(response).toEqual({
      success: false,
      msg: 'sample failed',
    });
  });
});
