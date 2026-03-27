/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron before any imports
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp') },
}));

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: { get: mockGet, set: mockSet },
}));

vi.mock('@process/channels/pairing/PairingService', () => ({
  getPairingService: vi.fn(() => ({})),
}));

vi.mock('@process/acp/connectors/acpConversationConnector', () => ({}));

// Also mock provider list (used inside getChannelDefaultModel)
vi.mock('@process/model/providerListStore', () => ({
  getProviderList: vi.fn(async () => []),
}));

const mockGetDetectedAgents = vi.fn();
vi.mock('@process/agent/acp/AcpDetector', () => ({
  acpDetector: {
    getDetectedAgents: mockGetDetectedAgents,
  },
}));

const mockCreateConversation = vi.fn();
vi.mock('@/process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: {
    createConversation: mockCreateConversation,
  },
}));

const mockClearContext = vi.fn();
vi.mock('@process/channels/agent/ChannelMessageService', () => ({
  getChannelMessageService: vi.fn(() => ({
    clearContext: mockClearContext,
  })),
}));

const mockKill = vi.fn();
vi.mock('@process/task/workerTaskManagerSingleton', () => ({
  workerTaskManager: {
    kill: mockKill,
  },
}));

const mockSessionManager = {
  getSession: vi.fn(),
  clearSession: vi.fn(),
  createSessionWithConversation: vi.fn(),
};
vi.mock('@process/channels/core/ChannelManager', () => ({
  getChannelManager: vi.fn(() => ({
    getSessionManager: () => mockSessionManager,
  })),
}));

const GEMINI_PROVIDER = {
  id: 'provider-gemini',
  platform: 'gemini',
  name: 'Gemini API',
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: 'test-key',
  model: ['gemini-2.0-flash'],
};

const BASE_CHANNEL_USER = {
  id: 'channel-user-1',
  platformUserId: 'wx-user-1',
  platformType: 'weixin' as const,
  displayName: 'Alice',
  authorizedAt: 1000,
};

function createActionContext() {
  return {
    platform: 'weixin' as const,
    pluginId: 'weixin_default',
    userId: 'wx-user-1',
    chatId: 'chat-wx-1',
    displayName: 'Alice',
    channelUser: BASE_CHANNEL_USER,
    sessionId: 'session-1',
    conversationId: 'conv-1',
    originalMessage: {
      id: 'msg-1',
      platform: 'weixin' as const,
      chatId: 'chat-wx-1',
      user: {
        id: 'wx-user-1',
        displayName: 'Alice',
      },
      content: {
        type: 'action' as const,
        text: 'agent.select',
      },
      timestamp: Date.now(),
    },
    sendMessage: vi.fn(async () => 'sent-message-id'),
    editMessage: vi.fn(async () => {}),
  };
}

describe('SystemActions weixin platform handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockImplementation(async (key: string) => {
      if (key === 'model.config') return [GEMINI_PROVIDER];
      if (key === 'assistant.weixin.agent') return { backend: 'gemini', name: 'Gemini' };
      return undefined;
    });
    mockSet.mockResolvedValue(undefined);

    mockGetDetectedAgents.mockReturnValue([]);
    mockCreateConversation.mockResolvedValue({ id: 'conv-new-1' });
    mockClearContext.mockResolvedValue(undefined);
    mockKill.mockReturnValue(undefined);

    mockSessionManager.getSession.mockReturnValue({
      id: 'session-old',
      userId: BASE_CHANNEL_USER.id,
      agentType: 'gemini',
      conversationId: 'conv-old',
      chatId: 'chat-wx-1',
      createdAt: 1000,
      lastActivity: 1000,
    });
    mockSessionManager.clearSession.mockResolvedValue(true);
    mockSessionManager.createSessionWithConversation.mockResolvedValue({
      id: 'session-new',
      userId: BASE_CHANNEL_USER.id,
      agentType: 'acp',
      conversationId: 'conv-new-1',
      chatId: 'chat-wx-1',
      createdAt: 1000,
      lastActivity: 1000,
    });
  });

  it('getChannelDefaultModel reads assistant.weixin.defaultModel for weixin platform', async () => {
    const { getChannelDefaultModel } = await import('@process/channels/actions/SystemActions');

    mockGet.mockImplementation((key: string) => {
      if (key === 'model.config') return Promise.resolve([GEMINI_PROVIDER]);
      if (key === 'assistant.weixin.defaultModel') return Promise.resolve({ id: 'p1', useModel: 'gemini-2.0-flash' });
      return Promise.resolve(undefined);
    });

    await getChannelDefaultModel('weixin');
    expect(mockGet).toHaveBeenCalledWith('assistant.weixin.defaultModel');
    expect(mockGet).not.toHaveBeenCalledWith('assistant.telegram.defaultModel');
  });

  it('getChannelDefaultModel still reads assistant.telegram.defaultModel for telegram', async () => {
    const { getChannelDefaultModel } = await import('@process/channels/actions/SystemActions');

    await getChannelDefaultModel('telegram');
    expect(mockGet).toHaveBeenCalledWith('assistant.telegram.defaultModel');
    expect(mockGet).not.toHaveBeenCalledWith('assistant.weixin.defaultModel');
  });

  it('getChannelDefaultModel falls back when model config read fails', async () => {
    const { getChannelDefaultModel } = await import('@process/channels/actions/SystemActions');

    mockGet.mockRejectedValueOnce(new Error('read failed'));
    const model = await getChannelDefaultModel('weixin');

    expect(model.id).toBe('gemini_default');
    expect(model.platform).toBe('gemini');
  });
});

describe('SystemActions agent selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockImplementation(async (key: string) => {
      if (key === 'model.config') return [GEMINI_PROVIDER];
      if (key === 'assistant.weixin.agent') return { backend: 'gemini', name: 'Gemini' };
      return undefined;
    });
    mockSet.mockResolvedValue(undefined);

    mockGetDetectedAgents.mockReturnValue([
      {
        backend: 'claude',
        name: 'Claude Code',
        customAgentId: 'claude-custom-1',
      },
    ]);

    mockSessionManager.getSession.mockReturnValue({
      id: 'session-old',
      userId: BASE_CHANNEL_USER.id,
      agentType: 'gemini',
      conversationId: 'conv-old',
      chatId: 'chat-wx-1',
      createdAt: 1000,
      lastActivity: 1000,
    });
    mockSessionManager.clearSession.mockResolvedValue(true);
    mockSessionManager.createSessionWithConversation.mockResolvedValue({
      id: 'session-new',
      userId: BASE_CHANNEL_USER.id,
      agentType: 'acp',
      conversationId: 'conv-new-1',
      chatId: 'chat-wx-1',
      createdAt: 1000,
      lastActivity: 1000,
    });

    mockClearContext.mockResolvedValue(undefined);
    mockKill.mockReturnValue(undefined);
    mockCreateConversation.mockResolvedValue({ id: 'conv-new-1' });
  });

  it('switches to selected backend agent and recreates conversation/session', async () => {
    const { handleAgentSelect } = await import('@process/channels/actions/SystemActions');
    const context = createActionContext();

    const result = await handleAgentSelect(context, { agentKey: 'claude:claude-custom-1' });

    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      'assistant.weixin.agent',
      expect.objectContaining({
        backend: 'claude',
        customAgentId: 'claude-custom-1',
        name: 'Claude Code',
      })
    );
    expect(mockClearContext).toHaveBeenCalledWith('session-old');
    expect(mockKill).toHaveBeenCalledWith('conv-old');
    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'acp',
        source: 'weixin',
        channelChatId: 'chat-wx-1',
        extra: expect.objectContaining({
          backend: 'claude',
          customAgentId: 'claude-custom-1',
          agentName: 'Claude Code',
        }),
      })
    );
    expect(mockSessionManager.createSessionWithConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: BASE_CHANNEL_USER.id }),
      'conv-new-1',
      'acp',
      undefined,
      'chat-wx-1'
    );
  });

  it('returns an error when selecting an unavailable agent key', async () => {
    const { handleAgentSelect } = await import('@process/channels/actions/SystemActions');
    const context = createActionContext();

    const result = await handleAgentSelect(context, { agentKey: 'unknown-agent' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or unavailable agent');
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockCreateConversation).not.toHaveBeenCalled();
    expect(mockSessionManager.clearSession).not.toHaveBeenCalled();
  });
});

describe('SystemActions agent show', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockImplementation(async (key: string) => {
      if (key === 'model.config') return [GEMINI_PROVIDER];
      if (key === 'assistant.weixin.agent') return { backend: 'claude', customAgentId: 'claude-custom-1' };
      return undefined;
    });

    mockGetDetectedAgents.mockReturnValue([
      {
        backend: 'claude',
        name: 'Claude Code',
        customAgentId: 'claude-custom-1',
      },
    ]);
  });

  it('shows current agent based on saved platform agent config', async () => {
    const { handleAgentShow } = await import('@process/channels/actions/SystemActions');
    const context = createActionContext();

    const result = await handleAgentShow(context);

    expect(result.success).toBe(true);
    expect(result.message?.text).toContain('Current: <b>🧠 Claude Code</b>');
    expect(result.message?.replyMarkup).toBeDefined();
  });
});
