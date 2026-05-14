/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConfigStorageRefer, TBrowserContextAsset } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import { ProcessConfig } from '@process/utils/initStorage';

type BrowserContextConfigStore = Pick<IConfigStorageRefer, 'browser.context.assets'>;

type BrowserContextStore = {
  get<K extends keyof BrowserContextConfigStore>(key: K): Promise<BrowserContextConfigStore[K]>;
  set<K extends keyof BrowserContextConfigStore>(
    key: K,
    value: BrowserContextConfigStore[K]
  ): Promise<BrowserContextConfigStore[K]>;
};

type CreateBrowserContextAssetInput = {
  spaceId: string;
  label: string;
  kind: TBrowserContextAsset['kind'];
  consentStatus?: TBrowserContextAsset['consentStatus'];
  storageMode?: TBrowserContextAsset['storageMode'];
  domains?: string[];
  fingerprintRef?: string;
  profileRef?: string;
  storageRef?: string;
  grantedAt?: number;
  expiresAt?: number;
  metadata?: TBrowserContextAsset['metadata'];
};

type UpdateBrowserContextConsentInput = {
  id: string;
  consentStatus: TBrowserContextAsset['consentStatus'];
  grantedAt?: number;
  expiresAt?: number;
};

type UpdateBrowserContextAssetInput = {
  id: string;
  label?: string;
  domains?: string[];
  fingerprintRef?: string;
  profileRef?: string;
  storageRef?: string;
  expiresAt?: number;
  lastUsedAt?: number;
  metadata?: TBrowserContextAsset['metadata'];
};

const BROWSER_CONTEXT_ASSET_KEY = 'browser.context.assets';

const normalizeDomains = (domains?: string[]): string[] | undefined => {
  if (!domains || domains.length === 0) {
    return undefined;
  }

  const normalized = domains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .filter((domain, index, list) => list.indexOf(domain) === index);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeLabel = (label: string): string => {
  const normalized = label.trim();
  if (!normalized) {
    throw new Error('Browser context label is required');
  }
  return normalized;
};

const defaultConsentStatus = (kind: TBrowserContextAsset['kind']): TBrowserContextAsset['consentStatus'] => {
  return kind === 'managed' ? 'granted' : 'pending';
};

const defaultStorageMode = (kind: TBrowserContextAsset['kind']): TBrowserContextAsset['storageMode'] => {
  if (kind === 'takeover-link') {
    return 'extension-bridge';
  }
  return 'local-encrypted';
};

const normalizeAsset = (asset: TBrowserContextAsset): TBrowserContextAsset => {
  return {
    ...asset,
    label: normalizeLabel(asset.label),
    domains: normalizeDomains(asset.domains),
    metadata: asset.metadata && Object.keys(asset.metadata).length > 0 ? asset.metadata : undefined,
  };
};

export class BrowserContextAssetService {
  constructor(private readonly store: BrowserContextStore = ProcessConfig) {}

  private async readAssets(): Promise<TBrowserContextAsset[]> {
    const stored = (await this.store.get(BROWSER_CONTEXT_ASSET_KEY)) ?? [];
    return Array.isArray(stored) ? stored.map(normalizeAsset) : [];
  }

  private async writeAssets(assets: TBrowserContextAsset[]): Promise<TBrowserContextAsset[]> {
    const normalizedAssets = assets.map(normalizeAsset).toSorted((left, right) => left.createTime - right.createTime);

    await this.store.set(BROWSER_CONTEXT_ASSET_KEY, normalizedAssets);
    return normalizedAssets;
  }

  async listBySpace(spaceId: string, includeRevoked = false): Promise<TBrowserContextAsset[]> {
    const normalizedSpaceId = spaceId.trim();
    if (!normalizedSpaceId) {
      throw new Error('Space ID is required');
    }

    const assets = await this.readAssets();
    return assets.filter(
      (asset) => asset.spaceId === normalizedSpaceId && (includeRevoked || asset.consentStatus !== 'revoked')
    );
  }

  async getAsset(id: string): Promise<TBrowserContextAsset | undefined> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('Browser context asset ID is required');
    }

    return (await this.readAssets()).find((asset) => asset.id === normalizedId);
  }

  async createAsset(input: CreateBrowserContextAssetInput): Promise<TBrowserContextAsset> {
    const spaceId = input.spaceId.trim();
    if (!spaceId) {
      throw new Error('Space ID is required');
    }

    const now = Date.now();
    const consentStatus = input.consentStatus ?? defaultConsentStatus(input.kind);
    const asset: TBrowserContextAsset = {
      id: uuid(),
      spaceId,
      label: normalizeLabel(input.label),
      kind: input.kind,
      provider: 'agent-browser',
      consentStatus,
      storageMode: input.storageMode ?? defaultStorageMode(input.kind),
      domains: normalizeDomains(input.domains),
      fingerprintRef: input.fingerprintRef?.trim() || undefined,
      profileRef: input.profileRef?.trim() || undefined,
      storageRef: input.storageRef?.trim() || undefined,
      grantedAt:
        consentStatus === 'granted' ? (typeof input.grantedAt === 'number' ? input.grantedAt : now) : input.grantedAt,
      expiresAt: input.expiresAt,
      metadata: input.metadata && Object.keys(input.metadata).length > 0 ? input.metadata : undefined,
      createTime: now,
      modifyTime: now,
    };

    const assets = await this.readAssets();
    await this.writeAssets([...assets, asset]);
    return asset;
  }

  async updateConsent(input: UpdateBrowserContextConsentInput): Promise<TBrowserContextAsset> {
    const assets = await this.readAssets();
    const asset = assets.find((item) => item.id === input.id.trim());

    if (!asset) {
      throw new Error(`Browser context asset not found: ${input.id}`);
    }

    const now = Date.now();
    const updatedAsset: TBrowserContextAsset = {
      ...asset,
      consentStatus: input.consentStatus,
      grantedAt:
        input.consentStatus === 'granted'
          ? typeof input.grantedAt === 'number'
            ? input.grantedAt
            : (asset.grantedAt ?? now)
          : (input.grantedAt ?? asset.grantedAt),
      expiresAt: input.expiresAt,
      revokedAt: input.consentStatus === 'revoked' ? now : undefined,
      modifyTime: now,
    };

    await this.writeAssets(assets.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
    return updatedAsset;
  }

  async updateAsset(input: UpdateBrowserContextAssetInput): Promise<TBrowserContextAsset> {
    const assets = await this.readAssets();
    const asset = assets.find((item) => item.id === input.id.trim());

    if (!asset) {
      throw new Error(`Browser context asset not found: ${input.id}`);
    }

    const updatedAsset: TBrowserContextAsset = normalizeAsset({
      ...asset,
      label: input.label ?? asset.label,
      domains: input.domains ?? asset.domains,
      fingerprintRef: input.fingerprintRef ?? asset.fingerprintRef,
      profileRef: input.profileRef ?? asset.profileRef,
      storageRef: input.storageRef ?? asset.storageRef,
      expiresAt: input.expiresAt ?? asset.expiresAt,
      lastUsedAt: input.lastUsedAt ?? asset.lastUsedAt,
      metadata: input.metadata ?? asset.metadata,
      modifyTime: Date.now(),
    });

    await this.writeAssets(assets.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
    return updatedAsset;
  }

  async revokeAsset(id: string): Promise<TBrowserContextAsset> {
    return this.updateConsent({
      id,
      consentStatus: 'revoked',
    });
  }

  async assertBindableToSpace(spaceId: string, assetId: string): Promise<TBrowserContextAsset> {
    const normalizedSpaceId = spaceId.trim();
    if (!normalizedSpaceId) {
      throw new Error('Space ID is required');
    }

    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error(`Browser context asset not found: ${assetId}`);
    }

    if (asset.spaceId !== normalizedSpaceId) {
      throw new Error(`Browser context asset ${asset.id} does not belong to space ${normalizedSpaceId}`);
    }

    if (asset.consentStatus !== 'granted') {
      throw new Error(`Browser context asset ${asset.id} is not granted for binding`);
    }

    if (typeof asset.expiresAt === 'number' && asset.expiresAt <= Date.now()) {
      throw new Error(`Browser context asset ${asset.id} has expired`);
    }

    return asset;
  }
}
