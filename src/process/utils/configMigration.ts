import { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';
import type { IConfigStorageRefer, IMcpServer } from '@/common/config/storage';

// Keys allowed to migrate from Electron config to server config.
// UI-only keys (theme, language, webui.desktop.*) and caches (acp.cachedModels)
// are intentionally excluded.
export const MIGRATABLE_KEYS: ReadonlyArray<keyof IConfigStorageRefer> = [
  'model.config',
  'gemini.config',
  'acp.config',
  'tools.imageGenerationModel',
  'mcp.config',
  'acp.customAgents',
] as const;

// Minimal interface for the config store — enables testing without real files.
export interface ConfigStore {
  get<K extends keyof IConfigStorageRefer>(key: K): Promise<IConfigStorageRefer[K]>;
  set<K extends keyof IConfigStorageRefer>(key: K, value: IConfigStorageRefer[K]): Promise<IConfigStorageRefer[K]>;
}

/**
 * Returns candidate Electron config file paths for the current platform.
 * Always returns two candidates (packaged + dev app name) since the server
 * cannot determine which Electron build the user ran.
 */
export function getElectronConfigCandidatePaths(): string[] {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const candidateDirs = [
      path.join(home, '.contextgo-config'),
      path.join(home, '.contextgo-config-dev'),
      path.join(home, '.contextgo-config'),
      path.join(home, '.contextgo-config-dev'),
    ];
    return [
      ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
      ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
    ];
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    const candidateDirs = [
      path.join(appData, 'ContextGo', 'config'),
      path.join(appData, 'ContextGo-Dev', 'config'),
      path.join(appData, 'ContextGo', 'config'),
      path.join(appData, 'ContextGo-Dev', 'config'),
    ];
    return [
      ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
      ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
    ];
  }
  // Linux and other platforms
  const candidateDirs = [
    path.join(home, '.config', 'ContextGo', 'config'),
    path.join(home, '.config', 'ContextGo-Dev', 'config'),
    path.join(home, '.config', 'ContextGo', 'config'),
    path.join(home, '.config', 'ContextGo-Dev', 'config'),
  ];
  return [
    ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
    ...candidateDirs.map((dir) => path.join(dir, 'contextgo-config.txt')),
  ];
}

/**
 * Decode a config file written by JsonFileBuilder (base64 → URL-decode → JSON).
 * Returns {} on any error (missing file, corrupted content, invalid JSON).
 */
export function decodeConfigFile(filePath: string): Partial<IConfigStorageRefer> {
  try {
    const raw = readFileSync(filePath, 'utf8').trim();
    if (!raw) return {};
    const decoded = decodeURIComponent(atob(raw));
    if (!decoded.trim()) return {};
    return JSON.parse(decoded) as Partial<IConfigStorageRefer>;
  } catch {
    return {};
  }
}

/**
 * Filter mcp.config: remove builtin entries (their command paths are machine-local
 * and are recreated by ensureBuiltinMcpServers on every startup anyway).
 */
function filterMcpConfig(servers: IMcpServer[]): IMcpServer[] {
  return servers.filter((s) => !s.builtin);
}

/**
 * Auto-migration: on first server startup, copy whitelisted keys from the
 * Electron desktop config file (if present) to the server config store.
 * Uses a migration flag to run only once.
 */
export async function migrateFromElectronConfig(configStore: ConfigStore): Promise<void> {
  try {
    // Already migrated — skip
    const alreadyMigrated = await configStore.get('migration.electronConfigImported').catch((): undefined => undefined);
    if (alreadyMigrated) return;

    // Find the first existing Electron config file
    const candidates = getElectronConfigCandidatePaths();
    const sourcePath = candidates.find((p) => existsSync(p));
    if (!sourcePath) return;

    // Decode — if result is empty, the file is missing/corrupted; do NOT set flag
    const sourceData = decodeConfigFile(sourcePath);
    if (Object.keys(sourceData).length === 0) {
      console.warn('[ContextGo] Config migration: source file appears empty or corrupted, will retry next startup');
      return;
    }

    // Copy whitelisted keys that are absent in the server config
    for (const key of MIGRATABLE_KEYS) {
      const sourceValue = sourceData[key];
      if (sourceValue === undefined) continue;

      const existing = await configStore.get(key).catch((): undefined => undefined);
      if (existing !== undefined && existing !== null) continue;

      // Special handling: filter builtin MCP entries
      if (key === 'mcp.config' && Array.isArray(sourceValue)) {
        const filtered = filterMcpConfig(sourceValue as IMcpServer[]);
        if (filtered.length > 0) {
          await configStore.set(key, filtered as IConfigStorageRefer[typeof key]);
        }
        continue;
      }

      await configStore.set(key, sourceValue as IConfigStorageRefer[typeof key]);
    }

    await configStore.set('migration.electronConfigImported', true);
    console.log('[ContextGo] Config migrated from Electron desktop config:', sourcePath);
  } catch (error) {
    console.warn('[ContextGo] Config migration from Electron failed:', error);
  }
}

/**
 * Manual import: copy whitelisted keys from a specified config file into the
 * server config store. Runs on every startup when IMPORT_CONFIG_FROM is set.
 * @param sourcePath - absolute path to a contextgo-config.txt / contextgo-config.txt file
 * @param overwrite  - if true, overwrite existing keys; if false, skip them
 * @param configStore - injected config store (uses ProcessConfig in production)
 */
export async function importConfigFromFile(
  sourcePath: string,
  overwrite: boolean,
  configStore: ConfigStore
): Promise<void> {
  try {
    // Warn on relative paths and resolve them
    if (!path.isAbsolute(sourcePath)) {
      const resolved = path.resolve(process.cwd(), sourcePath);
      console.warn('[ContextGo] IMPORT_CONFIG_FROM: relative path provided, resolving to:', resolved);
      sourcePath = resolved;
    }

    const sourceData = decodeConfigFile(sourcePath);
    if (Object.keys(sourceData).length === 0) {
      console.warn('[ContextGo] IMPORT_CONFIG_FROM: file is missing, empty, or corrupted:', sourcePath);
      return;
    }

    for (const key of MIGRATABLE_KEYS) {
      const sourceValue = sourceData[key];
      if (sourceValue === undefined) continue;

      if (!overwrite) {
        const existing = await configStore.get(key).catch((): undefined => undefined);
        if (existing !== undefined && existing !== null) continue;
      }

      // Special handling: filter builtin MCP entries
      if (key === 'mcp.config' && Array.isArray(sourceValue)) {
        const filtered = filterMcpConfig(sourceValue as IMcpServer[]);
        if (filtered.length > 0) {
          await configStore.set(key, filtered as IConfigStorageRefer[typeof key]);
        }
        continue;
      }

      await configStore.set(key, sourceValue as IConfigStorageRefer[typeof key]);
    }

    console.log('[ContextGo] Config imported from:', sourcePath, '(overwrite:', overwrite, ')');
  } catch (error) {
    console.warn('[ContextGo] IMPORT_CONFIG_FROM failed:', error);
  }
}
