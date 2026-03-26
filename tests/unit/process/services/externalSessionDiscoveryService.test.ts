import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';
import { ExternalSessionDiscoveryService } from '../../../../src/process/bridge/services/ExternalSessionDiscoveryService';
import type { AcpBackendAll } from '../../../../src/common/types/acpTypes';
import type { IConversationService } from '../../../../src/process/services/IConversationService';
import type { TChatConversation } from '../../../../src/common/config/storage';
import * as databaseModule from '../../../../src/process/services/database';

const createConversationService = (conversations: TChatConversation[]): IConversationService => ({
  createConversation: async (params) =>
    ({
      id: 'imported-conversation',
      type: params.type,
      name: params.name || 'Imported',
      source: params.source,
      extra: params.extra,
      createTime: Date.now(),
      modifyTime: Date.now(),
    }) as TChatConversation,
  deleteConversation: async () => {},
  updateConversation: async () => {},
  getConversation: async () => undefined,
  createWithMigration: async () => {
    throw new Error('not implemented');
  },
  listAllConversations: async () => conversations,
});

describe('ExternalSessionDiscoveryService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aionui-external-sessions-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const seedCodexStateDb = async (rolloutPath = '') => {
    const dbPath = path.join(tempDir, 'state_5.sqlite');
    const database = new DatabaseSync(dbPath);

    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        rollout_path TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT NOT NULL,
        sandbox_policy TEXT NOT NULL DEFAULT 'workspace-write',
        approval_mode TEXT NOT NULL DEFAULT 'default',
        tokens_used INTEGER NOT NULL DEFAULT 0,
        has_user_event INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        git_sha TEXT,
        git_branch TEXT,
        git_origin_url TEXT,
        cli_version TEXT NOT NULL DEFAULT '',
        first_user_message TEXT NOT NULL DEFAULT '',
        agent_nickname TEXT,
        agent_role TEXT,
        memory_mode TEXT NOT NULL DEFAULT 'enabled',
        model TEXT,
        reasoning_effort TEXT
      );
    `);

    database
      .prepare(`
        INSERT INTO threads (id, rollout_path, updated_at, source, model_provider, cwd, title, archived, model, reasoning_effort)
        VALUES (:id, :rollout_path, :updated_at, :source, :model_provider, :cwd, :title, :archived, :model, :reasoning_effort)
      `)
      .run({
        id: 'session-1',
        rollout_path: rolloutPath,
        updated_at: 1_774_444_492,
        source: 'cli',
        model_provider: 'infermesh',
        cwd: '/tmp/project-alpha',
        title: 'Alpha session',
        archived: 0,
        model: 'gpt-5.4',
        reasoning_effort: 'high',
      });

    database
      .prepare(`
        INSERT INTO threads (id, rollout_path, updated_at, source, model_provider, cwd, title, archived, model, reasoning_effort)
        VALUES (:id, :rollout_path, :updated_at, :source, :model_provider, :cwd, :title, :archived, :model, :reasoning_effort)
      `)
      .run({
        id: 'archived-session',
        rollout_path: '',
        updated_at: 1_774_444_400,
        source: 'cli',
        model_provider: 'infermesh',
        cwd: '/tmp/project-archived',
        title: 'Archived session',
        archived: 1,
        model: 'gpt-5.4',
        reasoning_effort: 'medium',
      });

    database.close();
    return dbPath;
  };

  const seedOpencodeStateDb = async () => {
    const dbPath = path.join(tempDir, 'opencode.db');
    const database = new DatabaseSync(dbPath);

    database.exec(`
      CREATE TABLE project (
        id TEXT PRIMARY KEY,
        worktree TEXT NOT NULL,
        vcs TEXT,
        name TEXT,
        icon_url TEXT,
        icon_color TEXT,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        time_initialized INTEGER,
        sandboxes TEXT NOT NULL,
        commands TEXT
      );

      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        slug TEXT NOT NULL,
        directory TEXT NOT NULL,
        title TEXT NOT NULL,
        version TEXT NOT NULL,
        share_url TEXT,
        summary_additions INTEGER,
        summary_deletions INTEGER,
        summary_files INTEGER,
        summary_diffs TEXT,
        revert TEXT,
        permission TEXT,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        time_compacting INTEGER,
        time_archived INTEGER,
        workspace_id TEXT,
        CONSTRAINT fk_session_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES project (id) ON DELETE CASCADE
      );

      CREATE TABLE message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        data TEXT NOT NULL,
        CONSTRAINT fk_message_session_id_session_id_fk FOREIGN KEY (session_id) REFERENCES session (id) ON DELETE CASCADE
      );

      CREATE TABLE part (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        data TEXT NOT NULL,
        CONSTRAINT fk_part_message_id_message_id_fk FOREIGN KEY (message_id) REFERENCES message (id) ON DELETE CASCADE
      );
    `);

    database
      .prepare(`
        INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
        VALUES (:id, :worktree, :name, :time_created, :time_updated, :sandboxes)
      `)
      .run({
        id: 'project-1',
        worktree: '/tmp/project-opencode',
        name: 'OpenCode Project',
        time_created: 1_775_000_000_000,
        time_updated: 1_775_000_300_000,
        sandboxes: '[]',
      });

    database
      .prepare(`
        INSERT INTO session (
          id, project_id, slug, directory, title, version, permission, time_created, time_updated, workspace_id
        )
        VALUES (
          :id, :project_id, :slug, :directory, :title, :version, :permission, :time_created, :time_updated, :workspace_id
        )
      `)
      .run({
        id: 'opencode-session-1',
        project_id: 'project-1',
        slug: 'open-code-session',
        directory: '/tmp/project-opencode',
        title: 'OpenCode Session',
        version: '1',
        permission: 'default',
        time_created: 1_775_000_000_000,
        time_updated: 1_775_000_300_000,
        workspace_id: 'workspace-1',
      });

    database
      .prepare(`
        INSERT INTO session (
          id, project_id, slug, directory, title, version, permission, time_created, time_updated, time_archived, workspace_id
        )
        VALUES (
          :id, :project_id, :slug, :directory, :title, :version, :permission, :time_created, :time_updated, :time_archived,
          :workspace_id
        )
      `)
      .run({
        id: 'opencode-archived',
        project_id: 'project-1',
        slug: 'archived-session',
        directory: '/tmp/project-opencode-archived',
        title: 'Archived OpenCode Session',
        version: '1',
        permission: 'default',
        time_created: 1_775_000_000_000,
        time_updated: 1_775_000_100_000,
        time_archived: 1_775_000_200_000,
        workspace_id: 'workspace-archived',
      });

    database
      .prepare(`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (:id, :session_id, :time_created, :time_updated, :data)
      `)
      .run({
        id: 'opencode-user-message',
        session_id: 'opencode-session-1',
        time_created: 1_775_000_100_000,
        time_updated: 1_775_000_100_000,
        data: JSON.stringify({
          role: 'user',
          time: {
            created: 1_775_000_100_000,
          },
          model: {
            providerID: 'openai',
            modelID: 'gpt-5.3-codex',
          },
          variant: 'medium',
        }),
      });

    database
      .prepare(`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (:id, :session_id, :time_created, :time_updated, :data)
      `)
      .run({
        id: 'opencode-assistant-message',
        session_id: 'opencode-session-1',
        time_created: 1_775_000_200_000,
        time_updated: 1_775_000_300_000,
        data: JSON.stringify({
          role: 'assistant',
          time: {
            created: 1_775_000_200_000,
            completed: 1_775_000_300_000,
          },
          providerID: 'openai',
          modelID: 'gpt-5.3-codex',
          variant: 'medium',
        }),
      });

    database
      .prepare(`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (:id, :message_id, :session_id, :time_created, :time_updated, :data)
      `)
      .run({
        id: 'opencode-user-text',
        message_id: 'opencode-user-message',
        session_id: 'opencode-session-1',
        time_created: 1_775_000_100_001,
        time_updated: 1_775_000_100_001,
        data: JSON.stringify({
          type: 'text',
          text: 'Investigate the import flow',
        }),
      });

    database
      .prepare(`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (:id, :message_id, :session_id, :time_created, :time_updated, :data)
      `)
      .run({
        id: 'opencode-assistant-step',
        message_id: 'opencode-assistant-message',
        session_id: 'opencode-session-1',
        time_created: 1_775_000_200_001,
        time_updated: 1_775_000_200_001,
        data: JSON.stringify({
          type: 'step-start',
        }),
      });

    database
      .prepare(`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (:id, :message_id, :session_id, :time_created, :time_updated, :data)
      `)
      .run({
        id: 'opencode-assistant-text',
        message_id: 'opencode-assistant-message',
        session_id: 'opencode-session-1',
        time_created: 1_775_000_200_002,
        time_updated: 1_775_000_200_002,
        data: JSON.stringify({
          type: 'text',
          text: 'OpenCode says hello',
        }),
      });

    database.close();
    return dbPath;
  };

  it('lists unmanaged Codex sessions from the latest local state database', async () => {
    await seedCodexStateDb();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      codexHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['codex']),
    });

    const sessions = await service.listSessions();

    expect(sessions).toEqual([
      {
        provider: 'codex',
        sessionId: 'session-1',
        title: 'Alpha session',
        workspace: '/tmp/project-alpha',
        updatedAt: 1_774_444_492_000,
        origin: 'cli',
        modelProvider: 'infermesh',
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
    ]);
  });

  it('filters out sessions that have already been taken over by AionUi', async () => {
    await seedCodexStateDb();
    const service = new ExternalSessionDiscoveryService(
      createConversationService([
        {
          id: 'conversation-1',
          type: 'acp',
          name: 'Imported session',
          source: 'aionui',
          extra: {
            backend: 'codex',
            workspace: '/tmp/project-alpha',
            customWorkspace: true,
            acpSessionId: 'session-1',
          },
          createTime: Date.now(),
          modifyTime: Date.now(),
        } as TChatConversation,
      ]),
      {
        codexHomeDir: tempDir,
        availableBackends: new Set<AcpBackendAll>(['codex']),
      }
    );

    const sessions = await service.listSessions();

    expect(sessions).toEqual([]);
  });

  it('reuses the existing conversation when the selected session is already managed', async () => {
    await seedCodexStateDb();
    const existingConversation = {
      id: 'conversation-1',
      type: 'acp',
      name: 'Imported session',
      source: 'aionui',
      extra: {
        backend: 'codex',
        workspace: '/tmp/project-alpha',
        customWorkspace: true,
        acpSessionId: 'session-1',
      },
      createTime: Date.now(),
      modifyTime: Date.now(),
    } as TChatConversation;

    const service = new ExternalSessionDiscoveryService(createConversationService([existingConversation]), {
      codexHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['codex']),
    });

    const conversation = await service.importSession({
      provider: 'codex',
      sessionId: 'session-1',
    });

    expect(conversation).toBe(existingConversation);
  });

  it('marks imported external sessions to defer the initial workspace hydration', async () => {
    await seedCodexStateDb();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      codexHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['codex']),
    });

    const conversation = await service.importSession({
      provider: 'codex',
      sessionId: 'session-1',
    });

    expect(conversation.extra).toMatchObject({
      backend: 'codex',
      workspace: '/tmp/project-alpha',
      acpSessionId: 'session-1',
      externalSessionImported: true,
      deferInitialWorkspaceLoad: true,
    });
  });

  it('imports visible Codex rollout history when taking over an unmanaged session', async () => {
    const rolloutPath = path.join(tempDir, 'rollout.jsonl');
    await fs.writeFile(
      rolloutPath,
      [
        '{"timestamp":"2026-03-26T10:00:04.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Second assistant reply"},{"type":"input_text","text":"ignore me"}]}}',
        '{"timestamp":"2026-03-26T10:00:01.000Z","type":"event_msg","payload":{"type":"task_started"}}',
        'not-json',
        '{"timestamp":"2026-03-26T10:00:00.000Z","type":"event_msg","payload":{"type":"user_message","message":"First question"}}',
        '{"timestamp":"2026-03-26T10:00:03.000Z","type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"output_text","text":"ignore developer"}]}}',
        '{"timestamp":"2026-03-26T10:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"First assistant reply"}]}}',
      ].join('\n')
    );

    await seedCodexStateDb(rolloutPath);

    const insertMessage = vi.fn(() => ({
      success: true,
    }));
    vi.spyOn(databaseModule, 'getDatabase').mockResolvedValue({
      insertMessage,
    } as unknown as Awaited<ReturnType<typeof databaseModule.getDatabase>>);

    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      codexHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['codex']),
    });

    await service.importSession({
      provider: 'codex',
      sessionId: 'session-1',
    });

    expect(insertMessage).toHaveBeenCalledTimes(3);
    expect(insertMessage.mock.calls.map(([message]) => message)).toMatchObject([
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'right',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:00.000Z'),
        content: {
          content: 'First question',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'left',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:02.000Z'),
        content: {
          content: 'First assistant reply',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'left',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:04.000Z'),
        content: {
          content: 'Second assistant reply',
        },
      },
    ]);
  });

  it('lists unmanaged OpenCode sessions from the local session database', async () => {
    const opencodeDbPath = await seedOpencodeStateDb();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      opencodeDbPath,
      availableBackends: new Set<AcpBackendAll>(['opencode']),
    });

    const sessions = await service.listSessions();

    expect(sessions).toEqual([
      {
        provider: 'opencode',
        sessionId: 'opencode-session-1',
        title: 'OpenCode Session',
        workspace: '/tmp/project-opencode',
        updatedAt: 1_775_000_300_000,
        modelProvider: 'openai',
        model: 'gpt-5.3-codex',
        reasoningEffort: 'medium',
      },
    ]);
  });

  it('filters out OpenCode sessions that have already been taken over by ContextGo', async () => {
    const opencodeDbPath = await seedOpencodeStateDb();
    const service = new ExternalSessionDiscoveryService(
      createConversationService([
        {
          id: 'conversation-opencode',
          type: 'acp',
          name: 'Imported OpenCode session',
          source: 'aionui',
          extra: {
            backend: 'opencode',
            workspace: '/tmp/project-opencode',
            customWorkspace: true,
            acpSessionId: 'opencode-session-1',
          },
          createTime: Date.now(),
          modifyTime: Date.now(),
        } as TChatConversation,
      ]),
      {
        opencodeDbPath,
        availableBackends: new Set<AcpBackendAll>(['opencode']),
      }
    );

    const sessions = await service.listSessions();

    expect(sessions).toEqual([]);
  });

  it('imports visible OpenCode history when taking over an unmanaged session', async () => {
    const opencodeDbPath = await seedOpencodeStateDb();
    const insertMessage = vi.fn(() => ({
      success: true,
    }));
    vi.spyOn(databaseModule, 'getDatabase').mockResolvedValue({
      insertMessage,
    } as unknown as Awaited<ReturnType<typeof databaseModule.getDatabase>>);

    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      opencodeDbPath,
      availableBackends: new Set<AcpBackendAll>(['opencode']),
    });

    const conversation = await service.importSession({
      provider: 'opencode',
      sessionId: 'opencode-session-1',
    });

    expect(conversation.extra).toMatchObject({
      backend: 'opencode',
      workspace: '/tmp/project-opencode',
      acpSessionId: 'opencode-session-1',
      currentModelId: 'gpt-5.3-codex',
      externalSessionImported: true,
      deferInitialWorkspaceLoad: true,
    });
    expect(insertMessage).toHaveBeenCalledTimes(2);
    expect(insertMessage.mock.calls.map(([message]) => message)).toMatchObject([
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'right',
        status: 'finish',
        createdAt: 1_775_000_100_000,
        content: {
          content: 'Investigate the import flow',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'left',
        status: 'finish',
        createdAt: 1_775_000_200_000,
        content: {
          content: 'OpenCode says hello',
        },
      },
    ]);
  });
});
