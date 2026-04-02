/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

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
    createAuthRequest: vi.fn(),
    completeAuth: vi.fn(),
    listFiles: vi.fn(),
  },
  mockStoreService: {
    getStats: vi.fn(),
    syncFiles: vi.fn(),
    listStoredFiles: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    googleDriveConnector: {
      getConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getConfig = fn)) },
      setConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.setConfig = fn)) },
      getStatus: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getStatus = fn)) },
      start: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.start = fn)) },
      stop: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.stop = fn)) },
      createAuthRequest: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.createAuthRequest = fn)),
      },
      completeAuth: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.completeAuth = fn)),
      },
      listFiles: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listFiles = fn)) },
      syncNow: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.syncNow = fn)) },
      listStoredFiles: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listStoredFiles = fn)),
      },
      statusChanged: { emit: emitters.statusChanged },
    },
  },
}));

vi.mock('@process/services/space/connectors/googleDrive/GoogleDriveConnectorService', () => ({
  GoogleDriveConnectorService: vi.fn(
    class GoogleDriveConnectorServiceMock {
      getConfig = mockService.getConfig;
      setConfig = mockService.setConfig;
      getStatus = mockService.getStatus;
      start = mockService.start;
      stop = mockService.stop;
      createAuthRequest = mockService.createAuthRequest;
      completeAuth = mockService.completeAuth;
      listFiles = mockService.listFiles;
    }
  ),
}));

vi.mock('@process/services/space/connectors/googleDrive/GoogleDriveStoreService', () => ({
  GoogleDriveStoreService: vi.fn(
    class GoogleDriveStoreServiceMock {
      getStats = mockStoreService.getStats;
      syncFiles = mockStoreService.syncFiles;
      listStoredFiles = mockStoreService.listStoredFiles;
    }
  ),
}));

import { initGoogleDriveConnectorBridge } from '../../src/process/bridge/googleDriveConnectorBridge';

describe('googleDriveConnectorBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns config and starts sidecar', async () => {
    mockService.getConfig.mockResolvedValueOnce({ clientId: 'google-client-id.apps.googleusercontent.com' });
    mockService.start.mockResolvedValueOnce({ lifecycle: 'running' });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'running' });
    mockStoreService.getStats.mockResolvedValueOnce({ fileCount: 0, storeDir: '/tmp/google-drive' });
    initGoogleDriveConnectorBridge();

    await expect(handlers.getConfig?.({})).resolves.toEqual({
      success: true,
      data: { clientId: 'google-client-id.apps.googleusercontent.com' },
    });
    await expect(handlers.start?.({})).resolves.toEqual({ success: true, data: { lifecycle: 'running' } });
    expect(emitters.statusChanged).toHaveBeenCalledWith({
      lifecycle: 'running',
      fileCount: 0,
      storeDir: '/tmp/google-drive',
    });
  });

  it('syncs files into store and returns stored file list', async () => {
    mockService.listFiles.mockResolvedValueOnce([{ id: 'file-1', name: 'Roadmap' }]);
    mockStoreService.syncFiles.mockResolvedValueOnce({
      storedCount: 1,
      syncedAt: '2026-03-30T11:00:00.000Z',
      storeDir: '/tmp/google-drive',
    });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'stopped' });
    mockStoreService.getStats.mockResolvedValueOnce({ fileCount: 1, storeDir: '/tmp/google-drive' });
    mockStoreService.listStoredFiles.mockResolvedValueOnce([{ recordId: 'rec-1', name: 'Roadmap' }]);
    initGoogleDriveConnectorBridge();

    await expect(handlers.syncNow?.({ limit: 10 })).resolves.toEqual({
      success: true,
      data: { storedCount: 1, syncedAt: '2026-03-30T11:00:00.000Z', storeDir: '/tmp/google-drive' },
    });
    await expect(handlers.listStoredFiles?.({ limit: 10 })).resolves.toEqual({
      success: true,
      data: [{ recordId: 'rec-1', name: 'Roadmap' }],
    });
  });

  it('returns auth url payload and listed files', async () => {
    mockService.createAuthRequest.mockResolvedValueOnce({ authUrl: 'https://accounts.google.com', state: 'state-1' });
    mockService.listFiles.mockResolvedValueOnce([{ id: 'file-1', name: 'Doc A' }]);
    initGoogleDriveConnectorBridge();

    await expect(handlers.createAuthRequest?.({})).resolves.toEqual({
      success: true,
      data: { authUrl: 'https://accounts.google.com', state: 'state-1' },
    });
    await expect(handlers.listFiles?.({ limit: 5 })).resolves.toEqual({
      success: true,
      data: [{ id: 'file-1', name: 'Doc A' }],
    });
  });
});
