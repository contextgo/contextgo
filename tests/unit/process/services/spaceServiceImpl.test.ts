/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TSpace } from '../../../../src/common/config/storage';
import type { ISpaceRepository } from '../../../../src/process/services/database/space/ISpaceRepository';
import { SpaceServiceImpl } from '../../../../src/process/services/space/SpaceServiceImpl';

const ensureSpaceVaultBindingMock = vi.fn();
const execFileMock = vi.fn();
const originalPlatform = process.platform;

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock('../../../../src/process/services/space/vaultBinding', () => ({
  ensureSpaceVaultBinding: (...args: unknown[]) => ensureSpaceVaultBindingMock(...args),
  isSpaceVaultProviderRef: (providerRef?: { kind?: string }) => providerRef?.kind === 'obsidian-vault',
}));

const createVaultProviderRef = (space: Pick<TSpace, 'id' | 'name'>) => ({
  kind: 'obsidian-vault' as const,
  vaultPath: `/tmp/vaults/${space.id}`,
  vaultName: `${space.name.replace(/\s+/g, '-')}-${space.id}`,
  landingNotePath: 'Home.md',
  launchStrategy: 'obsidian-app' as const,
});

function makeRepo(overrides: Partial<ISpaceRepository> = {}): ISpaceRepository {
  return {
    getSpace: vi.fn(),
    getDefaultSpace: vi.fn(),
    listSpaces: vi.fn(async () => []),
    createSpace: vi.fn(async () => {}),
    updateSpace: vi.fn(async () => {}),
    archiveSpace: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('SpaceServiceImpl', () => {
  const syncSpaceVaultMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    vi.clearAllMocks();
    ensureSpaceVaultBindingMock.mockImplementation(async (space: Pick<TSpace, 'id' | 'name'>) =>
      createVaultProviderRef(space)
    );
    execFileMock.mockImplementation((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
      callback?.(null);
    });
    syncSpaceVaultMock.mockClear();
    syncSpaceVaultMock.mockResolvedValue(undefined);
  });

  it('migrates an existing default space to a vault-backed provider ref when present', async () => {
    const existingSpace = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      isDefault: true,
      createTime: 1,
      modifyTime: 1,
    };
    const repo = makeRepo({
      getDefaultSpace: vi.fn(async () => existingSpace),
    });
    const service = new SpaceServiceImpl(repo, syncSpaceVaultMock);

    const result = await service.ensureDefaultSpace();

    expect(result.engine).toBe('vault');
    expect(result.providerRef).toEqual(createVaultProviderRef(existingSpace));
    expect(repo.createSpace).not.toHaveBeenCalled();
    expect(repo.updateSpace).toHaveBeenCalledWith(
      'space-1',
      expect.objectContaining({ engine: 'vault', providerRef: createVaultProviderRef(existingSpace) })
    );
  });

  it('creates a deterministic default space when missing', async () => {
    const repo = makeRepo({
      getDefaultSpace: vi.fn(async () => undefined),
    });
    const service = new SpaceServiceImpl(repo, syncSpaceVaultMock);

    const result = await service.ensureDefaultSpace();

    expect(result.name).toBe('Default Space');
    expect(result.engine).toBe('vault');
    expect(result.isDefault).toBe(true);
    expect(result.providerRef).toEqual(createVaultProviderRef(result));
    expect(repo.createSpace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        name: 'Default Space',
        engine: 'vault',
        providerRef: result.providerRef,
      })
    );
    expect(syncSpaceVaultMock).toHaveBeenCalledWith(expect.objectContaining({ id: result.id, name: 'Default Space' }));
  });

  it('opens the bound vault through Obsidian.app before falling back to uri handlers', async () => {
    const existingSpace = {
      id: 'space-open',
      name: 'Studio Vault',
      engine: 'vault',
      providerRef: createVaultProviderRef({ id: 'space-open', name: 'Studio Vault' }),
      createTime: 1,
      modifyTime: 1,
    } satisfies TSpace;
    const repo = makeRepo({
      getSpace: vi.fn(async () => existingSpace),
    });
    const service = new SpaceServiceImpl(repo, syncSpaceVaultMock);

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    const result = await service.openSpaceVault('space-open');

    expect(result).toEqual({
      opened: true,
      fallback: 'none',
      target: '/tmp/vaults/space-open',
      obsidianInstalled: true,
    });
    expect(execFileMock).toHaveBeenCalledWith(
      'open',
      ['-a', 'Obsidian', '/tmp/vaults/space-open'],
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the Obsidian vault uri when opening the app directly fails', async () => {
    const existingSpace = {
      id: 'space-fallback',
      name: 'Fallback Vault',
      engine: 'vault',
      providerRef: createVaultProviderRef({ id: 'space-fallback', name: 'Fallback Vault' }),
      createTime: 1,
      modifyTime: 1,
    } satisfies TSpace;
    const repo = makeRepo({
      getSpace: vi.fn(async () => existingSpace),
    });
    const service = new SpaceServiceImpl(repo, syncSpaceVaultMock);

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    execFileMock
      .mockImplementationOnce((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(new Error('launch failed'));
      })
      .mockImplementation((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(null);
      });

    const result = await service.openSpaceVault('space-fallback');

    expect(result).toEqual({
      opened: true,
      fallback: 'none',
      target: 'obsidian://open?vault=Fallback-Vault-space-fallback&file=Home.md',
      obsidianInstalled: true,
    });
    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      'open',
      ['-a', 'Obsidian', '/tmp/vaults/space-fallback'],
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      'open',
      ['obsidian://open?vault=Fallback-Vault-space-fallback&file=Home.md'],
      expect.any(Function)
    );
  });

  it('opens the vault folder and reports Obsidian as missing when all Obsidian entrypoints fail', async () => {
    const existingSpace = {
      id: 'space-folder',
      name: 'Folder Vault',
      engine: 'vault',
      providerRef: createVaultProviderRef({ id: 'space-folder', name: 'Folder Vault' }),
      createTime: 1,
      modifyTime: 1,
    } satisfies TSpace;
    const repo = makeRepo({
      getSpace: vi.fn(async () => existingSpace),
    });
    const service = new SpaceServiceImpl(repo, syncSpaceVaultMock);

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    execFileMock
      .mockImplementationOnce((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(new Error('launch failed'));
      })
      .mockImplementationOnce((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(new Error('vault uri failed'));
      })
      .mockImplementationOnce((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(new Error('path uri failed'));
      })
      .mockImplementation((_command: string, _args: string[], callback?: (error: Error | null) => void) => {
        callback?.(null);
      });

    const result = await service.openSpaceVault('space-folder');

    expect(result).toEqual({
      opened: true,
      fallback: 'folder',
      target: '/tmp/vaults/space-folder',
      obsidianInstalled: false,
    });
    expect(execFileMock).toHaveBeenNthCalledWith(4, 'open', ['/tmp/vaults/space-folder'], expect.any(Function));
  });
});
