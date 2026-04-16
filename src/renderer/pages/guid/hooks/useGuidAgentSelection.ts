/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider } from '@/common/config/storage';
import { ConfigStorage } from '@/common/config/storage';
import { getAgentModes } from '@/renderer/utils/model/agentModes';
import { filterAvailableAgentsForUi } from '@/renderer/utils/model/availableAgents';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type {
  AcpBackend,
  AcpBackendConfig,
  AcpModelInfo,
  AvailableAgent,
  EffectiveAgentInfo,
  GuidLocationState,
} from '../types';
import {
  getBackendFromAgentKey,
  getAgentKey as getAgentKeyUtil,
  savePreferredMode,
  savePreferredModelId,
} from './agentSelectionUtils';
import { useAgentAvailability } from './useAgentAvailability';
import { useCustomAgentsLoader } from './useCustomAgentsLoader';
import { usePresetAssistantResolver } from './usePresetAssistantResolver';

export type GuidAgentSelectionResult = {
  selectedAgentKey: string;
  setSelectedAgentKey: (key: string) => void;
  selectedAgent: AcpBackend | 'custom';
  selectedAgentInfo: AvailableAgent | undefined;
  selectedAssistantKey: string | null;
  setSelectedAssistantKey: React.Dispatch<React.SetStateAction<string | null>>;
  selectedAssistantInfo: AvailableAgent | undefined;
  isPresetAgent: boolean;
  availableAgents: AvailableAgent[] | undefined;
  customAgents: AcpBackendConfig[];
  selectedMode: string;
  setSelectedMode: React.Dispatch<React.SetStateAction<string>>;
  acpCachedModels: Record<string, AcpModelInfo>;
  selectedAcpModel: string | null;
  setSelectedAcpModel: React.Dispatch<React.SetStateAction<string | null>>;
  currentAcpCachedModelInfo: AcpModelInfo | null;
  currentEffectiveAgentInfo: EffectiveAgentInfo;
  getAgentKey: (agent: { backend: AcpBackend; customAgentId?: string }) => string;
  findAgentByKey: (key: string) => AvailableAgent | undefined;
  resolvePresetRulesAndSkills: (
    agentInfo: { backend: AcpBackend; customAgentId?: string; context?: string } | undefined
  ) => Promise<{ rules?: string; skills?: string }>;
  resolvePresetContext: (
    agentInfo: { backend: AcpBackend; customAgentId?: string; context?: string } | undefined
  ) => Promise<string | undefined>;
  resolvePresetAgentType: (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined) => string;
  resolveEnabledSkills: (
    agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined
  ) => string[] | undefined;
  resolveEnabledHooks: (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined) => string[] | undefined;
  isMainAgentAvailable: (agentType: string) => boolean;
  getAvailableFallbackAgent: () => string | null;
  getEffectiveAgentType: (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined) => EffectiveAgentInfo;
  refreshCustomAgents: () => Promise<void>;
  customAgentAvatarMap: Map<string, string | undefined>;
};

type UseGuidAgentSelectionOptions = {
  modelList: IProvider[];
  isGoogleAuth: boolean;
  localeKey: string;
  locationState?: GuidLocationState | null;
};

const PROBE_MODEL_INFO_BACKENDS = new Set<AcpBackend>(['claude', 'codex', 'opencode']);

/**
 * Guid page selection state keeps runtime and preset assistant independent.
 */
export const useGuidAgentSelection = ({
  modelList,
  isGoogleAuth,
  localeKey,
  locationState = null,
}: UseGuidAgentSelectionOptions): GuidAgentSelectionResult => {
  const [selectedAgentKey, _setSelectedAgentKey] = useState<string>('gemini');
  const [selectedAssistantKeyState, _setSelectedAssistantKeyState] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>();
  const [selectedMode, _setSelectedMode] = useState<string>('default');
  const selectedAgentRef = useRef<string | null>(null);
  const probedModelBackendsRef = useRef(new Set<string>());
  const [acpCachedModels, setAcpCachedModels] = useState<Record<string, AcpModelInfo>>({});
  const [selectedAcpModel, _setSelectedAcpModel] = useState<string | null>(null);
  const locationPreferredModeRef = useRef<string | null>(locationState?.preferredMode ?? null);
  const locationPreferredModelRef = useRef<string | null>(locationState?.preferredAcpModelId ?? null);

  const normalizedLocationSelection = useMemo(
    () => ({
      preferredAgentKey: typeof locationState?.preferredAgentKey === 'string' ? locationState.preferredAgentKey : null,
      preferredAssistantKey:
        typeof locationState?.preferredAssistantKey === 'string' ? locationState.preferredAssistantKey : null,
    }),
    [locationState?.preferredAgentKey, locationState?.preferredAssistantKey]
  );

  useEffect(() => {
    locationPreferredModeRef.current =
      typeof locationState?.preferredMode === 'string' ? locationState.preferredMode : null;
  }, [locationState?.preferredMode]);

  useEffect(() => {
    locationPreferredModelRef.current =
      typeof locationState?.preferredAcpModelId === 'string' ? locationState.preferredAcpModelId : null;
  }, [locationState?.preferredAcpModelId]);

  const setSelectedAgentKey = useCallback((key: string) => {
    _setSelectedAgentKey(key);
    ConfigStorage.set('guid.lastSelectedAgent', key).catch((error) => {
      console.error('Failed to save selected agent:', error);
    });
  }, []);

  const setSelectedAssistantKey = useCallback((key: React.SetStateAction<string | null>) => {
    _setSelectedAssistantKeyState((prev) => {
      const nextKey = typeof key === 'function' ? key(prev) : key;
      ConfigStorage.set('guid.lastSelectedAssistant', nextKey).catch((error) => {
        console.error('Failed to save selected assistant:', error);
      });
      return nextKey;
    });
  }, []);

  const setSelectedMode = useCallback((mode: React.SetStateAction<string>) => {
    _setSelectedMode((prev) => {
      const newMode = typeof mode === 'function' ? mode(prev) : mode;
      const agentKey = selectedAgentRef.current;
      if (agentKey) {
        void savePreferredMode(agentKey, newMode);
      }
      return newMode;
    });
  }, []);

  const setSelectedAcpModel = useCallback((modelId: React.SetStateAction<string | null>) => {
    _setSelectedAcpModel((prev) => {
      const newModelId = typeof modelId === 'function' ? modelId(prev) : modelId;
      const agentKey = selectedAgentRef.current;
      if (agentKey && agentKey !== 'gemini' && agentKey !== 'custom' && newModelId) {
        void savePreferredModelId(agentKey, newModelId);
      }
      return newModelId;
    });
  }, []);

  const availableCustomAgentIds = useMemo(() => {
    const ids = new Set<string>();
    (availableAgents || []).forEach((agent) => {
      if (agent.backend === 'custom' && agent.customAgentId) {
        ids.add(agent.customAgentId);
      }
    });
    return ids;
  }, [availableAgents]);

  const getAgentKey = getAgentKeyUtil;

  const { customAgents, customAgentAvatarMap, refreshCustomAgents } = useCustomAgentsLoader({
    availableCustomAgentIds,
  });

  const {
    resolvePresetRulesAndSkills,
    resolvePresetContext,
    resolvePresetAgentType,
    resolveEnabledSkills,
    resolveEnabledHooks,
  } = usePresetAssistantResolver({ customAgents, localeKey });

  const { isMainAgentAvailable, getAvailableFallbackAgent, getEffectiveAgentType } = useAgentAvailability({
    modelList,
    isGoogleAuth,
    availableAgents,
    resolvePresetAgentType,
  });

  const findAgentByKey = useCallback(
    (key: string): AvailableAgent | undefined => {
      const foundInAvailable = availableAgents?.find((agent) => getAgentKey(agent) === key);
      if (foundInAvailable) {
        return foundInAvailable;
      }

      if (key.startsWith('custom:')) {
        const customAgentId = key.slice(7);
        const assistant = customAgents.find((agent) => agent.id === customAgentId);
        if (assistant) {
          return {
            backend: 'custom' as AcpBackend,
            name: assistant.name,
            customAgentId: assistant.id,
            isPreset: true,
            context: '',
            avatar: assistant.avatar,
          };
        }
      }

      return undefined;
    },
    [availableAgents, customAgents]
  );

  const selectedAgentInfo = useMemo(() => findAgentByKey(selectedAgentKey), [findAgentByKey, selectedAgentKey]);
  const selectedAssistantInfo = useMemo(
    () => (selectedAssistantKeyState ? findAgentByKey(selectedAssistantKeyState) : undefined),
    [findAgentByKey, selectedAssistantKeyState]
  );
  const selectedAgent = (selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey)) as
    | AcpBackend
    | 'custom';
  const isPresetAgent = Boolean(selectedAssistantInfo?.isPreset);

  const { data: availableAgentsData } = useSWR('acp.agents.available', async () => {
    const result = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    if (result.success) {
      return filterAvailableAgentsForUi(result.data);
    }
    return [];
  });

  useEffect(() => {
    if (availableAgentsData) {
      setAvailableAgents(availableAgentsData);
    }
  }, [availableAgentsData]);

  useEffect(() => {
    if (!availableAgents || availableAgents.length === 0) return;

    let cancelled = false;

    const loadLastSelection = async () => {
      try {
        const [savedAgentKeyValue, savedAssistantKeyValue] = await Promise.all([
          ConfigStorage.get('guid.lastSelectedAgent'),
          ConfigStorage.get('guid.lastSelectedAssistant'),
        ]);
        if (cancelled) return;

        const savedAgentKey = typeof savedAgentKeyValue === 'string' ? savedAgentKeyValue : null;
        const savedAssistantKey = typeof savedAssistantKeyValue === 'string' ? savedAssistantKeyValue : null;

        let nextRuntimeKey: string | null = null;
        if (
          normalizedLocationSelection.preferredAgentKey &&
          !normalizedLocationSelection.preferredAgentKey.startsWith('custom:') &&
          availableAgents.some((agent) => getAgentKey(agent) === normalizedLocationSelection.preferredAgentKey)
        ) {
          nextRuntimeKey = normalizedLocationSelection.preferredAgentKey;
        }

        if (
          !nextRuntimeKey &&
          savedAgentKey &&
          !savedAgentKey.startsWith('custom:') &&
          availableAgents.some((agent) => getAgentKey(agent) === savedAgentKey)
        ) {
          nextRuntimeKey = savedAgentKey;
        }

        const legacyAssistantKey = savedAgentKey?.startsWith('custom:') ? savedAgentKey : null;
        const candidateAssistantKey =
          normalizedLocationSelection.preferredAssistantKey || savedAssistantKey || legacyAssistantKey;
        let nextAssistantKey: string | null = null;

        if (candidateAssistantKey?.startsWith('custom:')) {
          const assistantInfo = findAgentByKey(candidateAssistantKey);
          if (assistantInfo?.isPreset) {
            nextAssistantKey = candidateAssistantKey;
            if (!nextRuntimeKey) {
              const preferredRuntime = resolvePresetAgentType(assistantInfo);
              nextRuntimeKey = availableAgents.some((agent) => getAgentKey(agent) === preferredRuntime)
                ? preferredRuntime
                : getAvailableFallbackAgent() || 'gemini';
            }
          }
        }

        if (nextRuntimeKey) {
          _setSelectedAgentKey(nextRuntimeKey);
        }
        _setSelectedAssistantKeyState(nextAssistantKey);
      } catch (error) {
        console.error('Failed to load Guid selection:', error);
      }
    };

    void loadLastSelection();

    return () => {
      cancelled = true;
    };
  }, [
    availableAgents,
    findAgentByKey,
    getAvailableFallbackAgent,
    normalizedLocationSelection.preferredAgentKey,
    normalizedLocationSelection.preferredAssistantKey,
    resolvePresetAgentType,
  ]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get('acp.cachedModels')
      .then((cached) => {
        if (!isActive) return;
        setAcpCachedModels(cached || {});
      })
      .catch(() => {
        // cached model list is optional
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const backend = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
    if (backend === 'custom' || backend === 'gemini') return;
    if (!PROBE_MODEL_INFO_BACKENDS.has(backend)) return;
    if (acpCachedModels[backend]?.availableModels?.length) return;
    if (probedModelBackendsRef.current.has(backend)) return;

    let cancelled = false;
    probedModelBackendsRef.current.add(backend);

    ipcBridge.acpConversation.probeModelInfo
      .invoke({ backend })
      .then(async (result) => {
        if (cancelled) return;
        const modelInfo = result.success ? result.data?.modelInfo : null;
        if (!modelInfo?.availableModels?.length) {
          probedModelBackendsRef.current.delete(backend);
          return;
        }

        const cached = (await ConfigStorage.get('acp.cachedModels').catch(() => ({}))) || {};
        if (cancelled) return;

        const nextCachedModels = {
          ...cached,
          [backend]: modelInfo,
        };

        setAcpCachedModels((prev) => ({
          ...prev,
          [backend]: modelInfo,
        }));

        await ConfigStorage.set('acp.cachedModels', nextCachedModels).catch((error) => {
          console.error('Failed to save probed ACP model info:', error);
        });
      })
      .catch((error) => {
        probedModelBackendsRef.current.delete(backend);
        console.warn(`[Guid][${backend}] Failed to probe model info:`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [acpCachedModels, selectedAgentInfo, selectedAgentKey]);

  const currentEffectiveAgentInfo = useMemo(() => {
    const runtimeBackend = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
    const agentType = runtimeBackend === 'custom' ? selectedAgentInfo?.presetAgentType || 'custom' : runtimeBackend;
    const isAvailable = runtimeBackend === 'custom' ? Boolean(selectedAgentInfo) : isMainAgentAvailable(agentType);

    return {
      agentType,
      isFallback: false,
      originalType: agentType,
      isAvailable,
    };
  }, [isMainAgentAvailable, selectedAgentInfo, selectedAgentKey]);

  useEffect(() => {
    const backend = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
    if (backend === 'custom') {
      _setSelectedAcpModel(null);
      return;
    }

    const locationPreferredModelId = locationPreferredModelRef.current;
    const matchesLocationRuntime =
      !normalizedLocationSelection.preferredAgentKey ||
      normalizedLocationSelection.preferredAgentKey === selectedAgentKey;
    if (locationPreferredModelId && matchesLocationRuntime) {
      _setSelectedAcpModel(locationPreferredModelId);
      locationPreferredModelRef.current = null;
      return;
    }

    let cancelled = false;

    void ConfigStorage.get('acp.config')
      .then((config) => {
        if (cancelled) return;
        const preferred = (config?.[backend as AcpBackend] as Record<string, unknown>)?.preferredModelId as
          | string
          | undefined;
        if (preferred) {
          _setSelectedAcpModel(preferred);
          return;
        }
        const cachedInfo = acpCachedModels[backend];
        _setSelectedAcpModel(cachedInfo?.currentModelId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        const cachedInfo = acpCachedModels[backend];
        _setSelectedAcpModel(cachedInfo?.currentModelId ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [acpCachedModels, normalizedLocationSelection.preferredAgentKey, selectedAgentInfo, selectedAgentKey]);

  useEffect(() => {
    _setSelectedMode('default');

    const configKey = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
    selectedAgentRef.current = configKey;
    if (!configKey || configKey === 'custom') return;

    const locationPreferredMode = locationPreferredModeRef.current;
    const matchesLocationRuntime =
      !normalizedLocationSelection.preferredAgentKey ||
      normalizedLocationSelection.preferredAgentKey === selectedAgentKey;
    if (locationPreferredMode && matchesLocationRuntime) {
      _setSelectedMode(locationPreferredMode);
      locationPreferredModeRef.current = null;
      return;
    }

    let cancelled = false;

    const loadPreferredMode = async () => {
      try {
        let preferred: string | undefined;
        let yoloMode = false;

        if (configKey === 'gemini') {
          const config = await ConfigStorage.get('gemini.config');
          preferred = config?.preferredMode;
          yoloMode = config?.yoloMode ?? false;
        } else {
          const config = await ConfigStorage.get('acp.config');
          const backendConfig = config?.[configKey as AcpBackend] as Record<string, unknown> | undefined;
          preferred = backendConfig?.preferredMode as string | undefined;
          yoloMode = (backendConfig?.yoloMode as boolean) ?? false;
        }

        if (cancelled) return;

        if (preferred) {
          const modes = getAgentModes(configKey);
          if (modes.some((mode) => mode.value === preferred)) {
            _setSelectedMode(preferred);
            return;
          }
        }

        if (yoloMode) {
          const yoloValues: Record<string, string> = {
            claude: 'bypassPermissions',
            gemini: 'yolo',
            codex: 'yolo',
          };
          _setSelectedMode(yoloValues[configKey] || 'yolo');
        }
      } catch {
        // ignore invalid config
      }
    };

    void loadPreferredMode();

    return () => {
      cancelled = true;
    };
  }, [normalizedLocationSelection.preferredAgentKey, selectedAgentInfo, selectedAgentKey]);

  const currentAcpCachedModelInfo = useMemo(() => {
    const backend = selectedAgentInfo?.backend ?? getBackendFromAgentKey(selectedAgentKey);
    if (backend === 'custom') {
      return null;
    }

    return acpCachedModels[backend] ?? null;
  }, [acpCachedModels, selectedAgentInfo, selectedAgentKey]);

  useEffect(() => {
    if (!availableAgents || availableAgents.length === 0) return;
    if (selectedAgent === 'gemini' && !currentEffectiveAgentInfo.isAvailable) {
      console.log('[Guid] Gemini is not configured. Will check for alternatives when sending.');
    }
  }, [availableAgents, currentEffectiveAgentInfo, selectedAgent]);

  return {
    selectedAgentKey,
    setSelectedAgentKey,
    selectedAgent,
    selectedAgentInfo,
    selectedAssistantKey: selectedAssistantKeyState,
    setSelectedAssistantKey,
    selectedAssistantInfo,
    isPresetAgent,
    availableAgents,
    customAgents,
    selectedMode,
    setSelectedMode,
    acpCachedModels,
    selectedAcpModel,
    setSelectedAcpModel,
    currentAcpCachedModelInfo,
    currentEffectiveAgentInfo,
    getAgentKey,
    findAgentByKey,
    resolvePresetRulesAndSkills,
    resolvePresetContext,
    resolvePresetAgentType,
    resolveEnabledSkills,
    resolveEnabledHooks,
    isMainAgentAvailable,
    getAvailableFallbackAgent,
    getEffectiveAgentType,
    refreshCustomAgents,
    customAgentAvatarMap,
  };
};
