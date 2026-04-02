import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  GoogleDoc,
  GoogleDocsStoredDocument,
  GoogleDocsStoreStats,
  GoogleDocsSyncResult,
} from '@/common/types/connectors/googleDocs';

type GoogleDocsStoreBaseDirResolver = () => Promise<string>;

const defaultBaseDirResolver: GoogleDocsStoreBaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const baseDir = path.join(getDataPath(), 'store', 'connectors', 'google-docs');
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

const buildRecordId = (doc: GoogleDoc): string => {
  return createHash('sha256')
    .update(`${doc.id}:${doc.title}:${doc.modifiedTime || ''}:${doc.sizeBytes || 0}`)
    .digest('hex');
};

export class GoogleDocsStoreService {
  constructor(private readonly resolveBaseDir: GoogleDocsStoreBaseDirResolver = defaultBaseDirResolver) {}

  private async getBaseDir(): Promise<string> {
    return this.resolveBaseDir();
  }

  private async getDocsPath(): Promise<string> {
    return path.join(await this.getBaseDir(), 'documents.json');
  }

  private async readStoredDocuments(): Promise<GoogleDocsStoredDocument[]> {
    return parseJsonFile<GoogleDocsStoredDocument>(await this.getDocsPath());
  }

  private async writeStoredDocuments(docs: readonly GoogleDocsStoredDocument[]): Promise<void> {
    const sorted = [...docs].sort((left, right) => (right.modifiedTime || '').localeCompare(left.modifiedTime || ''));
    await writeJsonFile(await this.getDocsPath(), sorted);
  }

  async getStats(): Promise<GoogleDocsStoreStats> {
    const docs = await this.readStoredDocuments();
    return {
      docCount: docs.length,
      lastSyncedAt: docs[0]?.syncedAt,
      storeDir: await this.getBaseDir(),
    };
  }

  async listStoredDocuments(limit = 50): Promise<readonly GoogleDocsStoredDocument[]> {
    return (await this.readStoredDocuments()).slice(0, Math.max(1, limit));
  }

  async syncDocuments(docs: readonly GoogleDoc[]): Promise<GoogleDocsSyncResult> {
    const now = new Date().toISOString();
    const next = docs.map((doc) => ({
      recordId: buildRecordId(doc),
      documentId: doc.id,
      title: doc.title,
      mimeType: doc.mimeType,
      modifiedTime: doc.modifiedTime,
      createdTime: doc.createdTime,
      webViewLink: doc.webViewLink,
      ownerNames: doc.ownerNames,
      sizeBytes: doc.sizeBytes,
      starred: doc.starred,
      trashed: doc.trashed,
      syncedAt: now,
    }));
    await this.writeStoredDocuments(next);
    return {
      storedCount: next.length,
      syncedAt: now,
      storeDir: await this.getBaseDir(),
    };
  }
}
