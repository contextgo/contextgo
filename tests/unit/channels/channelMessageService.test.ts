import { beforeEach, describe, expect, it, vi } from 'vitest';

let agentMessageListener: ((event: unknown) => void) | null = null;

vi.mock('@process/task/workerTaskManagerSingleton', () => ({
  workerTaskManager: {
    getTask: vi.fn(() => undefined),
    getOrBuildTask: vi.fn(async () => {
      throw new Error('workerTaskManager should not be used in this test');
    }),
  },
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => {
    throw new Error('getDatabase should not be used in this test');
  }),
}));

vi.mock('@process/bridge/services/AssistantHookRuntime', () => ({
  AssistantHookRuntime: vi.fn().mockImplementation(() => ({
    applyBeforeUserPrompt: vi.fn(async (_conversation: unknown, content: string) => ({
      content,
      appliedHooks: [],
    })),
  })),
}));

vi.mock('@process/services/i18n', () => ({
  default: {
    t: vi.fn((key: string) => key),
  },
  i18nReady: Promise.resolve(),
}));

vi.mock('@process/services/cron/cronServiceSingleton', () => ({
  cronService: {
    addJob: vi.fn(),
    listJobsByConversation: vi.fn(async () => []),
    removeJob: vi.fn(),
  },
}));

vi.mock('../../../src/process/task/workerTaskManagerSingleton', () => ({
  workerTaskManager: {
    getTask: vi.fn(() => undefined),
    getOrBuildTask: vi.fn(async () => {
      throw new Error('workerTaskManager should not be used in this test');
    }),
  },
}));

vi.mock('../../../src/process/services/database', () => ({
  getDatabase: vi.fn(async () => {
    throw new Error('getDatabase should not be used in this test');
  }),
}));

vi.mock('../../../src/process/bridge/services/AssistantHookRuntime', () => ({
  AssistantHookRuntime: vi.fn().mockImplementation(() => ({
    applyBeforeUserPrompt: vi.fn(async (_conversation: unknown, content: string) => ({
      content,
      appliedHooks: [],
    })),
  })),
}));

vi.mock('../../../src/process/channels/agent/ChannelEventBus', () => ({
  channelEventBus: {
    onAgentMessage: vi.fn((listener: (event: unknown) => void) => {
      agentMessageListener = listener;
      return () => {
        agentMessageListener = null;
      };
    }),
  },
}));

import { ChannelMessageService } from '../../../src/process/channels/agent/ChannelMessageService';

describe('ChannelMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMessageListener = null;
  });

  it('applies hooks and keeps raw content for ACP channel messages', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const files = ['/tmp/weixin-media/image.png'];
    const service = new ChannelMessageService({
      taskManager: {
        getTask: vi.fn(() => undefined),
        getOrBuildTask: vi.fn(async () => ({
          type: 'acp',
          sendMessage,
        })),
      },
      getDatabase: async () =>
        ({
          getConversation: vi.fn(() => ({
            success: true,
            data: {
              id: 'conv-1',
              type: 'acp',
              source: 'telegram',
              extra: { backend: 'claude', enabledHooks: ['prompt-guard'] },
            },
          })),
        }) as unknown as Awaited<ReturnType<typeof import('../../../src/process/services/database').getDatabase>>,
      hookRuntime: {
        applyBeforeUserPrompt: vi.fn(async () => ({
          content: 'hooked content',
          appliedHooks: ['prompt-guard'],
        })),
      },
    });

    const promise = service.sendMessage('session-1', 'conv-1', 'raw content', vi.fn(), files);
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'raw content',
          agentContent: 'hooked content',
          files,
        })
      );
    });

    agentMessageListener?.({ type: 'finish', conversation_id: 'conv-1', data: null });
    await expect(promise).resolves.toMatch(/^channel_msg_/);
  });

  it('applies hooks and keeps raw content for Gemini channel messages', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const files = ['/tmp/weixin-media/document.pdf'];
    const service = new ChannelMessageService({
      taskManager: {
        getTask: vi.fn(() => undefined),
        getOrBuildTask: vi.fn(async () => ({
          type: 'gemini',
          sendMessage,
        })),
      },
      getDatabase: async () =>
        ({
          getConversation: vi.fn(() => ({
            success: true,
            data: {
              id: 'conv-2',
              type: 'gemini',
              source: 'lark',
              extra: { workspace: '/ws', enabledHooks: ['prompt-guard'] },
            },
          })),
        }) as unknown as Awaited<ReturnType<typeof import('../../../src/process/services/database').getDatabase>>,
      hookRuntime: {
        applyBeforeUserPrompt: vi.fn(async () => ({
          content: 'hooked input',
          appliedHooks: ['prompt-guard'],
        })),
      },
    });

    const promise = service.sendMessage('session-1', 'conv-2', 'raw input', vi.fn(), files);
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'raw input',
          agentInput: 'hooked input',
          files,
        })
      );
    });

    agentMessageListener?.({ type: 'finish', conversation_id: 'conv-2', data: null });
    await expect(promise).resolves.toMatch(/^channel_msg_/);
  });

  it('uses agent-facing content for hook injection while keeping clean display content', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const applyBeforeUserPrompt = vi.fn(async (_conversation: unknown, content: string) => ({
      content: `hooked: ${content}`,
      appliedHooks: ['prompt-guard'],
    }));
    const files = ['/tmp/weixin-media/voice.wav'];
    const visibleMessage = 'RTF1模式是啥意思\n\n[[CONTEXTGO_FILES]]\n/tmp/weixin-media/voice.wav';
    const agentMessage = [
      '[WeChat media message]',
      'User text: RTF1模式是啥意思',
      'Attachment 1: type=voice, path=/tmp/weixin-media/voice.wav, name=voice.wav, mime=audio/wav, size=131564, duration=2760',
    ].join('\n');
    const service = new ChannelMessageService({
      taskManager: {
        getTask: vi.fn(() => undefined),
        getOrBuildTask: vi.fn(async () => ({
          type: 'openclaw',
          sendMessage,
        })),
      },
      getDatabase: async () =>
        ({
          getConversation: vi.fn(() => ({
            success: true,
            data: {
              id: 'conv-media',
              type: 'openclaw',
              source: 'weixin',
              extra: {},
            },
          })),
        }) as unknown as Awaited<ReturnType<typeof import('../../../src/process/services/database').getDatabase>>,
      hookRuntime: {
        applyBeforeUserPrompt,
      },
    });

    const promise = service.sendMessage('session-1', 'conv-media', visibleMessage, vi.fn(), files, agentMessage);
    await vi.waitFor(() => {
      expect(applyBeforeUserPrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-media' }), agentMessage);
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: visibleMessage,
          agentContent: `hooked: ${agentMessage}`,
          files,
        })
      );
    });

    agentMessageListener?.({ type: 'finish', conversation_id: 'conv-media', data: null });
    await expect(promise).resolves.toMatch(/^channel_msg_/);
  });

  it('enables yolo mode for Discord channel conversations', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const getOrBuildTask = vi.fn(async (_conversationId: string, _options: { yoloMode: boolean }) => ({
      type: 'gemini',
      sendMessage,
    }));
    const service = new ChannelMessageService({
      taskManager: {
        getTask: vi.fn(() => undefined),
        getOrBuildTask,
      },
      getDatabase: async () =>
        ({
          getConversation: vi.fn(() => ({
            success: true,
            data: {
              id: 'conv-3',
              type: 'gemini',
              source: 'discord',
              extra: {},
            },
          })),
        }) as unknown as Awaited<ReturnType<typeof import('../../../src/process/services/database').getDatabase>>,
      hookRuntime: {
        applyBeforeUserPrompt: vi.fn(async () => ({
          content: 'discord prompt',
          appliedHooks: [],
        })),
      },
    });

    const promise = service.sendMessage('session-1', 'conv-3', 'discord prompt', vi.fn());
    await vi.waitFor(() => {
      expect(getOrBuildTask).toHaveBeenCalledWith('conv-3', {
        yoloMode: true,
      });
    });

    agentMessageListener?.({ type: 'finish', conversation_id: 'conv-3', data: null });
    await expect(promise).resolves.toMatch(/^channel_msg_/);
  });
});
