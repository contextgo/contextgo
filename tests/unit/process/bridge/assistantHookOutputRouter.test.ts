import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddMessage = vi.fn();
const mockShowNotification = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'router-message-id'),
}));

vi.mock('@process/utils/message', () => ({
  addMessage: mockAddMessage,
}));

vi.mock('@process/bridge/notificationBridge', () => ({
  showNotification: mockShowNotification,
}));

vi.mock('@process/services/i18n', () => ({
  default: {
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'agent.hooks.sidecarExported') {
        return `Sidecar files exported for ${options?.hookName || 'hook'}.`;
      }
      if (key === 'agent.hooks.markdownPath') {
        return 'Markdown';
      }
      if (key === 'agent.hooks.metadataPath') {
        return 'Metadata';
      }
      if (key === 'agent.hooks.openMarkdown') {
        return 'Open Markdown';
      }
      if (key === 'agent.hooks.showInFolder') {
        return 'Show In Folder';
      }
      return options?.defaultValue ?? key;
    },
  },
}));

vi.mock('@process/utils/initStorage', () => ({
  getSystemDir: () => ({
    workDir: '/mock/system-workdir',
  }),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
}));

describe('AssistantHookOutputRouter', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAddMessage.mockReset();
    mockShowNotification.mockReset();
    mockMkdir.mockReset();
    mockWriteFile.mockReset();
    mockShowNotification.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('falls back to chat-message delivery when no explicit output target is configured', async () => {
    const { AssistantHookOutputRouter } =
      await import('../../../../src/process/bridge/services/AssistantHookOutputRouter');
    const router = new AssistantHookOutputRouter();
    const onEmit = vi.fn();

    const result = await router.routeAfterResponseHooks(
      [
        {
          hookName: 'result-summary',
          manifest: {
            name: 'result-summary',
            executionType: 'native-projection',
            events: ['after_response'],
          },
          content: 'Summary body',
          templateValues: {
            conversationId: 'conv-1',
          },
          metadata: {
            conversationId: 'conv-1',
            conversationName: 'Conversation',
            workspace: '/workspace/project',
            backend: 'codex',
            sourceMessageId: 'assistant-msg-1',
            userRequest: 'Ship release notes',
            finalResponse: 'Done',
            finalResponseExcerpt: 'Done',
            assistantTurnSummary: 'Completed without tool calls.',
            toolCount: 0,
            toolNames: [],
            generatedAt: '2026-03-28T05:00:00.000Z',
            content: 'Summary body',
          },
        },
      ],
      onEmit
    );

    expect(result).toEqual({
      deliveredHooks: ['result-summary'],
      chatHooks: ['result-summary'],
      notificationHooks: [],
      sidecarHooks: [],
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        conversation_id: 'conv-1',
        content: { content: 'Summary body' },
      })
    );
    expect(onEmit).toHaveBeenCalledWith({
      type: 'content',
      conversation_id: 'conv-1',
      msg_id: 'router-message-id',
      data: { content: 'Summary body' },
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('routes after_response output to desktop notification and sidecar files', async () => {
    const { AssistantHookOutputRouter } =
      await import('../../../../src/process/bridge/services/AssistantHookOutputRouter');
    const router = new AssistantHookOutputRouter();
    const onEmit = vi.fn();

    const result = await router.routeAfterResponseHooks(
      [
        {
          hookName: 'continuity-handoff',
          manifest: {
            name: 'continuity-handoff',
            executionType: 'native-projection',
            events: ['after_response'],
            outputTargets: ['system-notification', 'sidecar-file'],
            notification: {
              title: '{{conversationName}} completed',
              body: '{{finalResponseExcerpt}}',
            },
            outputFile: {
              baseDir: 'system-workdir',
              relativeDir: 'hook-outputs/{{conversationId}}/{{hookName}}',
              fileBaseName: 'latest',
            },
          },
          content: '### Continuity Handoff\n\nDone',
          templateValues: {
            conversationId: 'conv-2',
            conversationName: 'Release Workspace',
            hookName: 'continuity-handoff',
            finalResponseExcerpt: 'Release note draft is ready.',
          },
          metadata: {
            conversationId: 'conv-2',
            conversationName: 'Release Workspace',
            workspace: '/workspace/release',
            backend: 'codex',
            sourceMessageId: 'assistant-msg-2',
            userRequest: 'Prepare the release note',
            finalResponse: 'Release note draft is ready.',
            finalResponseExcerpt: 'Release note draft is ready.',
            assistantTurnSummary: 'Completed after 2 tool calls. Tools used: search_query, apply_patch.',
            toolCount: 2,
            toolNames: ['search_query', 'apply_patch'],
            generatedAt: '2026-03-28T05:10:00.000Z',
            content: '### Continuity Handoff\n\nDone',
          },
        },
      ],
      onEmit
    );

    expect(result).toEqual({
      deliveredHooks: ['continuity-handoff'],
      chatHooks: [],
      notificationHooks: ['continuity-handoff'],
      sidecarHooks: ['continuity-handoff'],
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      'conv-2',
      expect.objectContaining({
        conversation_id: 'conv-2',
        type: 'tips',
        position: 'center',
        content: expect.objectContaining({
          type: 'success',
          content: expect.stringContaining('/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md'),
          actions: [
            {
              label: 'Open Markdown',
              action: 'open-file',
              path: '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md',
            },
            {
              label: 'Show In Folder',
              action: 'show-item-in-folder',
              path: '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md',
            },
          ],
        }),
      })
    );
    expect(onEmit).toHaveBeenCalledWith({
      type: 'tips',
      conversation_id: 'conv-2',
      msg_id: 'router-message-id',
      data: expect.objectContaining({
        type: 'success',
        content: expect.stringContaining('/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.json'),
        actions: [
          {
            label: 'Open Markdown',
            action: 'open-file',
            path: '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md',
          },
          {
            label: 'Show In Folder',
            action: 'show-item-in-folder',
            path: '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md',
          },
        ],
      }),
    });
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Release Workspace completed',
      body: 'Release note draft is ready.',
      conversationId: 'conv-2',
    });
    expect(mockMkdir).toHaveBeenCalledWith('/mock/system-workdir/hook-outputs/conv-2/continuity-handoff', {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.md',
      '### Continuity Handoff\n\nDone',
      'utf-8'
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/mock/system-workdir/hook-outputs/conv-2/continuity-handoff/latest.json',
      expect.stringContaining('"conversationId": "conv-2"'),
      'utf-8'
    );
  });
});
