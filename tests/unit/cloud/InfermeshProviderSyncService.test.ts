import type { IProvider } from '@/common/config/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const processConfigGet = vi.fn(async (key: string) => storage.get(key));
const processConfigSet = vi.fn(async (key: string, value: unknown) => {
  storage.set(key, value);
  return value;
});

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: processConfigGet,
    set: processConfigSet,
  },
}));

function createJsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('InfermeshProviderSyncService', () => {
  beforeEach(() => {
    storage.clear();
    processConfigGet.mockClear();
    processConfigSet.mockClear();
    vi.unstubAllGlobals();
  });

  it('upserts the managed provider and preserves existing model state for retained models', async () => {
    const existingManaged: IProvider = {
      id: 'infermesh-cloud-managed',
      platform: 'new-api',
      name: 'InferMesh Cloud',
      baseUrl: 'https://api.infermesh.org',
      apiKey: 'sk-old',
      model: ['gpt-5.4', 'legacy-model'],
      enabled: false,
      modelEnabled: {
        'gpt-5.4': false,
        'legacy-model': true,
      },
      modelHealth: {
        'gpt-5.4': {
          status: 'healthy',
          lastCheck: 123,
        },
        'legacy-model': {
          status: 'unhealthy',
          error: 'gone',
        },
      },
    };
    const otherProvider: IProvider = {
      id: 'custom-openai',
      platform: 'openai',
      name: 'Custom OpenAI',
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-custom',
      model: ['gpt-4o-mini'],
      enabled: true,
    };
    storage.set('model.config', [otherProvider, existingManaged]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          provider: {
            id: 'ignored-by-client',
            platform: 'new-api',
            name: 'InferMesh Cloud',
            baseUrl: 'https://api.infermesh.org',
            apiKey: 'sk-new',
            model: ['gpt-5.4', 'claude-sonnet-4'],
            modelProtocols: {
              'gpt-5.4': 'openai',
              'claude-sonnet-4': 'anthropic',
            },
          },
        })
      )
    );

    const { InfermeshProviderSyncService } = await import('@process/services/cloud/InfermeshProviderSyncService');
    const service = new InfermeshProviderSyncService();

    await service.syncFromDeviceToken('ctxdev_token');

    const nextConfig = storage.get('model.config') as IProvider[];
    expect(processConfigSet).toHaveBeenCalledOnce();
    expect(nextConfig).toHaveLength(2);
    expect(nextConfig[0]).toEqual(otherProvider);
    expect(nextConfig[1]).toEqual({
      id: 'infermesh-cloud-managed',
      platform: 'new-api',
      name: 'InferMesh Cloud',
      baseUrl: 'https://api.infermesh.org',
      apiKey: 'sk-new',
      model: ['gpt-5.4', 'claude-sonnet-4'],
      modelProtocols: {
        'gpt-5.4': 'openai',
        'claude-sonnet-4': 'anthropic',
      },
      enabled: false,
      modelEnabled: {
        'gpt-5.4': false,
      },
      modelHealth: {
        'gpt-5.4': {
          status: 'healthy',
          lastCheck: 123,
        },
      },
    });
  });

  it('ignores invalid provider payloads without mutating model config', async () => {
    const existingProviders: IProvider[] = [
      {
        id: 'custom-openai',
        platform: 'openai',
        name: 'Custom OpenAI',
        baseUrl: 'https://example.com/v1',
        apiKey: 'sk-custom',
        model: ['gpt-4o-mini'],
      },
    ];
    storage.set('model.config', existingProviders);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          provider: {
            platform: 'openai',
            name: 'Wrong Shape',
            baseUrl: 'https://example.com/v1',
            apiKey: 'sk-test',
          },
        })
      )
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { InfermeshProviderSyncService } = await import('@process/services/cloud/InfermeshProviderSyncService');
    const service = new InfermeshProviderSyncService();

    await service.syncFromDeviceToken('ctxdev_token');

    expect(processConfigSet).not.toHaveBeenCalled();
    expect(storage.get('model.config')).toEqual(existingProviders);
    expect(warnSpy).toHaveBeenCalledWith('[InferMesh] Managed provider payload was invalid');

    warnSpy.mockRestore();
  });

  it('removes only the managed provider on logout cleanup', async () => {
    const providers: IProvider[] = [
      {
        id: 'infermesh-cloud-managed',
        platform: 'new-api',
        name: 'InferMesh Cloud',
        baseUrl: 'https://api.infermesh.org',
        apiKey: 'sk-managed',
        model: ['gpt-5.4'],
      },
      {
        id: 'custom-openai',
        platform: 'openai',
        name: 'Custom OpenAI',
        baseUrl: 'https://example.com/v1',
        apiKey: 'sk-custom',
        model: ['gpt-4o-mini'],
      },
    ];
    storage.set('model.config', providers);

    const { InfermeshProviderSyncService } = await import('@process/services/cloud/InfermeshProviderSyncService');
    const service = new InfermeshProviderSyncService();

    await service.removeManagedProvider();

    expect(processConfigSet).toHaveBeenCalledOnce();
    expect(storage.get('model.config')).toEqual([providers[1]]);
  });
});
