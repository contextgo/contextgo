import type { IProvider } from '@/common/config/storage';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const processConfigGet = vi.fn(async (key: string) => storage.get(key));
const processConfigSet = vi.fn(async (key: string, value: unknown) => {
  storage.set(key, value);
  return value;
});
const syncFromDeviceTokenMock = vi.fn(async () => null);
const listTokenGroupsFromDeviceTokenMock = vi.fn(async () => [
  { name: 'default', displayName: 'default' },
  { name: 'openai-codex-0.3x', displayName: 'OpenAI Codex 0.3x' },
]);

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: processConfigGet,
    set: processConfigSet,
  },
}));

vi.mock('@process/services/cloud/InfermeshProviderSyncService', () => ({
  INFERMESH_MANAGED_PROVIDER_ID: 'infermesh-cloud-managed',
  getInfermeshProviderSyncService: () => ({
    syncFromDeviceToken: syncFromDeviceTokenMock,
    listTokenGroupsFromDeviceToken: listTokenGroupsFromDeviceTokenMock,
  }),
}));

describe('InfermeshRuntimeProvisioningService', () => {
  let tempDir: string;

  const provider: IProvider = {
    id: 'infermesh-cloud-managed',
    platform: 'new-api',
    name: 'InferMesh',
    baseUrl: 'https://api.infermesh.org',
    apiKey: 'sk-infermesh',
    model: ['gpt-5.5', 'glm-5.1', 'claude-sonnet-4-6', 'gemini-3.1-pro-preview'],
    modelProtocols: {
      'gpt-5.5': 'openai',
      'glm-5.1': 'openai',
      'claude-sonnet-4-6': 'anthropic',
      'gemini-3.1-pro-preview': 'gemini',
    },
  };

  beforeEach(async () => {
    storage.clear();
    processConfigGet.mockClear();
    processConfigSet.mockClear();
    syncFromDeviceTokenMock.mockClear();
    listTokenGroupsFromDeviceTokenMock.mockClear();
    vi.resetModules();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-infermesh-runtime-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tempDir);

    vi.doMock('@process/agent/codex/connection/CodexConnection', () => ({
      getCodexConfigPath: () => path.join(tempDir, '.codex', 'config.toml'),
      getCodexAuthPath: () => path.join(tempDir, '.codex', 'auth.json'),
    }));
    vi.doMock('@process/agent/acp/utils', () => ({
      getClaudeSettingsPath: () => path.join(tempDir, '.claude', 'settings.json'),
      getOpencodeConfigPath: () => path.join(tempDir, '.config', 'opencode', 'opencode.json'),
    }));
    vi.doMock('@process/agent/gemini/cli/settings', () => ({
      SETTINGS_DIRECTORY_NAME: '.gemini',
      USER_SETTINGS_PATH: path.join(tempDir, '.gemini', 'settings.json'),
    }));

    storage.set('model.config', [provider]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock('@process/agent/codex/connection/CodexConnection');
    vi.doUnmock('@process/agent/acp/utils');
    vi.doUnmock('@process/agent/gemini/cli/settings');
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes Codex InferMesh config and auth without removing unrelated TOML settings', async () => {
    const configPath = path.join(tempDir, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, 'approval_policy = "on-request"\n\n[notice]\nhide_full_access_warning = true\n');

    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().configure({
      backend: 'codex',
      provider: 'infermesh',
      model: 'gpt-5.5',
    });

    const nextConfig = await fs.readFile(configPath, 'utf-8');
    const auth = JSON.parse(await fs.readFile(path.join(tempDir, '.codex', 'auth.json'), 'utf-8')) as Record<
      string,
      string
    >;

    expect(result.model).toBe('gpt-5.5');
    expect(nextConfig).toContain('approval_policy = "on-request"');
    expect(nextConfig).toContain('model_provider = "infermesh"');
    expect(nextConfig).toContain('model = "gpt-5.5"');
    expect(nextConfig).toContain('[model_providers.infermesh]');
    expect(nextConfig).toContain('base_url = "https://api.infermesh.org/v1"');
    expect(auth.OPENAI_API_KEY).toBe('sk-infermesh');
  });

  it('writes Gemini settings and env without overriding the CLI path', async () => {
    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().configure({
      backend: 'gemini',
      provider: 'infermesh',
    });

    const settings = JSON.parse(await fs.readFile(path.join(tempDir, '.gemini', 'settings.json'), 'utf-8')) as {
      security?: { auth?: { selectedType?: string } };
      model?: { name?: string };
    };
    const env = await fs.readFile(path.join(tempDir, '.gemini', '.env'), 'utf-8');

    expect(result.model).toBe('gemini-3.1-pro-preview');
    expect(settings.security?.auth?.selectedType).toBe('gemini-api-key');
    expect(settings.model?.name).toBe('gemini-3.1-pro-preview');
    expect(env).toContain('GEMINI_MODEL=gemini-3.1-pro-preview');
    expect(env).toContain('GOOGLE_API_KEY=sk-infermesh');
    expect(env).toContain('GOOGLE_GEMINI_BASE_URL=https://api.infermesh.org');
    expect(storage.get('acp.config')).toEqual({
      gemini: {
        preferredModelId: 'gemini-3.1-pro-preview',
      },
    });
    await expect(fs.stat(path.join(tempDir, '.local', 'bin', 'gemini-infermesh'))).rejects.toThrow();
  });

  it('writes Claude settings with InferMesh auth token', async () => {
    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().configure({
      backend: 'claude',
      provider: 'infermesh',
      model: 'claude-sonnet-4-6',
    });

    const settingsPath = path.join(tempDir, '.claude', 'settings.json');
    const settingsContent = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsContent) as {
      model?: string;
      env?: Record<string, string>;
      includeCoAuthoredBy?: boolean;
    };

    expect(result.model).toBe('claude-sonnet-4-6');
    expect(settings.model).toBe('claude-sonnet-4-6');
    expect(settings.env?.ANTHROPIC_BASE_URL).toBe('https://api.infermesh.org');
    expect(settings.env?.ANTHROPIC_AUTH_TOKEN).toBe('sk-infermesh');
    expect(settings.includeCoAuthoredBy).toBe(false);
    expect(settingsContent).toContain('sk-infermesh');
  });

  it('writes OpenCode OpenAI-compatible provider config and model preference', async () => {
    storage.set('acp.config', {
      opencode: {
        cliPath: '/opt/opencode',
      },
    });
    const configPath = path.join(tempDir, '.config', 'opencode', 'opencode.json');
    const ohMyOpenCodeConfigPath = path.join(tempDir, '.config', 'opencode', 'oh-my-opencode.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        plugin: ['oh-my-opencode@3.5.2'],
      })
    );
    await fs.writeFile(
      ohMyOpenCodeConfigPath,
      JSON.stringify({
        agents: {
          sisyphus: {
            prompt_append: 'Keep existing Sisyphus override.',
          },
          oracle: {
            model: 'anthropic/claude-opus-4-6',
          },
        },
      })
    );

    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().configure({
      backend: 'opencode',
      provider: 'infermesh',
      model: 'glm-5.1',
    });

    const config = JSON.parse(await fs.readFile(configPath, 'utf-8')) as {
      $schema?: string;
      model?: string;
      plugin?: string[];
      provider?: {
        openai?: {
          options?: { baseURL?: string; apiKey?: string };
          models?: Record<string, { name?: string; options?: { store?: boolean } }>;
        };
      };
    };
    const ohMyOpenCodeConfig = JSON.parse(await fs.readFile(ohMyOpenCodeConfigPath, 'utf-8')) as {
      agents?: {
        sisyphus?: { model?: string; prompt_append?: string };
        prometheus?: { model?: string };
        oracle?: { model?: string };
      };
    };

    expect(result.model).toBe('glm-5.1');
    expect(config.$schema).toBe('https://opencode.ai/config.json');
    expect(config.plugin).toEqual(['oh-my-opencode@3.5.2']);
    expect(config.model).toBe('openai/glm-5.1');
    expect(config.provider?.openai?.options?.baseURL).toBe('https://api.infermesh.org/v1');
    expect(config.provider?.openai?.options?.apiKey).toBe('sk-infermesh');
    expect(config.provider?.openai?.models?.['glm-5.1']?.options?.store).toBe(false);
    expect(ohMyOpenCodeConfig.agents?.sisyphus?.model).toBe('openai/glm-5.1');
    expect(ohMyOpenCodeConfig.agents?.sisyphus?.prompt_append).toBe('Keep existing Sisyphus override.');
    expect(ohMyOpenCodeConfig.agents?.prometheus?.model).toBe('openai/glm-5.1');
    expect(ohMyOpenCodeConfig.agents?.oracle?.model).toBe('anthropic/claude-opus-4-6');
    expect(storage.get('acp.config')).toEqual({
      opencode: {
        cliPath: '/opt/opencode',
        preferredModelId: 'glm-5.1',
      },
    });
  });

  it('treats unannotated InferMesh models as OpenAI-compatible for OpenCode', async () => {
    storage.set('model.config', [
      {
        ...provider,
        model: ['glm-5.1'],
        modelProtocols: {},
      },
    ]);

    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().configure({
      backend: 'opencode',
      provider: 'infermesh',
      model: 'glm-5.1',
    });

    const config = JSON.parse(
      await fs.readFile(path.join(tempDir, '.config', 'opencode', 'opencode.json'), 'utf-8')
    ) as {
      model?: string;
      provider?: {
        openai?: {
          models?: Record<string, { name?: string; options?: { store?: boolean } }>;
        };
      };
    };

    expect(result.model).toBe('glm-5.1');
    expect(config.model).toBe('openai/glm-5.1');
    expect(config.provider?.openai?.models?.['glm-5.1']?.options?.store).toBe(false);
  });

  it('rejects a selected model that does not match the runtime protocol', async () => {
    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');

    await expect(
      new InfermeshRuntimeProvisioningService().configure({
        backend: 'claude',
        provider: 'infermesh',
        model: 'gpt-5.5',
      })
    ).rejects.toThrow('not compatible');
  });

  it('syncs the selected token group before writing runtime config', async () => {
    storage.set('cloud.deviceToken', 'device-token');

    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    await new InfermeshRuntimeProvisioningService().configure({
      backend: 'codex',
      provider: 'infermesh',
      model: 'gpt-5.5',
      group: 'openai-codex-0.3x',
    });

    expect(syncFromDeviceTokenMock).toHaveBeenCalledWith('device-token', { group: 'openai-codex-0.3x' });
  });

  it('lists InferMesh token groups through the signed-in device token', async () => {
    storage.set('cloud.deviceToken', 'device-token');

    const { InfermeshRuntimeProvisioningService } =
      await import('@process/services/cloud/InfermeshRuntimeProvisioningService');
    const result = await new InfermeshRuntimeProvisioningService().listTokenGroups({
      provider: 'infermesh',
    });

    expect(result.groups.map((group) => group.name)).toEqual(['default', 'openai-codex-0.3x']);
    expect(listTokenGroupsFromDeviceTokenMock).toHaveBeenCalledWith('device-token');
  });
});
