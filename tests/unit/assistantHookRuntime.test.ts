import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReadFile = vi.fn();
const mockAccess = vi.fn();
const mockGetDatabase = vi.fn();
const mockAddMessage = vi.fn();
const normalizePath = (filePath: string) => filePath.replace(/\\/g, '/');

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    access: mockAccess,
  },
}));

vi.mock('@process/utils/initStorage', () => ({
  getHooksDir: () => '/mock/hooks',
  getBuiltinHooksCopyDir: () => '/mock/builtin-hooks',
  getSystemDir: () => ({
    workDir: '/mock/workdir',
  }),
}));

vi.mock('@process/services/database', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('@process/utils/message', () => ({
  addMessage: mockAddMessage,
}));

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'mock-hook-message-id'),
}));

describe('AssistantHookRuntime', () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFile.mockReset();
    mockAccess.mockReset();
    mockGetDatabase.mockReset();
    mockAddMessage.mockReset();
    mockGetDatabase.mockResolvedValue({
      getConversation: vi.fn(() => ({ success: false, data: null })),
      getConversationMessages: vi.fn(() => ({ data: [] })),
    });
  });

  it('applies enabled before_user_prompt prompt-transform hooks in order', async () => {
    mockAccess.mockImplementation(async (filePath: string) => {
      if (normalizePath(filePath) === '/mock/hooks/quality-gate') return;
      throw new Error(`ENOENT ${filePath}`);
    });

    mockReadFile.mockImplementation(async (filePath: string) => {
      const normalizedPath = normalizePath(filePath);
      if (normalizedPath === '/mock/hooks/quality-gate/manifest.json') {
        return JSON.stringify({
          name: 'quality-gate',
          executionType: 'prompt-transform',
          events: ['before_user_prompt'],
        });
      }
      if (normalizedPath === '/mock/hooks/quality-gate/before_user_prompt.md') {
        return 'Checklist\n\n[User Request]\n{{userPrompt}}';
      }
      throw new Error(`ENOENT ${filePath}`);
    });

    const { AssistantHookRuntime } = await import('../../src/process/bridge/services/AssistantHookRuntime');
    const runtime = new AssistantHookRuntime();

    const result = await runtime.applyBeforeUserPrompt(
      {
        id: 'conv-1',
        type: 'acp',
        name: 'Conversation',
        createTime: Date.now(),
        modifyTime: Date.now(),
        extra: {
          backend: 'claude',
          workspace: '/workspace/project',
          enabledHooks: ['quality-gate'],
        },
      } as any,
      'Fix failing tests'
    );

    expect(result).toEqual({
      content: 'Checklist\n\n[User Request]\nFix failing tests',
      appliedHooks: ['quality-gate'],
    });
  });

  it('prefers workspace hooks before user and builtin hook directories', async () => {
    mockAccess.mockImplementation(async (filePath: string) => {
      if (normalizePath(filePath) === '/workspace/project/.contextgo/hooks/quality-gate') return;
      throw new Error(`ENOENT ${filePath}`);
    });

    mockReadFile.mockImplementation(async (filePath: string) => {
      const normalizedPath = normalizePath(filePath);
      if (normalizedPath === '/workspace/project/.contextgo/hooks/quality-gate/manifest.json') {
        return JSON.stringify({
          name: 'quality-gate',
          executionType: 'prompt-transform',
          events: ['before_user_prompt'],
        });
      }
      if (normalizedPath === '/workspace/project/.contextgo/hooks/quality-gate/before_user_prompt.md') {
        return 'Workspace hook for {{backend}}\n\n{{userPrompt}}';
      }
      throw new Error(`ENOENT ${filePath}`);
    });

    const { AssistantHookRuntime } = await import('../../src/process/bridge/services/AssistantHookRuntime');
    const runtime = new AssistantHookRuntime();

    const result = await runtime.applyBeforeUserPrompt(
      {
        id: 'conv-workspace',
        type: 'acp',
        name: 'Workspace Conversation',
        createTime: Date.now(),
        modifyTime: Date.now(),
        extra: {
          backend: 'claude',
          workingDirectory: '/workspace/project',
          enabledHooks: ['quality-gate'],
        },
      } as any,
      'Check workspace precedence'
    );

    expect(result).toEqual({
      content: 'Workspace hook for claude\n\nCheck workspace precedence',
      appliedHooks: ['quality-gate'],
    });
  });

  it('falls back to builtin hooks when the user hooks directory does not contain the hook', async () => {
    mockAccess.mockImplementation(async (filePath: string) => {
      if (normalizePath(filePath) === '/mock/builtin-hooks/plan-before-coding') return;
      throw new Error(`ENOENT ${filePath}`);
    });

    mockReadFile.mockImplementation(async (filePath: string) => {
      const normalizedPath = normalizePath(filePath);
      if (normalizedPath === '/mock/builtin-hooks/plan-before-coding/manifest.json') {
        return JSON.stringify({
          name: 'plan-before-coding',
          executionType: 'prompt-transform',
          events: ['before_user_prompt'],
          supportedBackends: ['gemini'],
        });
      }
      if (normalizedPath === '/mock/builtin-hooks/plan-before-coding/before_user_prompt.md') {
        return 'Plan first for {{backend}}\n\n{{userPrompt}}';
      }
      throw new Error(`ENOENT ${filePath}`);
    });

    const { AssistantHookRuntime } = await import('../../src/process/bridge/services/AssistantHookRuntime');
    const runtime = new AssistantHookRuntime();

    const result = await runtime.applyBeforeUserPrompt(
      {
        id: 'conv-2',
        type: 'gemini',
        name: 'Conversation',
        model: { id: 'p', name: 'Provider', useModel: 'm', platform: 'gemini', baseUrl: '', apiKey: '' },
        createTime: Date.now(),
        modifyTime: Date.now(),
        extra: {
          workspace: '/workspace/project',
          enabledHooks: ['plan-before-coding'],
        },
      } as any,
      'Draft a release note'
    );

    expect(result.appliedHooks).toEqual(['plan-before-coding']);
    expect(result.content).toContain('Draft a release note');
  });

  it('emits after_response native-projection hooks using the latest non-system user request and tool summary', async () => {
    mockAccess.mockImplementation(async (filePath: string) => {
      if (normalizePath(filePath) === '/mock/hooks/result-summary') return;
      throw new Error(`ENOENT ${filePath}`);
    });

    mockReadFile.mockImplementation(async (filePath: string) => {
      const normalizedPath = normalizePath(filePath);
      if (normalizedPath === '/mock/hooks/result-summary/manifest.json') {
        return JSON.stringify({
          name: 'result-summary',
          executionType: 'native-projection',
          events: ['after_response'],
        });
      }
      if (normalizedPath === '/mock/hooks/result-summary/after_response.md') {
        return [
          'Request: {{userRequest}}',
          'Summary: {{assistantTurnSummary}}',
          'Tools: {{toolCount}} {{toolNames}}',
          'Excerpt: {{finalResponseExcerpt}}',
        ].join('\n');
      }
      throw new Error(`ENOENT ${filePath}`);
    });

    mockGetDatabase.mockResolvedValue({
      getConversation: vi.fn(() => ({
        success: true,
        data: {
          id: 'conv-3',
          type: 'codex',
          name: 'Conversation',
          createTime: Date.now(),
          modifyTime: Date.now(),
          extra: {
            enabledHooks: ['result-summary', 'quality-gate'],
          },
        },
      })),
      getConversationMessages: vi.fn(() => ({
        data: [
          {
            id: 'user-1',
            type: 'text',
            position: 'right',
            conversation_id: 'conv-3',
            content: { content: 'Ship release notes' },
            createdAt: 10,
          },
          {
            id: 'tool-group-1',
            type: 'tool_group',
            conversation_id: 'conv-3',
            content: [
              {
                callId: 'call-1',
                description: '',
                name: 'search_query',
                renderOutputAsMarkdown: false,
                status: 'Success',
              },
              {
                callId: 'call-2',
                description: '',
                name: 'apply_patch',
                renderOutputAsMarkdown: false,
                status: 'Success',
              },
            ],
            createdAt: 20,
          },
          {
            id: 'sys-feedback',
            type: 'text',
            position: 'right',
            conversation_id: 'conv-3',
            content: { content: '[System Response]\ncron output' },
            createdAt: 30,
          },
          {
            id: 'codex-tool-1',
            type: 'codex_tool_call',
            position: 'left',
            conversation_id: 'conv-3',
            content: {
              toolCallId: 'tc-1',
              status: 'success',
              kind: 'execute',
              title: 'exec_command',
              subtype: 'exec_command_end',
              data: {},
            },
            createdAt: 40,
          },
          {
            id: 'assistant-1',
            msg_id: 'assistant-msg-1',
            type: 'text',
            position: 'left',
            conversation_id: 'conv-3',
            content: {
              content: 'Finished the work. Added the release note draft and verified the main happy path end-to-end.',
            },
            createdAt: 50,
          },
        ],
      })),
    });

    const { AssistantHookRuntime } = await import('../../src/process/bridge/services/AssistantHookRuntime');
    const runtime = new AssistantHookRuntime();
    const emittedMessages: Array<{ type: string; data: unknown }> = [];

    const result = await runtime.emitAfterResponse('conv-3', (message) => {
      emittedMessages.push(message);
    });

    expect(result).toEqual({
      appliedHooks: ['result-summary'],
      emittedHooks: ['result-summary'],
      sourceMessageId: 'assistant-msg-1',
    });
    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    const persistedMessage = mockAddMessage.mock.calls[0][1];
    expect(persistedMessage.content.content).toContain('Request: Ship release notes');
    expect(persistedMessage.content.content).toContain(
      'Summary: Completed after 3 tool calls. Tools used: search_query, apply_patch, exec_command.'
    );
    expect(persistedMessage.content.content).toContain('Tools: 3 search_query, apply_patch, exec_command');
    expect(persistedMessage.content.content).not.toContain('[System Response]');
    expect(emittedMessages).toHaveLength(1);
    expect(emittedMessages[0]).toMatchObject({
      type: 'content',
      data: {
        content: expect.stringContaining('Request: Ship release notes'),
      },
    });
  });
});
