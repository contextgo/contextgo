/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IConversationRepository } from '../../src/process/services/database/IConversationRepository';
import type { ISpaceService } from '../../src/process/services/space/ISpaceService';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp'), isPackaged: false } }));
vi.mock('../../src/process/utils/initStorage', () => ({ ProcessChat: { get: vi.fn(async () => []) } }));
vi.mock('../../src/process/services/context/scheduleServiceSingleton', () => ({
  scheduleService: {
    listConversationSchedules: vi.fn(async () => []),
    removeSchedule: vi.fn(async () => {}),
    updateSchedule: vi.fn(async () => {}),
  },
}));

vi.mock('../../src/process/bridge/services/workspaceAutomation', () => ({
  copyWorkspaceAutomationCommands: vi.fn(async () => {}),
  copyWorkspaceAutomationHooks: vi.fn(async () => {}),
  ensureHarnessWorkspaceAutomationForConversation: vi.fn(async () => {}),
}));
vi.mock('@process/utils/initAgent', () => ({
  createGeminiAgent: vi.fn(async () => ({ id: 'gen-id', type: 'gemini', name: 'test', extra: {} })),
  createAcpAgent: vi.fn(async () => ({ id: 'acp-id', type: 'acp', name: 'test', extra: {} })),
  createCodexAgent: vi.fn(async () => ({ id: 'codex-id', type: 'codex', name: 'test', extra: {} })),
  createOpenClawAgent: vi.fn(async () => ({ id: 'claw-id', type: 'openclaw-gateway', name: 'test', extra: {} })),
  createNanobotAgent: vi.fn(async () => ({ id: 'nano-id', type: 'nanobot', name: 'test', extra: {} })),
  ensureConversationWorkspaceBootstrap: vi.fn(async () => {}),
  createGroupConversation: vi.fn(async (params) => ({
    id: 'group-id',
    type: 'group',
    name: params.name ?? 'group',
    extra: {
      participants: params.participants,
      spaceId: params.spaceId,
    },
  })),
}));

function makeRepo(overrides: Partial<IConversationRepository> = {}): IConversationRepository {
  return {
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    getMessages: vi.fn(() => ({ data: [], total: 0, hasMore: false })),
    insertMessage: vi.fn(),
    getUserConversations: vi.fn(() => ({ data: [], total: 0, hasMore: false })),
    listAllConversations: vi.fn(() => []),
    searchMessages: vi.fn(() => ({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false })),
    ...overrides,
  };
}

function makeSpaceService(overrides: Partial<ISpaceService> = {}): ISpaceService {
  return {
    getSpace: vi.fn(),
    listSpaces: vi.fn(async () => []),
    createSpace: vi.fn(async () => ({
      id: 'space-created',
      name: 'Created Space',
      engine: 'vault',
      createTime: 1,
      modifyTime: 1,
    })),
    updateSpace: vi.fn(async () => undefined),
    getSpaceCommandLibrary: vi.fn(async () => []),
    saveSpaceCommandLibrary: vi.fn(async () => []),
    openSpaceVault: vi.fn(async () => ({
      opened: true,
      fallback: 'none',
      target: '/tmp/vault',
      obsidianInstalled: true,
    })),
    renameSpace: vi.fn(),
    archiveSpace: vi.fn(),
    ensureDefaultSpace: vi.fn(async () => ({
      id: 'space-default',
      name: 'My Space',
      engine: 'vault',
      isDefault: true,
      createTime: 1,
      modifyTime: 1,
    })),
    ...overrides,
  };
}

import { ConversationServiceImpl } from '../../src/process/services/ConversationServiceImpl';
import {
  copyWorkspaceAutomationCommands,
  copyWorkspaceAutomationHooks,
  ensureHarnessWorkspaceAutomationForConversation,
} from '../../src/process/bridge/services/workspaceAutomation';
import { ensureConversationWorkspaceBootstrap } from '../../src/process/utils/initAgent';

describe('ConversationServiceImpl.getConversation', () => {
  it('returns conversation from repo', async () => {
    const fakeConv = { id: 'c1', type: 'gemini' } as any;
    const repo = makeRepo({ getConversation: vi.fn(() => fakeConv) });
    const svc = new ConversationServiceImpl(repo);
    expect(await svc.getConversation('c1')).toEqual(fakeConv);
  });

  it('returns undefined when not found', async () => {
    const repo = makeRepo({ getConversation: vi.fn(() => undefined) });
    const svc = new ConversationServiceImpl(repo);
    expect(await svc.getConversation('missing')).toBeUndefined();
  });
});

describe('ConversationServiceImpl.deleteConversation', () => {
  it('calls repo.deleteConversation', async () => {
    const repo = makeRepo();
    const svc = new ConversationServiceImpl(repo);
    await svc.deleteConversation('c1');
    expect(repo.deleteConversation).toHaveBeenCalledWith('c1');
  });
});

describe('ConversationServiceImpl.updateConversation', () => {
  it('calls repo.updateConversation with updates', async () => {
    const repo = makeRepo();
    const svc = new ConversationServiceImpl(repo);
    await svc.updateConversation('c1', { name: 'new name' });
    expect(repo.updateConversation).toHaveBeenCalledWith('c1', { name: 'new name' });
  });

  it('merges extra when mergeExtra=true', async () => {
    const existing = { id: 'c1', extra: { workspace: '/ws', existing: true } } as any;
    const repo = makeRepo({ getConversation: vi.fn(() => existing) });
    const svc = new ConversationServiceImpl(repo);
    await svc.updateConversation('c1', { extra: { newField: 1 } } as any, true);
    expect(repo.updateConversation).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ extra: expect.objectContaining({ existing: true, newField: 1 }) })
    );
  });

  it('normalizes workingDirectory and legacy workspace during updates', async () => {
    const repo = makeRepo();
    const svc = new ConversationServiceImpl(repo);

    await svc.updateConversation('c1', {
      extra: {
        workingDirectory: '/wd/project',
        runtimeValidation: {
          expectedWorkingDirectory: '/wd/project',
        },
      },
    } as any);

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        extra: expect.objectContaining({
          workingDirectory: '/wd/project',
          workspace: '/wd/project',
          runtimeValidation: expect.objectContaining({
            expectedWorkingDirectory: '/wd/project',
            expectedWorkspace: '/wd/project',
          }),
        }),
      })
    );
  });

  it('re-bootstraps workspace automation when extra updates include a new workspace', async () => {
    const existing = {
      id: 'c1',
      type: 'acp',
      extra: {
        workspace: '/tmp/original',
        backend: 'codex',
      },
    } as any;
    const repo = makeRepo({ getConversation: vi.fn(() => existing) });
    const svc = new ConversationServiceImpl(repo);

    await svc.updateConversation(
      'c1',
      {
        extra: {
          workspace: '/tmp/project',
          customWorkspace: true,
          nativeWorkspaceBootstrap: true,
        },
      } as any,
      true
    );

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        extra: expect.objectContaining({
          workspace: '/tmp/project',
          workingDirectory: '/tmp/project',
          customWorkspace: true,
          nativeWorkspaceBootstrap: true,
          backend: 'codex',
        }),
      })
    );
    expect(ensureHarnessWorkspaceAutomationForConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        extra: expect.objectContaining({
          workspace: '/tmp/project',
          nativeWorkspaceBootstrap: true,
        }),
      })
    );
    expect(ensureConversationWorkspaceBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        extra: expect.objectContaining({
          workspace: '/tmp/project',
          nativeWorkspaceBootstrap: true,
        }),
      })
    );
  });
});

describe('ConversationServiceImpl.createWithMigration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates conversation in repo', async () => {
    const repo = makeRepo({
      getMessages: vi.fn(() => ({ data: [], total: 0, hasMore: false })),
    });
    const svc = new ConversationServiceImpl(repo);
    const conv = { id: 'new', name: 'test' } as any;
    await svc.createWithMigration({ conversation: conv });
    expect(repo.createConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('copies workspace automation and updates cron workspace metadata during migration', async () => {
    const repo = makeRepo({
      getConversation: vi.fn(
        () =>
          ({
            id: 'src',
            extra: { workspace: '/source-ws' },
          }) as any
      ),
      getMessages: vi.fn(() => ({ data: [], total: 0, hasMore: false })),
    });
    const svc = new ConversationServiceImpl(repo);

    const { scheduleService } = await import('../../src/process/services/context/scheduleServiceSingleton');
    vi.mocked(scheduleService.listConversationSchedules).mockResolvedValue([
      {
        id: 'job-1',
        scope: {
          conversationId: 'src',
          threadId: 'src',
          label: 'Source',
        },
        target: {
          kind: 'send_query',
          conversationId: 'src',
          conversationTitle: 'Source',
          workspacePath: '/source-ws',
        },
      } as any,
    ]);

    await svc.createWithMigration({
      conversation: {
        id: 'new',
        name: 'Migrated',
        extra: { workspace: '/target-ws' },
      } as any,
      sourceConversationId: 'src',
      migrateSchedule: true,
    });

    expect(copyWorkspaceAutomationCommands).toHaveBeenCalledWith('/source-ws', '/target-ws');
    expect(copyWorkspaceAutomationHooks).toHaveBeenCalledWith('/source-ws', '/target-ws');
    expect(scheduleService.updateSchedule).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        scope: expect.objectContaining({
          conversationId: 'new',
          label: 'Migrated',
        }),
        target: expect.objectContaining({
          conversationId: 'new',
          conversationTitle: 'Migrated',
          workspacePath: '/target-ws',
        }),
      })
    );
    expect(ensureConversationWorkspaceBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new',
        extra: expect.objectContaining({
          workspace: '/target-ws',
          workingDirectory: '/target-ws',
          customWorkspace: true,
          nativeWorkspaceBootstrap: true,
        }),
      })
    );
    expect(repo.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          workspace: '/target-ws',
          workingDirectory: '/target-ws',
          customWorkspace: true,
          nativeWorkspaceBootstrap: true,
        }),
      })
    );
  });

  it('copies messages from source conversation', async () => {
    const msg = { id: 'msg1', conversation_id: 'src', content: 'hello' } as any;
    const repo = makeRepo({
      getMessages: vi
        .fn()
        .mockReturnValueOnce({ data: [msg], total: 1, hasMore: false }) // source first page
        .mockReturnValue({ data: [], total: 1, hasMore: false }), // integrity check calls
    });
    const svc = new ConversationServiceImpl(repo);
    await svc.createWithMigration({ conversation: { id: 'new' } as any, sourceConversationId: 'src' });
    expect(repo.insertMessage).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: 'new' }));
  });
});

describe('ConversationServiceImpl.createConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and saves a gemini conversation', async () => {
    const repo = makeRepo();
    const spaceService = makeSpaceService();
    const svc = new ConversationServiceImpl(repo, spaceService);
    const result = await svc.createConversation({
      type: 'gemini',
      model: { provider: 'google', model: 'gemini-2.0-flash' } as any,
      extra: { workspace: '/ws' },
    });
    expect(result.type).toBe('gemini');
    expect(result.extra.spaceId).toBe('space-default');
    expect(spaceService.ensureDefaultSpace).toHaveBeenCalled();
    expect(repo.createConversation).toHaveBeenCalledWith(expect.objectContaining({ type: 'gemini' }));
  });

  it('creates and saves an acp conversation', async () => {
    const repo = makeRepo();
    const spaceService = makeSpaceService();
    const svc = new ConversationServiceImpl(repo, spaceService);
    const result = await svc.createConversation({
      type: 'acp',
      model: { provider: 'anthropic', model: 'claude-3-5-sonnet' } as any,
      extra: { workspace: '/ws', backend: 'claude' },
    });
    expect(result.type).toBe('acp');
    expect(result.extra.spaceId).toBe('space-default');
    expect(repo.createConversation).toHaveBeenCalledWith(expect.objectContaining({ type: 'acp' }));
  });

  it('bootstraps workspace automation for builtin harness assistants', async () => {
    const repo = makeRepo();
    const spaceService = makeSpaceService();
    const svc = new ConversationServiceImpl(repo, spaceService);

    await svc.createConversation({
      type: 'acp',
      model: { provider: 'openai', model: 'gpt-5' } as any,
      extra: {
        workspace: '/ws',
        backend: 'codex',
        presetAssistantId: 'builtin-superpowers',
      } as any,
    });

    expect(ensureHarnessWorkspaceAutomationForConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'acp',
        extra: expect.objectContaining({
          workspace: '/ws',
          presetAssistantId: 'builtin-superpowers',
        }),
      })
    );
    expect(ensureConversationWorkspaceBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'acp',
        extra: expect.objectContaining({
          workspace: '/ws',
          presetAssistantId: 'builtin-superpowers',
        }),
      })
    );
  });

  it('keeps an explicit spaceId without creating a default space', async () => {
    const repo = makeRepo();
    const spaceService = makeSpaceService();
    const svc = new ConversationServiceImpl(repo, spaceService);

    const result = await svc.createConversation({
      type: 'codex',
      model: { provider: 'openai', model: 'gpt-5-codex' } as any,
      extra: {
        workspace: '/ws',
        spaceId: 'space-explicit',
      },
    });

    expect(result.extra.spaceId).toBe('space-explicit');
    expect(spaceService.ensureDefaultSpace).not.toHaveBeenCalled();
  });

  it('binds group child conversations to the resolved space', async () => {
    const repo = makeRepo();
    const spaceService = makeSpaceService();
    const svc = new ConversationServiceImpl(repo, spaceService);
    const { createGroupConversation } = await import('../../src/process/utils/initAgent');

    await svc.createConversation({
      type: 'group',
      model: { provider: 'group', model: 'group' } as any,
      name: 'Team Group',
      extra: {
        workspace: '/ws',
        participants: [
          {
            id: 'participant-1',
            participantType: 'cli-agent',
            participantKey: 'codex:planner',
            name: 'Planner',
            conversation: {
              type: 'acp',
              name: 'Planner',
              model: {} as any,
              extra: {
                backend: 'codex',
                workspace: '/ws',
              },
            },
          },
        ],
      } as any,
    });

    expect(spaceService.ensureDefaultSpace).toHaveBeenCalledTimes(1);
    expect(createGroupConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-default',
        participants: [
          expect.objectContaining({
            conversation: expect.objectContaining({
              extra: expect.objectContaining({
                spaceId: 'space-default',
              }),
            }),
          }),
        ],
      })
    );
    expect(repo.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          spaceId: 'space-default',
        }),
      })
    );
    expect(ensureHarnessWorkspaceAutomationForConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'group',
        extra: expect.objectContaining({
          participants: expect.arrayContaining([
            expect.objectContaining({
              participantKey: 'codex:planner',
            }),
          ]),
        }),
      })
    );
  });

  it('throws for unknown conversation type', async () => {
    const repo = makeRepo();
    const svc = new ConversationServiceImpl(repo, makeSpaceService());
    await expect(svc.createConversation({ type: 'unknown' as any, model: {} as any, extra: {} })).rejects.toThrow();
  });
});
