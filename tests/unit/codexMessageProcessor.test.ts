import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHasCronCommands = vi.fn();
const mockProcessCronInMessage = vi.fn();
const mockEmit = vi.fn();
const mockSetProcessing = vi.fn();

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'mock-uuid'),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    codexConversation: {
      responseStream: {
        emit: mockEmit,
      },
    },
  },
}));

vi.mock('@process/task/CronCommandDetector', () => ({
  hasCronCommands: mockHasCronCommands,
}));

vi.mock('@process/task/MessageMiddleware', () => ({
  processCronInMessage: mockProcessCronInMessage,
}));

vi.mock('@process/services/cron/CronBusyGuard', () => ({
  cronBusyGuard: {
    setProcessing: mockSetProcessing,
  },
}));

describe('CodexMessageProcessor', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHasCronCommands.mockReset();
    mockProcessCronInMessage.mockReset();
    mockEmit.mockReset();
    mockSetProcessing.mockReset();
  });

  it('schedules after_response hooks when the final message does not continue via system feedback', async () => {
    mockHasCronCommands.mockReturnValue(false);

    const { CodexMessageProcessor } = await import('../../src/process/agent/codex/messaging/CodexMessageProcessor');
    const emitter = {
      emitAndPersistMessage: vi.fn(),
      persistMessage: vi.fn(),
      addConfirmation: vi.fn(),
      scheduleAfterResponseHooks: vi.fn(),
    };

    const processor = new CodexMessageProcessor('conv-1', emitter as any);
    processor.processTaskStart();
    processor.processFinalMessage({
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

  it('does not schedule after_response hooks when cron feedback continues the turn', async () => {
    mockHasCronCommands.mockReturnValue(true);
    mockProcessCronInMessage.mockImplementation(async (_conversationId, _backend, _message, onSystemMessage) => {
      onSystemMessage('cron-result');
    });

    const { CodexMessageProcessor } = await import('../../src/process/agent/codex/messaging/CodexMessageProcessor');
    const emitter = {
      emitAndPersistMessage: vi.fn(),
      persistMessage: vi.fn(),
      addConfirmation: vi.fn(),
      scheduleAfterResponseHooks: vi.fn(),
      sendMessageToAgent: vi.fn(),
    };

    const processor = new CodexMessageProcessor('conv-2', emitter as any);
    processor.processTaskStart();
    processor.processFinalMessage({
      type: 'agent_message',
      message: 'Final answer with cron commands',
    } as any);
    await Promise.resolve();
    await Promise.resolve();

    expect(emitter.sendMessageToAgent).toHaveBeenCalledWith('[System Response]\ncron-result');
    expect(emitter.scheduleAfterResponseHooks).not.toHaveBeenCalled();
  });
});
