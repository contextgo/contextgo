/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: vi.fn(async () => []),
    set: vi.fn(async (_key: string, value: unknown) => value),
  },
}));

import type { IConfigStorageRefer, TBrowserContextAsset } from '../../src/common/config/storage';
import { BrowserContextAssetService } from '../../src/process/services/space/browser/BrowserContextAssetService';

type BrowserContextStore = {
  get: <K extends 'browser.context.assets'>(key: K) => Promise<IConfigStorageRefer[K]>;
  set: <K extends 'browser.context.assets'>(key: K, value: IConfigStorageRefer[K]) => Promise<IConfigStorageRefer[K]>;
  snapshot: () => TBrowserContextAsset[];
};

function createStore(initial: TBrowserContextAsset[] = []): BrowserContextStore {
  let state = [...initial];

  return {
    get: vi.fn(async () => state),
    set: vi.fn(async (_key, value) => {
      state = [...(value ?? [])];
      return value;
    }),
    snapshot: () => state,
  };
}

describe('BrowserContextAssetService.createAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a managed agent-browser asset with normalized defaults', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_717_000_000_000);
    const store = createStore();
    const service = new BrowserContextAssetService(store);

    const asset = await service.createAsset({
      spaceId: 'space-alpha',
      label: '  Main Browser  ',
      kind: 'managed',
      domains: ['Example.com', 'example.com', 'docs.example.com'],
      fingerprintRef: 'fingerprint-1',
    });

    expect(asset.provider).toBe('agent-browser');
    expect(asset.consentStatus).toBe('granted');
    expect(asset.storageMode).toBe('local-encrypted');
    expect(asset.label).toBe('Main Browser');
    expect(asset.domains).toEqual(['example.com', 'docs.example.com']);
    expect(asset.grantedAt).toBe(1_717_000_000_000);
    expect(store.snapshot()).toHaveLength(1);
  });

  it('rejects empty labels', async () => {
    const service = new BrowserContextAssetService(createStore());

    await expect(
      service.createAsset({
        spaceId: 'space-alpha',
        label: '   ',
        kind: 'managed',
      })
    ).rejects.toThrow('Browser context label is required');
  });
});

describe('BrowserContextAssetService.assertBindableToSpace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the asset when it belongs to the target space and consent is granted', async () => {
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-alpha',
      label: 'Browser A',
      kind: 'managed',
      provider: 'agent-browser',
      consentStatus: 'granted',
      storageMode: 'local-encrypted',
      createTime: 1,
      modifyTime: 1,
    };
    const service = new BrowserContextAssetService(createStore([asset]));

    await expect(service.assertBindableToSpace('space-alpha', 'asset-1')).resolves.toEqual(asset);
  });

  it('rejects assets that belong to another space', async () => {
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-beta',
      label: 'Browser A',
      kind: 'managed',
      provider: 'agent-browser',
      consentStatus: 'granted',
      storageMode: 'local-encrypted',
      createTime: 1,
      modifyTime: 1,
    };
    const service = new BrowserContextAssetService(createStore([asset]));

    await expect(service.assertBindableToSpace('space-alpha', 'asset-1')).rejects.toThrow(
      'does not belong to space space-alpha'
    );
  });

  it('rejects assets whose consent is not granted', async () => {
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-alpha',
      label: 'Browser A',
      kind: 'takeover-link',
      provider: 'agent-browser',
      consentStatus: 'pending',
      storageMode: 'extension-bridge',
      createTime: 1,
      modifyTime: 1,
    };
    const service = new BrowserContextAssetService(createStore([asset]));

    await expect(service.assertBindableToSpace('space-alpha', 'asset-1')).rejects.toThrow('is not granted for binding');
  });

  it('rejects assets whose consent has expired', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-alpha',
      label: 'Browser A',
      kind: 'managed',
      provider: 'agent-browser',
      consentStatus: 'granted',
      storageMode: 'local-encrypted',
      expiresAt: 9_999,
      createTime: 1,
      modifyTime: 1,
    };
    const service = new BrowserContextAssetService(createStore([asset]));

    await expect(service.assertBindableToSpace('space-alpha', 'asset-1')).rejects.toThrow('has expired');
  });
});

describe('BrowserContextAssetService.revokeAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks the asset as revoked and persists the updated state', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(42_000);
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-alpha',
      label: 'Browser A',
      kind: 'imported-profile',
      provider: 'agent-browser',
      consentStatus: 'granted',
      storageMode: 'local-encrypted',
      grantedAt: 10,
      createTime: 1,
      modifyTime: 1,
    };
    const store = createStore([asset]);
    const service = new BrowserContextAssetService(store);

    const revoked = await service.revokeAsset('asset-1');

    expect(revoked.consentStatus).toBe('revoked');
    expect(revoked.revokedAt).toBe(42_000);
    expect(store.snapshot()[0]?.consentStatus).toBe('revoked');
  });

  it('fails when the asset does not exist', async () => {
    const service = new BrowserContextAssetService(createStore());

    await expect(service.revokeAsset('missing')).rejects.toThrow('Browser context asset not found: missing');
  });
});

describe('BrowserContextAssetService.updateAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates browser context metadata and usage timestamps without changing ownership', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_999);
    const asset: TBrowserContextAsset = {
      id: 'asset-1',
      spaceId: 'space-alpha',
      label: 'Browser A',
      kind: 'managed',
      provider: 'agent-browser',
      consentStatus: 'granted',
      storageMode: 'local-encrypted',
      metadata: {
        homeUrl: 'https://old.example.com',
        sticky: true,
      },
      createTime: 1,
      modifyTime: 1,
    };
    const store = createStore([asset]);
    const service = new BrowserContextAssetService(store);

    const updated = await service.updateAsset({
      id: 'asset-1',
      label: '  Main Browser  ',
      domains: ['Docs.Example.com', 'docs.example.com'],
      lastUsedAt: 8_888,
      metadata: {
        ...asset.metadata,
        homeUrl: 'https://example.com',
      },
    });

    expect(updated.spaceId).toBe('space-alpha');
    expect(updated.label).toBe('Main Browser');
    expect(updated.domains).toEqual(['docs.example.com']);
    expect(updated.lastUsedAt).toBe(8_888);
    expect(updated.metadata).toEqual({
      homeUrl: 'https://example.com',
      sticky: true,
    });
    expect(updated.modifyTime).toBe(9_999);
    expect(store.snapshot()[0]?.metadata?.homeUrl).toBe('https://example.com');
  });

  it('fails when the target asset is missing', async () => {
    const service = new BrowserContextAssetService(createStore());

    await expect(service.updateAsset({ id: 'missing', lastUsedAt: 1 })).rejects.toThrow(
      'Browser context asset not found: missing'
    );
  });
});
