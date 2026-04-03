/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { ipcBridge } from '@/common';
import { useAssistantList } from '@/renderer/hooks/assistant';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import {
  AVAILABLE_AGENTS_SWR_KEY,
  buildConversationPresetAssistants,
  filterAvailableAgentsForUi,
  splitConversationDropdownAgents,
} from '@/renderer/utils/model/availableAgents';

export type UseConversationAgentsResult = {
  /** CLI Agents (non-custom, non-preset backends) */
  cliAgents: AvailableAgent[];
  /** Preset assistants (isPreset === true) */
  presetAssistants: AvailableAgent[];
  /** Loading state */
  isLoading: boolean;
  /** Refresh data */
  refresh: () => Promise<void>;
};

/**
 * Hook to fetch available CLI agents and preset assistants for the conversation tab dropdown.
 */
export const useConversationAgents = (): UseConversationAgentsResult => {
  const { assistants, localeKey } = useAssistantList();
  const {
    data: availableAgents,
    isLoading,
    mutate,
  } = useSWR(AVAILABLE_AGENTS_SWR_KEY, async () => {
    const result = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    if (result.success) {
      return filterAvailableAgentsForUi(result.data);
    }
    return [];
  });

  const { cliAgents, presetAssistants } = useMemo(() => {
    const resolvedPresetAssistants = buildConversationPresetAssistants(assistants, localeKey);

    if (!availableAgents) {
      return { cliAgents: [], presetAssistants: resolvedPresetAssistants };
    }

    const { cliAgents } = splitConversationDropdownAgents(availableAgents);
    return { cliAgents, presetAssistants: resolvedPresetAssistants };
  }, [assistants, availableAgents, localeKey]);

  const refresh = async () => {
    await mutate();
  };

  return {
    cliAgents,
    presetAssistants,
    isLoading,
    refresh,
  };
};
