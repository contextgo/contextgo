/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ISqliteDriver } from './drivers/ISqliteDriver';

/**
 * Initialize database schema with all tables and indexes
 */
export function initSchema(db: ISqliteDriver): void {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  // Enable Write-Ahead Logging for better performance
  try {
    db.pragma('journal_mode = WAL');
  } catch (error) {
    console.warn('[Database] Failed to enable WAL mode, using default journal mode:', error);
    // Continue with default journal mode if WAL fails
  }

  // Users table (账户系统)
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_path TEXT,
    jwt_secret TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login INTEGER
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  db.exec(`CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_user_updated ON spaces(user_id, updated_at DESC)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_default_per_user ON spaces(user_id) WHERE is_default = 1');

  db.exec(`CREATE TABLE IF NOT EXISTS context_sources (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    thread_id TEXT,
    artifact_id TEXT,
    kind TEXT NOT NULL,
    title TEXT,
    canonical_uri TEXT,
    checksum TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_sources_space_updated ON context_sources(space_id, updated_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_sources_space_kind ON context_sources(space_id, kind)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_documents (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_uri TEXT NOT NULL,
    title TEXT,
    checksum TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES context_sources(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_documents_space_created ON context_documents(space_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_documents_source ON context_documents(source_id)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_chunks (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'source',
    embedding_key TEXT,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES context_documents(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_chunks_document_sequence ON context_chunks(document_id, sequence ASC)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_memories (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT,
    source_ids TEXT NOT NULL DEFAULT '[]',
    chunk_ids TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'factual',
    priority TEXT NOT NULL,
    state TEXT NOT NULL,
    superseded_by_id TEXT,
    expires_at TEXT,
    last_accessed_at TEXT,
    last_confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_memories_space_state ON context_memories(space_id, state)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_memories_space_updated ON context_memories(space_id, updated_at DESC)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_memory_candidates (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    thread_id TEXT,
    kind TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'factual',
    summary TEXT NOT NULL,
    detail TEXT,
    source_ids TEXT NOT NULL DEFAULT '[]',
    chunk_ids TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0,
    priority TEXT NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 1,
    repeated_across_sources INTEGER NOT NULL DEFAULT 0,
    recent_reference_count INTEGER NOT NULL DEFAULT 1,
    user_confirmed INTEGER NOT NULL DEFAULT 0,
    manually_pinned INTEGER NOT NULL DEFAULT 0,
    execution_backed INTEGER NOT NULL DEFAULT 0,
    contradiction_detected INTEGER NOT NULL DEFAULT 0,
    promotion_score INTEGER NOT NULL DEFAULT 0,
    promotion_rationale TEXT NOT NULL DEFAULT '[]',
    destination TEXT NOT NULL DEFAULT 'memory',
    state TEXT NOT NULL,
    review_status TEXT NOT NULL,
    promoted_memory_id TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_memory_candidates_space_state ON context_memory_candidates(space_id, state)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_memory_candidates_thread ON context_memory_candidates(thread_id, created_at DESC)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_profiles (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    key TEXT NOT NULL,
    summary TEXT NOT NULL,
    memory_ids TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_profiles_space_state ON context_profiles(space_id, state)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_operations (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    thread_id TEXT,
    replica_id TEXT,
    actor_kind TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_operations_space_created ON context_operations(space_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_operations_space_type ON context_operations(space_id, type)');

  // Conversations table (会话表 - 存储TChatConversation)
  db.exec(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('gemini', 'acp', 'codex', 'openclaw-gateway', 'nanobot', 'group')),
    extra TEXT NOT NULL,
    model TEXT,
    status TEXT CHECK(status IN ('pending', 'running', 'finished')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)');

  // Messages table (消息表 - 存储TMessage)
  db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    msg_id TEXT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    position TEXT CHECK(position IN ('left', 'right', 'center', 'pop')),
    status TEXT CHECK(status IN ('finish', 'pending', 'error', 'work')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_msg_id ON messages(msg_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)');

  db.exec(`CREATE TABLE IF NOT EXISTS voice_input_records (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    trigger_mode TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('inserted', 'copied', 'recorded', 'failed')),
    transcript TEXT NOT NULL,
    transcript_length INTEGER NOT NULL,
    source_app_name TEXT,
    source_bundle_id TEXT,
    model TEXT,
    language_hints TEXT NOT NULL DEFAULT '[]',
    vocabulary_id TEXT,
    hotwords TEXT NOT NULL DEFAULT '[]',
    duration_ms INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_voice_input_records_created_at ON voice_input_records(created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_voice_input_records_status ON voice_input_records(status)');

  console.log('[Database] Schema initialized successfully');
}

/**
 * Get database version for migration tracking
 * Uses SQLite's built-in user_version pragma
 */
export function getDatabaseVersion(db: ISqliteDriver): number {
  try {
    const result = db.pragma('user_version', { simple: true }) as number;
    return result;
  } catch {
    return 0;
  }
}

/**
 * Set database version
 * Uses SQLite's built-in user_version pragma
 */
export function setDatabaseVersion(db: ISqliteDriver, version: number): void {
  db.pragma(`user_version = ${version}`);
}

/**
 * Current database schema version
 * Update this when adding new migrations in migrations.ts
 */
export const CURRENT_DB_VERSION = 22;
