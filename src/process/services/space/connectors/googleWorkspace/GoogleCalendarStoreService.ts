import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  GoogleCalendarEntry,
  GoogleCalendarStoredEntry,
  GoogleCalendarSyncResult,
} from '@/common/types/connectors/googleCalendar';

type BaseDirResolver = () => Promise<string>;
const defaultResolver: BaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const dir = path.join(getDataPath(), 'store', 'connectors', 'google-calendar');
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
const buildId = (entry: GoogleCalendarEntry) =>
  createHash('sha256').update(`${entry.id}:${entry.summary}`).digest('hex');
export class GoogleCalendarStoreService {
  constructor(private readonly resolveBaseDir: BaseDirResolver = defaultResolver) {}
  private async getBaseDir() {
    return this.resolveBaseDir();
  }
  private async getPath() {
    return path.join(await this.getBaseDir(), 'calendars.json');
  }
  async getStats() {
    const rows = await parseJson<GoogleCalendarStoredEntry>(await this.getPath());
    return { calendarCount: rows.length, lastSyncedAt: rows[0]?.syncedAt, storeDir: await this.getBaseDir() };
  }
  async listStoredCalendars(limit = 50) {
    return (await parseJson<GoogleCalendarStoredEntry>(await this.getPath())).slice(0, Math.max(1, limit));
  }
  async syncCalendars(items: readonly GoogleCalendarEntry[]): Promise<GoogleCalendarSyncResult> {
    const now = new Date().toISOString();
    const rows = items.map((item) => ({ ...item, recordId: buildId(item), syncedAt: now }));
    await writeJson(await this.getPath(), rows);
    return { storedCount: rows.length, syncedAt: now, storeDir: await this.getBaseDir() };
  }
}
