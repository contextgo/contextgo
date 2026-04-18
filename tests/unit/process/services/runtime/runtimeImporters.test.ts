import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtimeImporters', () => {
  let tempRoot: string;
  let homeDir: string;
  let workspace: string;
  let originalHome: string | undefined;
  let originalXdgConfigHome: string | undefined;
  let originalXdgDataHome: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-runtime-importers-'));
    homeDir = path.join(tempRoot, 'home');
    workspace = path.join(tempRoot, 'workspace');
    originalHome = process.env.HOME;
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    originalXdgDataHome = process.env.XDG_DATA_HOME;

    process.env.HOME = homeDir;
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(workspace, { recursive: true });
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    if (originalXdgDataHome === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = originalXdgDataHome;
    }

    await fs.rm(tempRoot, {
      recursive: true,
      force: true,
    });
  });

  it('allows partial backend imports when only the primary config file exists', async () => {
    await fs.mkdir(path.join(homeDir, '.codex'), { recursive: true });
    await fs.writeFile(path.join(homeDir, '.codex', 'config.toml'), 'model = "gpt-5.4"\n', 'utf-8');

    const { importProjectLocalRuntimeForBackend } = await import('@process/services/runtime/runtimeImporters');

    const result = await importProjectLocalRuntimeForBackend(workspace, 'codex');

    expect(result.imported).toBe(true);
    expect(result.importedFrom).toEqual({
      codex: '~/.codex/config.toml',
    });
    await expect(fs.readFile(path.join(workspace, '.contextgo', 'codex', 'config.toml'), 'utf-8')).resolves.toContain(
      'gpt-5.4'
    );
    await expect(fs.access(path.join(workspace, '.contextgo', 'codex', 'auth.json'))).rejects.toThrow();
  });

  it('keeps the existing backend override intact when a multi-file import fails midway', async () => {
    const sourceDir = path.join(homeDir, '.codex');
    const targetDir = path.join(workspace, '.contextgo', 'codex');

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'config.toml'), 'model = "gpt-5.4"\n', 'utf-8');
    await fs.writeFile(path.join(sourceDir, 'auth.json'), '{"token":"new"}\n', 'utf-8');

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, 'config.toml'), 'model = "old-model"\n', 'utf-8');
    await fs.writeFile(path.join(targetDir, 'auth.json'), '{"token":"old"}\n', 'utf-8');

    const actualCopyFile = fs.copyFile.bind(fs);
    let copyCount = 0;
    vi.spyOn(fs, 'copyFile').mockImplementation(async (...args: Parameters<typeof fs.copyFile>) => {
      copyCount += 1;
      if (copyCount === 2) {
        throw new Error('copy failed');
      }

      return actualCopyFile(...args);
    });

    const { importProjectLocalRuntimeForBackend } = await import('@process/services/runtime/runtimeImporters');

    await expect(importProjectLocalRuntimeForBackend(workspace, 'codex')).rejects.toThrow('copy failed');

    await expect(fs.readFile(path.join(targetDir, 'config.toml'), 'utf-8')).resolves.toContain('old-model');
    await expect(fs.readFile(path.join(targetDir, 'auth.json'), 'utf-8')).resolves.toContain('"old"');
  });

  it('uses the resolved Codex global paths instead of assuming ~/.codex on every platform', async () => {
    const customCodexRoot = path.join(tempRoot, 'custom-codex');
    const customConfigPath = path.join(customCodexRoot, 'config.toml');
    const customAuthPath = path.join(customCodexRoot, 'auth.json');

    await fs.mkdir(customCodexRoot, { recursive: true });
    await fs.writeFile(customConfigPath, 'model = "gpt-5.4"\n', 'utf-8');
    await fs.writeFile(customAuthPath, '{"token":"custom"}\n', 'utf-8');

    vi.doMock('@process/agent/codex/connection/CodexConnection', () => ({
      getCodexConfigPath: vi.fn(() => customConfigPath),
      getCodexAuthPath: vi.fn(() => customAuthPath),
    }));

    const { importProjectLocalRuntimeForBackend } = await import('@process/services/runtime/runtimeImporters');

    const result = await importProjectLocalRuntimeForBackend(workspace, 'codex');

    expect(result.imported).toBe(true);
    await expect(fs.readFile(path.join(workspace, '.contextgo', 'codex', 'config.toml'), 'utf-8')).resolves.toContain(
      'gpt-5.4'
    );
    await expect(fs.readFile(path.join(workspace, '.contextgo', 'codex', 'auth.json'), 'utf-8')).resolves.toContain(
      '"custom"'
    );
  });

  it('uses XDG OpenCode paths when importing project runtime state', async () => {
    const xdgConfigHome = path.join(tempRoot, 'xdg-config');
    const xdgDataHome = path.join(tempRoot, 'xdg-data');
    const sourceConfigPath = path.join(xdgConfigHome, 'opencode', 'opencode.json');
    const sourceAuthPath = path.join(xdgDataHome, 'opencode', 'auth.json');

    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.XDG_DATA_HOME = xdgDataHome;

    await fs.mkdir(path.dirname(sourceConfigPath), { recursive: true });
    await fs.mkdir(path.dirname(sourceAuthPath), { recursive: true });
    await fs.writeFile(sourceConfigPath, '{"model":"gpt-5.4"}\n', 'utf-8');
    await fs.writeFile(sourceAuthPath, '{"token":"xdg-auth"}\n', 'utf-8');

    const { importProjectLocalRuntimeForBackend } = await import('@process/services/runtime/runtimeImporters');

    const result = await importProjectLocalRuntimeForBackend(workspace, 'opencode');

    expect(result.imported).toBe(true);
    await expect(
      fs.readFile(path.join(workspace, '.contextgo', 'opencode', 'opencode.json'), 'utf-8')
    ).resolves.toContain('"gpt-5.4"');
    await expect(fs.readFile(path.join(workspace, '.contextgo', 'opencode', 'auth.json'), 'utf-8')).resolves.toContain(
      '"xdg-auth"'
    );
  });
});
