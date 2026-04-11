/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ISqliteDriver } from './drivers/ISqliteDriver';

const hasTable = (db: ISqliteDriver, tableName: string): boolean => {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`).get(tableName) as
    | { name?: string }
    | undefined;
  return row?.name === tableName;
};

const hasColumn = (db: ISqliteDriver, tableName: string, columnName: string): boolean => {
  if (!hasTable(db, tableName)) {
    return false;
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
};

const ensureColumn = (db: ISqliteDriver, tableName: string, columnName: string, definition: string): void => {
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
};

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
  ensureColumn(db, 'users', 'jwt_secret', 'jwt_secret TEXT');

  db.exec(`CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,
    description TEXT,
    members_json TEXT NOT NULL DEFAULT '[]',
    permissions_policy_json TEXT NOT NULL DEFAULT '{}',
    provider_ref_json TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  ensureColumn(db, 'spaces', 'members_json', `members_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn(db, 'spaces', 'permissions_policy_json', `permissions_policy_json TEXT NOT NULL DEFAULT '{}'`);
  ensureColumn(db, 'spaces', 'provider_ref_json', 'provider_ref_json TEXT');
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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_documents_space_created ON context_documents(space_id, created_at DESC)'
  );
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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_chunks_document_sequence ON context_chunks(document_id, sequence ASC)'
  );

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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_memories_space_updated ON context_memories(space_id, updated_at DESC)'
  );

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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_memory_candidates_space_state ON context_memory_candidates(space_id, state)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_memory_candidates_thread ON context_memory_candidates(thread_id, created_at DESC)'
  );

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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_context_operations_space_created ON context_operations(space_id, created_at DESC)'
  );
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
    source TEXT,
    channel_chat_id TEXT,
    external_session_id TEXT,
    root_run_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  ensureColumn(db, 'conversations', 'source', 'source TEXT');
  ensureColumn(db, 'conversations', 'channel_chat_id', 'channel_chat_id TEXT');
  ensureColumn(db, 'conversations', 'external_session_id', 'external_session_id TEXT');
  ensureColumn(db, 'conversations', 'root_run_id', 'root_run_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_source_updated ON conversations(source, updated_at DESC)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_conversations_source_chat ON conversations(source, channel_chat_id, updated_at DESC)'
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_external_session ON conversations(external_session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_root_run ON conversations(root_run_id)');

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

  db.exec(`CREATE TABLE IF NOT EXISTS assistant_plugins (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL,
    status TEXT CHECK(status IN ('created', 'initializing', 'ready', 'starting', 'running', 'stopping', 'stopped', 'error')),
    last_connected INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_plugins_type ON assistant_plugins(type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_plugins_enabled ON assistant_plugins(enabled)');

  db.exec(`CREATE TABLE IF NOT EXISTS assistant_users (
    id TEXT PRIMARY KEY,
    platform_user_id TEXT NOT NULL,
    platform_type TEXT NOT NULL,
    display_name TEXT,
    authorized_at INTEGER NOT NULL,
    last_active INTEGER,
    session_id TEXT,
    UNIQUE(platform_user_id, platform_type)
  )`);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_assistant_users_platform ON assistant_users(platform_type, platform_user_id)'
  );

  db.exec(`CREATE TABLE IF NOT EXISTS assistant_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    conversation_id TEXT,
    workspace TEXT,
    chat_id TEXT,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES assistant_users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
  )`);
  ensureColumn(db, 'assistant_sessions', 'chat_id', 'chat_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user ON assistant_sessions(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_sessions_conversation ON assistant_sessions(conversation_id)');

  db.exec(`CREATE TABLE IF NOT EXISTS assistant_pairing_codes (
    code TEXT PRIMARY KEY,
    platform_user_id TEXT NOT NULL,
    platform_type TEXT NOT NULL,
    display_name TEXT,
    requested_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_pairing_expires ON assistant_pairing_codes(expires_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_pairing_status ON assistant_pairing_codes(status)');

  db.exec(`CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    schedule_kind TEXT NOT NULL,
    schedule_value TEXT NOT NULL,
    schedule_tz TEXT,
    schedule_description TEXT NOT NULL,
    payload_message TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    conversation_title TEXT,
    workspace_path TEXT,
    agent_type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    next_run_at INTEGER,
    last_run_at INTEGER,
    last_status TEXT,
    last_error TEXT,
    run_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
  )`);
  ensureColumn(db, 'cron_jobs', 'workspace_path', 'workspace_path TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cron_jobs_conversation ON cron_jobs(conversation_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cron_jobs_workspace ON cron_jobs(workspace_path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE enabled = 1');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cron_jobs_agent_type ON cron_jobs(agent_type)');

  db.exec(`CREATE TABLE IF NOT EXISTS context_schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    owner TEXT NOT NULL,
    created_by TEXT NOT NULL,
    scope_kind TEXT NOT NULL,
    space_id TEXT NOT NULL,
    conversation_id TEXT,
    target_kind TEXT NOT NULL,
    schedule_json TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    target_json TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_schedules_enabled ON context_schedules(enabled, updated_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_schedules_conversation ON context_schedules(conversation_id, updated_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_context_schedules_space ON context_schedules(space_id, updated_at DESC)');

  db.exec(`CREATE TABLE IF NOT EXISTS connector_instances (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('created', 'initializing', 'ready', 'starting', 'running', 'stopping', 'stopped', 'error')),
    credentials TEXT NOT NULL,
    runtime_config TEXT NOT NULL,
    capabilities TEXT NOT NULL DEFAULT '{}',
    legacy_plugin_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_connector_instances_platform ON connector_instances(platform)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_connector_instances_enabled ON connector_instances(enabled)');

  db.exec(`CREATE TABLE IF NOT EXISTS remote_identities (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    remote_user_id TEXT,
    remote_chat_id TEXT NOT NULL,
    platform_chat_id TEXT,
    remote_chat_type TEXT,
    peer_scope TEXT,
    parent_chat_id TEXT,
    thread_id TEXT,
    display_name TEXT,
    authorized_at INTEGER NOT NULL,
    last_active INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    legacy_user_id TEXT,
    FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
    UNIQUE (connector_id, remote_chat_id)
  )`);
  ensureColumn(db, 'remote_identities', 'platform_chat_id', 'platform_chat_id TEXT');
  ensureColumn(db, 'remote_identities', 'peer_scope', 'peer_scope TEXT');
  ensureColumn(db, 'remote_identities', 'parent_chat_id', 'parent_chat_id TEXT');
  ensureColumn(db, 'remote_identities', 'thread_id', 'thread_id TEXT');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_remote_identities_connector_chat ON remote_identities(connector_id, remote_chat_id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_remote_identities_connector_platform_chat ON remote_identities(connector_id, platform_chat_id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_remote_identities_connector_user ON remote_identities(connector_id, remote_user_id)'
  );

  db.exec(`CREATE TABLE IF NOT EXISTS agent_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    backend TEXT NOT NULL,
    model_ref TEXT,
    workspace_ref TEXT,
    prompt_profile TEXT NOT NULL DEFAULT '{}',
    tool_policy TEXT NOT NULL DEFAULT '{}',
    memory_policy TEXT NOT NULL DEFAULT '{}',
    delegation_policy TEXT NOT NULL DEFAULT '{}',
    published_from_conversation_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (published_from_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_profiles_backend ON agent_profiles(backend)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_profiles_archived ON agent_profiles(archived)');

  db.exec(`CREATE TABLE IF NOT EXISTS channel_bindings (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_key TEXT,
    agent_profile_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    temporary INTEGER NOT NULL DEFAULT 0,
    fallback_agent_profile_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (fallback_agent_profile_id) REFERENCES agent_profiles(id) ON DELETE SET NULL
  )`);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_channel_bindings_connector_scope ON channel_bindings(connector_id, scope_type, scope_key, enabled, priority)'
  );

  db.exec(`CREATE TABLE IF NOT EXISTS external_sessions (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    remote_identity_id TEXT NOT NULL,
    binding_id TEXT,
    agent_profile_id TEXT NOT NULL,
    active_conversation_id TEXT,
    state TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (remote_identity_id) REFERENCES remote_identities(id) ON DELETE CASCADE,
    FOREIGN KEY (binding_id) REFERENCES channel_bindings(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (active_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
    UNIQUE (connector_id, remote_identity_id)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_external_sessions_conversation ON external_sessions(active_conversation_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_external_sessions_last_activity ON external_sessions(last_activity DESC)');

  db.exec(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    external_session_id TEXT,
    parent_run_id TEXT,
    root_run_id TEXT NOT NULL,
    agent_profile_id TEXT NOT NULL,
    backend TEXT NOT NULL,
    conversation_id TEXT,
    workspace_ref TEXT,
    status TEXT NOT NULL,
    input_message_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    FOREIGN KEY (external_session_id) REFERENCES external_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_run_id) REFERENCES runs(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_runs_external_session ON runs(external_session_id, started_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_runs_root_run ON runs(root_run_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_runs_parent_run ON runs(parent_run_id)');

  db.exec(`CREATE TABLE IF NOT EXISTS pairing_requests_v2 (
    code TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    remote_user_id TEXT,
    remote_chat_id TEXT NOT NULL,
    display_name TEXT,
    requested_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE
  )`);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_pairing_requests_v2_connector_status ON pairing_requests_v2(connector_id, status, expires_at)'
  );

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

  db.exec(`CREATE TABLE IF NOT EXISTS channel_control_leases (
    external_session_id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL,
    control_mode TEXT NOT NULL,
    source_external_session_id TEXT,
    source_conversation_id TEXT,
    continuation_mode TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    released_at INTEGER,
    FOREIGN KEY (external_session_id) REFERENCES external_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (source_external_session_id) REFERENCES external_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
  )`);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_channel_control_leases_updated_at ON channel_control_leases(updated_at DESC)'
  );

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
export const CURRENT_DB_VERSION = 1;
