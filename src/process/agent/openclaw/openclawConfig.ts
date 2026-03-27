/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenClaw Config Reader
 *
 * Reads OpenClaw configuration from ~/.openclaw/openclaw.json
 * to get gateway auth settings.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Config file paths
const DEFAULT_STATE_DIR = path.join(os.homedir(), '.openclaw');
const CONFIG_FILENAME = 'openclaw.json';
const LEGACY_CONFIG_FILENAMES = ['clawdbot.json', 'moltbot.json', 'moldbot.json'];

interface OpenClawGatewayAuth {
  mode?: 'none' | 'token' | 'password';
  token?: string;
  password?: string;
}

interface OpenClawGatewayConfig {
  port?: number;
  auth?: OpenClawGatewayAuth;
}

interface OpenClawAgentIdentity {
  name?: string;
  emoji?: string;
}

interface OpenClawAgentDefaults {
  workspace?: string;
  model?: string | { primary?: string };
  models?: Record<string, { alias?: string; label?: string; name?: string }>;
}

interface OpenClawAgentEntry {
  id?: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  identity?: OpenClawAgentIdentity;
  model?: string | { primary?: string };
  models?: Record<string, { alias?: string; label?: string; name?: string }>;
}

interface OpenClawAgentsConfig {
  defaults?: OpenClawAgentDefaults;
  list?: OpenClawAgentEntry[];
}

interface OpenClawProviderModelEntry {
  id?: string;
  name?: string;
}

interface OpenClawModelsProviderEntry {
  models?: OpenClawProviderModelEntry[];
}

interface OpenClawModelsConfig {
  providers?: Record<string, OpenClawModelsProviderEntry>;
}

interface OpenClawConfig {
  gateway?: OpenClawGatewayConfig;
  agents?: OpenClawAgentsConfig;
  models?: OpenClawModelsConfig;
}

export interface OpenClawNativeAgentSummary {
  agentId: string;
  name: string;
  workspace: string;
  avatar?: string;
  isDefault: boolean;
}

export interface OpenClawConfiguredModelSummary {
  id: string;
  label: string;
  providerId?: string;
  alias?: string;
}

/**
 * Resolve the state directory (default: ~/.openclaw)
 */
function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }

  const newDir = DEFAULT_STATE_DIR;
  const legacyDirs = ['.clawdbot', '.moltbot', '.moldbot'].map((dir) => path.join(os.homedir(), dir));

  if (fs.existsSync(newDir)) {
    return newDir;
  }

  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });

  if (existingLegacy) {
    return existingLegacy;
  }

  return newDir;
}

/**
 * Resolve user path (expand ~ to home directory)
 */
function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('~')) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

/**
 * Find the config file path
 */
function findConfigPath(): string | null {
  const override = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override);
  }

  const stateDir = resolveStateDir();
  const candidates = [CONFIG_FILENAME, ...LEGACY_CONFIG_FILENAMES].map((name) => path.join(stateDir, name));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Read OpenClaw config from file
 */
export function readOpenClawConfig(): OpenClawConfig | null {
  const configPath = findConfigPath();
  if (!configPath) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    try {
      return JSON.parse(content) as OpenClawConfig;
    } catch {
      // If standard parse fails, try removing comments (JSONC style)
      // Use a string-aware approach: skip // and /* */ only outside quoted strings
      const cleanContent = content.replace(/"(?:[^"\\]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//gm, (match) =>
        match.startsWith('"') ? match : match.startsWith('/*') ? '' : ''
      );
      return JSON.parse(cleanContent) as OpenClawConfig;
    }
  } catch (error) {
    console.warn('[OpenClawConfig] Failed to read config:', error);
    return null;
  }
}

function normalizeAgentId(input?: string): string {
  return input?.trim().toLowerCase() || 'main';
}

function getConfiguredAgentEntries(config: OpenClawConfig): OpenClawAgentEntry[] {
  return Array.isArray(config.agents?.list)
    ? config.agents.list.filter(
        (entry): entry is OpenClawAgentEntry => !!entry && typeof entry === 'object' && typeof entry.id === 'string'
      )
    : [];
}

function resolveDefaultAgentId(config: OpenClawConfig): string {
  const entries = getConfiguredAgentEntries(config);
  if (entries.length === 0) {
    return 'main';
  }

  const explicitDefault = entries.find((entry) => entry.default === true);
  return normalizeAgentId(explicitDefault?.id ?? entries[0]?.id);
}

function resolveDefaultWorkspaceDir(): string {
  return path.join(resolveStateDir(), 'workspace');
}

function resolveAgentWorkspace(config: OpenClawConfig, agentId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId);
  const entry = getConfiguredAgentEntries(config).find(
    (candidate) => normalizeAgentId(candidate.id) === normalizedAgentId
  );
  const explicitWorkspace = entry?.workspace?.trim();
  if (explicitWorkspace) {
    return resolveUserPath(explicitWorkspace);
  }

  if (normalizedAgentId === resolveDefaultAgentId(config)) {
    const defaultWorkspace = config.agents?.defaults?.workspace?.trim();
    return defaultWorkspace ? resolveUserPath(defaultWorkspace) : resolveDefaultWorkspaceDir();
  }

  return path.join(resolveStateDir(), `workspace-${normalizedAgentId}`);
}

function getConfiguredAgentEntry(config: OpenClawConfig, agentId: string): OpenClawAgentEntry | undefined {
  const normalizedAgentId = normalizeAgentId(agentId);
  return getConfiguredAgentEntries(config).find((candidate) => normalizeAgentId(candidate.id) === normalizedAgentId);
}

function normalizeModelId(input: unknown): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed || null;
  }

  if (input && typeof input === 'object') {
    const primary = (input as { primary?: unknown }).primary;
    if (typeof primary === 'string') {
      const trimmed = primary.trim();
      return trimmed || null;
    }
  }

  return null;
}

function getConfiguredModelAliases(
  config: OpenClawConfig,
  agentId: string
): Record<string, { alias?: string; label?: string; name?: string }> {
  const agentEntry = getConfiguredAgentEntry(config, agentId);
  return {
    ...config.agents?.defaults?.models,
    ...agentEntry?.models,
  };
}

function resolveConfiguredModelLabel(
  modelId: string,
  modelName: string | undefined,
  aliasConfig: { alias?: string; label?: string; name?: string } | undefined
): string {
  const explicitLabel = aliasConfig?.label?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  const alias = aliasConfig?.alias?.trim();
  if (alias) {
    return alias;
  }

  const configuredName = aliasConfig?.name?.trim();
  if (configuredName) {
    return configuredName;
  }

  const resolvedName = modelName?.trim();
  if (resolvedName) {
    return resolvedName;
  }

  return modelId;
}

function buildAgentDisplayName(entry: OpenClawAgentEntry | undefined, agentId: string, isDefault: boolean): string {
  const identityName = entry?.identity?.name?.trim();
  const configuredName = entry?.name?.trim();
  const baseName = identityName || configuredName || (isDefault ? 'OpenClaw' : agentId);

  if (isDefault || baseName.toLowerCase() === agentId.toLowerCase()) {
    return baseName;
  }

  return `${baseName} (${agentId})`;
}

export function listConfiguredOpenClawAgents(): OpenClawNativeAgentSummary[] {
  const config = readOpenClawConfig();
  if (!config) {
    return [];
  }

  const entries = getConfiguredAgentEntries(config);
  const defaultAgentId = resolveDefaultAgentId(config);

  if (entries.length === 0) {
    return [
      {
        agentId: defaultAgentId,
        name: 'OpenClaw',
        workspace: resolveAgentWorkspace(config, defaultAgentId),
        isDefault: true,
      },
    ];
  }

  const seen = new Set<string>();
  const summaries: OpenClawNativeAgentSummary[] = [];

  for (const entry of entries) {
    const agentId = normalizeAgentId(entry.id);
    if (seen.has(agentId)) {
      continue;
    }
    seen.add(agentId);

    summaries.push({
      agentId,
      name: buildAgentDisplayName(entry, agentId, agentId === defaultAgentId),
      workspace: resolveAgentWorkspace(config, agentId),
      avatar: entry.identity?.emoji?.trim() || undefined,
      isDefault: agentId === defaultAgentId,
    });
  }

  return summaries;
}

export function listConfiguredOpenClawModels(agentId?: string): OpenClawConfiguredModelSummary[] {
  const config = readOpenClawConfig();
  if (!config) {
    return [];
  }

  const resolvedAgentId = normalizeAgentId(agentId || resolveDefaultAgentId(config));
  const configuredAliases = getConfiguredModelAliases(config, resolvedAgentId);
  const agentEntry = getConfiguredAgentEntry(config, resolvedAgentId);
  const configuredPrimaryModel =
    normalizeModelId(agentEntry?.model) || normalizeModelId(config.agents?.defaults?.model) || null;

  const dedupedModels = new Map<string, OpenClawConfiguredModelSummary>();
  const setModel = (modelId: string, label: string, providerId?: string, alias?: string) => {
    const trimmedId = modelId.trim();
    if (!trimmedId) {
      return;
    }

    const current = dedupedModels.get(trimmedId);
    if (!current || current.label === current.id) {
      dedupedModels.set(trimmedId, {
        id: trimmedId,
        label: label || trimmedId,
        providerId,
        alias,
      });
    }
  };

  Object.entries(config.models?.providers || {}).forEach(([providerId, providerConfig]) => {
    const normalizedProviderId = providerId.trim();
    (providerConfig.models || []).forEach((model) => {
      const rawModelId = model.id?.trim();
      if (!rawModelId) {
        return;
      }

      const fullModelId = rawModelId.includes('/') ? rawModelId : `${normalizedProviderId}/${rawModelId}`;
      const aliasConfig = configuredAliases[fullModelId];
      setModel(
        fullModelId,
        resolveConfiguredModelLabel(fullModelId, model.name, aliasConfig),
        normalizedProviderId,
        aliasConfig?.alias?.trim() || undefined
      );
    });
  });

  Object.entries(configuredAliases).forEach(([modelId, aliasConfig]) => {
    const trimmedModelId = modelId.trim();
    if (!trimmedModelId) {
      return;
    }

    setModel(
      trimmedModelId,
      resolveConfiguredModelLabel(trimmedModelId, undefined, aliasConfig),
      trimmedModelId.includes('/') ? trimmedModelId.split('/')[0] : undefined,
      aliasConfig.alias?.trim() || undefined
    );
  });

  if (configuredPrimaryModel) {
    const aliasConfig = configuredAliases[configuredPrimaryModel];
    setModel(
      configuredPrimaryModel,
      resolveConfiguredModelLabel(configuredPrimaryModel, undefined, aliasConfig),
      configuredPrimaryModel.includes('/') ? configuredPrimaryModel.split('/')[0] : undefined,
      aliasConfig?.alias?.trim() || undefined
    );
  }

  return Array.from(dedupedModels.values());
}

/**
 * Get gateway auth settings from config
 */
export function getGatewayAuthFromConfig(): OpenClawGatewayAuth | null {
  const config = readOpenClawConfig();
  return config?.gateway?.auth ?? null;
}

/**
 * Get gateway auth token from config
 */
export function getGatewayAuthToken(): string | null {
  const auth = getGatewayAuthFromConfig();
  if (auth?.mode === 'token' && auth.token) {
    return auth.token;
  }
  return null;
}

/**
 * Get gateway auth password from config
 */
export function getGatewayAuthPassword(): string | null {
  const auth = getGatewayAuthFromConfig();
  if (auth?.mode === 'password' && auth.password) {
    return auth.password;
  }
  return null;
}

/**
 * Get gateway port from config
 */
export function getGatewayPort(): number {
  const config = readOpenClawConfig();
  const port = config?.gateway?.port;
  if (typeof port === 'number' && Number.isFinite(port) && port > 0) {
    return port;
  }
  return 18789; // Default port
}
