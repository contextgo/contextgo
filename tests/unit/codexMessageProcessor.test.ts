import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProcessing = vi.fn();

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'mock-uuid'),
}));

vi.mock('@process/services/context/events/schedule/ScheduleConversationGuard', () => ({
  scheduleConversationGuard: {
    setProcessing: mockSetProcessing,
  },
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
