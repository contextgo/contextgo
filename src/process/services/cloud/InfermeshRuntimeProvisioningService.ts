/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider } from '@/common/config/storage';
import type {
  AcpBackend,
  ManagedRuntimeConfigEntry,
  ManagedRuntimeModelConfigParams,
  ManagedRuntimeModelConfigResult,
  ManagedRuntimeModelProviderSyncParams,
  ManagedRuntimeModelProviderSyncResult,
  ManagedRuntimeTokenGroupListParams,
  ManagedRuntimeTokenGroupListResult,
} from '@/common/types/acpTypes';
import { getCodexAuthPath, getCodexConfigPath } from '@process/agent/codex/connection/CodexConnection';
import { getClaudeSettingsPath, getOpencodeConfigPath } from '@process/agent/acp/utils';
import {
  SETTINGS_DIRECTORY_NAME,
  USER_SETTINGS_PATH as GEMINI_SETTINGS_PATH,
} from '@process/agent/gemini/cli/settings';
import { ProcessConfig } from '@process/utils/initStorage';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getInfermeshProviderSyncService, INFERMESH_MANAGED_PROVIDER_ID } from './InfermeshProviderSyncService';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';
const INFERMESH_PROVIDER_NAME = 'infermesh';
const GEMINI_ENV_PATH = path.join(os.homedir(), SETTINGS_DIRECTORY_NAME, '.env');

type RuntimeProtocol = 'openai' | 'anthropic' | 'gemini';

type ProvisioningTarget = {
  protocol: RuntimeProtocol;
  defaultModels: readonly string[];
};

const RUNTIME_TARGETS: Partial<Record<AcpBackend, ProvisioningTarget>> = {
  codex: {
    protocol: 'openai',
    defaultModels: ['gpt-5.5', 'gpt-5.3-codex', 'gpt-5.4'],
  },
  opencode: {
    protocol: 'openai',
    defaultModels: ['gpt-5.3-codex', 'gpt-5.5', 'gpt-5.4'],
  },
  claude: {
    protocol: 'anthropic',
    defaultModels: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'],
  },
  gemini: {
    protocol: 'gemini',
    defaultModels: ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-2.5-pro'],
  },
};

function isProviderList(value: unknown): value is IProvider[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function withOpenAiPath(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function inferModelProtocol(provider: IProvider, model: string): RuntimeProtocol {
  const explicit = provider.modelProtocols?.[model];
  if (explicit === 'openai' || explicit === 'anthropic' || explicit === 'gemini') {
    return explicit;
  }

  const normalized = model.toLowerCase();
  if (normalized.includes('claude') || normalized.includes('anthropic')) {
    return 'anthropic';
  }
  if (normalized.includes('gemini')) {
    return 'gemini';
  }
  return 'openai';
}

function isModelCompatible(provider: IProvider, model: string, target: ProvisioningTarget): boolean {
  return inferModelProtocol(provider, model) === target.protocol;
}

function chooseModel(provider: IProvider, target: ProvisioningTarget, requestedModel?: string): string {
  const models = provider.model.filter((model) => model.trim() !== '');
  const compatibleModels = models.filter((model) => isModelCompatible(provider, model, target));

  if (requestedModel?.trim()) {
    const model = requestedModel.trim();
    if (!models.includes(model)) {
      throw new Error(`InferMesh model is not available: ${model}`);
    }
    if (!isModelCompatible(provider, model, target)) {
      throw new Error(`InferMesh model ${model} is not compatible with this runtime.`);
    }
    return model;
  }

  for (const defaultModel of target.defaultModels) {
    if (compatibleModels.includes(defaultModel)) {
      return defaultModel;
    }
  }

  const hinted = compatibleModels.find((model) =>
    target.defaultModels.some((defaultModel) => model.toLowerCase().includes(defaultModel.toLowerCase()))
  );
  if (hinted) {
    return hinted;
  }

  const firstCompatible = compatibleModels[0];
  if (firstCompatible) {
    return firstCompatible;
  }

  throw new Error(`InferMesh has no ${target.protocol} model available for this runtime.`);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  const content = await readTextIfExists(filePath);
  if (!content.trim()) {
    return {};
  }

  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

function isOhMyOpenCodePluginEntry(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return value.toLowerCase().includes('oh-my-opencode');
}

function hasOhMyOpenCodePlugin(config: Record<string, unknown>): boolean {
  return Array.isArray(config.plugin) && config.plugin.some(isOhMyOpenCodePluginEntry);
}

function getOhMyOpenCodeConfigPath(opencodeConfigPath: string): string {
  return path.join(path.dirname(opencodeConfigPath), 'oh-my-opencode.json');
}

async function writeJsonFile(filePath: string, value: unknown, mode?: number): Promise<void> {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf-8', mode });
  if (mode !== undefined) {
    await fs.chmod(filePath, mode);
  }
}

async function writeTextFile(filePath: string, content: string, mode?: number): Promise<void> {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, content, { encoding: 'utf-8', mode });
  if (mode !== undefined) {
    await fs.chmod(filePath, mode);
  }
}

function upsertTopLevelTomlKeys(content: string, keys: Record<string, string | number | boolean>): string {
  const lines = content ? content.split(/\r?\n/) : [];
  const consumed = new Set<string>();
  let inTopLevel = true;
  const nextLines = lines.map((line) => {
    if (/^\s*\[/.test(line)) {
      inTopLevel = false;
      return line;
    }

    if (!inTopLevel) {
      return line;
    }

    const match = line.match(/^(\s*)([A-Za-z0-9_.-]+)(\s*=\s*)(.*)$/);
    if (!match) {
      return line;
    }

    const key = match[2];
    if (!(key in keys)) {
      return line;
    }

    consumed.add(key);
    return `${match[1]}${key}${match[3]}${formatTomlValue(keys[key])}`;
  });

  const missing = Object.entries(keys)
    .filter(([key]) => !consumed.has(key))
    .map(([key, value]) => `${key} = ${formatTomlValue(value)}`);

  if (missing.length === 0) {
    return nextLines.join('\n').replace(/\s*$/, '\n');
  }

  const firstSectionIndex = nextLines.findIndex((line) => /^\s*\[/.test(line));
  if (firstSectionIndex === -1) {
    return [...missing, ...nextLines.filter((line) => line.trim() !== '')].join('\n').replace(/\s*$/, '\n');
  }

  nextLines.splice(firstSectionIndex, 0, ...missing, '');
  return nextLines.join('\n').replace(/\s*$/, '\n');
}

function formatTomlValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function upsertTomlSection(content: string, sectionName: string, sectionBody: string): string {
  const normalizedBody = sectionBody.trim();
  const lines = content ? content.replace(/\s*$/, '\n').split(/\r?\n/) : [];
  const startIndex = lines.findIndex((line) => line.trim() === `[${sectionName}]`);
  const replacement = [`[${sectionName}]`, ...normalizedBody.split(/\r?\n/), ''];

  if (startIndex === -1) {
    const base = content.trim() ? content.replace(/\s*$/, '\n\n') : '';
    return `${base}${replacement.join('\n')}`.replace(/\s*$/, '\n');
  }

  let endIndex = startIndex + 1;
  while (endIndex < lines.length && !/^\s*\[/.test(lines[endIndex])) {
    endIndex += 1;
  }

  lines.splice(startIndex, endIndex - startIndex, ...replacement);
  return lines.join('\n').replace(/\s*$/, '\n');
}

function mergeDotenv(content: string, values: Record<string, string>): string {
  const lines = content ? content.split(/\r?\n/) : [];
  const remaining = new Set(Object.keys(values));
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !(match[1] in values)) {
      return line;
    }
    remaining.delete(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });

  for (const key of remaining) {
    nextLines.push(`${key}=${values[key]}`);
  }

  return nextLines.filter((line, index, array) => line.trim() !== '' || index < array.length - 1).join('\n') + '\n';
}

function buildEntry(filePath: string, kind: ManagedRuntimeConfigEntry['kind']): ManagedRuntimeConfigEntry {
  return {
    kind,
    path: filePath,
    exists: fsSync.existsSync(filePath),
  };
}

export class InfermeshRuntimeProvisioningService {
  public async listTokenGroups(input: ManagedRuntimeTokenGroupListParams): Promise<ManagedRuntimeTokenGroupListResult> {
    if (input.provider !== INFERMESH_PROVIDER_NAME) {
      throw new Error(`Unsupported runtime model provider: ${input.provider}`);
    }

    const deviceToken = await this.getDeviceToken();
    const groups = await getInfermeshProviderSyncService().listTokenGroupsFromDeviceToken(deviceToken);
    return {
      provider: INFERMESH_PROVIDER_NAME,
      groups,
    };
  }

  public async syncProvider(
    input: ManagedRuntimeModelProviderSyncParams
  ): Promise<ManagedRuntimeModelProviderSyncResult> {
    if (input.provider !== INFERMESH_PROVIDER_NAME) {
      throw new Error(`Unsupported runtime model provider: ${input.provider}`);
    }

    const deviceToken = await this.getDeviceToken();
    const provider = await getInfermeshProviderSyncService().syncFromDeviceToken(deviceToken, { group: input.group });
    if (!provider) {
      throw new Error('InferMesh account is not configured. Sign in to ContextGo and sync InferMesh first.');
    }

    return {
      provider: INFERMESH_PROVIDER_NAME,
      tokenGroup: input.group,
      modelCount: provider.model.length,
    };
  }

  public async configure(input: ManagedRuntimeModelConfigParams): Promise<ManagedRuntimeModelConfigResult> {
    if (input.provider !== 'infermesh') {
      throw new Error(`Unsupported runtime model provider: ${input.provider}`);
    }

    const target = RUNTIME_TARGETS[input.backend];
    if (!target) {
      throw new Error(`InferMesh provisioning is not supported for ${input.backend}.`);
    }

    const provider = await this.getInfermeshProvider(input.group);
    const model = chooseModel(provider, target, input.model);
    const writtenEntries = await this.configureBackend(input.backend, provider, model);

    return {
      backend: input.backend,
      provider: 'infermesh',
      model,
      baseUrl: provider.baseUrl,
      writtenEntries,
    };
  }

  private async getDeviceToken(): Promise<string> {
    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (typeof deviceToken !== 'string' || !deviceToken.trim()) {
      throw new Error('ContextGo cloud sign-in is required before configuring InferMesh.');
    }

    return deviceToken.trim();
  }

  private async getInfermeshProvider(group?: string): Promise<IProvider> {
    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (typeof deviceToken === 'string' && deviceToken.trim()) {
      await getInfermeshProviderSyncService().syncFromDeviceToken(deviceToken.trim(), { group });
    }

    const modelConfig = await ProcessConfig.get('model.config');
    const providers = isProviderList(modelConfig) ? modelConfig : [];
    const provider = providers.find((item) => item.id === INFERMESH_MANAGED_PROVIDER_ID);

    if (!provider?.apiKey?.trim() || !provider.baseUrl?.trim()) {
      throw new Error('InferMesh account is not configured. Sign in to ContextGo and sync InferMesh first.');
    }

    return provider;
  }

  private async configureBackend(
    backend: AcpBackend,
    provider: IProvider,
    model: string
  ): Promise<ManagedRuntimeConfigEntry[]> {
    switch (backend) {
      case 'codex':
        return this.configureCodex(provider, model);
      case 'claude':
        return this.configureClaude(provider, model);
      case 'gemini':
        return this.configureGemini(provider, model);
      case 'opencode':
        return this.configureOpencode(provider, model);
      default:
        throw new Error(`InferMesh provisioning is not supported for ${backend}.`);
    }
  }

  private async configureCodex(provider: IProvider, model: string): Promise<ManagedRuntimeConfigEntry[]> {
    const configPath = getCodexConfigPath();
    const authPath = getCodexAuthPath();
    const existingConfig = await readTextIfExists(configPath);
    const withTopLevel = upsertTopLevelTomlKeys(existingConfig, {
      model_provider: INFERMESH_PROVIDER_NAME,
      model,
      review_model: model,
    });
    const nextConfig = upsertTomlSection(
      withTopLevel,
      `model_providers.${INFERMESH_PROVIDER_NAME}`,
      [
        `name = ${formatTomlValue('InferMesh')}`,
        `base_url = ${formatTomlValue(withOpenAiPath(provider.baseUrl))}`,
        `wire_api = ${formatTomlValue('responses')}`,
        'requires_openai_auth = true',
      ].join('\n')
    );
    const existingAuth = await readJsonObject(authPath);

    await writeTextFile(configPath, nextConfig);
    await writeJsonFile(authPath, { ...existingAuth, OPENAI_API_KEY: provider.apiKey }, 0o600);

    return [buildEntry(configPath, 'config'), buildEntry(authPath, 'auth')];
  }

  private async configureClaude(provider: IProvider, model: string): Promise<ManagedRuntimeConfigEntry[]> {
    const settingsPath = getClaudeSettingsPath();
    const settings = await readJsonObject(settingsPath);
    const env = settings.env && typeof settings.env === 'object' && !Array.isArray(settings.env) ? settings.env : {};

    await writeJsonFile(settingsPath, {
      ...settings,
      model,
      env: {
        ...env,
        ANTHROPIC_BASE_URL: trimTrailingSlash(provider.baseUrl),
        ANTHROPIC_AUTH_TOKEN: provider.apiKey,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model.includes('haiku') ? model : 'claude-haiku-4-5-20251001',
        ANTHROPIC_DEFAULT_SONNET_MODEL: model.includes('sonnet') ? model : 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: model.includes('opus') ? model : 'claude-opus-4-7',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
      },
      includeCoAuthoredBy: false,
    });

    return [buildEntry(settingsPath, 'config')];
  }

  private async configureGemini(provider: IProvider, model: string): Promise<ManagedRuntimeConfigEntry[]> {
    const settings = await readJsonObject(GEMINI_SETTINGS_PATH);
    const security = (
      settings.security && typeof settings.security === 'object' && !Array.isArray(settings.security)
        ? settings.security
        : {}
    ) as Record<string, unknown>;
    const auth =
      security.auth && typeof security.auth === 'object' && !Array.isArray(security.auth)
        ? (security.auth as Record<string, unknown>)
        : {};
    const existingModel = (
      settings.model && typeof settings.model === 'object' && !Array.isArray(settings.model) ? settings.model : {}
    ) as Record<string, unknown>;
    const existingEnv = await readTextIfExists(GEMINI_ENV_PATH);

    await writeJsonFile(GEMINI_SETTINGS_PATH, {
      ...settings,
      security: {
        ...security,
        auth: {
          ...auth,
          selectedType: 'gemini-api-key',
        },
      },
      model: {
        ...existingModel,
        name: model,
      },
    });
    await writeTextFile(
      GEMINI_ENV_PATH,
      mergeDotenv(existingEnv, {
        GEMINI_API_KEY: provider.apiKey,
        GOOGLE_API_KEY: provider.apiKey,
        GEMINI_MODEL: model,
        GOOGLE_GEMINI_BASE_URL: trimTrailingSlash(provider.baseUrl),
      }),
      0o600
    );
    await this.updateAcpRuntimeConfig('gemini', { preferredModelId: model });

    return [buildEntry(GEMINI_SETTINGS_PATH, 'config'), buildEntry(GEMINI_ENV_PATH, 'auth')];
  }

  private async configureOpencode(provider: IProvider, model: string): Promise<ManagedRuntimeConfigEntry[]> {
    const configPath = getOpencodeConfigPath();
    const config = await readJsonObject(configPath);
    const providerConfig = isRecord(config.provider) ? config.provider : {};
    const openaiProvider = isRecord(providerConfig.openai) ? providerConfig.openai : {};
    const existingModels = isRecord(openaiProvider.models) ? openaiProvider.models : {};
    const opencodeModel = `openai/${model}`;

    await writeJsonFile(
      configPath,
      {
        ...config,
        model: opencodeModel,
        provider: {
          ...providerConfig,
          openai: {
            ...openaiProvider,
            options: {
              ...(isRecord(openaiProvider.options) ? openaiProvider.options : {}),
              baseURL: withOpenAiPath(provider.baseUrl),
              apiKey: provider.apiKey,
            },
            models: {
              ...existingModels,
              [model]: {
                name: model,
                options: {
                  store: false,
                },
              },
            },
          },
        },
      },
      0o600
    );
    const writtenEntries = [buildEntry(configPath, 'config')];
    if (hasOhMyOpenCodePlugin(config)) {
      const ohMyOpenCodeConfigPath = getOhMyOpenCodeConfigPath(configPath);
      await this.configureOhMyOpenCode(ohMyOpenCodeConfigPath, opencodeModel);
      writtenEntries.push(buildEntry(ohMyOpenCodeConfigPath, 'config'));
    }
    await this.updateAcpRuntimeConfig('opencode', { preferredModelId: model });

    return writtenEntries;
  }

  private async configureOhMyOpenCode(configPath: string, model: string): Promise<void> {
    const config = await readJsonObject(configPath);
    const agents = isRecord(config.agents) ? config.agents : {};
    const sisyphus = isRecord(agents.sisyphus) ? agents.sisyphus : {};
    const prometheus = isRecord(agents.prometheus) ? agents.prometheus : {};

    await writeJsonFile(
      configPath,
      {
        ...config,
        agents: {
          ...agents,
          sisyphus: {
            ...sisyphus,
            model,
          },
          prometheus: {
            ...prometheus,
            model,
          },
        },
      },
      0o600
    );
  }

  private async updateAcpRuntimeConfig(
    backend: AcpBackend,
    updates: { cliPath?: string; preferredModelId?: string }
  ): Promise<void> {
    const config = ((await ProcessConfig.get('acp.config')) ?? {}) as Record<string, Record<string, unknown>>;
    const current = config[backend] ?? {};
    await ProcessConfig.set('acp.config', {
      ...config,
      [backend]: {
        ...current,
        ...updates,
      },
    });
  }
}

let infermeshRuntimeProvisioningService: InfermeshRuntimeProvisioningService | null = null;

export function getInfermeshRuntimeProvisioningService(): InfermeshRuntimeProvisioningService {
  if (!infermeshRuntimeProvisioningService) {
    infermeshRuntimeProvisioningService = new InfermeshRuntimeProvisioningService();
  }

  return infermeshRuntimeProvisioningService;
}
