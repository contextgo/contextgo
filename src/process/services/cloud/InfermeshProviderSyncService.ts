/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider } from '@/common/config/storage';
import type { ManagedRuntimeTokenGroup } from '@/common/types/acpTypes';
import { ProcessConfig } from '@process/utils/initStorage';
import { CLOUD_API_BASE_URL } from './constants';

const INFERMESH_PROVIDER_ENDPOINT = `${CLOUD_API_BASE_URL}/api/integrations/infermesh/provider`;
const INFERMESH_TOKEN_GROUPS_ENDPOINT = `${CLOUD_API_BASE_URL}/api/integrations/infermesh/token-groups`;
export const INFERMESH_MANAGED_PROVIDER_ID = 'infermesh-cloud-managed';
const INFERMESH_MANAGED_GROUP_KEY = 'infermesh.managedTokenGroup';
const DEFAULT_INFERMESH_TOKEN_GROUP: ManagedRuntimeTokenGroup = {
  name: 'default',
  displayName: 'default',
};

type InfermeshProviderResponse = {
  success?: boolean;
  provider?: Partial<IProvider> | null;
};

type InfermeshTokenGroupsResponse = {
  success?: boolean;
  groups?: unknown;
};

export type InfermeshProviderSyncOptions = {
  group?: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}

function normalizeTokenGroup(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTokenGroups(rawGroups: unknown): ManagedRuntimeTokenGroup[] {
  if (!Array.isArray(rawGroups)) {
    return [];
  }

  const groups: ManagedRuntimeTokenGroup[] = [];
  const seen = new Set<string>();
  for (const rawGroup of rawGroups) {
    if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
      continue;
    }

    const record = rawGroup as Record<string, unknown>;
    const name = normalizeTokenGroup(record.name);
    if (!name || seen.has(name)) {
      continue;
    }

    const displayName = normalizeTokenGroup(record.displayName) ?? name;
    const description = normalizeTokenGroup(record.description);
    groups.push(description ? { name, displayName, description } : { name, displayName });
    seen.add(name);
  }

  return groups;
}

function ensureDefaultTokenGroup(groups: ManagedRuntimeTokenGroup[]): ManagedRuntimeTokenGroup[] {
  if (groups.some((group) => group.name === DEFAULT_INFERMESH_TOKEN_GROUP.name)) {
    return groups;
  }

  return [DEFAULT_INFERMESH_TOKEN_GROUP, ...groups];
}

function normalizeProvider(rawProvider: Partial<IProvider> | null | undefined): IProvider | null {
  if (!rawProvider) {
    return null;
  }

  if (
    rawProvider.platform !== 'new-api' ||
    typeof rawProvider.name !== 'string' ||
    typeof rawProvider.baseUrl !== 'string' ||
    typeof rawProvider.apiKey !== 'string'
  ) {
    return null;
  }

  const models = isStringArray(rawProvider.model) ? rawProvider.model.filter((item) => item.trim() !== '') : [];
  const modelProtocols = isRecordOfStrings(rawProvider.modelProtocols) ? rawProvider.modelProtocols : {};

  return {
    id: INFERMESH_MANAGED_PROVIDER_ID,
    platform: 'new-api',
    name: rawProvider.name,
    baseUrl: rawProvider.baseUrl,
    apiKey: rawProvider.apiKey,
    model: models,
    modelProtocols,
    enabled: true,
  };
}

function preserveModelState(
  existing: IProvider | undefined,
  provider: IProvider
): Pick<IProvider, 'enabled' | 'modelEnabled' | 'modelHealth'> {
  if (!existing) {
    return {
      enabled: provider.enabled,
    };
  }

  const modelEnabled =
    existing.modelEnabled && provider.model.length > 0
      ? Object.fromEntries(
          provider.model
            .filter((modelName) => existing.modelEnabled?.[modelName] !== undefined)
            .map((modelName) => [modelName, existing.modelEnabled?.[modelName] as boolean])
        )
      : undefined;

  const modelHealth =
    existing.modelHealth && provider.model.length > 0
      ? Object.fromEntries(
          provider.model
            .filter((modelName) => existing.modelHealth?.[modelName] !== undefined)
            .map((modelName) => [
              modelName,
              existing.modelHealth?.[modelName] as NonNullable<IProvider['modelHealth']>[string],
            ])
        )
      : undefined;

  return {
    enabled: existing.enabled ?? provider.enabled,
    modelEnabled: modelEnabled && Object.keys(modelEnabled).length > 0 ? modelEnabled : undefined,
    modelHealth: modelHealth && Object.keys(modelHealth).length > 0 ? modelHealth : undefined,
  };
}

export class InfermeshProviderSyncService {
  public async listTokenGroupsFromDeviceToken(deviceToken: string): Promise<ManagedRuntimeTokenGroup[]> {
    if (!deviceToken) {
      return [];
    }

    let payload: InfermeshTokenGroupsResponse | null = null;

    try {
      const response = await fetch(INFERMESH_TOKEN_GROUPS_ENDPOINT, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn(`[InferMesh] Token group sync failed: ${response.status} ${detail}`);
        return [];
      }

      payload = (await response.json()) as InfermeshTokenGroupsResponse;
    } catch (error) {
      console.warn('[InferMesh] Failed to fetch token groups:', error);
      return [];
    }

    if (!payload?.success) {
      console.warn('[InferMesh] Token group payload was invalid');
      return [];
    }

    return ensureDefaultTokenGroup(normalizeTokenGroups(payload.groups));
  }

  public async syncFromDeviceToken(
    deviceToken: string,
    options: InfermeshProviderSyncOptions = {}
  ): Promise<IProvider | null> {
    if (!deviceToken) {
      return null;
    }

    let payload: InfermeshProviderResponse | null = null;
    const group = normalizeTokenGroup(options.group);
    const endpoint = group
      ? `${INFERMESH_PROVIDER_ENDPOINT}?${new URLSearchParams({ group }).toString()}`
      : INFERMESH_PROVIDER_ENDPOINT;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn(`[InferMesh] Provider sync failed: ${response.status} ${detail}`);
        return null;
      }

      payload = (await response.json()) as InfermeshProviderResponse;
    } catch (error) {
      console.warn('[InferMesh] Failed to fetch managed provider payload:', error);
      return null;
    }

    if (!payload) {
      console.warn('[InferMesh] Managed provider payload was empty');
      return null;
    }

    const nextProvider = normalizeProvider(payload.provider);
    if (!payload.success || !nextProvider) {
      console.warn('[InferMesh] Managed provider payload was invalid');
      return null;
    }

    await this.upsertProvider(nextProvider);
    const selectedGroup = normalizeTokenGroup((payload.provider as Record<string, unknown> | undefined)?.tokenGroup);
    if (selectedGroup) {
      await ProcessConfig.set(INFERMESH_MANAGED_GROUP_KEY, selectedGroup);
    }
    return nextProvider;
  }

  public async removeManagedProvider(): Promise<void> {
    const modelConfig = ((await ProcessConfig.get('model.config')) as IProvider[] | undefined) ?? [];
    const nextConfig = modelConfig.filter((provider) => provider.id !== INFERMESH_MANAGED_PROVIDER_ID);
    if (nextConfig.length === modelConfig.length) {
      return;
    }

    await ProcessConfig.set('model.config', nextConfig);
  }

  private async upsertProvider(provider: IProvider): Promise<void> {
    const modelConfig = ((await ProcessConfig.get('model.config')) as IProvider[] | undefined) ?? [];
    const existing = modelConfig.find((item) => item.id === INFERMESH_MANAGED_PROVIDER_ID);
    const preservedState = preserveModelState(existing, provider);
    const nextProvider: IProvider = {
      ...existing,
      ...provider,
      ...preservedState,
      id: INFERMESH_MANAGED_PROVIDER_ID,
    };

    const nextConfig = existing
      ? modelConfig.map((item) => (item.id === INFERMESH_MANAGED_PROVIDER_ID ? nextProvider : item))
      : [nextProvider, ...modelConfig];

    await ProcessConfig.set('model.config', nextConfig);
  }
}

let infermeshProviderSyncService: InfermeshProviderSyncService | null = null;

export function getInfermeshProviderSyncService(): InfermeshProviderSyncService {
  if (!infermeshProviderSyncService) {
    infermeshProviderSyncService = new InfermeshProviderSyncService();
  }

  return infermeshProviderSyncService;
}
