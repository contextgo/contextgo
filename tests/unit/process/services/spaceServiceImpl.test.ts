/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISpaceRepository } from '../../../../src/process/services/database/space/ISpaceRepository';
import { SpaceServiceImpl } from '../../../../src/process/services/space/SpaceServiceImpl';

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
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing default space when present', async () => {
    const existingSpace = {
      id: 'space-1',
      name: 'My Space',
      engine: 'affine',
      isDefault: true,
      createTime: 1,
      modifyTime: 1,
    };
    const repo = makeRepo({
      getDefaultSpace: vi.fn(async () => existingSpace),
    });
    const service = new SpaceServiceImpl(repo);

    const result = await service.ensureDefaultSpace();

    expect(result).toEqual(existingSpace);
    expect(repo.createSpace).not.toHaveBeenCalled();
  });

  it('creates a deterministic default space when missing', async () => {
    const repo = makeRepo({
      getDefaultSpace: vi.fn(async () => undefined),
    });
    const service = new SpaceServiceImpl(repo);

    const result = await service.ensureDefaultSpace();

    expect(result.name).toBe('My Space');
    expect(result.engine).toBe('affine');
    expect(result.isDefault).toBe(true);
    expect(repo.createSpace).toHaveBeenCalledWith(expect.objectContaining({ id: result.id, name: 'My Space' }));
  });
});
