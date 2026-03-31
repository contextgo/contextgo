import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../../src/process/services/database/migrations';
import type { IStatement, ISqliteDriver } from '../../src/process/services/database/drivers/ISqliteDriver';
import { initSchema } from '../../src/process/services/database/schema';

class NodeSqliteStatement implements IStatement {
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}

  get(...args: unknown[]): unknown {
    return this.statement.get(...args);
  }

  all(...args: unknown[]): unknown[] {
    return this.statement.all(...args) as unknown[];
  }

  run(...args: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    return this.statement.run(...args);
  }
}

class NodeSqliteDriver implements ISqliteDriver {
  private readonly db = new DatabaseSync(':memory:');

  prepare(sql: string): IStatement {
    return new NodeSqliteStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  pragma(sql: string, options?: { simple?: boolean }): unknown {
    if (sql.includes('=')) {
      this.db.exec(`PRAGMA ${sql}`);
      return undefined;
    }

    const rows = this.db.prepare(`PRAGMA ${sql}`).all() as Record<string, unknown>[];
    if (options?.simple) {
      return rows[0] ? Object.values(rows[0])[0] : undefined;
    }
    return rows;
  }

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
    return (...args: unknown[]) => {
      this.db.exec('BEGIN');
      try {
        const result = fn(...args);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    };
  }

  close(): void {
    this.db.close();
  }
}

describe('database migrations', () => {
  let driver: NodeSqliteDriver | undefined;

  afterEach(() => {
    driver?.close();
    driver = undefined;
  });

  it('renames the internal conversation source from contextgo to contextgo in v20', () => {
    driver = new NodeSqliteDriver();
    driver.exec(`CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      source TEXT
    )`);
    driver.exec(`INSERT INTO conversations (id, source) VALUES
      ('conv-contextgo', 'contextgo'),
      ('conv-telegram', 'telegram'),
      ('conv-null', NULL)
    `);

    runMigrations(driver, 19, 20);

    const rows = driver.prepare('SELECT id, source FROM conversations ORDER BY id').all() as Array<{
      id: string;
      source: string | null;
    }>;

    expect(rows).toEqual([
      { id: 'conv-contextgo', source: 'contextgo' },
      { id: 'conv-null', source: null },
      { id: 'conv-telegram', source: 'telegram' },
    ]);
  });

  it('adds the spaces table in v21', () => {
    driver = new NodeSqliteDriver();
    driver.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY
    )`);

    runMigrations(driver, 20, 21);

    const columns = driver.pragma('table_info(spaces)') as Array<{ name: string }>;
    expect(columns.map(({ name }) => name)).toEqual([
      'id',
      'user_id',
      'name',
      'engine',
      'description',
      'is_default',
      'archived_at',
      'created_at',
      'updated_at',
    ]);

    const indexes = driver
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'spaces' ORDER BY name`)
      .all() as Array<{ name: string }>;

    expect(indexes.map(({ name }) => name)).toEqual([
      'idx_spaces_default_per_user',
      'idx_spaces_user_id',
      'idx_spaces_user_updated',
      'sqlite_autoindex_spaces_1',
    ]);
  });

  it('repairs a v21 database when channel binding tables are missing', () => {
    driver = new NodeSqliteDriver();
    driver.pragma('user_version = 21');

    driver.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_path TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login INTEGER
    )`);
    driver.exec(`CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      extra TEXT NOT NULL,
      model TEXT,
      status TEXT,
      source TEXT,
      channel_chat_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);

    initSchema(driver);

    const repairedTables = driver
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('connector_instances', 'agent_profiles', 'channel_bindings', 'external_sessions', 'runs', 'pairing_requests_v2')
         ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    expect(repairedTables.map(({ name }) => name)).toEqual([
      'agent_profiles',
      'channel_bindings',
      'connector_instances',
      'external_sessions',
      'pairing_requests_v2',
      'runs',
    ]);

    const conversationColumns = driver.pragma('table_info(conversations)') as Array<{ name: string }>;
    expect(conversationColumns.map(({ name }) => name)).toContain('external_session_id');
    expect(conversationColumns.map(({ name }) => name)).toContain('root_run_id');

    const userColumns = driver.pragma('table_info(users)') as Array<{ name: string }>;
    expect(userColumns.map(({ name }) => name)).toContain('jwt_secret');
  });
});
