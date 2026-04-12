import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

// Helper: encode data the same way JsonFileBuilder does
const encodeConfig = (data: unknown): string =>
  Buffer.from(encodeURIComponent(JSON.stringify(data))).toString('base64');

describe('getElectronConfigCandidatePaths', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  it('returns both symlink candidates on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const { getElectronConfigCandidatePaths } = await import('../../../../src/process/utils/configMigration');
    const home = os.homedir();
    const paths = getElectronConfigCandidatePaths();
    expect(paths).toContain(path.join(home, '.contextgo-config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.contextgo-config-dev', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.contextgo-config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.contextgo-config-dev', 'contextgo-config.txt'));
    expect(paths).toHaveLength(8);
  });

  it('returns both app-name candidates on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const appData = 'C:\\Users\\test\\AppData\\Roaming';
    process.env.APPDATA = appData;
    const { getElectronConfigCandidatePaths } = await import('../../../../src/process/utils/configMigration');
    const paths = getElectronConfigCandidatePaths();
    expect(paths).toContain(path.join(appData, 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(appData, 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(appData, 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(appData, 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(appData, 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(appData, 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toHaveLength(8);
  });

  it('returns both app-name candidates on Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const { getElectronConfigCandidatePaths } = await import('../../../../src/process/utils/configMigration');
    const home = os.homedir();
    const paths = getElectronConfigCandidatePaths();
    expect(paths).toContain(path.join(home, '.config', 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.config', 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.config', 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.config', 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.config', 'ContextGo', 'config', 'contextgo-config.txt'));
    expect(paths).toContain(path.join(home, '.config', 'ContextGo-Dev', 'config', 'contextgo-config.txt'));
    expect(paths).toHaveLength(8);
  });
});

describe('MIGRATABLE_KEYS', () => {
  it('does not include removed MCP or image generation config keys', async () => {
    const { MIGRATABLE_KEYS } = await import('../../../../src/process/utils/configMigration');
    expect(MIGRATABLE_KEYS).not.toContain('mcp.config');
    expect(MIGRATABLE_KEYS).not.toContain('tools.imageGenerationModel');
  });
});

describe('migrateFromElectronConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('skips migration when flag is already set', async () => {
    const store: Record<string, unknown> = {
      'migration.electronConfigImported': true,
    };
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    const { migrateFromElectronConfig } = await import('../../../../src/process/utils/configMigration');
    await migrateFromElectronConfig(configStore as any);
    // set should never be called — migration was already done
    expect(configStore.set).not.toHaveBeenCalled();
  });

  it('skips migration when no Electron config file exists', async () => {
    const store: Record<string, unknown> = {};
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    // Explicitly mock existsSync to return false — do not rely on real filesystem
    // (CI machines might have ~/.contextgo-config from a previous run)
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue(''),
    }));
    const { migrateFromElectronConfig } = await import('../../../../src/process/utils/configMigration');
    await migrateFromElectronConfig(configStore as any);
    expect(configStore.set).not.toHaveBeenCalled();
  });

  it('does not set migration flag when source file decodes to {}', async () => {
    const store: Record<string, unknown> = {};
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(''), // empty → decodes to {}
    }));
    const { migrateFromElectronConfig } = await import('../../../../src/process/utils/configMigration');
    await migrateFromElectronConfig(configStore as any);
    expect(configStore.set).not.toHaveBeenCalled();
  });

  it('migrates whitelisted keys, skipping existing ones', async () => {
    const sourceData = {
      'model.config': [{ id: 'openai', name: 'OpenAI' }],
      'gemini.config': { authType: 'oauth', proxy: '' },
      language: 'zh-CN', // not whitelisted — should be ignored
    };
    const encodedSource = Buffer.from(encodeURIComponent(JSON.stringify(sourceData))).toString('base64');

    const store: Record<string, unknown> = {};
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(encodedSource),
    }));
    const { migrateFromElectronConfig } = await import('../../../../src/process/utils/configMigration');
    await migrateFromElectronConfig(configStore as any);

    expect(configStore.set).toHaveBeenCalledWith('model.config', sourceData['model.config']);
    expect(configStore.set).toHaveBeenCalledWith('gemini.config', sourceData['gemini.config']);
    // language must NOT be migrated
    expect(configStore.set).not.toHaveBeenCalledWith('language', expect.anything());
    // migration flag must be set
    expect(configStore.set).toHaveBeenCalledWith('migration.electronConfigImported', true);
  });

  it('does not overwrite keys that already exist in server config', async () => {
    const sourceData = { 'model.config': [{ id: 'openai' }] };
    const encodedSource = Buffer.from(encodeURIComponent(JSON.stringify(sourceData))).toString('base64');

    const store: Record<string, unknown> = {
      'model.config': [{ id: 'existing-provider' }], // already configured
    };
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(encodedSource),
    }));
    const { migrateFromElectronConfig } = await import('../../../../src/process/utils/configMigration');
    await migrateFromElectronConfig(configStore as any);

    expect(configStore.set).not.toHaveBeenCalledWith('model.config', expect.anything());
    // flag is still set even though no keys were actually written
    expect(configStore.set).toHaveBeenCalledWith('migration.electronConfigImported', true);
  });
});

describe('importConfigFromFile', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('skips import when file decodes to {}', async () => {
    const store: Record<string, unknown> = {};
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue(''),
    }));
    const { importConfigFromFile } = await import('../../../../src/process/utils/configMigration');
    await importConfigFromFile('/nonexistent/path.txt', false, configStore as any);
    expect(configStore.set).not.toHaveBeenCalled();
  });

  it('skips existing keys when overwrite=false', async () => {
    const sourceData = { 'model.config': [{ id: 'new' }], 'gemini.config': { authType: 'oauth', proxy: '' } };
    const encodedSource = Buffer.from(encodeURIComponent(JSON.stringify(sourceData))).toString('base64');
    const store: Record<string, unknown> = { 'model.config': [{ id: 'existing' }] };
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(encodedSource),
    }));
    const { importConfigFromFile } = await import('../../../../src/process/utils/configMigration');
    await importConfigFromFile('/path/contextgo-config.txt', false, configStore as any);
    expect(configStore.set).not.toHaveBeenCalledWith('model.config', expect.anything());
    expect(configStore.set).toHaveBeenCalledWith('gemini.config', sourceData['gemini.config']);
  });

  it('overwrites existing keys when overwrite=true', async () => {
    const sourceData = { 'model.config': [{ id: 'new' }] };
    const encodedSource = Buffer.from(encodeURIComponent(JSON.stringify(sourceData))).toString('base64');
    const store: Record<string, unknown> = { 'model.config': [{ id: 'existing' }] };
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(encodedSource),
    }));
    const { importConfigFromFile } = await import('../../../../src/process/utils/configMigration');
    await importConfigFromFile('/path/contextgo-config.txt', true, configStore as any);
    expect(configStore.set).toHaveBeenCalledWith('model.config', sourceData['model.config']);
  });

  it('resolves relative path and warns', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store: Record<string, unknown> = {};
    const configStore = {
      get: vi.fn(async (key: string) => store[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    };
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue(''),
    }));
    const { importConfigFromFile } = await import('../../../../src/process/utils/configMigration');
    await importConfigFromFile('relative/path.txt', false, configStore as any);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('relative path'), expect.any(String));
    warnSpy.mockRestore();
  });
});
