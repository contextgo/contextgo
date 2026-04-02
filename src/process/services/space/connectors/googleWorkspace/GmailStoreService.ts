import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { GmailMessage, GmailStoredMessage, GmailSyncResult } from '@/common/types/connectors/gmail';

type BaseDirResolver = () => Promise<string>;
const defaultResolver: BaseDirResolver = async () => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const dir = path.join(getDataPath(), 'store', 'connectors', 'gmail');
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
const buildId = (message: GmailMessage) =>
  createHash('sha256')
    .update(`${message.id}:${message.threadId || ''}:${message.internalDate || ''}:${message.subject || ''}`)
    .digest('hex');
export class GmailStoreService {
  constructor(private readonly resolveBaseDir: BaseDirResolver = defaultResolver) {}
  private async getBaseDir() {
    return this.resolveBaseDir();
  }
  private async getPath() {
    return path.join(await this.getBaseDir(), 'messages.json');
  }
  async getStats() {
    const rows = await parseJson<GmailStoredMessage>(await this.getPath());
    return { messageCount: rows.length, lastSyncedAt: rows[0]?.syncedAt, storeDir: await this.getBaseDir() };
  }
  async listStoredMessages(limit = 50) {
    return (await parseJson<GmailStoredMessage>(await this.getPath())).slice(0, Math.max(1, limit));
  }
  async syncMessages(items: readonly GmailMessage[]): Promise<GmailSyncResult> {
    const now = new Date().toISOString();
    const rows = items.map((item) => ({ ...item, recordId: buildId(item), syncedAt: now }));
    await writeJson(await this.getPath(), rows);
    return { storedCount: rows.length, syncedAt: now, storeDir: await this.getBaseDir() };
  }
}
