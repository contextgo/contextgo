/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { IProvider } from '../../src/common/config/storage';
import type { AcpBackendConfig, AcpModelInfo, AvailableAgent } from '../../src/renderer/pages/guid/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configStorageMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
}));

const ipcMock = vi.hoisted(() => ({
  getAvailableAgents: vi.fn(),
  probeModelInfo: vi.fn(),
  refreshCustomAgents: vi.fn().mockResolvedValue(undefined),
  getAssistants: vi.fn(),
}));

vi.mock('../../src/common', () => ({
  ipcBridge: {
    acpConversation: {
      getAvailableAgents: { invoke: ipcMock.getAvailableAgents },
      probeModelInfo: { invoke: ipcMock.probeModelInfo },
      refreshCustomAgents: { invoke: ipcMock.refreshCustomAgents },
    },
    extensions: {
      getAssistants: { invoke: ipcMock.getAssistants },
    },
  },
}));

vi.mock('../../src/common/config/storage', () => ({
  ConfigStorage: configStorageMock,
}));

vi.mock('../../src/common/config/presets/assistantPresets', () => ({
  ASSISTANT_PRESETS: [],
}));

vi.mock('../../src/common/types/codex/codexModels', () => ({
  DEFAULT_CODEX_MODELS: [],
}));

let swrData: Record<string, unknown> = {};

function resetSwrCache() {
  swrData = {};
}

vi.mock('swr', () => ({
  default: (key: string, fetcher: () => Promise<unknown>) => {
    if (!(key in swrData)) {
      swrData[key] = undefined;
      fetcher()
        .then((data) => {
          swrData[key] = data;
        })
        .catch(() => {});
    }
    return { data: swrData[key], error: undefined, mutate: vi.fn() };
  },
  mutate: vi.fn(),
}));

vi.mock('../../src/renderer/utils/model/agentModes', () => ({
  getAgentModes: (backend?: string) => {
    if (backend === 'claude') {
      return [
        { value: 'default', label: 'Default' },
        { value: 'bypassPermissions', label: 'Bypass Permissions' },
      ];
    }
    return [
      { value: 'default', label: 'Default' },
      { value: 'yolo', label: 'YOLO' },
    ];
  },
  supportsModeSwitch: () => true,
}));

import { useGuidAgentSelection } from '../../src/renderer/pages/guid/hooks/useGuidAgentSelection';

const PRESET_AGENT_ID = 'cowork';

const AVAILABLE_AGENTS: AvailableAgent[] = [
  { backend: 'gemini', name: 'Gemini' },
  { backend: 'claude', name: 'Claude' },
  { backend: 'codex', name: 'Codex' },
  { backend: 'custom', name: 'Cowork Assistant', customAgentId: PRESET_AGENT_ID, isPreset: true },
];

const OPENCLAW_AGENTS: AvailableAgent[] = [
  {
    backend: 'openclaw-gateway',
    name: 'OpenClaw',
    openclawAgentId: 'main',
    workspace: '/Users/test/.openclaw/workspace',
  },
  {
    backend: 'openclaw-gateway',
    name: 'Reviewer (reviewer)',
    openclawAgentId: 'reviewer',
    workspace: '/Users/test/.openclaw/workspace-reviewer',
  },
];

const CUSTOM_AGENTS: AcpBackendConfig[] = [
  {
    id: PRESET_AGENT_ID,
    name: 'Cowork Assistant',
    isPreset: true,
    enabled: true,
    presetAgentType: 'claude',
  } as AcpBackendConfig,
];

const CLAUDE_CACHED_MODEL: AcpModelInfo = {
  source: 'models',
  currentModelId: 'claude-sonnet-4-5-20250514',
  currentModelLabel: 'Claude Sonnet 4.5',
  availableModels: [
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-5-20250514', label: 'Claude Opus 4.5' },
  ],
  canSwitch: true,
};

const CODEx_CACHED_MODEL: AcpModelInfo = {
  source: 'models',
  currentModelId: 'codex-latest',
  currentModelLabel: 'Codex Latest',
  availableModels: [{ id: 'codex-latest', label: 'Codex Latest' }],
  canSwitch: true,
};

const MODEL_LIST: IProvider[] = [
  {
    id: 'p1',
    name: 'Test Provider',
    platform: 'openai',
    baseUrl: '',
    apiKey: 'k',
    model: ['gpt-4'],
  } as IProvider,
];

function setupMocks(overrides?: {
  availableAgents?: AvailableAgent[];
  cachedModels?: Record<string, AcpModelInfo>;
  acpConfig?: Record<string, unknown>;
  geminiConfig?: Record<string, unknown>;
  lastSelectedAgent?: string | null;
  lastSelectedAssistant?: string | null;
}) {
  const availableAgents = overrides?.availableAgents ?? AVAILABLE_AGENTS;
  const cachedModels = overrides?.cachedModels ?? { claude: CLAUDE_CACHED_MODEL, codex: CODEx_CACHED_MODEL };
  const acpConfig = overrides?.acpConfig ?? { claude: { preferredMode: 'bypassPermissions' } };
  const geminiConfig = overrides?.geminiConfig ?? {};
  const lastSelectedAgent = overrides?.lastSelectedAgent ?? null;
  const lastSelectedAssistant = overrides?.lastSelectedAssistant ?? null;

  ipcMock.getAvailableAgents.mockResolvedValue({ success: true, data: availableAgents });
  ipcMock.probeModelInfo.mockResolvedValue({ success: false });
  ipcMock.getAssistants.mockResolvedValue([]);

  configStorageMock.get.mockImplementation(async (key: string) => {
    switch (key) {
      case 'acp.cachedModels':
        return cachedModels;
      case 'acp.customAgents':
        return CUSTOM_AGENTS;
      case 'guid.lastSelectedAgent':
        return lastSelectedAgent;
      case 'guid.lastSelectedAssistant':
        return lastSelectedAssistant;
      case 'acp.config':
        return acpConfig;
      case 'gemini.config':
        return geminiConfig;
      case 'gemini.defaultModel':
        return null;
      default:
        return null;
    }
  });
}

describe('useGuidAgentSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSwrCache();
    setupMocks();
  });

  const hookOptions = {
    modelList: MODEL_LIST,
    isGoogleAuth: false,
    localeKey: 'en-US',
  };

  it('keeps the selected runtime when choosing a preset assistant', async () => {
    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.availableAgents).toBeDefined();
    });

    act(() => {
      result.current.setSelectedAgentKey('claude');
    });

    await waitFor(() => {
      expect(result.current.selectedMode).toBe('bypassPermissions');
    });

    act(() => {
      result.current.setSelectedAssistantKey(`custom:${PRESET_AGENT_ID}`);
    });

    await waitFor(() => {
      expect(result.current.selectedAssistantKey).toBe(`custom:${PRESET_AGENT_ID}`);
    });

    expect(result.current.selectedAgentKey).toBe('claude');
    expect(result.current.selectedAgent).toBe('claude');
    expect(result.current.isPresetAgent).toBe(true);
    expect(result.current.currentAcpCachedModelInfo?.currentModelId).toBe('claude-sonnet-4-5-20250514');
  });

  it('keeps the selected assistant when switching runtime', async () => {
    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.availableAgents).toBeDefined();
    });

    act(() => {
      result.current.setSelectedAssistantKey(`custom:${PRESET_AGENT_ID}`);
    });

    act(() => {
      result.current.setSelectedAgentKey('codex');
    });

    await waitFor(() => {
      expect(result.current.selectedAgentKey).toBe('codex');
    });

    expect(result.current.selectedAssistantKey).toBe(`custom:${PRESET_AGENT_ID}`);
    expect(result.current.selectedAssistantInfo?.customAgentId).toBe(PRESET_AGENT_ID);
    expect(result.current.selectedAgent).toBe('codex');
    expect(result.current.currentAcpCachedModelInfo?.currentModelId).toBe('codex-latest');
  });

  it('restores a legacy preset selection as assistant and derives its runtime', async () => {
    setupMocks({
      lastSelectedAgent: `custom:${PRESET_AGENT_ID}`,
      lastSelectedAssistant: null,
    });

    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.selectedAssistantKey).toBe(`custom:${PRESET_AGENT_ID}`);
    });

    expect(result.current.selectedAgentKey).toBe('claude');
    expect(result.current.selectedAgent).toBe('claude');
    expect(result.current.isPresetAgent).toBe(true);
  });

  it('restores runtime and assistant independently from persisted state', async () => {
    setupMocks({
      availableAgents: [...AVAILABLE_AGENTS, ...OPENCLAW_AGENTS],
      lastSelectedAgent: 'openclaw-gateway:reviewer',
      lastSelectedAssistant: `custom:${PRESET_AGENT_ID}`,
    });

    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.selectedAgentKey).toBe('openclaw-gateway:reviewer');
    });

    expect(result.current.selectedAssistantKey).toBe(`custom:${PRESET_AGENT_ID}`);
    expect(result.current.selectedAgentInfo).toMatchObject({
      backend: 'openclaw-gateway',
      openclawAgentId: 'reviewer',
      workspace: '/Users/test/.openclaw/workspace-reviewer',
    });
    expect(result.current.findAgentByKey('openclaw-gateway:main')).toMatchObject({
      name: 'OpenClaw',
      workspace: '/Users/test/.openclaw/workspace',
    });
  });

  it('saves mode preference under the runtime backend even when an assistant is selected', async () => {
    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.availableAgents).toBeDefined();
    });

    act(() => {
      result.current.setSelectedAgentKey('claude');
      result.current.setSelectedAssistantKey(`custom:${PRESET_AGENT_ID}`);
    });

    configStorageMock.get.mockClear();
    configStorageMock.set.mockClear();
    configStorageMock.get.mockResolvedValue({});

    act(() => {
      result.current.setSelectedMode('bypassPermissions');
    });

    await waitFor(() => {
      const acpConfigCall = configStorageMock.set.mock.calls.find(([key]: [string]) => key === 'acp.config');
      expect(acpConfigCall).toBeDefined();
      const savedConfig = acpConfigCall?.[1] as Record<string, unknown>;
      expect(savedConfig).toHaveProperty('claude');
      expect((savedConfig.claude as Record<string, unknown>).preferredMode).toBe('bypassPermissions');
    });
  });

  it('returns null for runtime model cache when the selected runtime has no cached entry', async () => {
    setupMocks({
      cachedModels: { claude: CLAUDE_CACHED_MODEL },
    });

    const { result } = renderHook(() => useGuidAgentSelection(hookOptions));

    await waitFor(() => {
      expect(result.current.availableAgents).toBeDefined();
    });

    act(() => {
      result.current.setSelectedAgentKey('codex');
      result.current.setSelectedAssistantKey(`custom:${PRESET_AGENT_ID}`);
    });

    await waitFor(() => {
      expect(result.current.selectedAgentKey).toBe('codex');
    });

    expect(result.current.currentAcpCachedModelInfo).toBeNull();
  });
});
