import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ensureObsidianVaultBootstrap,
  obsidianVaultBootstrapInternals,
} from '../../../src/process/services/space/obsidianVaultBootstrap';

const TEMP_ROOT = path.join(os.tmpdir(), 'contextgo-obsidian-bootstrap-tests');

const providerRef = {
  kind: 'obsidian-vault' as const,
  vaultPath: path.join(TEMP_ROOT, 'vaults', 'my-space-1234abcd'),
  vaultName: 'My Space',
  landingNotePath: 'Home.md',
  launchStrategy: 'obsidian-uri' as const,
};

describe('ensureObsidianVaultBootstrap', () => {
  beforeEach(async () => {
    await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  });

  it('creates a minimal Obsidian vault structure and registers the vault', async () => {
    await fs.mkdir(providerRef.vaultPath, { recursive: true });
    const registryPath = path.join(TEMP_ROOT, 'obsidian-config', 'obsidian', 'obsidian.json');

    await ensureObsidianVaultBootstrap(providerRef, {
      platform: 'linux',
      xdgConfigHome: path.join(TEMP_ROOT, 'obsidian-config'),
      now: () => 1234567890,
    });

    const workspace = JSON.parse(
      await fs.readFile(path.join(providerRef.vaultPath, '.obsidian', 'workspace.json'), 'utf8')
    ) as {
      lastOpenFiles: string[];
      active: string;
    };
    const corePlugins = JSON.parse(
      await fs.readFile(path.join(providerRef.vaultPath, '.obsidian', 'core-plugins.json'), 'utf8')
    ) as Record<string, boolean>;
    const graph = JSON.parse(
      await fs.readFile(path.join(providerRef.vaultPath, '.obsidian', 'graph.json'), 'utf8')
    ) as {
      colorGroups: Array<{ query: string; color: { a: number; rgb: number } }>;
      'collapse-color-groups': boolean;
    };
    const rawRegistry = await fs.readFile(registryPath, 'utf8');
    expect(rawRegistry).toContain('\"open\": true');

    const registry = JSON.parse(rawRegistry) as {
      vaults: Record<string, { path: string; ts: number; open?: boolean }>;
    };
    const vaultId = obsidianVaultBootstrapInternals.buildFallbackVaultId(providerRef.vaultPath);

    expect(workspace.lastOpenFiles).toEqual(['Home.md']);
    expect(workspace.active).toBe('contextgo-home');
    expect(corePlugins['file-explorer']).toBe(true);
    expect(corePlugins.canvas).toBe(true);
    expect(graph['collapse-color-groups']).toBe(false);
    expect(graph.colorGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ query: 'path:"Projects/"', color: expect.any(Object) }),
        expect.objectContaining({ query: 'path:"Projects/" path:"/Sources/"' }),
        expect.objectContaining({ query: 'path:"Projects/" path:"/Sessions/"' }),
      ])
    );
    expect(registry.vaults[vaultId]).toEqual({
      path: providerRef.vaultPath,
      ts: 1234567890,
      open: true,
    });
  });

  it('reuses an existing registered vault id instead of adding a duplicate registry entry', async () => {
    await fs.mkdir(providerRef.vaultPath, { recursive: true });
    const obsidianConfigDir = path.join(TEMP_ROOT, 'obsidian-config');
    const registryPath = path.join(obsidianConfigDir, 'obsidian', 'obsidian.json');
    const existingId = 'existing-vault-id';

    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(
      registryPath,
      JSON.stringify(
        {
          vaults: {
            [existingId]: {
              path: providerRef.vaultPath,
              ts: 42,
              open: false,
            },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    await ensureObsidianVaultBootstrap(providerRef, {
      platform: 'linux',
      xdgConfigHome: obsidianConfigDir,
      now: () => 999,
    });

    const rawRegistry = await fs.readFile(registryPath, 'utf8');
    expect(rawRegistry).toContain('\"open\": true');

    const registry = JSON.parse(rawRegistry) as {
      vaults: Record<string, { path: string; ts: number; open?: boolean }>;
    };

    expect(Object.keys(registry.vaults)).toEqual([existingId]);
    expect(registry.vaults[existingId]).toEqual({
      path: providerRef.vaultPath,
      ts: 42,
      open: true,
    });
  });
});
