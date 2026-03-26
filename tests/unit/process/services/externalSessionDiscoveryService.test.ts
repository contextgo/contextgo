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

  const seedClaudeSessionFile = async (sessionId = 'claude-session-1') => {
    const projectDir = path.join(tempDir, 'projects', '-Users-test-project-alpha');
    const sessionPath = path.join(projectDir, `${sessionId}.jsonl`);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      sessionPath,
      [
        '{"type":"queue-operation","operation":"enqueue","timestamp":"2026-03-26T10:00:01.000Z","sessionId":"claude-session-1"}',
        '{"type":"user","isMeta":true,"cwd":"/tmp/claude-project","sessionId":"claude-session-1","message":{"role":"user","content":"<local-command-caveat>ignore</local-command-caveat>"},"timestamp":"2026-03-26T10:00:00.000Z"}',
        '{"type":"user","cwd":"/tmp/claude-project","sessionId":"claude-session-1","message":{"role":"user","content":"<command-name>/model</command-name>"},"timestamp":"2026-03-26T10:00:01.000Z"}',
        '{"type":"user","cwd":"/tmp/claude-project","sessionId":"claude-session-1","message":{"role":"user","content":[{"type":"text","text":"First Claude question"}]},"timestamp":"2026-03-26T10:00:02.000Z"}',
        '{"type":"assistant","cwd":"/tmp/claude-project","sessionId":"claude-session-1","message":{"model":"claude-sonnet-4-6","type":"message","role":"assistant","content":[{"type":"thinking","thinking":"ignore me"}]},"timestamp":"2026-03-26T10:00:03.000Z"}',
        '{"type":"assistant","cwd":"/tmp/claude-project","sessionId":"claude-session-1","message":{"model":"claude-sonnet-4-6","type":"message","role":"assistant","content":[{"type":"text","text":"First Claude reply"}]},"timestamp":"2026-03-26T10:00:04.000Z"}',
        '{"type":"last-prompt","lastPrompt":"Claude latest prompt","sessionId":"claude-session-1","timestamp":"2026-03-26T10:00:05.000Z"}',
      ].join('\n')
    );

    return sessionPath;
  };

  const seedGeminiSession = async (options?: {
    projectDirName?: string;
    workspace?: string;
    sessionId?: string;
    fileName?: string;
    startTime?: string;
    lastUpdated?: string;
    messages?: Array<{
      timestamp?: string;
      type?: string;
      content?: unknown;
      model?: string;
    }>;
  }) => {
    const projectDirName = options?.projectDirName || 'project-alpha';
    const workspace = options?.workspace || '/tmp/project-gemini-alpha';
    const sessionId = options?.sessionId || 'gemini-session-1';
    const fileName = options?.fileName || 'session-2026-03-26T10-00-gemini-session-1.json';
    const startTime = options?.startTime || '2026-03-26T10:00:00.000Z';
    const lastUpdated = options?.lastUpdated || '2026-03-26T10:05:00.000Z';
    const messages = options?.messages || [
      {
        timestamp: '2026-03-26T10:00:01.000Z',
        type: 'user',
        content: [{ text: 'Investigate flaky tests' }],
      },
      {
        timestamp: '2026-03-26T10:00:05.000Z',
        type: 'gemini',
        content: 'I will inspect the test suite.',
        model: 'gemini-2.5-pro',
      },
    ];

    const projectDir = path.join(tempDir, 'tmp', projectDirName);
    const chatsDir = path.join(projectDir, 'chats');
    await fs.mkdir(chatsDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, '.project_root'), workspace);
    await fs.writeFile(
      path.join(chatsDir, fileName),
      JSON.stringify({
        sessionId,
        startTime,
        lastUpdated,
        messages,
      })
    );

    return {
      chatPath: path.join(chatsDir, fileName),
      sessionId,
      workspace,
    };
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

  it('lists unmanaged Claude sessions from the local Claude projects directory', async () => {
    await seedClaudeSessionFile();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      claudeHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['claude']),
    });

    const sessions = await service.listSessions();

    expect(sessions).toEqual([
      {
        provider: 'claude',
        sessionId: 'claude-session-1',
        title: 'Claude latest prompt',
        workspace: '/tmp/claude-project',
        updatedAt: Date.parse('2026-03-26T10:00:05.000Z'),
        origin: 'cli',
        modelProvider: 'anthropic',
        model: 'claude-sonnet-4-6',
      },
    ]);
  });

  it('lists unmanaged Gemini sessions from local Gemini CLI chat files', async () => {
    await seedGeminiSession();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      geminiHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['gemini']),
    });

    const sessions = await service.listSessions();

    expect(sessions).toEqual([
      {
        provider: 'gemini',
        sessionId: 'gemini-session-1',
        title: 'Investigate flaky tests',
        workspace: '/tmp/project-gemini-alpha',
        updatedAt: Date.parse('2026-03-26T10:05:00.000Z'),
        origin: 'cli',
        model: 'gemini-2.5-pro',
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

  it('filters out Claude sessions that have already been taken over by AionUi', async () => {
    await seedClaudeSessionFile();
    const service = new ExternalSessionDiscoveryService(
      createConversationService([
        {
          id: 'conversation-1',
          type: 'acp',
          name: 'Imported Claude session',
          source: 'aionui',
          extra: {
            backend: 'claude',
            workspace: '/tmp/claude-project',
            customWorkspace: true,
            acpSessionId: 'claude-session-1',
          },
          createTime: Date.now(),
          modifyTime: Date.now(),
        } as TChatConversation,
      ]),
      {
        claudeHomeDir: tempDir,
        availableBackends: new Set<AcpBackendAll>(['claude']),
      }
    );

    const sessions = await service.listSessions();

    expect(sessions).toEqual([]);
  });

  it('filters out Gemini sessions that have already been taken over by AionUi', async () => {
    await seedGeminiSession();
    const service = new ExternalSessionDiscoveryService(
      createConversationService([
        {
          id: 'conversation-gemini-1',
          type: 'acp',
          name: 'Imported Gemini session',
          source: 'aionui',
          extra: {
            backend: 'gemini',
            workspace: '/tmp/project-gemini-alpha',
            customWorkspace: true,
            acpSessionId: 'gemini-session-1',
          },
          createTime: Date.now(),
          modifyTime: Date.now(),
        } as TChatConversation,
      ]),
      {
        geminiHomeDir: tempDir,
        availableBackends: new Set<AcpBackendAll>(['gemini']),
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

  it('marks imported Claude sessions to defer the initial workspace hydration', async () => {
    await seedClaudeSessionFile();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      claudeHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['claude']),
    });

    const conversation = await service.importSession({
      provider: 'claude',
      sessionId: 'claude-session-1',
    });

    expect(conversation.extra).toMatchObject({
      backend: 'claude',
      workspace: '/tmp/claude-project',
      acpSessionId: 'claude-session-1',
      currentModelId: 'claude-sonnet-4-6',
      externalSessionImported: true,
      deferInitialWorkspaceLoad: true,
    });
  });

  it('creates ACP Gemini conversations when taking over an external Gemini session', async () => {
    await seedGeminiSession();
    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      geminiHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['gemini']),
    });

    const conversation = await service.importSession({
      provider: 'gemini',
      sessionId: 'gemini-session-1',
    });

    expect(conversation).toMatchObject({
      type: 'acp',
      name: 'Investigate flaky tests',
      source: 'aionui',
      extra: {
        backend: 'gemini',
        workspace: '/tmp/project-gemini-alpha',
        cliPath: 'gemini',
        agentName: 'Gemini CLI',
        acpSessionId: 'gemini-session-1',
        currentModelId: 'gemini-2.5-pro',
        externalSessionImported: true,
        deferInitialWorkspaceLoad: true,
      },
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

  it('imports visible Claude history when taking over an unmanaged session', async () => {
    await seedClaudeSessionFile();

    const insertMessage = vi.fn(() => ({
      success: true,
    }));
    vi.spyOn(databaseModule, 'getDatabase').mockResolvedValue({
      insertMessage,
    } as unknown as Awaited<ReturnType<typeof databaseModule.getDatabase>>);

    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      claudeHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['claude']),
    });

    await service.importSession({
      provider: 'claude',
      sessionId: 'claude-session-1',
    });

    expect(insertMessage).toHaveBeenCalledTimes(2);
    expect(insertMessage.mock.calls.map(([message]) => message)).toMatchObject([
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'right',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:02.000Z'),
        content: {
          content: 'First Claude question',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'left',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:04.000Z'),
        content: {
          content: 'First Claude reply',
        },
      },
    ]);
  });

  it('imports visible Gemini chat history when taking over an unmanaged session', async () => {
    await seedGeminiSession({
      messages: [
        {
          timestamp: '2026-03-26T10:00:00.000Z',
          type: 'user',
          content: [{ text: 'Hello Gemini' }],
        },
        {
          timestamp: '2026-03-26T10:00:02.000Z',
          type: 'gemini',
          content: 'Hello from Gemini.',
          model: 'gemini-2.5-pro',
        },
        {
          timestamp: '2026-03-26T10:00:03.000Z',
          type: 'error',
          content: 'ignore me',
        },
        {
          timestamp: '2026-03-26T10:00:04.000Z',
          type: 'user',
          content: [{ text: 'Summarize the plan' }],
        },
      ],
    });

    const insertMessage = vi.fn(() => ({
      success: true,
    }));
    vi.spyOn(databaseModule, 'getDatabase').mockResolvedValue({
      insertMessage,
    } as unknown as Awaited<ReturnType<typeof databaseModule.getDatabase>>);

    const service = new ExternalSessionDiscoveryService(createConversationService([]), {
      geminiHomeDir: tempDir,
      availableBackends: new Set<AcpBackendAll>(['gemini']),
    });

    await service.importSession({
      provider: 'gemini',
      sessionId: 'gemini-session-1',
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
          content: 'Hello Gemini',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'left',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:02.000Z'),
        content: {
          content: 'Hello from Gemini.',
        },
      },
      {
        conversation_id: 'imported-conversation',
        type: 'text',
        position: 'right',
        status: 'finish',
        createdAt: Date.parse('2026-03-26T10:00:04.000Z'),
        content: {
          content: 'Summarize the plan',
        },
      },
    ]);
  });
});
