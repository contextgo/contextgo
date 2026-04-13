# ContextGo Database

ContextGo currently ships a single SQLite baseline schema.

## Source of Truth

- `schema.ts` defines the full shipped schema and creates any missing tables or columns during startup.
- `migrations.ts` exists only to version the public schema and to support explicit rollback in tests.
- `CURRENT_DB_VERSION` is intentionally fixed at `1` until a real post-release schema change is needed.

This project is still pre-release, so historical local-development migrations were intentionally removed. A fresh install should always initialize directly from `schema.ts` and then record `user_version = 1`.

## Startup Flow

Database initialization happens in `index.ts`:

1. `initSchema(db)` creates the current schema.
2. `getDatabaseVersion(db)` reads SQLite `PRAGMA user_version`.
3. If the stored version is lower than `CURRENT_DB_VERSION`, `runMigrations()` executes any forward migrations.
4. `setDatabaseVersion(db, CURRENT_DB_VERSION)` records the final version.

Because the current public baseline is a single version, the baseline migration is effectively a no-op over the schema that `initSchema()` already created.

## Versioning Policy

- `v1`: baseline public schema

Do not add synthetic migrations for local refactors that have not shipped. If the schema changes before release, fold the change back into `schema.ts` and keep the migration list clean.

## Local Data

Local `.db` artifacts used during development are disposable and should not be treated as release fixtures. When validating a clean build, remove stale local database files and let the app recreate them from the baseline schema.

## Test Expectations

`tests/unit/databaseMigrations.test.ts` is the guardrail for this contract. It verifies that:

- the app exposes only one baseline migration,
- `schema.ts` creates the full current schema directly,
- `user_version` tracks the baseline release version,
- rollback remains available for tests.
