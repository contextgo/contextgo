import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, emitters, mockService, mockStoreService } = vi.hoisted(() => ({
  handlers: {} as Record<string, ((payload: unknown) => Promise<unknown>) | undefined>,
  emitters: { statusChanged: vi.fn() },
  mockService: {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    listMessages: vi.fn(),
  },
  mockStoreService: {
    getStats: vi.fn(),
    syncMessages: vi.fn(),
    listStoredMessages: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    gmailConnector: {
      getConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getConfig = fn)) },
      setConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.setConfig = fn)) },
      getStatus: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getStatus = fn)) },
      start: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.start = fn)) },
      stop: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.stop = fn)) },
      listMessages: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listMessages = fn)) },
      syncNow: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.syncNow = fn)) },
      listStoredMessages: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listStoredMessages = fn)),
      },
      statusChanged: { emit: emitters.statusChanged },
    },
  },
}));

vi.mock('@process/services/space/connectors/googleWorkspace/GmailConnectorService', () => ({
  GmailConnectorService: vi.fn(
    class GmailConnectorServiceMock {
      getConfig = mockService.getConfig;
      setConfig = mockService.setConfig;
      getStatus = mockService.getStatus;
      start = mockService.start;
      stop = mockService.stop;
      listMessages = mockService.listMessages;
    }
  ),
}));

vi.mock('@process/services/space/connectors/googleWorkspace/GmailStoreService', () => ({
  GmailStoreService: vi.fn(
    class GmailStoreServiceMock {
      getStats = mockStoreService.getStats;
      syncMessages = mockStoreService.syncMessages;
      listStoredMessages = mockStoreService.listStoredMessages;
    }
  ),
}));

import { initGmailConnectorBridge } from '../../src/process/bridge/googleWorkspaceFamilyBridges';

describe('gmailConnectorBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns config and starts sidecar', async () => {
    mockService.getConfig.mockResolvedValueOnce({ clientId: 'gmail-client-id' });
    mockService.start.mockResolvedValueOnce({ lifecycle: 'running' });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'running' });
    mockStoreService.getStats.mockResolvedValueOnce({ messageCount: 0, storeDir: '/tmp/gmail-store' });
    initGmailConnectorBridge();

    await expect(handlers.getConfig?.({})).resolves.toEqual({
      success: true,
      data: { clientId: 'gmail-client-id' },
    });
    await expect(handlers.start?.({})).resolves.toEqual({ success: true, data: { lifecycle: 'running' } });
    expect(emitters.statusChanged).toHaveBeenCalledWith({
      lifecycle: 'running',
      messageCount: 0,
      storeDir: '/tmp/gmail-store',
    });
  });

  it('lists and syncs gmail messages', async () => {
    mockService.listMessages.mockResolvedValueOnce([{ id: 'msg-1', subject: 'Hello' }]);
    mockStoreService.syncMessages.mockResolvedValueOnce({
      storedCount: 1,
      syncedAt: '2026-03-31T10:00:00.000Z',
      storeDir: '/tmp/gmail-store',
    });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'stopped' });
    mockStoreService.getStats.mockResolvedValueOnce({ messageCount: 1, storeDir: '/tmp/gmail-store' });
    mockStoreService.listStoredMessages.mockResolvedValueOnce([{ recordId: 'rec-1', subject: 'Hello' }]);
    initGmailConnectorBridge();

    await expect(handlers.listMessages?.({ limit: 10 })).resolves.toEqual({
      success: true,
      data: [{ id: 'msg-1', subject: 'Hello' }],
    });
    await expect(handlers.syncNow?.({ limit: 10 })).resolves.toEqual({
      success: true,
      data: { storedCount: 1, syncedAt: '2026-03-31T10:00:00.000Z', storeDir: '/tmp/gmail-store' },
    });
    await expect(handlers.listStoredMessages?.({ limit: 10 })).resolves.toEqual({
      success: true,
      data: [{ recordId: 'rec-1', subject: 'Hello' }],
    });
  });
});
