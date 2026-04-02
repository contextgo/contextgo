import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  GoogleSheet,
  GoogleSheetsStoredSpreadsheet,
  GoogleSheetsSyncResult,
} from '@/common/types/connectors/googleSheets';

type BaseDirResolver = () => Promise<string>;
const defaultResolver: BaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const dir = path.join(getDataPath(), 'store', 'connectors', 'google-sheets');
  ensureDirectory(dir);
  return dir;
};
const parseJson = async <T>(file: string): Promise<T[]> => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as T[];
  } catch {
    return [];
  }
};
const writeJson = async <T>(file: string, value: readonly T[]) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf-8');
};
const buildId = (sheet: GoogleSheet) =>
  createHash('sha256')
    .update(`${sheet.id}:${sheet.title}:${sheet.modifiedTime || ''}`)
    .digest('hex');
export class GoogleSheetsStoreService {
  constructor(private readonly resolveBaseDir: BaseDirResolver = defaultResolver) {}
  private async getBaseDir() {
    return this.resolveBaseDir();
  }
  private async getPath() {
    return path.join(await this.getBaseDir(), 'spreadsheets.json');
  }
  async getStats() {
    const rows = await parseJson<GoogleSheetsStoredSpreadsheet>(await this.getPath());
    return { sheetCount: rows.length, lastSyncedAt: rows[0]?.syncedAt, storeDir: await this.getBaseDir() };
  }
  async listStoredSpreadsheets(limit = 50) {
    return (await parseJson<GoogleSheetsStoredSpreadsheet>(await this.getPath())).slice(0, Math.max(1, limit));
  }
  async syncSpreadsheets(items: readonly GoogleSheet[]): Promise<GoogleSheetsSyncResult> {
    const now = new Date().toISOString();
    const rows = items.map((item) => ({
      recordId: buildId(item),
      spreadsheetId: item.id,
      title: item.title,
      mimeType: item.mimeType,
      modifiedTime: item.modifiedTime,
      createdTime: item.createdTime,
      webViewLink: item.webViewLink,
      ownerNames: item.ownerNames,
      sizeBytes: item.sizeBytes,
      starred: item.starred,
      trashed: item.trashed,
      syncedAt: now,
    }));
    await writeJson(await this.getPath(), rows);
    return { storedCount: rows.length, syncedAt: now, storeDir: await this.getBaseDir() };
  }
}
