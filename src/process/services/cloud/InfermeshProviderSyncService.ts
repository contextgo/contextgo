/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider } from '@/common/config/storage';
import { ProcessConfig } from '@process/utils/initStorage';
import { CLOUD_API_BASE_URL } from './constants';

const INFERMESH_PROVIDER_ENDPOINT = `${CLOUD_API_BASE_URL}/api/integrations/infermesh/provider`;
const MANAGED_PROVIDER_ID = 'infermesh-cloud-managed';

type InfermeshProviderResponse = {
  success?: boolean;
  provider?: Partial<IProvider> | null;
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
    id: MANAGED_PROVIDER_ID,
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
  public async syncFromDeviceToken(deviceToken: string): Promise<void> {
    if (!deviceToken) {
      return;
    }

    let payload: InfermeshProviderResponse | null = null;

    try {
      const response = await fetch(INFERMESH_PROVIDER_ENDPOINT, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn(`[InferMesh] Provider sync failed: ${response.status} ${detail}`);
        return;
      }

      payload = (await response.json()) as InfermeshProviderResponse;
    } catch (error) {
      console.warn('[InferMesh] Failed to fetch managed provider payload:', error);
      return;
    }

    if (!payload) {
      console.warn('[InferMesh] Managed provider payload was empty');
      return;
    }

    const nextProvider = normalizeProvider(payload.provider);
    if (!payload.success || !nextProvider) {
      console.warn('[InferMesh] Managed provider payload was invalid');
      return;
    }

    await this.upsertProvider(nextProvider);
  }

  public async removeManagedProvider(): Promise<void> {
    const modelConfig = ((await ProcessConfig.get('model.config')) as IProvider[] | undefined) ?? [];
    const nextConfig = modelConfig.filter((provider) => provider.id !== MANAGED_PROVIDER_ID);
    if (nextConfig.length === modelConfig.length) {
      return;
    }

    await ProcessConfig.set('model.config', nextConfig);
  }

  private async upsertProvider(provider: IProvider): Promise<void> {
    const modelConfig = ((await ProcessConfig.get('model.config')) as IProvider[] | undefined) ?? [];
    const existing = modelConfig.find((item) => item.id === MANAGED_PROVIDER_ID);
    const preservedState = preserveModelState(existing, provider);
    const nextProvider: IProvider = {
      ...existing,
      ...provider,
      ...preservedState,
      id: MANAGED_PROVIDER_ID,
    };

    const nextConfig = existing
      ? modelConfig.map((item) => (item.id === MANAGED_PROVIDER_ID ? nextProvider : item))
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
