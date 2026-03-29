/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureDirectory, getDataPath } from '@process/utils';
import type { ISqliteDriver } from './drivers/ISqliteDriver';
import { createDriver } from './drivers/createDriver';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { runMigrations as executeMigrations } from './migrations';
import { CURRENT_DB_VERSION, getDatabaseVersion, initSchema, setDatabaseVersion } from './schema';
import type {
  IAgentProfileRow,
  IChannelBindingRow,
  IChannelRunRow,
  IConnectorInstanceRow,
  IConversationRow,
  IExternalSessionRow,
  IMessageRow,
  IPaginatedResult,
  IQueryResult,
  IRemoteIdentityRow,
  IUser,
  TChatConversation,
  TMessage,
} from './types';
import {
  agentProfileToRow,
  channelBindingToRow,
  channelRunToRow,
  connectorInstanceToRow,
  conversationToRow,
  externalSessionToRow,
  messageToRow,
  remoteIdentityToRow,
  rowToAgentProfile,
  rowToChannelBinding,
  rowToChannelRun,
  rowToConnectorInstance,
  rowToConversation,
  rowToExternalSession,
  rowToMessage,
  rowToRemoteIdentity,
} from './types';
import type { IMessageSearchItem, IMessageSearchResponse } from '@/common/types/database';
import type { VoiceInputRecord, VoiceInputStats } from '@/common/types/voiceInput';
import type {
  IAgentProfile,
  IChannelBinding,
  IChannelPluginConfig,
  IChannelUser,
  IChannelSession,
  IChannelRun,
  IChannelPairingRequest,
  IChannelUserRow,
  IChannelSessionRow,
  IChannelPairingCodeRow,
  IConnectorInstance,
  IExternalSession,
  IRemoteIdentity,
  PluginType,
  PluginStatus,
} from '@process/channels/types';
import type { ConversationSource, TProviderWithModel } from '@/common/config/storage';
import {
  getChannelBindingTarget,
  resolveChannelConvType,
  rowToChannelUser,
  rowToChannelSession,
  rowToPairingRequest,
} from '@process/channels/types';
import { encryptCredentials, decryptCredentials } from '@process/channels/utils/credentialCrypto';

type IConversationMessageSearchRow = IConversationRow & {
  message_id: string;
  message_type: TMessage['type'];
  message_content: string;
  message_created_at: number;
};

type VoiceInputRecordRow = {
  id: string;
  provider_id: VoiceInputRecord['providerId'];
  trigger_mode: VoiceInputRecord['triggerMode'];
  status: VoiceInputRecord['status'];
  transcript: string;
  transcript_length: number;
  source_app_name?: string | null;
  source_bundle_id?: string | null;
  model?: string | null;
  language_hints: string;
  vocabulary_id?: string | null;
  hotwords: string;
  duration_ms?: number | null;
  error_message?: string | null;
  created_at: number;
};

type VoiceInputStatsRow = {
  total_transcription_count: number | null;
  total_recording_duration_ms: number | null;
  total_transcribed_character_count: number | null;
};

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

const buildChannelSessionKey = (userId: string, chatId?: string | null): string =>
  chatId ? `${userId}:${chatId}` : userId;

const mapBackendToChannelAgentType = (backend: string): IChannelSession['agentType'] => {
  const { convType } = resolveChannelConvType(backend);
  return convType as IChannelSession['agentType'];
};

const hasScopeKey = (scopeKey?: string): boolean => typeof scopeKey === 'string' && scopeKey.trim().length > 0;

const validateChannelBinding = (binding: IChannelBinding): string | null => {
  const target = getChannelBindingTarget(binding);

  if (binding.scopeType === 'connector_default') {
    if (target.type === 'external_session') {
      return 'external_session targets require remote_chat scope';
    }
    return hasScopeKey(binding.scopeKey) ? 'connector_default bindings cannot define scopeKey' : null;
  }

  if (!hasScopeKey(binding.scopeKey)) {
    return `${binding.scopeType} bindings require scopeKey`;
  }

  if (binding.scopeType === 'temporary_override' && !binding.temporary) {
    return 'temporary_override bindings must set temporary = true';
  }

  if (binding.scopeType === 'remote_user' && binding.scopeKey.startsWith('group:')) {
    return 'remote_user bindings cannot target group-scoped keys; use remote_chat instead';
  }

  if (target.type === 'external_session' && binding.scopeType !== 'remote_chat') {
    return 'external_session targets require remote_chat scope';
  }

  return null;
};

const extractSearchPreviewText = (rawContent: string): string => {
  const collectStrings = (value: unknown, bucket: string[]): void => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        bucket.push(normalized);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectStrings(item, bucket));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) => collectStrings(item, bucket));
    }
  };

  try {
    const parsed = JSON.parse(rawContent);
    const bucket: string[] = [];
    collectStrings(parsed, bucket);
    const previewText = bucket.join(' ').replace(/\s+/g, ' ').trim();
    return previewText || rawContent;
  } catch {
    return rawContent.replace(/\s+/g, ' ').trim();
  }
};

const rowToVoiceInputRecord = (row: VoiceInputRecordRow): VoiceInputRecord => ({
  id: row.id,
  providerId: row.provider_id,
  triggerMode: row.trigger_mode,
  status: row.status,
  transcript: row.transcript,
  transcriptLength: row.transcript_length,
  sourceAppName: row.source_app_name ?? undefined,
  sourceBundleId: row.source_bundle_id ?? undefined,
  model: row.model ?? undefined,
  languageHints: JSON.parse(row.language_hints) as string[],
  vocabularyId: row.vocabulary_id ?? undefined,
  hotwords: JSON.parse(row.hotwords) as string[],
  durationMs: row.duration_ms ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
});

/**
 * Main database class for AionUi
 * Uses a pluggable ISqliteDriver for SQLite operations
 */
export class AionUIDatabase {
  private db: ISqliteDriver;
  private readonly defaultUserId = 'system_default_user';
  private readonly systemPasswordPlaceholder = '';

  private constructor(db: ISqliteDriver) {
    this.db = db;
  }

  /**
   * Create a new AionUIDatabase instance with corruption recovery.
   * This is the only way to obtain an instance — the constructor is private.
   */
  static async create(dbPath: string): Promise<AionUIDatabase> {
    const dir = path.dirname(dbPath);
    ensureDirectory(dir);

    // Attempt normal initialization
    try {
      const driver = await createDriver(dbPath);
      const instance = new AionUIDatabase(driver);
      instance.initialize();
      return instance;
    } catch (error) {
      console.error('[Database] Failed to initialize, attempting recovery...', error);
    }

    // Recovery: backup corrupted file and start fresh.
    // IMPORTANT: also remove the WAL (-wal) and shared-memory (-shm) sidecar files.
    // If they are left behind, SQLite will try to apply the stale WAL to the new
    // empty database on the next open, which causes another initialization failure
    // and triggers an infinite recovery loop.
    if (fs.existsSync(dbPath)) {
      const backupPath = `${dbPath}.backup.${Date.now()}`;
      try {
        fs.renameSync(dbPath, backupPath);
        console.log(`[Database] Backed up corrupted database to: ${backupPath}`);
      } catch {
        try {
          fs.unlinkSync(dbPath);
          console.log('[Database] Deleted corrupted database file');
        } catch (e2) {
          throw new Error('Database is corrupted and cannot be recovered. Please manually delete: ' + dbPath, {
            cause: e2,
          });
        }
      }
    }
    // Remove stale WAL sidecar files so SQLite starts with a clean slate
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = dbPath + suffix;
      if (fs.existsSync(sidecar)) {
        try {
          fs.unlinkSync(sidecar);
          console.log(`[Database] Removed stale WAL sidecar: ${sidecar}`);
        } catch (e) {
          console.warn(`[Database] Could not remove sidecar ${sidecar}:`, e);
        }
      }
    }

    // Retry with fresh file
    const driver = await createDriver(dbPath);
    const instance = new AionUIDatabase(driver);
    instance.initialize();
    return instance;
  }

  private initialize(): void {
    try {
      initSchema(this.db);

      // Check and run migrations if needed
      const currentVersion = getDatabaseVersion(this.db);
      if (currentVersion < CURRENT_DB_VERSION) {
        this.runMigrations(currentVersion, CURRENT_DB_VERSION);
        setDatabaseVersion(this.db, CURRENT_DB_VERSION);
      }

      this.ensureSystemUser();
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      throw error;
    }
  }

  private runMigrations(from: number, to: number): void {
    executeMigrations(this.db, from, to);
  }

  private ensureSystemUser(): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO users (id, username, email, password_hash, avatar_path, created_at, updated_at, last_login, jwt_secret)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, NULL)`
      )
      .run(this.defaultUserId, this.defaultUserId, this.systemPasswordPlaceholder, now, now);
  }

  getSystemUser(): IUser | null {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(this.defaultUserId) as IUser | undefined;
    return user ?? null;
  }

  setSystemUserCredentials(username: string, passwordHash: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE users
         SET username = ?, password_hash = ?, updated_at = ?, created_at = COALESCE(created_at, ?)
         WHERE id = ?`
      )
      .run(username, passwordHash, now, now, this.defaultUserId);
  }

  updateUserUsername(userId: string, username: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?').run(username, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Execute multiple database operations atomically.
   */
  runInTransaction<T>(fn: () => T): IQueryResult<T> {
    try {
      const transaction = this.db.transaction(fn);
      const data = transaction();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * User operations
   * 用户操作
   * ==================
   */

  /**
   * Create a new user in the database
   * 在数据库中创建新用户
   *
   * @param username - Username (unique identifier)
   * @param email - User email (optional)
   * @param passwordHash - Hashed password (use bcrypt)
   * @returns Query result with created user data
   */
  createUser(username: string, email: string | undefined, passwordHash: string): IQueryResult<IUser> {
    try {
      const userId = `user_${Date.now()}`;
      const now = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, password_hash, avatar_path, created_at, updated_at, last_login)
        VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)
      `);

      stmt.run(userId, username, email ?? null, passwordHash, now, now);

      return {
        success: true,
        data: {
          id: userId,
          username,
          email,
          password_hash: passwordHash,
          created_at: now,
          updated_at: now,
          last_login: null,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user by user ID
   * 通过用户 ID 获取用户信息
   *
   * @param userId - User ID to query
   * @returns Query result with user data or error if not found
   */
  getUser(userId: string): IQueryResult<IUser> {
    try {
      const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as IUser | undefined;

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user by username (used for authentication)
   * 通过用户名获取用户信息（用于身份验证）
   *
   * @param username - Username to query
   * @returns Query result with user data or null if not found
   */
  getUserByUsername(username: string): IQueryResult<IUser | null> {
    try {
      const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as IUser | undefined;

      return {
        success: true,
        data: user ?? null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Get all users (excluding system default user)
   * 获取所有用户（排除系统默认用户）
   *
   * @returns Query result with array of all users ordered by creation time
   */
  getAllUsers(): IQueryResult<IUser[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at ASC');
      const rows = stmt.all() as IUser[];

      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Get total count of users (excluding system default user)
   * 获取用户总数（排除系统默认用户）
   *
   * @returns Query result with user count
   */
  getUserCount(): IQueryResult<number> {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
      const row = stmt.get() as { count: number };

      return {
        success: true,
        data: row.count,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: 0,
      };
    }
  }

  /**
   * Check if any users exist in the database
   * 检查数据库中是否存在用户
   *
   * @returns Query result with boolean indicating if users exist
   */
  hasUsers(): IQueryResult<boolean> {
    try {
      // 只统计已设置密码的账户，排除尚未完成初始化的占位行
      // Count only accounts with a non-empty password to ignore placeholder entries
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL AND TRIM(password_hash) != ''`
      );
      const row = stmt.get() as { count: number };
      return {
        success: true,
        data: row.count > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update user's last login timestamp
   * 更新用户的最后登录时间戳
   *
   * @param userId - User ID to update
   * @returns Query result with success status
   */
  updateUserLastLogin(userId: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?').run(now, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * Update user's password hash
   * 更新用户的密码哈希
   *
   * @param userId - User ID to update
   * @param newPasswordHash - New hashed password (use bcrypt)
   * @returns Query result with success status
   */
  updateUserPassword(userId: string, newPasswordHash: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(newPasswordHash, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * Update user's JWT secret
   * 更新用户的 JWT secret
   */
  updateUserJwtSecret(userId: string, jwtSecret: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET jwt_secret = ?, updated_at = ? WHERE id = ?').run(jwtSecret, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * ==================
   * Conversation operations
   * ==================
   */

  createConversation(conversation: TChatConversation, userId?: string): IQueryResult<TChatConversation> {
    try {
      const row = conversationToRow(conversation, userId || this.defaultUserId);

      const stmt = this.db.prepare(`
        INSERT INTO conversations (
          id, user_id, name, type, extra, model, status, source, channel_chat_id,
          external_session_id, root_run_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        row.id,
        row.user_id,
        row.name,
        row.type,
        row.extra,
        row.model,
        row.status,
        row.source,
        row.channel_chat_id ?? null,
        row.external_session_id ?? null,
        row.root_run_id ?? null,
        row.created_at,
        row.updated_at
      );

      return {
        success: true,
        data: conversation,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getConversation(conversationId: string): IQueryResult<TChatConversation> {
    try {
      const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as
        | IConversationRow
        | undefined;

      if (!row) {
        return {
          success: false,
          error: 'Conversation not found',
        };
      }

      return {
        success: true,
        data: rowToConversation(row),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Find the latest channel conversation by source, chat ID, type, and optionally backend.
   * Used for per-chat conversation isolation in channel platforms.
   *
   * For ACP conversations, `backend` distinguishes between claude, iflow, codebuddy, etc.
   * (stored in `extra.backend` JSON field).
   */
  findChannelConversation(
    source: ConversationSource,
    channelChatId: string,
    type: string,
    backend?: string,
    userId?: string
  ): IQueryResult<TChatConversation | null> {
    try {
      const finalUserId = userId || this.defaultUserId;

      let row: IConversationRow | undefined;
      if (backend) {
        row = this.db
          .prepare(
            `
            SELECT * FROM conversations
            WHERE user_id = ? AND source = ? AND channel_chat_id = ? AND type = ?
              AND json_extract(extra, '$.backend') = ?
            ORDER BY updated_at DESC
            LIMIT 1
          `
          )
          .get(finalUserId, source, channelChatId, type, backend) as IConversationRow | undefined;
      } else {
        row = this.db
          .prepare(
            `
            SELECT * FROM conversations
            WHERE user_id = ? AND source = ? AND channel_chat_id = ? AND type = ?
            ORDER BY updated_at DESC
            LIMIT 1
          `
          )
          .get(finalUserId, source, channelChatId, type) as IConversationRow | undefined;
      }

      return {
        success: true,
        data: row ? rowToConversation(row) : null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch-update the model field on channel conversations matching source + type.
   * Used when channel settings change to propagate new model to existing conversations.
   */
  updateChannelConversationModel(
    source: 'telegram' | 'lark' | 'dingtalk' | 'weixin',
    type: string,
    model: TProviderWithModel,
    userId?: string
  ): IQueryResult<number> {
    try {
      const finalUserId = userId || this.defaultUserId;
      const modelJson = JSON.stringify(model);
      const now = Date.now();
      const stmt = this.db.prepare(`
        UPDATE conversations SET model = ?, updated_at = ?
        WHERE user_id = ? AND source = ? AND type = ?
      `);
      const result = stmt.run(modelJson, now, finalUserId, source, type);
      return { success: true, data: result.changes };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getUserConversations(userId?: string, page = 0, pageSize = 50): IPaginatedResult<TChatConversation> {
    try {
      const finalUserId = userId || this.defaultUserId;

      const countResult = this.db
        .prepare('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?')
        .get(finalUserId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC LIMIT ?
            OFFSET ?
          `
        )
        .all(finalUserId, pageSize, page * pageSize) as IConversationRow[];

      return {
        data: rows.map(rowToConversation),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Get conversations error:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  updateConversation(conversationId: string, updates: Partial<TChatConversation>): IQueryResult<boolean> {
    try {
      const existing = this.getConversation(conversationId);
      if (!existing.success || !existing.data) {
        return {
          success: false,
          error: 'Conversation not found',
        };
      }

      const updated = {
        ...existing.data,
        ...updates,
        modifyTime: Date.now(),
      } as TChatConversation;
      const row = conversationToRow(updated, this.defaultUserId);

      const stmt = this.db.prepare(`
        UPDATE conversations
        SET name       = ?,
            extra      = ?,
            model      = ?,
            status     = ?,
            source     = ?,
            channel_chat_id = ?,
            external_session_id = ?,
            root_run_id = ?,
            updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        row.name,
        row.extra,
        row.model,
        row.status,
        row.source ?? null,
        row.channel_chat_id ?? null,
        row.external_session_id ?? null,
        row.root_run_id ?? null,
        row.updated_at,
        conversationId
      );

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteConversation(conversationId: string): IQueryResult<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
      const result = stmt.run(conversationId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ==================
   * Message operations
   * ==================
   */

  insertMessage(message: TMessage): IQueryResult<TMessage> {
    try {
      const row = messageToRow(message);

      const stmt = this.db.prepare(`
        INSERT INTO messages (id, conversation_id, msg_id, type, content, position, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        row.id,
        row.conversation_id,
        row.msg_id,
        row.type,
        row.content,
        row.position,
        row.status,
        row.created_at
      );

      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getConversationMessages(conversationId: string, page = 0, pageSize = 100, order = 'ASC'): IPaginatedResult<TMessage> {
    try {
      const countResult = this.db
        .prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?')
        .get(conversationId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ${order} LIMIT ?
            OFFSET ?
          `
        )
        .all(conversationId, pageSize, page * pageSize) as IMessageRow[];

      return {
        data: rows.map(rowToMessage),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Get messages error:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  searchConversationMessages(keyword: string, userId?: string, page = 0, pageSize = 20): IMessageSearchResponse {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }

    try {
      const finalUserId = userId || this.defaultUserId;
      const escapedKeyword = escapeLikePattern(trimmedKeyword);
      const likePattern = `%${escapedKeyword}%`;

      const countResult = this.db
        .prepare(
          `
            SELECT COUNT(*) as count
            FROM messages m
            INNER JOIN conversations c ON c.id = m.conversation_id
            WHERE c.user_id = ?
              AND m.content LIKE ? ESCAPE '\\'
          `
        )
        .get(finalUserId, likePattern) as { count: number };

      const rows = this.db
        .prepare(
          `
            SELECT
              c.id,
              c.user_id,
              c.name,
              c.type,
              c.extra,
              c.model,
              c.status,
              c.source,
              c.channel_chat_id,
              c.external_session_id,
              c.root_run_id,
              c.created_at,
              c.updated_at,
              m.id as message_id,
              m.type as message_type,
              m.content as message_content,
              m.created_at as message_created_at
            FROM messages m
            INNER JOIN conversations c ON c.id = m.conversation_id
            WHERE c.user_id = ?
              AND m.content LIKE ? ESCAPE '\\'
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
          `
        )
        .all(finalUserId, likePattern, pageSize, page * pageSize) as IConversationMessageSearchRow[];

      const items: IMessageSearchItem[] = rows.map((row) => ({
        conversation: rowToConversation(row),
        messageId: row.message_id,
        messageType: row.message_type,
        messageCreatedAt: row.message_created_at,
        previewText: extractSearchPreviewText(row.message_content),
      }));

      return {
        items,
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Search messages error:', error);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  /**
   * Update a message in the database
   * @param messageId - Message ID to update
   * @param message - Updated message data
   */
  updateMessage(messageId: string, message: TMessage): IQueryResult<boolean> {
    try {
      const row = messageToRow(message);

      const stmt = this.db.prepare(`
        UPDATE messages
        SET type     = ?,
            content  = ?,
            position = ?,
            status   = ?
        WHERE id = ?
      `);

      const result = stmt.run(row.type, row.content, row.position, row.status, messageId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteMessage(messageId: string): IQueryResult<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
      const result = stmt.run(messageId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteConversationMessages(conversationId: string): IQueryResult<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
      const result = stmt.run(conversationId);

      return {
        success: true,
        data: result.changes,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get message by msg_id and conversation_id
   * Used for finding existing messages to update (e.g., streaming text accumulation)
   */
  getMessageByMsgId(conversationId: string, msgId: string, type: TMessage['type']): IQueryResult<TMessage | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT *
        FROM messages
        WHERE conversation_id = ?
          AND msg_id = ?
          AND type = ?
        ORDER BY created_at DESC LIMIT 1
      `);

      const row = stmt.get(conversationId, msgId, type) as IMessageRow | undefined;

      return {
        success: true,
        data: row ? rowToMessage(row) : null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ==================
   * Channel Plugin operations
   * 个人助手插件操作
   * ==================
   */

  /**
   * Get all assistant plugins
   */
  getChannelPlugins(): IQueryResult<IChannelPluginConfig[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM assistant_plugins ORDER BY created_at ASC').all() as Array<{
        id: string;
        type: string;
        name: string;
        enabled: number;
        config: string;
        status: string | null;
        last_connected: number | null;
        created_at: number;
        updated_at: number;
      }>;

      const plugins: IChannelPluginConfig[] = rows.map((row) => {
        const storedConfig = JSON.parse(row.config || '{}');
        // Decrypt credentials when loading
        const decryptedCredentials = decryptCredentials(storedConfig.credentials);

        return {
          id: row.id,
          type: row.type as PluginType,
          name: row.name,
          enabled: row.enabled === 1,
          credentials: decryptedCredentials,
          config: storedConfig.config,
          status: (row.status as PluginStatus) || 'stopped',
          lastConnected: row.last_connected ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return { success: true, data: plugins };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get assistant plugin by ID
   */
  getChannelPlugin(pluginId: string): IQueryResult<IChannelPluginConfig | null> {
    try {
      const row = this.db.prepare('SELECT * FROM assistant_plugins WHERE id = ?').get(pluginId) as
        | {
            id: string;
            type: string;
            name: string;
            enabled: number;
            config: string;
            status: string | null;
            last_connected: number | null;
            created_at: number;
            updated_at: number;
          }
        | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      const storedConfig = JSON.parse(row.config || '{}');
      // Decrypt credentials when loading
      const decryptedCredentials = decryptCredentials(storedConfig.credentials);

      const plugin: IChannelPluginConfig = {
        id: row.id,
        type: row.type as PluginType,
        name: row.name,
        enabled: row.enabled === 1,
        credentials: decryptedCredentials,
        config: storedConfig.config,
        status: (row.status as PluginStatus) || 'stopped',
        lastConnected: row.last_connected ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return { success: true, data: plugin };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create or update assistant plugin
   */
  upsertChannelPlugin(plugin: IChannelPluginConfig): IQueryResult<boolean> {
    try {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO assistant_plugins (id, type, name, enabled, config, status, last_connected, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          name = excluded.name,
          enabled = excluded.enabled,
          config = excluded.config,
          status = excluded.status,
          last_connected = excluded.last_connected,
          updated_at = excluded.updated_at
      `);

      // Encrypt credentials before storing
      const encryptedCredentials = encryptCredentials(plugin.credentials);

      // Store both credentials and config in the config column
      const storedConfig = {
        credentials: encryptedCredentials,
        config: plugin.config,
      };

      stmt.run(
        plugin.id,
        plugin.type,
        plugin.name,
        plugin.enabled ? 1 : 0,
        JSON.stringify(storedConfig),
        plugin.status,
        plugin.lastConnected ?? null,
        plugin.createdAt || now,
        now
      );

      this.upsertConnectorInstance({
        id: plugin.id,
        platform: plugin.type,
        name: plugin.name,
        enabled: plugin.enabled,
        status: plugin.status,
        credentials: plugin.credentials,
        runtimeConfig: plugin.config,
        legacyPluginId: plugin.id,
        createdAt: plugin.createdAt || now,
        updatedAt: now,
      });

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update assistant plugin status
   */
  updateChannelPluginStatus(pluginId: string, status: PluginStatus, lastConnected?: number): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db
        .prepare(
          'UPDATE assistant_plugins SET status = ?, last_connected = COALESCE(?, last_connected), updated_at = ? WHERE id = ?'
        )
        .run(status, lastConnected ?? null, now, pluginId);
      this.db
        .prepare('UPDATE connector_instances SET status = ?, updated_at = ? WHERE legacy_plugin_id = ?')
        .run(status, now, pluginId);
      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete assistant plugin
   */
  deleteChannelPlugin(pluginId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM assistant_plugins WHERE id = ?').run(pluginId);
      this.db.prepare('DELETE FROM connector_instances WHERE legacy_plugin_id = ?').run(pluginId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Connector Instance operations
   * ==================
   */

  getConnectorInstances(): IQueryResult<IConnectorInstance[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM connector_instances ORDER BY created_at ASC')
        .all() as IConnectorInstanceRow[];
      return { success: true, data: rows.map(rowToConnectorInstance) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  getConnectorInstance(connectorId: string): IQueryResult<IConnectorInstance | null> {
    try {
      const row = this.db.prepare('SELECT * FROM connector_instances WHERE id = ?').get(connectorId) as
        | IConnectorInstanceRow
        | undefined;
      return { success: true, data: row ? rowToConnectorInstance(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getConnectorInstanceByLegacyPluginId(legacyPluginId: string): IQueryResult<IConnectorInstance | null> {
    try {
      const row = this.db.prepare('SELECT * FROM connector_instances WHERE legacy_plugin_id = ?').get(legacyPluginId) as
        | IConnectorInstanceRow
        | undefined;
      return { success: true, data: row ? rowToConnectorInstance(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  upsertConnectorInstance(connector: IConnectorInstance): IQueryResult<boolean> {
    try {
      const now = Date.now();
      const row = connectorInstanceToRow({
        ...connector,
        createdAt: connector.createdAt || now,
        updatedAt: now,
      });
      const encryptedCredentials = encryptCredentials(connector.credentials);

      this.db
        .prepare(`
          INSERT INTO connector_instances (
            id, platform, name, enabled, status, credentials, runtime_config,
            capabilities, legacy_plugin_id, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            platform = excluded.platform,
            name = excluded.name,
            enabled = excluded.enabled,
            status = excluded.status,
            credentials = excluded.credentials,
            runtime_config = excluded.runtime_config,
            capabilities = excluded.capabilities,
            legacy_plugin_id = excluded.legacy_plugin_id,
            updated_at = excluded.updated_at
        `)
        .run(
          row.id,
          row.platform,
          row.name,
          row.enabled,
          row.status,
          JSON.stringify(encryptedCredentials ?? {}),
          row.runtime_config,
          row.capabilities,
          row.legacy_plugin_id,
          row.created_at,
          row.updated_at
        );

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  deleteConnectorInstance(connectorId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM connector_instances WHERE id = ?').run(connectorId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Remote Identity operations
   * ==================
   */

  getRemoteIdentity(identityId: string): IQueryResult<IRemoteIdentity | null> {
    try {
      const row = this.db.prepare('SELECT * FROM remote_identities WHERE id = ?').get(identityId) as
        | IRemoteIdentityRow
        | undefined;
      return { success: true, data: row ? rowToRemoteIdentity(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getRemoteIdentityByConnectorChat(connectorId: string, remoteChatId: string): IQueryResult<IRemoteIdentity | null> {
    try {
      const row = this.db
        .prepare('SELECT * FROM remote_identities WHERE connector_id = ? AND remote_chat_id = ?')
        .get(connectorId, remoteChatId) as IRemoteIdentityRow | undefined;
      return { success: true, data: row ? rowToRemoteIdentity(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getRemoteIdentityByLegacyUserId(legacyUserId: string): IQueryResult<IRemoteIdentity | null> {
    try {
      const row = this.db.prepare('SELECT * FROM remote_identities WHERE legacy_user_id = ?').get(legacyUserId) as
        | IRemoteIdentityRow
        | undefined;
      return { success: true, data: row ? rowToRemoteIdentity(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getRemoteIdentities(connectorId?: string): IQueryResult<IRemoteIdentity[]> {
    try {
      const rows = connectorId
        ? (this.db
            .prepare(
              'SELECT * FROM remote_identities WHERE connector_id = ? ORDER BY COALESCE(last_active, authorized_at) DESC, authorized_at DESC'
            )
            .all(connectorId) as IRemoteIdentityRow[])
        : (this.db
            .prepare(
              'SELECT * FROM remote_identities ORDER BY COALESCE(last_active, authorized_at) DESC, authorized_at DESC'
            )
            .all() as IRemoteIdentityRow[]);
      return { success: true, data: rows.map(rowToRemoteIdentity) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  upsertRemoteIdentity(identity: IRemoteIdentity): IQueryResult<boolean> {
    try {
      const row = remoteIdentityToRow(identity);
      this.db
        .prepare(`
          INSERT INTO remote_identities (
            id, connector_id, remote_user_id, remote_chat_id, remote_chat_type,
            display_name, authorized_at, last_active, metadata, legacy_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            connector_id = excluded.connector_id,
            remote_user_id = excluded.remote_user_id,
            remote_chat_id = excluded.remote_chat_id,
            remote_chat_type = excluded.remote_chat_type,
            display_name = excluded.display_name,
            authorized_at = excluded.authorized_at,
            last_active = excluded.last_active,
            metadata = excluded.metadata,
            legacy_user_id = excluded.legacy_user_id
        `)
        .run(
          row.id,
          row.connector_id,
          row.remote_user_id,
          row.remote_chat_id,
          row.remote_chat_type,
          row.display_name,
          row.authorized_at,
          row.last_active,
          row.metadata,
          row.legacy_user_id
        );

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  updateRemoteIdentityActivity(identityId: string, lastActive = Date.now()): IQueryResult<boolean> {
    try {
      const result = this.db
        .prepare('UPDATE remote_identities SET last_active = ? WHERE id = ?')
        .run(lastActive, identityId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  deleteRemoteIdentity(identityId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM remote_identities WHERE id = ?').run(identityId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Agent Profile operations
   * ==================
   */

  getAgentProfiles(includeArchived = false): IQueryResult<IAgentProfile[]> {
    try {
      const query = includeArchived
        ? 'SELECT * FROM agent_profiles ORDER BY updated_at DESC'
        : 'SELECT * FROM agent_profiles WHERE archived = 0 ORDER BY updated_at DESC';
      const rows = this.db.prepare(query).all() as IAgentProfileRow[];
      return { success: true, data: rows.map(rowToAgentProfile) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  getAgentProfile(profileId: string): IQueryResult<IAgentProfile | null> {
    try {
      const row = this.db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(profileId) as
        | IAgentProfileRow
        | undefined;
      return { success: true, data: row ? rowToAgentProfile(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getAgentProfileByPublishedConversation(conversationId: string): IQueryResult<IAgentProfile | null> {
    try {
      const row = this.db
        .prepare('SELECT * FROM agent_profiles WHERE published_from_conversation_id = ? ORDER BY version DESC LIMIT 1')
        .get(conversationId) as IAgentProfileRow | undefined;
      return { success: true, data: row ? rowToAgentProfile(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  upsertAgentProfile(profile: IAgentProfile): IQueryResult<boolean> {
    try {
      const now = Date.now();
      const row = agentProfileToRow({
        ...profile,
        createdAt: profile.createdAt || now,
        updatedAt: now,
      });

      this.db
        .prepare(`
          INSERT INTO agent_profiles (
            id, name, backend, model_ref, workspace_ref, prompt_profile, tool_policy,
            memory_policy, delegation_policy, published_from_conversation_id,
            version, archived, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            backend = excluded.backend,
            model_ref = excluded.model_ref,
            workspace_ref = excluded.workspace_ref,
            prompt_profile = excluded.prompt_profile,
            tool_policy = excluded.tool_policy,
            memory_policy = excluded.memory_policy,
            delegation_policy = excluded.delegation_policy,
            published_from_conversation_id = excluded.published_from_conversation_id,
            version = excluded.version,
            archived = excluded.archived,
            updated_at = excluded.updated_at
        `)
        .run(
          row.id,
          row.name,
          row.backend,
          row.model_ref,
          row.workspace_ref,
          row.prompt_profile,
          row.tool_policy,
          row.memory_policy,
          row.delegation_policy,
          row.published_from_conversation_id,
          row.version,
          row.archived,
          row.created_at,
          row.updated_at
        );

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  deleteAgentProfile(profileId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM agent_profiles WHERE id = ?').run(profileId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Channel Binding operations
   * ==================
   */

  getChannelBindings(connectorId?: string): IQueryResult<IChannelBinding[]> {
    try {
      const rows = connectorId
        ? (this.db
            .prepare('SELECT * FROM channel_bindings WHERE connector_id = ? ORDER BY priority DESC, created_at ASC')
            .all(connectorId) as IChannelBindingRow[])
        : (this.db
            .prepare('SELECT * FROM channel_bindings ORDER BY connector_id ASC, priority DESC, created_at ASC')
            .all() as IChannelBindingRow[]);
      return { success: true, data: rows.map(rowToChannelBinding) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  getChannelBinding(bindingId: string): IQueryResult<IChannelBinding | null> {
    try {
      const row = this.db.prepare('SELECT * FROM channel_bindings WHERE id = ?').get(bindingId) as
        | IChannelBindingRow
        | undefined;
      return { success: true, data: row ? rowToChannelBinding(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getChannelBindingsForScope(
    connectorId: string,
    scopeType: IChannelBinding['scopeType'],
    scopeKey?: string
  ): IQueryResult<IChannelBinding[]> {
    try {
      const rows =
        scopeKey === undefined
          ? (this.db
              .prepare(
                'SELECT * FROM channel_bindings WHERE connector_id = ? AND scope_type = ? AND enabled = 1 AND scope_key IS NULL ORDER BY priority DESC, created_at ASC'
              )
              .all(connectorId, scopeType) as IChannelBindingRow[])
          : (this.db
              .prepare(
                'SELECT * FROM channel_bindings WHERE connector_id = ? AND scope_type = ? AND enabled = 1 AND scope_key = ? ORDER BY priority DESC, created_at ASC'
              )
              .all(connectorId, scopeType, scopeKey) as IChannelBindingRow[]);
      return { success: true, data: rows.map(rowToChannelBinding) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  upsertChannelBinding(binding: IChannelBinding): IQueryResult<boolean> {
    try {
      const validationError = validateChannelBinding(binding);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const now = Date.now();
      const row = channelBindingToRow({
        ...binding,
        createdAt: binding.createdAt || now,
        updatedAt: now,
      });

      this.db
        .prepare(`
          INSERT INTO channel_bindings (
            id, connector_id, scope_type, scope_key, agent_profile_id, priority,
            enabled, temporary, fallback_agent_profile_id, metadata, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            connector_id = excluded.connector_id,
            scope_type = excluded.scope_type,
            scope_key = excluded.scope_key,
            agent_profile_id = excluded.agent_profile_id,
            priority = excluded.priority,
            enabled = excluded.enabled,
            temporary = excluded.temporary,
            fallback_agent_profile_id = excluded.fallback_agent_profile_id,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
        `)
        .run(
          row.id,
          row.connector_id,
          row.scope_type,
          row.scope_key,
          row.agent_profile_id,
          row.priority,
          row.enabled,
          row.temporary,
          row.fallback_agent_profile_id,
          row.metadata,
          row.created_at,
          row.updated_at
        );

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  deleteChannelBinding(bindingId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM channel_bindings WHERE id = ?').run(bindingId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * External Session operations
   * ==================
   */

  getExternalSession(sessionId: string): IQueryResult<IExternalSession | null> {
    try {
      const row = this.db.prepare('SELECT * FROM external_sessions WHERE id = ?').get(sessionId) as
        | IExternalSessionRow
        | undefined;
      return { success: true, data: row ? rowToExternalSession(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getExternalSessionByConnectorRemote(
    connectorId: string,
    remoteIdentityId: string
  ): IQueryResult<IExternalSession | null> {
    try {
      const row = this.db
        .prepare('SELECT * FROM external_sessions WHERE connector_id = ? AND remote_identity_id = ?')
        .get(connectorId, remoteIdentityId) as IExternalSessionRow | undefined;
      return { success: true, data: row ? rowToExternalSession(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getExternalSessionByActiveConversation(conversationId: string): IQueryResult<IExternalSession | null> {
    try {
      const row = this.db
        .prepare('SELECT * FROM external_sessions WHERE active_conversation_id = ?')
        .get(conversationId) as IExternalSessionRow | undefined;
      return { success: true, data: row ? rowToExternalSession(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  upsertExternalSession(session: IExternalSession): IQueryResult<boolean> {
    try {
      const now = Date.now();
      const row = externalSessionToRow({
        ...session,
        createdAt: session.createdAt || now,
        lastActivity: session.lastActivity || now,
      });

      this.db
        .prepare(`
          INSERT INTO external_sessions (
            id, connector_id, remote_identity_id, binding_id, agent_profile_id,
            active_conversation_id, state, created_at, last_activity, metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            connector_id = excluded.connector_id,
            remote_identity_id = excluded.remote_identity_id,
            binding_id = excluded.binding_id,
            agent_profile_id = excluded.agent_profile_id,
            active_conversation_id = excluded.active_conversation_id,
            state = excluded.state,
            last_activity = excluded.last_activity,
            metadata = excluded.metadata
        `)
        .run(
          row.id,
          row.connector_id,
          row.remote_identity_id,
          row.binding_id,
          row.agent_profile_id,
          row.active_conversation_id,
          row.state,
          row.created_at,
          row.last_activity,
          row.metadata
        );

      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  updateExternalSessionActivity(
    sessionId: string,
    updates: {
      lastActivity?: number;
      activeConversationId?: string;
      bindingId?: string;
    }
  ): IQueryResult<boolean> {
    try {
      const result = this.db
        .prepare(`
          UPDATE external_sessions
          SET last_activity = ?,
              active_conversation_id = COALESCE(?, active_conversation_id),
              binding_id = COALESCE(?, binding_id)
          WHERE id = ?
        `)
        .run(
          updates.lastActivity ?? Date.now(),
          updates.activeConversationId ?? null,
          updates.bindingId ?? null,
          sessionId
        );
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  deleteExternalSession(sessionId: string): IQueryResult<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM external_sessions WHERE id = ?').run(sessionId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Channel Run operations
   * ==================
   */

  getChannelRun(runId: string): IQueryResult<IChannelRun | null> {
    try {
      const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as IChannelRunRow | undefined;
      return { success: true, data: row ? rowToChannelRun(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getChannelRunsByExternalSession(externalSessionId: string): IQueryResult<IChannelRun[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM runs WHERE external_session_id = ? ORDER BY started_at DESC')
        .all(externalSessionId) as IChannelRunRow[];
      return { success: true, data: rows.map(rowToChannelRun) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  getChannelRunsByRootRun(rootRunId: string): IQueryResult<IChannelRun[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM runs WHERE root_run_id = ? ORDER BY started_at ASC')
        .all(rootRunId) as IChannelRunRow[];
      return { success: true, data: rows.map(rowToChannelRun) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  upsertChannelRun(run: IChannelRun): IQueryResult<boolean> {
    try {
      const row = channelRunToRow(run);
      this.db
        .prepare(`
          INSERT INTO runs (
            id, external_session_id, parent_run_id, root_run_id, agent_profile_id,
            backend, conversation_id, workspace_ref, status, input_message_id,
            metadata, started_at, ended_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            external_session_id = excluded.external_session_id,
            parent_run_id = excluded.parent_run_id,
            root_run_id = excluded.root_run_id,
            agent_profile_id = excluded.agent_profile_id,
            backend = excluded.backend,
            conversation_id = excluded.conversation_id,
            workspace_ref = excluded.workspace_ref,
            status = excluded.status,
            input_message_id = excluded.input_message_id,
            metadata = excluded.metadata,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at
        `)
        .run(
          row.id,
          row.external_session_id,
          row.parent_run_id,
          row.root_run_id,
          row.agent_profile_id,
          row.backend,
          row.conversation_id,
          row.workspace_ref,
          row.status,
          row.input_message_id,
          row.metadata,
          row.started_at,
          row.ended_at
        );
      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  updateChannelRunStatus(runId: string, status: IChannelRun['status'], endedAt?: number): IQueryResult<boolean> {
    try {
      const result = this.db
        .prepare('UPDATE runs SET status = ?, ended_at = COALESCE(?, ended_at) WHERE id = ?')
        .run(status, endedAt ?? null, runId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Channel User operations
   * 个人助手用户操作
   * ==================
   */

  /**
   * Get all authorized assistant users
   */
  getChannelUsers(): IQueryResult<IChannelUser[]> {
    try {
      const legacyRows = this.db
        .prepare('SELECT * FROM assistant_users ORDER BY authorized_at DESC')
        .all() as IChannelUserRow[];

      const projectedRows = this.db
        .prepare(
          `
            SELECT
              ri.id,
              ri.legacy_user_id,
              COALESCE(ri.remote_user_id, au.platform_user_id, ri.remote_chat_id) AS platform_user_id,
              ci.platform AS platform_type,
              COALESCE(ri.display_name, au.display_name) AS display_name,
              ri.authorized_at,
              COALESCE(ri.last_active, au.last_active) AS last_active,
              COALESCE(es.id, au.session_id) AS session_id
            FROM remote_identities ri
            INNER JOIN connector_instances ci ON ci.id = ri.connector_id
            LEFT JOIN assistant_users au ON au.id = ri.legacy_user_id
            LEFT JOIN external_sessions es ON es.remote_identity_id = ri.id
            ORDER BY COALESCE(ri.last_active, ri.authorized_at) DESC, ri.authorized_at DESC
          `
        )
        .all() as Array<{
        id: string;
        legacy_user_id: string | null;
        platform_user_id: string;
        platform_type: string;
        display_name: string | null;
        authorized_at: number;
        last_active: number | null;
        session_id: string | null;
      }>;

      const projectedUsers: IChannelUser[] = projectedRows.map((row) => ({
        id: row.id,
        platformUserId: row.platform_user_id,
        platformType: row.platform_type as PluginType,
        displayName: row.display_name ?? undefined,
        authorizedAt: row.authorized_at,
        lastActive: row.last_active ?? undefined,
        sessionId: row.session_id ?? undefined,
      }));

      const coveredLegacyUserIds = new Set(
        projectedRows
          .map((row) => row.legacy_user_id)
          .filter((legacyUserId): legacyUserId is string => Boolean(legacyUserId))
      );
      const legacyUsers = legacyRows.map(rowToChannelUser).filter((user) => !coveredLegacyUserIds.has(user.id));

      const users = [...projectedUsers, ...legacyUsers].toSorted(
        (left, right) =>
          (right.lastActive ?? right.authorizedAt) - (left.lastActive ?? left.authorizedAt) ||
          right.authorizedAt - left.authorizedAt
      );

      return { success: true, data: users };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get assistant user by platform user ID
   */
  getChannelUserByPlatform(platformUserId: string, platformType: PluginType): IQueryResult<IChannelUser | null> {
    try {
      const projectedRow = this.db
        .prepare(
          `
            SELECT
              ri.id AS remote_identity_id,
              au.id AS assistant_user_id,
              COALESCE(ri.remote_user_id, au.platform_user_id, ri.remote_chat_id) AS platform_user_id,
              ci.platform AS platform_type,
              COALESCE(ri.display_name, au.display_name) AS display_name,
              ri.authorized_at,
              COALESCE(ri.last_active, au.last_active) AS last_active,
              COALESCE(es.id, au.session_id) AS session_id
            FROM remote_identities ri
            INNER JOIN connector_instances ci ON ci.id = ri.connector_id
            LEFT JOIN assistant_users au ON au.id = ri.legacy_user_id
            LEFT JOIN external_sessions es ON es.remote_identity_id = ri.id
            WHERE ci.platform = ? AND ri.remote_user_id = ?
            ORDER BY COALESCE(ri.last_active, ri.authorized_at) DESC, ri.authorized_at DESC
            LIMIT 1
          `
        )
        .get(platformType, platformUserId) as
        | {
            remote_identity_id: string;
            assistant_user_id: string | null;
            platform_user_id: string;
            platform_type: string;
            display_name: string | null;
            authorized_at: number;
            last_active: number | null;
            session_id: string | null;
          }
        | undefined;

      if (!projectedRow) {
        const legacyRow = this.db
          .prepare('SELECT * FROM assistant_users WHERE platform_user_id = ? AND platform_type = ?')
          .get(platformUserId, platformType) as IChannelUserRow | undefined;
        return { success: true, data: legacyRow ? rowToChannelUser(legacyRow) : null };
      }

      return {
        success: true,
        data: {
          id: projectedRow.remote_identity_id,
          platformUserId: projectedRow.platform_user_id,
          platformType: projectedRow.platform_type as PluginType,
          displayName: projectedRow.display_name ?? undefined,
          authorizedAt: projectedRow.authorized_at,
          lastActive: projectedRow.last_active ?? undefined,
          sessionId: projectedRow.session_id ?? undefined,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create assistant user (authorize)
   */
  createChannelUser(user: IChannelUser): IQueryResult<IChannelUser> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO assistant_users (id, platform_user_id, platform_type, display_name, authorized_at, last_active, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        user.id,
        user.platformUserId,
        user.platformType,
        user.displayName ?? null,
        user.authorizedAt,
        user.lastActive ?? null,
        user.sessionId ?? null
      );

      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  ensureChannelUserMirror(params: {
    remoteIdentityId?: string;
    platformUserId: string;
    platformType: PluginType;
    displayName?: string;
    authorizedAt: number;
    lastActive?: number;
    sessionId?: string;
  }): IQueryResult<IChannelUser> {
    try {
      const remoteIdentityResult = params.remoteIdentityId
        ? this.getRemoteIdentity(params.remoteIdentityId)
        : { success: true, data: null as IRemoteIdentity | null };
      const remoteIdentity = remoteIdentityResult.success ? remoteIdentityResult.data : null;

      let userRow: IChannelUserRow | undefined;
      if (remoteIdentity?.legacyUserId) {
        userRow = this.db.prepare('SELECT * FROM assistant_users WHERE id = ?').get(remoteIdentity.legacyUserId) as
          | IChannelUserRow
          | undefined;
      }

      if (!userRow) {
        userRow = this.db
          .prepare(
            'SELECT * FROM assistant_users WHERE platform_user_id = ? AND platform_type = ? ORDER BY authorized_at DESC LIMIT 1'
          )
          .get(params.platformUserId, params.platformType) as IChannelUserRow | undefined;
      }

      const resolvedUser: IChannelUser = userRow
        ? {
            ...rowToChannelUser(userRow),
            displayName: params.displayName ?? rowToChannelUser(userRow).displayName,
            authorizedAt: Math.min(userRow.authorized_at, params.authorizedAt),
            lastActive: params.lastActive ?? rowToChannelUser(userRow).lastActive,
            sessionId: params.sessionId ?? rowToChannelUser(userRow).sessionId,
          }
        : {
            id: `assistant_user_${randomUUID()}`,
            platformUserId: params.platformUserId,
            platformType: params.platformType,
            displayName: params.displayName,
            authorizedAt: params.authorizedAt,
            lastActive: params.lastActive,
            sessionId: params.sessionId,
          };

      this.db
        .prepare(`
          INSERT INTO assistant_users (id, platform_user_id, platform_type, display_name, authorized_at, last_active, session_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            platform_user_id = excluded.platform_user_id,
            platform_type = excluded.platform_type,
            display_name = excluded.display_name,
            authorized_at = excluded.authorized_at,
            last_active = excluded.last_active,
            session_id = excluded.session_id
        `)
        .run(
          resolvedUser.id,
          resolvedUser.platformUserId,
          resolvedUser.platformType,
          resolvedUser.displayName ?? null,
          resolvedUser.authorizedAt,
          resolvedUser.lastActive ?? null,
          resolvedUser.sessionId ?? null
        );

      if (remoteIdentity) {
        this.upsertRemoteIdentity({
          ...remoteIdentity,
          displayName: params.displayName ?? remoteIdentity.displayName,
          lastActive: params.lastActive ?? remoteIdentity.lastActive,
          legacyUserId: resolvedUser.id,
        });
      }

      return { success: true, data: resolvedUser };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  ensureChannelSessionMirror(session: IChannelSession): IQueryResult<IChannelSession> {
    try {
      const projectedRow = this.db
        .prepare(
          `
            SELECT
              es.id,
              ri.legacy_user_id,
              ap.backend,
              es.active_conversation_id AS conversation_id,
              ap.workspace_ref AS workspace,
              ri.remote_chat_id AS chat_id,
              es.created_at,
              es.last_activity
            FROM external_sessions es
            INNER JOIN remote_identities ri ON ri.id = es.remote_identity_id
            INNER JOIN agent_profiles ap ON ap.id = es.agent_profile_id
            WHERE es.id = ?
            LIMIT 1
          `
        )
        .get(session.id) as
        | {
            id: string;
            legacy_user_id: string | null;
            backend: string;
            conversation_id: string | null;
            workspace: string | null;
            chat_id: string | null;
            created_at: number;
            last_activity: number;
          }
        | undefined;

      const resolvedUserId = projectedRow?.legacy_user_id ?? session.userId;
      const existingUser = this.db.prepare('SELECT id FROM assistant_users WHERE id = ?').get(resolvedUserId) as
        | { id: string }
        | undefined;
      if (!existingUser) {
        throw new Error(`Channel session mirror requires assistant user ${resolvedUserId}`);
      }

      const resolvedSession: IChannelSession = {
        id: session.id,
        userId: resolvedUserId,
        agentType: projectedRow ? mapBackendToChannelAgentType(projectedRow.backend) : session.agentType,
        conversationId: projectedRow?.conversation_id ?? session.conversationId,
        workspace: projectedRow?.workspace ?? session.workspace,
        chatId: projectedRow?.chat_id ?? session.chatId,
        createdAt: projectedRow?.created_at ?? session.createdAt,
        lastActivity: projectedRow?.last_activity ?? session.lastActivity,
      };

      this.db
        .prepare(
          `
            DELETE FROM assistant_sessions
            WHERE id != ?
              AND user_id = ?
              AND COALESCE(chat_id, '') = COALESCE(?, '')
          `
        )
        .run(resolvedSession.id, resolvedSession.userId, resolvedSession.chatId ?? null);

      this.db
        .prepare('UPDATE assistant_users SET session_id = NULL WHERE session_id = ? AND id != ?')
        .run(resolvedSession.id, resolvedSession.userId);

      this.db
        .prepare(`
          INSERT INTO assistant_sessions (id, user_id, agent_type, conversation_id, workspace, chat_id, created_at, last_activity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            user_id = excluded.user_id,
            agent_type = excluded.agent_type,
            conversation_id = excluded.conversation_id,
            workspace = excluded.workspace,
            chat_id = excluded.chat_id,
            created_at = excluded.created_at,
            last_activity = excluded.last_activity
        `)
        .run(
          resolvedSession.id,
          resolvedSession.userId,
          resolvedSession.agentType,
          resolvedSession.conversationId ?? null,
          resolvedSession.workspace ?? null,
          resolvedSession.chatId ?? null,
          resolvedSession.createdAt,
          resolvedSession.lastActivity
        );

      this.db
        .prepare('UPDATE assistant_users SET session_id = ? WHERE id = ?')
        .run(resolvedSession.id, resolvedSession.userId);

      return { success: true, data: resolvedSession };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update assistant user's last active time
   */
  updateChannelUserActivity(userId: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE assistant_users SET last_active = ? WHERE id = ?').run(now, userId);
      this.db.prepare('UPDATE remote_identities SET last_active = ? WHERE legacy_user_id = ?').run(now, userId);
      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete assistant user (revoke authorization)
   */
  deleteChannelUser(userId: string): IQueryResult<boolean> {
    try {
      const projectedIdentity = this.db
        .prepare(
          `
            SELECT id, legacy_user_id, remote_chat_id
            FROM remote_identities
            WHERE id = ?
          `
        )
        .get(userId) as
        | {
            id: string;
            legacy_user_id: string | null;
            remote_chat_id: string;
          }
        | undefined;

      if (projectedIdentity) {
        const sessionIds = this.db
          .prepare('SELECT id FROM external_sessions WHERE remote_identity_id = ?')
          .all(projectedIdentity.id) as Array<{ id: string }>;

        for (const session of sessionIds) {
          this.db.prepare('DELETE FROM assistant_sessions WHERE id = ?').run(session.id);
        }

        if (projectedIdentity.legacy_user_id) {
          this.db
            .prepare('DELETE FROM assistant_sessions WHERE user_id = ? AND chat_id = ?')
            .run(projectedIdentity.legacy_user_id, projectedIdentity.remote_chat_id);
        }

        const deleteIdentityResult = this.db
          .prepare('DELETE FROM remote_identities WHERE id = ?')
          .run(projectedIdentity.id);

        if (projectedIdentity.legacy_user_id) {
          const remaining = this.db
            .prepare('SELECT COUNT(*) AS count FROM remote_identities WHERE legacy_user_id = ?')
            .get(projectedIdentity.legacy_user_id) as { count: number };

          if (remaining.count === 0) {
            this.db.prepare('DELETE FROM assistant_sessions WHERE user_id = ?').run(projectedIdentity.legacy_user_id);
            this.db.prepare('DELETE FROM assistant_users WHERE id = ?').run(projectedIdentity.legacy_user_id);
          } else {
            this.db
              .prepare('UPDATE assistant_users SET session_id = NULL WHERE id = ?')
              .run(projectedIdentity.legacy_user_id);
          }
        }

        return { success: true, data: deleteIdentityResult.changes > 0 };
      }

      const legacyUser = this.db.prepare('SELECT id FROM assistant_users WHERE id = ?').get(userId) as
        | { id: string }
        | undefined;

      if (!legacyUser) {
        return { success: true, data: false };
      }

      const sessionIds = this.db
        .prepare(
          `
            SELECT es.id
            FROM external_sessions es
            INNER JOIN remote_identities ri ON ri.id = es.remote_identity_id
            WHERE ri.legacy_user_id = ?
          `
        )
        .all(userId) as Array<{ id: string }>;

      for (const session of sessionIds) {
        this.db.prepare('DELETE FROM assistant_sessions WHERE id = ?').run(session.id);
      }

      this.db.prepare('DELETE FROM remote_identities WHERE legacy_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM assistant_sessions WHERE user_id = ?').run(userId);

      const result = this.db.prepare('DELETE FROM assistant_users WHERE id = ?').run(userId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Channel Session operations
   * 个人助手会话操作
   * ==================
   */

  /**
   * Get all active assistant sessions
   */
  getChannelSessions(): IQueryResult<IChannelSession[]> {
    try {
      const legacyRows = this.db
        .prepare('SELECT * FROM assistant_sessions ORDER BY last_activity DESC')
        .all() as IChannelSessionRow[];

      const projectedRows = this.db
        .prepare(
          `
            SELECT
              es.id,
              ri.id AS user_id,
              ap.backend,
              es.active_conversation_id AS conversation_id,
              ap.workspace_ref AS workspace,
              ri.remote_chat_id AS chat_id,
              es.created_at,
              es.last_activity
            FROM external_sessions es
            INNER JOIN remote_identities ri ON ri.id = es.remote_identity_id
            INNER JOIN agent_profiles ap ON ap.id = es.agent_profile_id
            ORDER BY es.last_activity DESC
          `
        )
        .all() as Array<{
        id: string;
        user_id: string;
        backend: string;
        conversation_id: string | null;
        workspace: string | null;
        chat_id: string | null;
        created_at: number;
        last_activity: number;
      }>;

      const projectedSessions: IChannelSession[] = projectedRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        agentType: mapBackendToChannelAgentType(row.backend),
        conversationId: row.conversation_id ?? undefined,
        workspace: row.workspace ?? undefined,
        chatId: row.chat_id ?? undefined,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
      }));

      const projectedSessionIds = new Set(projectedSessions.map((session) => session.id));
      const projectedSessionKeys = new Set(
        projectedSessions.map((session) => buildChannelSessionKey(session.userId, session.chatId))
      );
      const legacySessions = legacyRows
        .map(rowToChannelSession)
        .filter(
          (session) =>
            !projectedSessionIds.has(session.id) &&
            !projectedSessionKeys.has(buildChannelSessionKey(session.userId, session.chatId))
        );

      const sessions = [...projectedSessions, ...legacySessions].toSorted(
        (left, right) => right.lastActivity - left.lastActivity || right.createdAt - left.createdAt
      );

      return { success: true, data: sessions };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get assistant session by user ID
   */
  getChannelSessionByUser(userId: string): IQueryResult<IChannelSession | null> {
    try {
      const projectedRow = this.db
        .prepare(
          `
            SELECT
              es.id,
              ri.id AS user_id,
              ap.backend,
              es.active_conversation_id AS conversation_id,
              ap.workspace_ref AS workspace,
              ri.remote_chat_id AS chat_id,
              es.created_at,
              es.last_activity
            FROM external_sessions es
            INNER JOIN remote_identities ri ON ri.id = es.remote_identity_id
            INNER JOIN agent_profiles ap ON ap.id = es.agent_profile_id
            WHERE ri.legacy_user_id = ? OR ri.id = ?
            ORDER BY es.last_activity DESC
            LIMIT 1
          `
        )
        .get(userId, userId) as
        | {
            id: string;
            user_id: string;
            backend: string;
            conversation_id: string | null;
            workspace: string | null;
            chat_id: string | null;
            created_at: number;
            last_activity: number;
          }
        | undefined;

      if (projectedRow) {
        return {
          success: true,
          data: {
            id: projectedRow.id,
            userId: projectedRow.user_id,
            agentType: mapBackendToChannelAgentType(projectedRow.backend),
            conversationId: projectedRow.conversation_id ?? undefined,
            workspace: projectedRow.workspace ?? undefined,
            chatId: projectedRow.chat_id ?? undefined,
            createdAt: projectedRow.created_at,
            lastActivity: projectedRow.last_activity,
          },
        };
      }

      const row = this.db.prepare('SELECT * FROM assistant_sessions WHERE user_id = ?').get(userId) as
        | IChannelSessionRow
        | undefined;
      return { success: true, data: row ? rowToChannelSession(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create or update assistant session
   */
  upsertChannelSession(session: IChannelSession): IQueryResult<boolean> {
    const result = this.ensureChannelSessionMirror({
      ...session,
      createdAt: session.createdAt || Date.now(),
      lastActivity: session.lastActivity || Date.now(),
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: true };
  }

  /**
   * Delete assistant session
   */
  deleteChannelSession(sessionId: string): IQueryResult<boolean> {
    try {
      this.db.prepare('UPDATE assistant_users SET session_id = NULL WHERE session_id = ?').run(sessionId);
      const result = this.db.prepare('DELETE FROM assistant_sessions WHERE id = ?').run(sessionId);
      return { success: true, data: result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ==================
   * Channel Pairing Code operations
   * 个人助手配对码操作
   * ==================
   */

  /**
   * Get all pending pairing requests
   */
  getPendingPairingRequests(): IQueryResult<IChannelPairingRequest[]> {
    try {
      const now = Date.now();
      const legacyRows = this.db
        .prepare(
          "SELECT * FROM assistant_pairing_codes WHERE status = 'pending' AND expires_at > ? ORDER BY requested_at DESC"
        )
        .all(now) as IChannelPairingCodeRow[];
      const v2Rows = this.db
        .prepare(
          `
            SELECT
              p.code,
              p.connector_id,
              p.remote_user_id,
              p.remote_chat_id,
              p.display_name,
              p.requested_at,
              p.expires_at,
              p.status,
              p.metadata,
              c.platform
            FROM pairing_requests_v2 p
            INNER JOIN connector_instances c ON c.id = p.connector_id
            WHERE p.status = 'pending' AND p.expires_at > ?
            ORDER BY p.requested_at DESC
          `
        )
        .all(now) as Array<{
        code: string;
        connector_id: string;
        remote_user_id: string | null;
        remote_chat_id: string;
        display_name: string | null;
        requested_at: number;
        expires_at: number;
        status: string;
        metadata: string;
        platform: string;
      }>;

      const legacyRequests = legacyRows.map(rowToPairingRequest);
      const v2Requests: IChannelPairingRequest[] = v2Rows.map((row) => ({
        code: row.code,
        connectorId: row.connector_id,
        platformUserId: row.remote_user_id ?? row.remote_chat_id,
        platformType: row.platform as PluginType,
        remoteChatId: row.remote_chat_id,
        displayName: row.display_name ?? undefined,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
        status: row.status as IChannelPairingRequest['status'],
        metadata: JSON.parse(row.metadata || '{}') as Record<string, unknown>,
      }));
      const v2Codes = new Set(v2Requests.map((request) => request.code));

      return {
        success: true,
        data: [...v2Requests, ...legacyRequests.filter((request) => !v2Codes.has(request.code))],
      };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get pairing request by code
   */
  getPairingRequestByCode(code: string): IQueryResult<IChannelPairingRequest | null> {
    try {
      const v2Row = this.db
        .prepare(
          `
            SELECT
              p.code,
              p.connector_id,
              p.remote_user_id,
              p.remote_chat_id,
              p.display_name,
              p.requested_at,
              p.expires_at,
              p.status,
              p.metadata,
              c.platform
            FROM pairing_requests_v2 p
            INNER JOIN connector_instances c ON c.id = p.connector_id
            WHERE p.code = ?
          `
        )
        .get(code) as
        | {
            code: string;
            connector_id: string;
            remote_user_id: string | null;
            remote_chat_id: string;
            display_name: string | null;
            requested_at: number;
            expires_at: number;
            status: string;
            metadata: string;
            platform: string;
          }
        | undefined;

      if (v2Row) {
        return {
          success: true,
          data: {
            code: v2Row.code,
            connectorId: v2Row.connector_id,
            platformUserId: v2Row.remote_user_id ?? v2Row.remote_chat_id,
            platformType: v2Row.platform as PluginType,
            remoteChatId: v2Row.remote_chat_id,
            displayName: v2Row.display_name ?? undefined,
            requestedAt: v2Row.requested_at,
            expiresAt: v2Row.expires_at,
            status: v2Row.status as IChannelPairingRequest['status'],
            metadata: JSON.parse(v2Row.metadata || '{}') as Record<string, unknown>,
          },
        };
      }

      const row = this.db.prepare('SELECT * FROM assistant_pairing_codes WHERE code = ?').get(code) as
        | IChannelPairingCodeRow
        | undefined;
      return { success: true, data: row ? rowToPairingRequest(row) : null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create pairing request
   */
  createPairingRequest(request: IChannelPairingRequest): IQueryResult<IChannelPairingRequest> {
    try {
      if (request.connectorId) {
        this.db
          .prepare(`
            INSERT INTO pairing_requests_v2 (
              code, connector_id, remote_user_id, remote_chat_id, display_name,
              requested_at, expires_at, status, metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
              connector_id = excluded.connector_id,
              remote_user_id = excluded.remote_user_id,
              remote_chat_id = excluded.remote_chat_id,
              display_name = excluded.display_name,
              requested_at = excluded.requested_at,
              expires_at = excluded.expires_at,
              status = excluded.status,
              metadata = excluded.metadata
          `)
          .run(
            request.code,
            request.connectorId,
            request.platformUserId,
            request.remoteChatId ?? request.platformUserId,
            request.displayName ?? null,
            request.requestedAt,
            request.expiresAt,
            request.status,
            JSON.stringify(request.metadata ?? {})
          );
      }

      const stmt = this.db.prepare(`
        INSERT INTO assistant_pairing_codes (code, platform_user_id, platform_type, display_name, requested_at, expires_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          platform_user_id = excluded.platform_user_id,
          platform_type = excluded.platform_type,
          display_name = excluded.display_name,
          requested_at = excluded.requested_at,
          expires_at = excluded.expires_at,
          status = excluded.status
      `);

      stmt.run(
        request.code,
        request.platformUserId,
        request.platformType,
        request.displayName ?? null,
        request.requestedAt,
        request.expiresAt,
        request.status
      );

      return { success: true, data: request };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update pairing request status
   */
  updatePairingRequestStatus(code: string, status: IChannelPairingRequest['status']): IQueryResult<boolean> {
    try {
      const legacyResult = this.db
        .prepare('UPDATE assistant_pairing_codes SET status = ? WHERE code = ?')
        .run(status, code);
      const v2Result = this.db.prepare('UPDATE pairing_requests_v2 SET status = ? WHERE code = ?').run(status, code);
      return { success: true, data: legacyResult.changes > 0 || v2Result.changes > 0 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete expired pairing requests
   */
  cleanupExpiredPairingRequests(): IQueryResult<number> {
    try {
      const now = Date.now();
      const legacyResult = this.db
        .prepare("DELETE FROM assistant_pairing_codes WHERE expires_at < ? OR status != 'pending'")
        .run(now);
      const v2Result = this.db
        .prepare("DELETE FROM pairing_requests_v2 WHERE expires_at < ? OR status != 'pending'")
        .run(now);
      return { success: true, data: legacyResult.changes + v2Result.changes };
    } catch (error: any) {
      return { success: false, error: error.message, data: 0 };
    }
  }

  insertVoiceInputRecord(record: VoiceInputRecord): IQueryResult<VoiceInputRecord> {
    try {
      this.db
        .prepare(
          `INSERT INTO voice_input_records (
            id,
            provider_id,
            trigger_mode,
            status,
            transcript,
            transcript_length,
            source_app_name,
            source_bundle_id,
            model,
            language_hints,
            vocabulary_id,
            hotwords,
            duration_ms,
            error_message,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.providerId,
          record.triggerMode,
          record.status,
          record.transcript,
          record.transcriptLength,
          record.sourceAppName ?? null,
          record.sourceBundleId ?? null,
          record.model ?? null,
          JSON.stringify(record.languageHints),
          record.vocabularyId ?? null,
          JSON.stringify(record.hotwords),
          record.durationMs ?? null,
          record.errorMessage ?? null,
          record.createdAt
        );

      return { success: true, data: record };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  listVoiceInputRecords(limit = 20): IQueryResult<VoiceInputRecord[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM voice_input_records ORDER BY created_at DESC LIMIT ?')
        .all(limit) as VoiceInputRecordRow[];
      return { success: true, data: rows.map(rowToVoiceInputRecord) };
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }

  getVoiceInputStats(): IQueryResult<VoiceInputStats> {
    try {
      const row = this.db
        .prepare(
          `SELECT
            COUNT(*) AS total_transcription_count,
            COALESCE(SUM(COALESCE(duration_ms, 0)), 0) AS total_recording_duration_ms,
            COALESCE(SUM(COALESCE(transcript_length, 0)), 0) AS total_transcribed_character_count
          FROM voice_input_records
          WHERE status != 'failed'`
        )
        .get() as VoiceInputStatsRow | undefined;

      return {
        success: true,
        data: {
          totalTranscriptionCount: row?.total_transcription_count ?? 0,
          totalRecordingDurationMs: row?.total_recording_duration_ms ?? 0,
          totalTranscribedCharacterCount: row?.total_transcribed_character_count ?? 0,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM');
    console.log('[Database] Vacuum completed');
  }
}

// Async singleton with Promise cache
let dbInstancePromise: Promise<AionUIDatabase> | null = null;
// Synchronous reference to the resolved instance — used for safe close on exit
let dbResolved: AionUIDatabase | null = null;

function resolveDbPath(): string {
  return path.join(getDataPath(), 'aionui.db');
}

export function getDatabase(): Promise<AionUIDatabase> {
  if (!dbInstancePromise) {
    dbInstancePromise = AionUIDatabase.create(resolveDbPath()).then((db) => {
      dbResolved = db;
      return db;
    });
  }
  return dbInstancePromise;
}

export function closeDatabase(): void {
  // Close synchronously via the resolved reference so this is safe to call from
  // process.on('exit') handlers (which cannot await Promises).
  if (dbResolved) {
    try {
      dbResolved.close();
    } catch {
      // ignore errors during shutdown
    }
    dbResolved = null;
  }
  dbInstancePromise = null;
}
