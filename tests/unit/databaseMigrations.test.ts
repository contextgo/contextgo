import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getMigrationHistory,
  getMigrationsToRollback,
  getMigrationsToRun,
  isMigrationApplied,
  rollbackMigrations,
  runMigrations,
} from '../../src/process/services/database/migrations';
import type { IStatement, ISqliteDriver } from '../../src/process/services/database/drivers/ISqliteDriver';
import {
  CURRENT_DB_VERSION,
  getDatabaseVersion,
  initSchema,
  setDatabaseVersion,
} from '../../src/process/services/database/schema';

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

  it('ships a single baseline migration for the first public release', () => {
    expect(CURRENT_DB_VERSION).toBe(1);
    expect(getMigrationsToRun(0, 1).map((migration) => migration.version)).toEqual([1]);
    expect(getMigrationsToRun(1, 1)).toEqual([]);
    expect(getMigrationsToRollback(1, 0).map((migration) => migration.version)).toEqual([1]);
  });

  it('initializes the baseline schema directly from schema.ts', () => {
    driver = new NodeSqliteDriver();
    initSchema(driver);

    const tables = driver
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual([
      'agent_profiles',
      'assistant_pairing_codes',
      'assistant_plugins',
      'assistant_sessions',
      'assistant_users',
      'channel_bindings',
      'channel_control_leases',
      'connector_instances',
      'context_chunks',
      'context_documents',
      'context_memories',
      'context_memory_candidates',
      'context_operations',
      'context_profiles',
      'context_sources',
      'conversations',
      'cron_jobs',
      'external_sessions',
      'messages',
      'pairing_requests_v2',
      'remote_identities',
      'runs',
      'spaces',
      'users',
      'voice_input_records',
    ]);

    const controlLeaseColumns = driver.pragma('table_info(channel_control_leases)') as Array<{ name: string }>;
    expect(controlLeaseColumns.map(({ name }) => name)).toContain('continuation_mode');
    expect(controlLeaseColumns.map(({ name }) => name)).not.toContain('handoff_mode');
  });

  it('tracks the public baseline version via user_version', () => {
    driver = new NodeSqliteDriver();
    expect(getDatabaseVersion(driver)).toBe(0);

    setDatabaseVersion(driver, CURRENT_DB_VERSION);
    expect(getDatabaseVersion(driver)).toBe(CURRENT_DB_VERSION);
    expect(isMigrationApplied(driver, 1)).toBe(true);
    expect(isMigrationApplied(driver, 2)).toBe(false);
  });

  it('returns a simplified migration history for the baseline release', () => {
    driver = new NodeSqliteDriver();
    setDatabaseVersion(driver, 1);

    expect(getMigrationHistory(driver)).toEqual([
      {
        version: 1,
        name: 'Baseline public schema',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('allows explicit rollback of the baseline migration in tests', () => {
    driver = new NodeSqliteDriver();
    initSchema(driver);
    rollbackMigrations(driver, 1, 0);

    const remainingTables = driver
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as Array<{ name: string }>;

    expect(remainingTables).toEqual([]);
  });

  it('runs the baseline migration as a no-op over an already initialized schema', () => {
    driver = new NodeSqliteDriver();
    initSchema(driver);

    expect(() => runMigrations(driver, 0, 1)).not.toThrow();

    const controlLeaseColumns = driver.pragma('table_info(channel_control_leases)') as Array<{ name: string }>;
    expect(controlLeaseColumns.map(({ name }) => name)).toContain('continuation_mode');
  });
});
