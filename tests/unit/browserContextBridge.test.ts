/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, mockService } = vi.hoisted(() => ({
  handlers: {} as Record<string, ((payload: unknown) => Promise<unknown>) | undefined>,
  mockService: {
    listBySpace: vi.fn(),
    getAsset: vi.fn(),
    createAsset: vi.fn(),
    updateConsent: vi.fn(),
    revokeAsset: vi.fn(),
    assertBindableToSpace: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    browserContext: {
      listBySpace: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.listBySpace = fn)) },
      get: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.get = fn)) },
      create: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.create = fn)) },
      updateConsent: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.updateConsent = fn)),
      },
      revoke: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.revoke = fn)) },
      assertBindable: {
        provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.assertBindable = fn)),
      },
    },
  },
}));

vi.mock('@process/services/space/browser/BrowserContextAssetService', () => ({
  BrowserContextAssetService: vi.fn(
    class BrowserContextAssetServiceMock {
      listBySpace = mockService.listBySpace;
      getAsset = mockService.getAsset;
      createAsset = mockService.createAsset;
      updateConsent = mockService.updateConsent;
      revokeAsset = mockService.revokeAsset;
      assertBindableToSpace = mockService.assertBindableToSpace;
    }
  ),
}));

import { initBrowserContextBridge } from '../../src/process/bridge/browserContextBridge';

describe('browserContextBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns listed assets for the requested space', async () => {
    mockService.listBySpace.mockResolvedValueOnce([{ id: 'asset-1', spaceId: 'space-alpha' }]);
    initBrowserContextBridge();

    const response = await handlers.listBySpace?.({ spaceId: 'space-alpha' });

    expect(mockService.listBySpace).toHaveBeenCalledWith('space-alpha', undefined);
    expect(response).toEqual({
      success: true,
      data: [{ id: 'asset-1', spaceId: 'space-alpha' }],
    });
  });

  it('returns a failed response when asset creation throws', async () => {
    mockService.createAsset.mockRejectedValueOnce(new Error('bad create'));
    initBrowserContextBridge();

    const response = await handlers.create?.({ spaceId: 'space-alpha', label: 'Browser A', kind: 'managed' });

    expect(response).toEqual({
      success: false,
      msg: 'bad create',
    });
  });
});
