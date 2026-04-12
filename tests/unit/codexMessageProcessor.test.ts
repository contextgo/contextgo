import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProcessing = vi.fn();

vi.mock('@/common/platform', () => ({
  getPlatformServices: () => ({
    paths: {
      getDataDir: () => '/tmp/contextgo-test',
      getTempDir: () => '/tmp',
      getHomeDir: () => '/tmp',
      getLogsDir: () => '/tmp',
      getAppPath: () => '/tmp/contextgo-test-app',
      isPackaged: () => false,
      getSystemPath: () => '/tmp',
      getName: () => 'ContextGo',
      getVersion: () => '0.0.0-test',
      needsCliSafeSymlinks: () => false,
    },
    worker: {
      fork: vi.fn(),
    },
    power: {
      preventSleep: vi.fn(() => null),
      allowSleep: vi.fn(),
    },
    notification: {
      send: vi.fn(),
    },
  }),
}));

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'mock-uuid'),
}));

vi.mock('@process/utils/message', () => ({
  addMessage: vi.fn(),
  addOrUpdateMessage: vi.fn(),
  nextTickToLocalFinish: vi.fn(),
}));

vi.mock('@process/services/context/events/schedule/ScheduleConversationGuard', () => ({
  scheduleConversationGuard: {
    setProcessing: mockSetProcessing,
  },
}));

vi.mock('@process/services/context/events/schedule/ScheduleEventMessageEmitter', () => ({
  emitScheduleEventMessage: vi.fn(),
}));

describe('CodexMessageProcessor', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSetProcessing.mockReset();
  });

  it('schedules after_response hooks when the final message does not continue via system feedback', async () => {
    const { CodexMessageProcessor } = await import('../../src/process/agent/codex/messaging/CodexMessageProcessor');
    const emitter = {
      emitAndPersistMessage: vi.fn(),
      persistMessage: vi.fn(),
      addConfirmation: vi.fn(),
      scheduleAfterResponseHooks: vi.fn(),
    };

    const processor = new CodexMessageProcessor('conv-1', emitter as any);
    processor.processTaskStart();
    await processor.processFinalMessage({
      type: 'agent_message',
      message: 'Final answer',
    } as any);

    expect(emitter.persistMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        type: 'text',
        content: { content: 'Final answer' },
      })
    );
    expect(emitter.scheduleAfterResponseHooks).toHaveBeenCalledTimes(1);
  });

  it('suppresses streamed schedule command blocks from codex content deltas', async () => {
    const { CodexMessageProcessor } = await import('../../src/process/agent/codex/messaging/CodexMessageProcessor');
    const emitter = {
      emitAndPersistMessage: vi.fn(),
      persistMessage: vi.fn(),
      addConfirmation: vi.fn(),
      scheduleAfterResponseHooks: vi.fn(),
      updateFinalAssistantContent: vi.fn(),
      sendMessageToAgent: vi.fn(),
    };

    const processor = new CodexMessageProcessor('conv-schedule', emitter as any);
    processor.processTaskStart();

    processor.processMessageDelta({
      type: 'agent_message_delta',
      delta: '先创建任务：\n[SCHED',
    } as any);
    processor.processMessageDelta({
      type: 'agent_message_delta',
      delta: 'ULE_CREATE]\nname: 每日问候\nschedule: 20 11 * * *\n',
    } as any);
    processor.processMessageDelta({
      type: 'agent_message_delta',
      delta: 'schedule_description: 每天 11:20\nmessage: 你好\n[/SCHEDULE_CREATE]\n完成。',
    } as any);

    expect(emitter.emitAndPersistMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'content',
        conversation_id: 'conv-schedule',
        data: '先创建任务：\n',
      }),
      false
    );
    expect(emitter.emitAndPersistMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'content',
        conversation_id: 'conv-schedule',
        data: '\n完成。',
      }),
      false
    );
  });

  it('overwrites thought payloads with the latest reasoning chunk instead of accumulating them', async () => {
    const { CodexMessageProcessor } = await import('../../src/process/agent/codex/messaging/CodexMessageProcessor');
    const emitter = {
      emitAndPersistMessage: vi.fn(),
      persistMessage: vi.fn(),
      addConfirmation: vi.fn(),
    };

    const processor = new CodexMessageProcessor('conv-thought', emitter as any);
    processor.processTaskStart();

    processor.handleReasoningMessage({
      type: 'agent_reasoning_delta',
      delta: '第一段思考：先检查上下文结构。',
    } as any);

    processor.handleReasoningMessage({
      type: 'agent_reasoning_delta',
      delta: '第二段思考：直接覆盖当前展示，不累计旧段落。',
    } as any);

    expect(emitter.emitAndPersistMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'thought',
        conversation_id: 'conv-thought',
        data: {
          subject: 'Thinking',
          description: '第一段思考：先检查上下文结构。',
        },
      }),
      false
    );

    expect(emitter.emitAndPersistMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'thought',
        conversation_id: 'conv-thought',
        data: {
          subject: 'Thinking',
          description: '第二段思考：直接覆盖当前展示，不累计旧段落。',
        },
      }),
      false
    );
  });
});
