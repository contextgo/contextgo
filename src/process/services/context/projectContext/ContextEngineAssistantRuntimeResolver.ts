/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  findContextEngineSystemAssistantByJobType,
  type ContextEngineSystemAssistantDefinition,
  type ContextEngineSystemAssistantRuntimeSpec,
} from '@/common/config/presets/systemAssistants';
import type { IAgentProfile } from '@process/channels/types';
import type { ContextJob } from '../contextDomain';

const CONTEXT_ENGINE_BACKEND = 'context-engine';

export type ResolvedContextEngineAssistantRuntime = {
  assistant?: ContextEngineSystemAssistantDefinition;
  runtimeSpec: ContextEngineSystemAssistantRuntimeSpec;
  profile: IAgentProfile;
};

function buildFallbackRuntimeSpec(job: ContextJob): ContextEngineSystemAssistantRuntimeSpec {
  const normalizedTriggerKind =
    job.source === 'runtime-hook'
      ? 'hook'
      : job.source === 'conversation-lifecycle'
        ? 'lifecycle'
        : job.source === 'connector-sync'
          ? 'connector'
          : job.source === 'derived'
            ? 'derived'
            : job.source === 'timer'
              ? 'timer'
              : 'manual';

  return {
    executionBoundary: 'space-vault-root',
    triggerKinds: [normalizedTriggerKind],
    promptProfile: {
      role: 'system-maintenance',
      jobType: job.type,
      boundary: 'space-vault-root',
      systemManaged: true,
    },
    toolPolicy: {
      mode: 'space-vault-maintainer',
      allowVaultRead: true,
      allowVaultWrite: true,
      allowContextRead: true,
      allowContextWrite: true,
    },
    memoryPolicy: {
      mode: 'context-engine-managed',
      canPromote: true,
      canDistill: true,
    },
    delegationPolicy: {
      mode: 'system-builtin',
      allowUserMutation: false,
      allowCrossSpaceDelegation: false,
    },
  };
}

export function resolveContextEngineAssistantRuntime(job: ContextJob): ResolvedContextEngineAssistantRuntime {
  const assistant = findContextEngineSystemAssistantByJobType(job.type);
  const runtimeSpec = assistant?.runtimeSpec ?? buildFallbackRuntimeSpec(job);
  const profileId = assistant?.profileId ?? `agent_profile_context_engine_${job.type}`;
  const profileName = assistant?.nameI18n['en-US'] ?? `Context Engine · ${job.type.replace(/_/g, ' ')}`;

  const profile: IAgentProfile = {
    id: profileId,
    name: profileName,
    backend: CONTEXT_ENGINE_BACKEND,
    workspaceRef: job.executionBoundary?.vaultRoot || job.projectSlug,
    promptProfile: {
      ...runtimeSpec.promptProfile,
      executionBoundary: job.executionBoundary,
      trigger: job.trigger,
      spaceId: job.spaceId,
      projectSlug: job.projectSlug,
      threadId: job.threadId,
      systemOwner: assistant?.owner,
      systemRole: assistant?.systemRole,
    },
    toolPolicy: runtimeSpec.toolPolicy,
    memoryPolicy: runtimeSpec.memoryPolicy,
    delegationPolicy: runtimeSpec.delegationPolicy,
    version: 1,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    assistant,
    runtimeSpec,
    profile,
  };
}
