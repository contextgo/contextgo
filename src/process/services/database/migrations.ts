/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ISqliteDriver } from './drivers/ISqliteDriver';

/**
 * Migration script definition
 */
export interface IMigration {
  version: number;
  name: string;
  up: (db: ISqliteDriver) => void;
  down: (db: ISqliteDriver) => void;
}

/**
 * Baseline schema for the first public release.
 *
 * Historical local-dev migrations were intentionally removed so `schema.ts`
 * remains the single source of truth for the shipped database layout.
 */
const migration_v1: IMigration = {
  version: 1,
  name: 'Baseline public schema',
  up: (_db) => {
    console.log('[Migration v1] Baseline schema already created by initSchema()');
  },
  down: (db) => {
    db.exec('DROP TABLE IF EXISTS channel_control_leases');
    db.exec('DROP TABLE IF EXISTS voice_input_records');
    db.exec('DROP TABLE IF EXISTS channel_pairing_requests');
    db.exec('DROP TABLE IF EXISTS runs');
    db.exec('DROP TABLE IF EXISTS external_sessions');
    db.exec('DROP TABLE IF EXISTS channel_bindings');
    db.exec('DROP TABLE IF EXISTS agent_profiles');
    db.exec('DROP TABLE IF EXISTS remote_identities');
    db.exec('DROP TABLE IF EXISTS channel_accounts');
    db.exec('DROP TABLE IF EXISTS cron_jobs');
    db.exec('DROP TABLE IF EXISTS assistant_pairing_codes');
    db.exec('DROP TABLE IF EXISTS assistant_sessions');
    db.exec('DROP TABLE IF EXISTS assistant_users');
    db.exec('DROP TABLE IF EXISTS assistant_plugins');
    db.exec('DROP TABLE IF EXISTS messages');
    db.exec('DROP TABLE IF EXISTS conversations');
    db.exec('DROP TABLE IF EXISTS context_operations');
    db.exec('DROP TABLE IF EXISTS context_profiles');
    db.exec('DROP TABLE IF EXISTS context_schedules');
    db.exec('DROP TABLE IF EXISTS context_memory_candidates');
    db.exec('DROP TABLE IF EXISTS context_memories');
    db.exec('DROP TABLE IF EXISTS context_chunks');
    db.exec('DROP TABLE IF EXISTS context_documents');
    db.exec('DROP TABLE IF EXISTS context_sources');
    db.exec('DROP TABLE IF EXISTS spaces');
    db.exec('DROP TABLE IF EXISTS users');
    console.log('[Migration v1] Rolled back baseline schema');
  },
};

export const ALL_MIGRATIONS: IMigration[] = [migration_v1];

export function getMigrationsToRun(fromVersion: number, toVersion: number): IMigration[] {
  return ALL_MIGRATIONS.filter(
    (migration) => migration.version > fromVersion && migration.version <= toVersion
  ).toSorted((left, right) => left.version - right.version);
}

export function getMigrationsToRollback(fromVersion: number, toVersion: number): IMigration[] {
  return ALL_MIGRATIONS.filter(
    (migration) => migration.version > toVersion && migration.version <= fromVersion
  ).toSorted((left, right) => right.version - left.version);
}

export function runMigrations(db: ISqliteDriver, fromVersion: number, toVersion: number): void {
  if (fromVersion === toVersion) {
    console.log('[Migrations] Already at target version');
    return;
  }

  if (fromVersion > toVersion) {
    throw new Error('[Migrations] Downgrade not supported in production. Use rollbackMigrations() explicitly.');
  }

  const migrations = getMigrationsToRun(fromVersion, toVersion);
  if (migrations.length === 0) {
    console.log(`[Migrations] No migrations needed from v${fromVersion} to v${toVersion}`);
    return;
  }

  console.log(`[Migrations] Running ${migrations.length} migrations from v${fromVersion} to v${toVersion}`);
  db.pragma('foreign_keys = OFF');

  const runAll = db.transaction(() => {
    for (const migration of migrations) {
      console.log(`[Migrations] Running migration v${migration.version}: ${migration.name}`);
      migration.up(db);
      console.log(`[Migrations] ✓ Migration v${migration.version} completed`);
    }

    const foreignKeyViolations = db.pragma('foreign_key_check') as unknown[];
    if (foreignKeyViolations.length > 0) {
      throw new Error(`[Migrations] Foreign key check failed: ${foreignKeyViolations.length} violation(s)`);
    }
  });

  try {
    runAll();
    console.log('[Migrations] All migrations completed successfully');
  } catch (error) {
    console.error('[Migrations] Migration failed, all changes rolled back:', error);
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export function rollbackMigrations(db: ISqliteDriver, fromVersion: number, toVersion: number): void {
  if (fromVersion <= toVersion) {
    throw new Error('[Migrations] Cannot rollback to a higher or equal version');
  }

  const migrations = getMigrationsToRollback(fromVersion, toVersion);
  if (migrations.length === 0) {
    console.log(`[Migrations] No rollback needed from v${fromVersion} to v${toVersion}`);
    return;
  }

  console.log(`[Migrations] Rolling back ${migrations.length} migrations from v${fromVersion} to v${toVersion}`);
  console.warn('[Migrations] WARNING: This may cause data loss!');
  db.pragma('foreign_keys = OFF');

  const rollbackAll = db.transaction(() => {
    for (const migration of migrations) {
      console.log(`[Migrations] Rolling back migration v${migration.version}: ${migration.name}`);
      migration.down(db);
      console.log(`[Migrations] ✓ Rollback v${migration.version} completed`);
    }

    const foreignKeyViolations = db.pragma('foreign_key_check') as unknown[];
    if (foreignKeyViolations.length > 0) {
      throw new Error(`[Migrations] Foreign key check failed: ${foreignKeyViolations.length} violation(s)`);
    }
  });

  try {
    rollbackAll();
    console.log('[Migrations] All rollbacks completed successfully');
  } catch (error) {
    console.error('[Migrations] Rollback failed:', error);
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export function getMigrationHistory(db: ISqliteDriver): Array<{ version: number; name: string; timestamp: number }> {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  return [
    {
      version: currentVersion,
      name: currentVersion >= 1 ? 'Baseline public schema' : 'Uninitialized schema',
      timestamp: Date.now(),
    },
  ];
}

export function isMigrationApplied(db: ISqliteDriver, version: number): boolean {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  return currentVersion >= version;
}
