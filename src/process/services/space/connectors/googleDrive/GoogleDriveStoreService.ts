/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  GoogleDriveFile,
  GoogleDriveStoredFile,
  GoogleDriveStoreStats,
  GoogleDriveSyncResult,
} from '@/common/types/connectors/googleDrive';

type GoogleDriveStoreBaseDirResolver = () => Promise<string>;

const defaultBaseDirResolver: GoogleDriveStoreBaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const baseDir = path.join(getDataPath(), 'store', 'connectors', 'google-drive');
  ensureDirectory(baseDir);
  return baseDir;
};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const parseJsonFile = async <T>(filePath: string): Promise<T[]> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return ensureArray<T>(JSON.parse(content));
  } catch {
    return [];
  }
};

const writeJsonFile = async <T>(filePath: string, value: readonly T[]): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const buildRecordId = (file: GoogleDriveFile): string => {
  return createHash('sha256').update(`${file.id}:${file.name}:${file.modifiedTime || ''}:${file.sizeBytes || 0}`).digest('hex');
};

export class GoogleDriveStoreService {
  constructor(private readonly resolveBaseDir: GoogleDriveStoreBaseDirResolver = defaultBaseDirResolver) {}

  private async getBaseDir(): Promise<string> {
    return this.resolveBaseDir();
  }

  private async getFilesPath(): Promise<string> {
    return path.join(await this.getBaseDir(), 'files.json');
  }

  private async readStoredFiles(): Promise<GoogleDriveStoredFile[]> {
    return parseJsonFile<GoogleDriveStoredFile>(await this.getFilesPath());
  }

  private async writeStoredFiles(files: readonly GoogleDriveStoredFile[]): Promise<void> {
    const sorted = [...files].sort((left, right) => {
      const leftTime = left.modifiedTime || '';
      const rightTime = right.modifiedTime || '';
      return rightTime.localeCompare(leftTime) || left.name.localeCompare(right.name);
    });
    await writeJsonFile(await this.getFilesPath(), sorted);
  }

  async getStats(): Promise<GoogleDriveStoreStats> {
    const files = await this.readStoredFiles();
    return {
      fileCount: files.length,
      lastSyncedAt: files[0]?.syncedAt,
      storeDir: await this.getBaseDir(),
    };
  }

  async listStoredFiles(limit = 50): Promise<readonly GoogleDriveStoredFile[]> {
    return (await this.readStoredFiles()).slice(0, Math.max(1, limit));
  }

  async syncFiles(files: readonly GoogleDriveFile[]): Promise<GoogleDriveSyncResult> {
    const now = new Date().toISOString();
    const current = await this.readStoredFiles();
    const nextByFileId = new Map<string, GoogleDriveStoredFile>();

    for (const file of files) {
      nextByFileId.set(file.id, {
        recordId: buildRecordId(file),
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        createdTime: file.createdTime,
        modifiedByMeTime: file.modifiedByMeTime,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        driveId: file.driveId,
        parents: file.parents,
        ownerNames: file.ownerNames,
        sizeBytes: file.sizeBytes,
        shared: file.shared,
        starred: file.starred,
        trashed: file.trashed,
        syncedAt: now,
      });
    }

    await this.writeStoredFiles([...nextByFileId.values()]);

    return {
      storedCount: nextByFileId.size,
      syncedAt: now,
      storeDir: await this.getBaseDir(),
    };
  }
}
