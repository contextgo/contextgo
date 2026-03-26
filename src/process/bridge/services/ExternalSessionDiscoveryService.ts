/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation, TProviderWithModel } from '@/common/config/storage';
import type { TMessage } from '@/common/chat/chatLib';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import type {
  ExternalSessionProvider,
  ExternalSessionSummary,
  ImportExternalSessionParams,
} from '@/common/types/externalSessions';
import { uuid } from '@/common/utils';
import type { IConversationService } from '@/process/services/IConversationService';
import { getDatabase } from '@/process/services/database';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';

type CodexThreadRow = {
  id: string;
  title: string;
  cwd: string;
  updated_at: number;
  source: string;
  model_provider: string | null;
  model: string | null;
  reasoning_effort: string | null;
  rollout_path?: string | null;
};

type OpencodeSessionRow = {
  id: string;
  title: string;
  directory: string;
  time_updated: number;
  latest_message_data: string | null;
};

type OpencodeMessageRow = {
  id: string;
  time_created: number;
  data: string;
};

type OpencodePartRow = {
  id: string;
  message_id: string;
  time_created: number;
  data: string;
};

type ImportedConversationMessage = {
  content: string;
  createdAt: number;
  position: 'left' | 'right';
};

type CodexRolloutEntry = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown> & {
    type?: string;
    role?: string;
    message?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
};

type ClaudeJsonlEntry = {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  isMeta?: boolean;
  message?: {
    model?: string;
    role?: string;
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
          thinking?: string;
        }>;
  };
  lastPrompt?: string;
};

type GeminiChatMessage = {
  timestamp?: string;
  type?: string;
  content?: unknown;
  model?: string;
};

type GeminiChatFile = {
  sessionId?: string;
  startTime?: string;
  lastUpdated?: string;
  messages?: GeminiChatMessage[];
};

type GeminiSessionSource = {
  chatPath: string;
  sessionId: string;
  workspace: string;
  title: string;
  updatedAt: number;
  model?: string;
};

type OpencodeMessageData = {
  role?: string;
  time?: {
    created?: number;
    completed?: number;
  };
  model?: {
    providerID?: string;
    modelID?: string;
  };
  providerID?: string;
  modelID?: string;
  variant?: string;
};

type OpencodePartData = {
  type?: string;
  text?: string;
};

type ExternalSessionDiscoveryOptions = {
  codexHomeDir?: string;
  claudeHomeDir?: string;
  geminiHomeDir?: string;
  opencodeDbPath?: string;
  availableBackends?: Set<AcpBackendAll>;
};

type CodexStateDbInfo = {
  path: string;
  mtimeMs: number;
  walMtimeMs: number;
};

type CodexSessionCacheEntry = {
  dbPath: string;
  dbMtimeMs: number;
  dbWalMtimeMs: number;
  sessions: ExternalSessionSummary[];
};

const CODEX_STATE_FILE_PATTERN = /^state_\d+\.sqlite$/;
const CLAUDE_SESSION_FILE_PATTERN = /\.jsonl$/i;
const CODEX_IMPORT_PLACEHOLDER_PROVIDER: TProviderWithModel = {
  id: 'external-session-import',
  platform: 'codex',
  name: 'Codex',
  baseUrl: '',
  apiKey: '',
  useModel: 'default',
};
const CLAUDE_IMPORT_PLACEHOLDER_PROVIDER: TProviderWithModel = {
  id: 'external-session-import',
  platform: 'anthropic',
  name: 'Claude Code',
  baseUrl: '',
  apiKey: '',
  useModel: 'default',
};
const GEMINI_IMPORT_PLACEHOLDER_PROVIDER: TProviderWithModel = {
  id: 'external-session-import',
  platform: 'gemini',
  name: 'Gemini',
  baseUrl: '',
  apiKey: '',
  useModel: 'default',
};
const OPENCODE_IMPORT_PLACEHOLDER_PROVIDER: TProviderWithModel = {
  id: 'external-session-import',
  platform: 'opencode',
  name: 'OpenCode',
  baseUrl: '',
  apiKey: '',
  useModel: 'default',
};

let codexSessionCache: CodexSessionCacheEntry | null = null;
let opencodeSessionCache: CodexSessionCacheEntry | null = null;

export class ExternalSessionDiscoveryService {
  constructor(
    private readonly conversationService: IConversationService,
    private readonly options: ExternalSessionDiscoveryOptions = {}
  ) {}

  async listSessions(): Promise<ExternalSessionSummary[]> {
    const [codexSessions, claudeSessions, geminiSessions, opencodeSessions] = await Promise.all([
      this.listCodexSessions(),
      this.listClaudeSessions(),
      this.listGeminiSessions(),
      this.listOpencodeSessions(),
    ]);
    const sessions = [...codexSessions, ...claudeSessions, ...geminiSessions, ...opencodeSessions];

    if (sessions.length === 0) {
      return [];
    }

    const conversations = await this.conversationService.listAllConversations();
    const managedSessions = this.collectManagedSessions(conversations);

    return sessions
      .filter((session) => !managedSessions.has(this.buildManagedKey(session.provider, session.sessionId)))
      .toSorted((left, right) => right.updatedAt - left.updatedAt);
  }

  async importSession(params: ImportExternalSessionParams): Promise<TChatConversation> {
    const { provider, sessionId } = params;
    const conversations = await this.conversationService.listAllConversations();
    const existingConversation = this.findImportedConversation(conversations, provider, sessionId);
    if (existingConversation) {
      return existingConversation;
    }

    switch (provider) {
      case 'claude':
        return this.importClaudeSession(sessionId);
      case 'codex':
        return this.importCodexSession(sessionId);
      case 'gemini':
        return this.importGeminiSession(sessionId);
      case 'opencode':
        return this.importOpencodeSession(sessionId);
      default:
        throw new Error(`External session provider is not supported yet: ${provider}`);
    }
  }

  private async importClaudeSession(sessionId: string): Promise<TChatConversation> {
    const session = (await this.listClaudeSessions()).find((item) => item.sessionId === sessionId);
    if (!session) {
      throw new Error('External Claude session not found');
    }

    const conversation = await this.conversationService.createConversation({
      type: 'acp',
      name: session.title || path.basename(session.workspace) || session.sessionId,
      model: {
        ...CLAUDE_IMPORT_PLACEHOLDER_PROVIDER,
        useModel: session.model || CLAUDE_IMPORT_PLACEHOLDER_PROVIDER.useModel,
      },
      source: 'aionui',
      extra: {
        workspace: session.workspace,
        customWorkspace: true,
        backend: 'claude',
        cliPath: 'claude',
        agentName: 'Claude Code',
        acpSessionId: session.sessionId,
        acpSessionUpdatedAt: session.updatedAt,
        currentModelId: session.model || undefined,
        externalSessionImported: true,
        deferInitialWorkspaceLoad: true,
      },
    });

    await this.importClaudeHistory(conversation.id, sessionId);

    return conversation;
  }

  private async importCodexSession(sessionId: string): Promise<TChatConversation> {
    const session = (await this.listCodexSessions()).find((item) => item.sessionId === sessionId);
    if (!session) {
      throw new Error('External Codex session not found');
    }

    const conversation = await this.conversationService.createConversation({
      type: 'acp',
      name: session.title || path.basename(session.workspace) || session.sessionId,
      model: {
        ...CODEX_IMPORT_PLACEHOLDER_PROVIDER,
        useModel: session.model || CODEX_IMPORT_PLACEHOLDER_PROVIDER.useModel,
      },
      source: 'aionui',
      extra: {
        workspace: session.workspace,
        customWorkspace: true,
        backend: 'codex',
        cliPath: 'codex',
        agentName: 'Codex CLI',
        acpSessionId: session.sessionId,
        acpSessionUpdatedAt: session.updatedAt,
        currentModelId: session.model || undefined,
        externalSessionImported: true,
        deferInitialWorkspaceLoad: true,
      },
    });

    await this.importCodexHistory(conversation.id, sessionId);

    return conversation;
  }

  private async importGeminiSession(sessionId: string): Promise<TChatConversation> {
    const session = (await this.listGeminiSessions()).find((item) => item.sessionId === sessionId);
    if (!session) {
      throw new Error('External Gemini session not found');
    }

    const conversation = await this.conversationService.createConversation({
      type: 'acp',
      name: session.title || path.basename(session.workspace) || session.sessionId,
      model: {
        ...GEMINI_IMPORT_PLACEHOLDER_PROVIDER,
        useModel: session.model || GEMINI_IMPORT_PLACEHOLDER_PROVIDER.useModel,
      },
      source: 'aionui',
      extra: {
        workspace: session.workspace,
        customWorkspace: true,
        backend: 'gemini',
        cliPath: 'gemini',
        agentName: 'Gemini CLI',
        acpSessionId: session.sessionId,
        acpSessionUpdatedAt: session.updatedAt,
        currentModelId: session.model || undefined,
        externalSessionImported: true,
        deferInitialWorkspaceLoad: true,
      },
    });

    await this.importGeminiHistory(conversation.id, sessionId);

    return conversation;
  }

  private async importOpencodeSession(sessionId: string): Promise<TChatConversation> {
    const session = (await this.listOpencodeSessions()).find((item) => item.sessionId === sessionId);
    if (!session) {
      throw new Error('External OpenCode session not found');
    }

    const conversation = await this.conversationService.createConversation({
      type: 'acp',
      name: session.title || path.basename(session.workspace) || session.sessionId,
      model: {
        ...OPENCODE_IMPORT_PLACEHOLDER_PROVIDER,
        useModel: session.model || OPENCODE_IMPORT_PLACEHOLDER_PROVIDER.useModel,
      },
      source: 'aionui',
      extra: {
        workspace: session.workspace,
        customWorkspace: true,
        backend: 'opencode',
        cliPath: 'opencode',
        agentName: 'OpenCode CLI',
        acpSessionId: session.sessionId,
        acpSessionUpdatedAt: session.updatedAt,
        currentModelId: session.model || undefined,
        externalSessionImported: true,
        deferInitialWorkspaceLoad: true,
      },
    });

    await this.importOpencodeHistory(conversation.id, sessionId);

    return conversation;
  }

  private async listCodexSessions(): Promise<ExternalSessionSummary[]> {
    if (!this.isBackendAvailable('codex')) {
      return [];
    }

    const stateDb = await this.resolveLatestCodexStateDb();
    if (!stateDb) {
      return [];
    }

    if (
      codexSessionCache &&
      codexSessionCache.dbPath === stateDb.path &&
      codexSessionCache.dbMtimeMs === stateDb.mtimeMs &&
      codexSessionCache.dbWalMtimeMs === stateDb.walMtimeMs
    ) {
      return codexSessionCache.sessions;
    }

    let database: DatabaseSync | null = null;
    try {
      database = new DatabaseSync(stateDb.path, {
        open: true,
        readOnly: true,
      });
      const rows = database
        .prepare(`
          SELECT id, title, cwd, updated_at, source, model_provider, model, reasoning_effort
          FROM threads
          WHERE archived = 0
          ORDER BY updated_at DESC
        `)
        .all() as CodexThreadRow[];

      const sessions = rows
        .filter((row) => typeof row.id === 'string' && typeof row.cwd === 'string' && row.cwd.trim())
        .map((row) => ({
          provider: 'codex' as const,
          sessionId: row.id,
          title: row.title || row.id,
          workspace: row.cwd,
          updatedAt: this.normalizeTimestamp(row.updated_at),
          origin: row.source || undefined,
          modelProvider: row.model_provider || undefined,
          model: row.model || undefined,
          reasoningEffort: row.reasoning_effort || undefined,
        }));

      codexSessionCache = {
        dbPath: stateDb.path,
        dbMtimeMs: stateDb.mtimeMs,
        dbWalMtimeMs: stateDb.walMtimeMs,
        sessions,
      };

      return sessions;
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to list Codex sessions:', error);
      return [];
    } finally {
      database?.close();
    }
  }

  private async listClaudeSessions(): Promise<ExternalSessionSummary[]> {
    if (!this.isBackendAvailable('claude')) {
      return [];
    }

    const claudeHomeDir = this.options.claudeHomeDir || path.join(os.homedir(), '.claude');
    const projectsDir = path.join(claudeHomeDir, 'projects');

    try {
      const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
      const sessionFiles = await Promise.all(
        projectEntries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const projectDir = path.join(projectsDir, entry.name);
            const children = await fs.readdir(projectDir, { withFileTypes: true });
            return children
              .filter((child) => child.isFile() && CLAUDE_SESSION_FILE_PATTERN.test(child.name))
              .map((child) => path.join(projectDir, child.name));
          })
      );

      const sessions = await Promise.all(
        sessionFiles.flat().map((filePath) => this.readClaudeSessionSummary(filePath))
      );
      return sessions.filter((session): session is ExternalSessionSummary => session !== null);
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to list Claude sessions:', error);
      return [];
    }
  }

  private async listGeminiSessions(): Promise<ExternalSessionSummary[]> {
    if (!this.isBackendAvailable('gemini')) {
      return [];
    }

    const geminiTmpDir = path.join(this.options.geminiHomeDir || path.join(os.homedir(), '.gemini'), 'tmp');

    try {
      const entries = await fs.readdir(geminiTmpDir, { withFileTypes: true });
      const sessionGroups = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => this.listGeminiSessionsInProject(path.join(geminiTmpDir, entry.name)))
      );

      const dedupedSessions = new Map<string, ExternalSessionSummary>();
      for (const group of sessionGroups) {
        for (const session of group) {
          const existing = dedupedSessions.get(session.sessionId);
          if (!existing || existing.updatedAt < session.updatedAt) {
            dedupedSessions.set(session.sessionId, session);
          }
        }
      }

      return Array.from(dedupedSessions.values());
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to list Gemini sessions:', error);
      return [];
    }
  }

  private async listOpencodeSessions(): Promise<ExternalSessionSummary[]> {
    if (!this.isBackendAvailable('opencode')) {
      return [];
    }

    const stateDb = await this.resolveOpencodeStateDb();
    if (!stateDb) {
      return [];
    }

    if (
      opencodeSessionCache &&
      opencodeSessionCache.dbPath === stateDb.path &&
      opencodeSessionCache.dbMtimeMs === stateDb.mtimeMs &&
      opencodeSessionCache.dbWalMtimeMs === stateDb.walMtimeMs
    ) {
      return opencodeSessionCache.sessions;
    }

    let database: DatabaseSync | null = null;
    try {
      database = new DatabaseSync(stateDb.path, {
        open: true,
        readOnly: true,
      });
      const rows = database
        .prepare(`
          SELECT
            s.id,
            s.title,
            s.directory,
            s.time_updated,
            (
              SELECT m.data
              FROM message m
              WHERE m.session_id = s.id
              ORDER BY m.time_created DESC, m.id DESC
              LIMIT 1
            ) AS latest_message_data
          FROM session s
          WHERE s.time_archived IS NULL
          ORDER BY s.time_updated DESC
        `)
        .all() as OpencodeSessionRow[];

      const sessions = rows
        .filter((row) => typeof row.id === 'string' && typeof row.directory === 'string' && row.directory.trim())
        .map((row) => {
          const latestMessage = this.parseOpencodeMessageData(row.latest_message_data);

          return {
            provider: 'opencode' as const,
            sessionId: row.id,
            title: row.title || row.id,
            workspace: row.directory,
            updatedAt: this.normalizeTimestamp(row.time_updated),
            modelProvider: latestMessage?.providerID || latestMessage?.model?.providerID || undefined,
            model: latestMessage?.modelID || latestMessage?.model?.modelID || undefined,
            reasoningEffort: latestMessage?.variant || undefined,
          };
        });

      opencodeSessionCache = {
        dbPath: stateDb.path,
        dbMtimeMs: stateDb.mtimeMs,
        dbWalMtimeMs: stateDb.walMtimeMs,
        sessions,
      };

      return sessions;
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to list OpenCode sessions:', error);
      return [];
    } finally {
      database?.close();
    }
  }

  private async resolveLatestCodexStateDb(): Promise<CodexStateDbInfo | null> {
    const codexHomeDir = this.options.codexHomeDir || path.join(os.homedir(), '.codex');

    try {
      const entries = await fs.readdir(codexHomeDir, { withFileTypes: true });
      const candidates = entries
        .filter((entry) => entry.isFile() && CODEX_STATE_FILE_PATTERN.test(entry.name))
        .map((entry) => path.join(codexHomeDir, entry.name));

      if (candidates.length === 0) {
        return null;
      }

      const stats = await Promise.all(
        candidates.map(async (candidatePath) => ({
          path: candidatePath,
          stat: await fs.stat(candidatePath),
        }))
      );

      stats.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
      const latest = stats[0];

      if (!latest) {
        return null;
      }

      return {
        path: latest.path,
        mtimeMs: latest.stat.mtimeMs,
        walMtimeMs: 0,
      };
    } catch {
      return null;
    }
  }

  private async resolveOpencodeStateDb(): Promise<CodexStateDbInfo | null> {
    const configuredPath = this.options.opencodeDbPath;
    if (configuredPath) {
      return this.buildStateDbInfo(configuredPath);
    }

    const homeDir = os.homedir();
    const xdgDataHome = process.env.XDG_DATA_HOME;
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;
    const candidatePaths =
      process.platform === 'win32'
        ? [
            path.join(localAppData || path.join(homeDir, 'AppData', 'Local'), 'opencode', 'opencode.db'),
            path.join(appData || path.join(homeDir, 'AppData', 'Roaming'), 'opencode', 'opencode.db'),
            path.join(homeDir, '.opencode', 'opencode.db'),
          ]
        : [
            path.join(xdgDataHome || path.join(homeDir, '.local', 'share'), 'opencode', 'opencode.db'),
            path.join(homeDir, 'Library', 'Application Support', 'opencode', 'opencode.db'),
            path.join(homeDir, '.opencode', 'opencode.db'),
          ];

    const dbInfos = await Promise.all(candidatePaths.map((candidatePath) => this.buildStateDbInfo(candidatePath)));
    const existingDbs = dbInfos.filter((dbInfo): dbInfo is CodexStateDbInfo => dbInfo !== null);
    if (existingDbs.length === 0) {
      return null;
    }

    existingDbs.sort((left, right) => {
      const leftMtime = Math.max(left.mtimeMs, left.walMtimeMs);
      const rightMtime = Math.max(right.mtimeMs, right.walMtimeMs);
      return rightMtime - leftMtime;
    });

    return existingDbs[0] || null;
  }

  private async buildStateDbInfo(dbPath: string): Promise<CodexStateDbInfo | null> {
    try {
      const stat = await fs.stat(dbPath);
      const walPath = `${dbPath}-wal`;
      const walMtimeMs = await fs
        .stat(walPath)
        .then((walStat) => walStat.mtimeMs)
        .catch(() => 0);

      return {
        path: dbPath,
        mtimeMs: stat.mtimeMs,
        walMtimeMs,
      };
    } catch {
      return null;
    }
  }

  private async importCodexHistory(conversationId: string, sessionId: string): Promise<void> {
    try {
      const thread = await this.getCodexThread(sessionId);
      if (!thread?.rollout_path) {
        return;
      }

      const importedMessages = await this.readCodexRolloutMessages(thread.rollout_path);
      await this.insertImportedMessages(conversationId, importedMessages, 'Codex');
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to import Codex history:', error);
    }
  }

  private async importGeminiHistory(conversationId: string, sessionId: string): Promise<void> {
    try {
      const session = await this.getGeminiSessionSource(sessionId);
      if (!session) {
        return;
      }

      const importedMessages = await this.readGeminiChatMessages(session.chatPath);
      await this.insertImportedMessages(conversationId, importedMessages, 'Gemini');
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to import Gemini history:', error);
    }
  }

  private async importOpencodeHistory(conversationId: string, sessionId: string): Promise<void> {
    const stateDb = await this.resolveOpencodeStateDb();
    if (!stateDb) {
      return;
    }

    let database: DatabaseSync | null = null;
    try {
      database = new DatabaseSync(stateDb.path, {
        open: true,
        readOnly: true,
      });

      const messageRows = database
        .prepare(`
          SELECT id, time_created, data
          FROM message
          WHERE session_id = ?
          ORDER BY time_created ASC, id ASC
        `)
        .all(sessionId) as OpencodeMessageRow[];
      if (messageRows.length === 0) {
        return;
      }

      const partRows = database
        .prepare(`
          SELECT id, message_id, time_created, data
          FROM part
          WHERE session_id = ?
          ORDER BY time_created ASC, id ASC
        `)
        .all(sessionId) as OpencodePartRow[];

      const partsByMessageId = new Map<string, OpencodePartRow[]>();
      for (const partRow of partRows) {
        const messageParts = partsByMessageId.get(partRow.message_id) || [];
        messageParts.push(partRow);
        partsByMessageId.set(partRow.message_id, messageParts);
      }

      const importedMessages = messageRows
        .map((messageRow) => this.parseOpencodeImportedMessage(messageRow, partsByMessageId.get(messageRow.id) || []))
        .filter((message): message is ImportedConversationMessage => message !== null);

      await this.insertImportedMessages(conversationId, importedMessages, 'OpenCode');
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to import OpenCode history:', error);
    } finally {
      database?.close();
    }
  }

  private async importClaudeHistory(conversationId: string, sessionId: string): Promise<void> {
    try {
      const sessionFilePath = await this.resolveClaudeSessionFilePath(sessionId);
      if (!sessionFilePath) {
        return;
      }

      const importedMessages = await this.readClaudeSessionMessages(sessionFilePath);
      await this.insertImportedMessages(conversationId, importedMessages, 'Claude');
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to import Claude history:', error);
    }
  }

  private async getCodexThread(sessionId: string): Promise<CodexThreadRow | null> {
    const stateDb = await this.resolveLatestCodexStateDb();
    if (!stateDb) {
      return null;
    }

    let database: DatabaseSync | null = null;
    try {
      database = new DatabaseSync(stateDb.path, {
        open: true,
        readOnly: true,
      });

      const row = database
        .prepare(`
          SELECT id, title, cwd, updated_at, source, model_provider, model, reasoning_effort, rollout_path
          FROM threads
          WHERE archived = 0 AND id = ?
          LIMIT 1
        `)
        .get(sessionId) as CodexThreadRow | undefined;

      return row ?? null;
    } catch (error) {
      console.warn('[ExternalSessionDiscoveryService] Failed to load Codex thread:', error);
      return null;
    } finally {
      database?.close();
    }
  }

  private async resolveClaudeSessionFilePath(sessionId: string): Promise<string | null> {
    const claudeHomeDir = this.options.claudeHomeDir || path.join(os.homedir(), '.claude');
    const projectsDir = path.join(claudeHomeDir, 'projects');

    try {
      const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });

      for (const entry of projectEntries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const candidate = path.join(projectsDir, entry.name, `${sessionId}.jsonl`);
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          continue;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private async readCodexRolloutMessages(rolloutPath: string): Promise<ImportedConversationMessage[]> {
    const importedMessages: ImportedConversationMessage[] = [];
    const stream = createReadStream(rolloutPath, { encoding: 'utf8' });
    const lineReader = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of lineReader) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        try {
          const entry = JSON.parse(trimmedLine) as CodexRolloutEntry;
          const importedMessage = this.parseCodexRolloutEntry(entry);
          if (importedMessage) {
            importedMessages.push(importedMessage);
          }
        } catch {
          continue;
        }
      }
    } finally {
      lineReader.close();
      stream.destroy();
    }

    return importedMessages.toSorted((left, right) => left.createdAt - right.createdAt);
  }

  private async readClaudeSessionSummary(sessionFilePath: string): Promise<ExternalSessionSummary | null> {
    const importedUserMessages = await this.readClaudeSessionMessages(sessionFilePath, true);
    const stat = await fs.stat(sessionFilePath);
    let workspace = '';
    let title = '';
    let model: string | undefined;
    let updatedAt = 0;

    const stream = createReadStream(sessionFilePath, { encoding: 'utf8' });
    const lineReader = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of lineReader) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        try {
          const entry = JSON.parse(trimmedLine) as ClaudeJsonlEntry;
          if (!workspace && typeof entry.cwd === 'string' && entry.cwd.trim()) {
            workspace = entry.cwd.trim();
          }

          if (entry.type === 'last-prompt' && typeof entry.lastPrompt === 'string' && entry.lastPrompt.trim()) {
            title = entry.lastPrompt.trim();
          }

          if (!model && typeof entry.message?.model === 'string' && entry.message.model.trim()) {
            model = entry.message.model.trim();
          }

          const parsedTimestamp = this.parseRolloutTimestamp(entry.timestamp);
          if (parsedTimestamp > updatedAt) {
            updatedAt = parsedTimestamp;
          }
        } catch {
          continue;
        }
      }
    } finally {
      lineReader.close();
      stream.destroy();
    }

    if (!workspace) {
      return null;
    }

    const sessionId = path.basename(sessionFilePath, '.jsonl');
    const fallbackTitle = importedUserMessages.at(-1)?.content || path.basename(workspace) || sessionId;

    return {
      provider: 'claude',
      sessionId,
      title: (title || fallbackTitle).trim(),
      workspace,
      updatedAt: updatedAt || stat.mtimeMs,
      origin: 'cli',
      modelProvider: 'anthropic',
      model,
    };
  }

  private async readClaudeSessionMessages(
    sessionFilePath: string,
    onlyUserMessages: boolean = false
  ): Promise<ImportedConversationMessage[]> {
    const importedMessages: ImportedConversationMessage[] = [];
    const stream = createReadStream(sessionFilePath, { encoding: 'utf8' });
    const lineReader = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of lineReader) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        try {
          const entry = JSON.parse(trimmedLine) as ClaudeJsonlEntry;
          const importedMessage = this.parseClaudeSessionEntry(entry, onlyUserMessages);
          if (importedMessage) {
            importedMessages.push(importedMessage);
          }
        } catch {
          continue;
        }
      }
    } finally {
      lineReader.close();
      stream.destroy();
    }

    return importedMessages.toSorted((left, right) => left.createdAt - right.createdAt);
  }

  private parseCodexRolloutEntry(entry: CodexRolloutEntry): ImportedConversationMessage | null {
    const createdAt = this.parseRolloutTimestamp(entry.timestamp);

    if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
      const content = typeof entry.payload.message === 'string' ? entry.payload.message.trim() : '';
      if (!content) {
        return null;
      }

      return {
        content,
        createdAt,
        position: 'right',
      };
    }

    if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
      const content = Array.isArray(entry.payload.content)
        ? entry.payload.content
            .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
            .map((item) => item.text?.trim() || '')
            .filter(Boolean)
            .join('\n\n')
        : '';

      if (!content) {
        return null;
      }

      return {
        content,
        createdAt,
        position: 'left',
      };
    }

    return null;
  }

  private parseOpencodeImportedMessage(
    messageRow: OpencodeMessageRow,
    partRows: OpencodePartRow[]
  ): ImportedConversationMessage | null {
    const messageData = this.parseOpencodeMessageData(messageRow.data);
    const role = messageData?.role;
    if (role !== 'user' && role !== 'assistant') {
      return null;
    }

    const content = partRows
      .map((partRow) => this.parseOpencodePartData(partRow.data))
      .filter((partData) => partData?.type === 'text' && typeof partData.text === 'string')
      .map((partData) => partData?.text?.trim() || '')
      .filter(Boolean)
      .join('\n\n');
    if (!content) {
      return null;
    }

    return {
      content,
      createdAt: this.normalizeTimestamp(messageData?.time?.created || messageRow.time_created),
      position: role === 'user' ? 'right' : 'left',
    };
  }

  private parseClaudeSessionEntry(
    entry: ClaudeJsonlEntry,
    onlyUserMessages: boolean
  ): ImportedConversationMessage | null {
    const createdAt = this.parseRolloutTimestamp(entry.timestamp);

    if (entry.type === 'user' && !entry.isMeta) {
      const content = this.extractClaudeMessageText(entry.message?.content);
      if (!content || this.isClaudeControlMessage(content)) {
        return null;
      }

      return {
        content,
        createdAt,
        position: 'right',
      };
    }

    if (onlyUserMessages) {
      return null;
    }

    if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
      const content = this.extractClaudeMessageText(entry.message?.content, ['text']);
      if (!content) {
        return null;
      }

      return {
        content,
        createdAt,
        position: 'left',
      };
    }

    return null;
  }

  private extractClaudeMessageText(
    content: ClaudeJsonlEntry['message'] extends { content?: infer T } ? T : never,
    allowedTypes: string[] = ['text']
  ): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .filter((item) => allowedTypes.includes(item.type || '') && typeof item.text === 'string')
      .map((item) => item.text?.trim() || '')
      .filter(Boolean)
      .join('\n\n');
  }

  private isClaudeControlMessage(content: string): boolean {
    const trimmedContent = content.trim();
    return (
      trimmedContent.startsWith('<local-command-') ||
      trimmedContent.startsWith('<command-name>') ||
      trimmedContent.startsWith('<command-message>') ||
      trimmedContent.startsWith('<command-args>')
    );
  }

  private async listGeminiSessionsInProject(projectDir: string): Promise<ExternalSessionSummary[]> {
    const sessionSources = await this.listGeminiSessionSourcesInProject(projectDir);
    return sessionSources.map((session) => ({
      provider: 'gemini',
      sessionId: session.sessionId,
      title: session.title,
      workspace: session.workspace,
      updatedAt: session.updatedAt,
      origin: 'cli',
      model: session.model,
    }));
  }

  private async readGeminiProjectRoot(projectDir: string): Promise<string | null> {
    try {
      const projectRoot = (await fs.readFile(path.join(projectDir, '.project_root'), 'utf8')).trim();
      return projectRoot || null;
    } catch {
      return null;
    }
  }

  private async getGeminiSessionSource(sessionId: string): Promise<GeminiSessionSource | null> {
    const geminiTmpDir = path.join(this.options.geminiHomeDir || path.join(os.homedir(), '.gemini'), 'tmp');

    try {
      const entries = await fs.readdir(geminiTmpDir, { withFileTypes: true });
      const sessionGroups = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => this.listGeminiSessionSourcesInProject(path.join(geminiTmpDir, entry.name)))
      );

      return sessionGroups.flat().find((session) => session.sessionId === sessionId) || null;
    } catch {
      return null;
    }
  }

  private async listGeminiSessionSourcesInProject(projectDir: string): Promise<GeminiSessionSource[]> {
    const workspace = await this.readGeminiProjectRoot(projectDir);
    if (!workspace) {
      return [];
    }

    const chatsDir = path.join(projectDir, 'chats');
    try {
      const chatEntries = await fs.readdir(chatsDir, { withFileTypes: true });
      const sessions = await Promise.all(
        chatEntries
          .filter((entry) => entry.isFile() && entry.name.startsWith('session-') && entry.name.endsWith('.json'))
          .map(async (entry) => this.readGeminiSessionSource(workspace, path.join(chatsDir, entry.name)))
      );

      return sessions.filter((session): session is GeminiSessionSource => session !== null);
    } catch {
      return [];
    }
  }

  private async readGeminiSessionSource(workspace: string, chatPath: string): Promise<GeminiSessionSource | null> {
    try {
      const rawContent = await fs.readFile(chatPath, 'utf8');
      const chat = JSON.parse(rawContent) as GeminiChatFile;
      if (typeof chat.sessionId !== 'string' || !chat.sessionId.trim()) {
        return null;
      }

      return {
        chatPath,
        sessionId: chat.sessionId,
        workspace,
        title: this.resolveGeminiSessionTitle(chat.messages, workspace, chat.sessionId),
        updatedAt: this.parseRolloutTimestamp(chat.lastUpdated || chat.startTime),
        model: this.resolveGeminiSessionModel(chat.messages),
      };
    } catch {
      return null;
    }
  }

  private async readGeminiChatMessages(chatPath: string): Promise<ImportedConversationMessage[]> {
    const rawContent = await fs.readFile(chatPath, 'utf8');
    const chat = JSON.parse(rawContent) as GeminiChatFile;
    const messages = Array.isArray(chat.messages) ? chat.messages : [];

    return messages
      .map((message) => this.parseGeminiChatMessage(message))
      .filter((message): message is ImportedConversationMessage => message !== null)
      .toSorted((left, right) => left.createdAt - right.createdAt);
  }

  private parseGeminiChatMessage(message: GeminiChatMessage): ImportedConversationMessage | null {
    if (message.type !== 'user' && message.type !== 'gemini') {
      return null;
    }

    const content = this.extractGeminiMessageText(message.content);
    if (!content) {
      return null;
    }

    return {
      content,
      createdAt: this.parseRolloutTimestamp(message.timestamp),
      position: message.type === 'user' ? 'right' : 'left',
    };
  }

  private extractGeminiMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }

          if (
            typeof item === 'object' &&
            item !== null &&
            'text' in item &&
            typeof (item as { text?: unknown }).text === 'string'
          ) {
            return (item as { text: string }).text.trim();
          }

          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    return '';
  }

  private resolveGeminiSessionTitle(
    messages: GeminiChatMessage[] | undefined,
    workspace: string,
    sessionId: string
  ): string {
    const titleSource =
      messages
        ?.map((message) => {
          if (message.type !== 'user') {
            return '';
          }

          return this.extractGeminiMessageText(message.content);
        })
        .find(Boolean) || '';

    const normalizedTitle = titleSource.replace(/\s+/g, ' ').trim();
    if (normalizedTitle) {
      return normalizedTitle.slice(0, 80);
    }

    return path.basename(workspace) || sessionId;
  }

  private resolveGeminiSessionModel(messages: GeminiChatMessage[] | undefined): string | undefined {
    return messages
      ?.toReversed()
      .find((message) => typeof message.model === 'string' && message.model.trim())
      ?.model?.trim();
  }

  private parseOpencodeMessageData(rawData: string | null | undefined): OpencodeMessageData | null {
    if (!rawData) {
      return null;
    }

    try {
      return JSON.parse(rawData) as OpencodeMessageData;
    } catch {
      return null;
    }
  }

  private parseOpencodePartData(rawData: string): OpencodePartData | null {
    try {
      return JSON.parse(rawData) as OpencodePartData;
    } catch {
      return null;
    }
  }

  private async insertImportedMessages(
    conversationId: string,
    importedMessages: ImportedConversationMessage[],
    providerName: string
  ): Promise<void> {
    if (importedMessages.length === 0) {
      return;
    }

    const db = await getDatabase();
    for (const importedMessage of importedMessages) {
      const message: TMessage = {
        id: uuid(36),
        msg_id: uuid(36),
        conversation_id: conversationId,
        type: 'text',
        position: importedMessage.position,
        status: 'finish',
        createdAt: importedMessage.createdAt,
        content: {
          content: importedMessage.content,
        },
      };

      const result = db.insertMessage(message);
      if (!result.success) {
        throw new Error(result.error || `Failed to insert imported ${providerName} history message`);
      }
    }
  }

  private collectManagedSessions(conversations: TChatConversation[]): Set<string> {
    const managed = new Set<string>();

    for (const conversation of conversations) {
      if (conversation.type === 'acp' && conversation.extra?.backend === 'claude' && conversation.extra.acpSessionId) {
        managed.add(this.buildManagedKey('claude', conversation.extra.acpSessionId));
      }

      if (
        conversation.type === 'acp' &&
        (conversation.extra?.backend === 'codex' || conversation.extra?.backend === 'gemini') &&
        conversation.extra.acpSessionId
      ) {
        managed.add(this.buildManagedKey(conversation.extra.backend, conversation.extra.acpSessionId));
      }

      if (
        conversation.type === 'acp' &&
        conversation.extra?.backend === 'opencode' &&
        conversation.extra.acpSessionId
      ) {
        managed.add(this.buildManagedKey('opencode', conversation.extra.acpSessionId));
      }

      if (
        conversation.type === 'openclaw-gateway' &&
        typeof conversation.extra?.sessionKey === 'string' &&
        conversation.extra.sessionKey
      ) {
        managed.add(this.buildManagedKey('openclaw-gateway', conversation.extra.sessionKey));
      }
    }

    return managed;
  }

  private findImportedConversation(
    conversations: TChatConversation[],
    provider: ExternalSessionProvider,
    sessionId: string
  ): TChatConversation | undefined {
    return conversations.find((conversation) => {
      if (provider === 'claude') {
        return (
          conversation.type === 'acp' &&
          conversation.extra?.backend === 'claude' &&
          conversation.extra.acpSessionId === sessionId
        );
      }

      if (provider === 'codex') {
        return (
          conversation.type === 'acp' &&
          conversation.extra?.backend === 'codex' &&
          conversation.extra.acpSessionId === sessionId
        );
      }

      if (provider === 'gemini') {
        return (
          conversation.type === 'acp' &&
          conversation.extra?.backend === 'gemini' &&
          conversation.extra.acpSessionId === sessionId
        );
      }

      if (provider === 'opencode') {
        return (
          conversation.type === 'acp' &&
          conversation.extra?.backend === 'opencode' &&
          conversation.extra.acpSessionId === sessionId
        );
      }

      if (provider === 'openclaw-gateway') {
        return conversation.type === 'openclaw-gateway' && conversation.extra?.sessionKey === sessionId;
      }

      return false;
    });
  }

  private buildManagedKey(provider: ExternalSessionProvider, sessionId: string): string {
    return `${provider}:${sessionId}`;
  }

  private isBackendAvailable(backend: AcpBackendAll): boolean {
    return this.options.availableBackends?.has(backend) ?? true;
  }

  private normalizeTimestamp(timestamp: number): number {
    return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
  }

  private parseRolloutTimestamp(timestamp?: string): number {
    if (!timestamp) {
      return Date.now();
    }

    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
}
