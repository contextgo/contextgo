/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';

import { GoogleDriveStoreService } from '../../src/process/services/space/connectors/googleDrive/GoogleDriveStoreService';

const tempDirs: string[] = [];

const createTempBaseDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-google-drive-store-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('GoogleDriveStoreService', () => {
  it('syncs files into ContextGo store', async () => {
    const baseDir = await createTempBaseDir();
    const service = new GoogleDriveStoreService(async () => baseDir);

    const result = await service.syncFiles([
      {
        id: 'file-1',
        name: 'Roadmap',
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '2026-03-30T10:00:00.000Z',
        webViewLink: 'https://drive.google.com/file/d/file-1/view',
      },
    ]);

    expect(result.storedCount).toBe(1);
    await expect(service.getStats()).resolves.toMatchObject({ fileCount: 1, storeDir: baseDir });
    await expect(service.listStoredFiles(10)).resolves.toHaveLength(1);
  });
});
