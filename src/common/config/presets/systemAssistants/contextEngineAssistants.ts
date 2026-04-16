import type { BuiltinAssistantSystemRole } from '@/common/types/acpTypes';

export type ContextEngineAssistantJobType =
  | 'session_compaction'
  | 'session_pattern_detection'
  | 'project_promotion'
  | 'space_memory_distillation'
  | 'connector_digest'
  | 'project_capability_curation';

export type ContextEngineAssistantDeliveryStatus = 'live' | 'planned';

export type ContextEngineAssistantTriggerKind = 'hook' | 'lifecycle' | 'timer' | 'connector' | 'manual' | 'derived';

export type ContextEngineExecutionBoundaryKind = 'space-vault-root';

export type ContextEngineSystemAssistantRuntimeSpec = {
  executionBoundary: ContextEngineExecutionBoundaryKind;
  triggerKinds: readonly ContextEngineAssistantTriggerKind[];
  promptProfile: Readonly<Record<string, unknown>>;
  toolPolicy: Readonly<Record<string, unknown>>;
  memoryPolicy: Readonly<Record<string, unknown>>;
  delegationPolicy: Readonly<Record<string, unknown>>;
};

export type ContextEngineSystemAssistantDefinition = {
  id: string;
  owner: 'context-engine';
  systemRole: BuiltinAssistantSystemRole;
  jobType: ContextEngineAssistantJobType;
  profileId: string;
  deliveryStatus: ContextEngineAssistantDeliveryStatus;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  runtimeSpec: ContextEngineSystemAssistantRuntimeSpec;
};

function createRuntimeSpec(input: {
  jobType: ContextEngineAssistantJobType;
  goal: string;
  triggerKinds: readonly ContextEngineAssistantTriggerKind[];
  writesMemory?: boolean;
  writesArtifacts?: boolean;
}): ContextEngineSystemAssistantRuntimeSpec {
  return {
    executionBoundary: 'space-vault-root',
    triggerKinds: input.triggerKinds,
    promptProfile: {
      role: 'system-maintenance',
      jobType: input.jobType,
      goal: input.goal,
      boundary: 'space-vault-root',
      systemManaged: true,
    },
    toolPolicy: {
      mode: input.writesArtifacts ? 'space-vault-maintainer' : 'space-vault-observer',
      allowVaultRead: true,
      allowVaultWrite: input.writesArtifacts !== false,
      allowContextRead: true,
      allowContextWrite: input.writesMemory !== false,
    },
    memoryPolicy: {
      mode: input.writesMemory === false ? 'read-only' : 'context-engine-managed',
      canPromote: input.writesMemory !== false,
      canDistill: input.writesMemory !== false,
    },
    delegationPolicy: {
      mode: 'system-builtin',
      allowUserMutation: false,
      allowCrossSpaceDelegation: false,
    },
  };
}

export const CONTEXT_ENGINE_SYSTEM_ASSISTANTS: readonly ContextEngineSystemAssistantDefinition[] = [
  {
    id: 'system-context-engine-session-compactor',
    owner: 'context-engine',
    systemRole: 'context-engine-session-compactor',
    jobType: 'session_compaction',
    profileId: 'agent_profile_context_engine_session_compactor',
    deliveryStatus: 'live',
    nameI18n: {
      'en-US': 'Session Context Keeper',
      'zh-CN': '会话上下文整理员',
    },
    descriptionI18n: {
      'en-US': 'Condenses long-running session signals into a compact working memory for the next turn.',
      'zh-CN': '把长会话中的信号压缩成下一轮可直接复用的工作记忆。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'session_compaction',
      goal: 'Condense the current session into a compact working set anchored in the space vault.',
      triggerKinds: ['hook', 'lifecycle', 'manual'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
  {
    id: 'system-context-engine-session-pattern-detector',
    owner: 'context-engine',
    systemRole: 'context-engine-session-pattern-detector',
    jobType: 'session_pattern_detection',
    profileId: 'agent_profile_context_engine_session_pattern_detector',
    deliveryStatus: 'planned',
    nameI18n: {
      'en-US': 'Session Pattern Watcher',
      'zh-CN': '会话模式观察员',
    },
    descriptionI18n: {
      'en-US': 'Looks for repeated request patterns, strategy shifts, and interruption clusters across the session.',
      'zh-CN': '持续观察重复诉求、策略转向和中断聚集等会话模式。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'session_pattern_detection',
      goal: 'Detect repeated session patterns and annotate the space context with durable behavioral signals.',
      triggerKinds: ['hook', 'timer', 'manual'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
  {
    id: 'system-context-engine-project-promoter',
    owner: 'context-engine',
    systemRole: 'context-engine-project-promoter',
    jobType: 'project_promotion',
    profileId: 'agent_profile_context_engine_project_promoter',
    deliveryStatus: 'live',
    nameI18n: {
      'en-US': 'Project Knowledge Promoter',
      'zh-CN': '项目知识推进员',
    },
    descriptionI18n: {
      'en-US': 'Promotes stable takeaways from session scope into reusable project knowledge.',
      'zh-CN': '把已经稳定的会话结论推进到项目层，形成可复用知识。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'project_promotion',
      goal: 'Promote stable session outcomes into reusable project knowledge inside the same space vault.',
      triggerKinds: ['derived', 'manual'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
  {
    id: 'system-context-engine-space-memory-distiller',
    owner: 'context-engine',
    systemRole: 'context-engine-space-memory-distiller',
    jobType: 'space_memory_distillation',
    profileId: 'agent_profile_context_engine_space_memory_distiller',
    deliveryStatus: 'planned',
    nameI18n: {
      'en-US': 'Space Memory Distiller',
      'zh-CN': '空间记忆提炼员',
    },
    descriptionI18n: {
      'en-US': 'Rolls project-level findings upward into shared space memory and governance context.',
      'zh-CN': '把项目层结论继续提炼到 Space 级共享记忆与治理上下文。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'space_memory_distillation',
      goal: 'Distill project memory upward into shared space memory and governance notes.',
      triggerKinds: ['timer', 'manual'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
  {
    id: 'system-context-engine-connector-digester',
    owner: 'context-engine',
    systemRole: 'context-engine-connector-digester',
    jobType: 'connector_digest',
    profileId: 'agent_profile_context_engine_connector_digester',
    deliveryStatus: 'planned',
    nameI18n: {
      'en-US': 'Connector Digest Curator',
      'zh-CN': '连接器摘要整理员',
    },
    descriptionI18n: {
      'en-US': 'Digests external connector updates into source-aware context records before promotion.',
      'zh-CN': '先把外部连接器更新整理成带来源的上下文记录，再进入后续沉淀。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'connector_digest',
      goal: 'Digest connector updates into source-aware context records anchored in the current space vault.',
      triggerKinds: ['connector', 'timer', 'manual'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
  {
    id: 'system-context-engine-project-capability-curator',
    owner: 'context-engine',
    systemRole: 'context-engine-project-capability-curator',
    jobType: 'project_capability_curation',
    profileId: 'agent_profile_context_engine_project_capability_curator',
    deliveryStatus: 'live',
    nameI18n: {
      'en-US': 'Project Capability Curator',
      'zh-CN': '项目能力整理员',
    },
    descriptionI18n: {
      'en-US':
        'Keeps project-local skills, hooks, schedules, and commands mirrored into the vault as first-class context objects.',
      'zh-CN': '把项目本地的 skills、hooks、定时任务和 commands 镜像进 vault，形成一等上下文对象。',
    },
    runtimeSpec: createRuntimeSpec({
      jobType: 'project_capability_curation',
      goal: 'Mirror the project-local capability surface into the same space vault for browsing, graphing, and later evolution.',
      triggerKinds: ['hook', 'timer', 'manual', 'derived'],
      writesMemory: true,
      writesArtifacts: true,
    }),
  },
] as const;

const CONTEXT_ENGINE_SYSTEM_ASSISTANT_BY_ROLE = new Map(
  CONTEXT_ENGINE_SYSTEM_ASSISTANTS.map((assistant) => [assistant.systemRole, assistant])
);

const CONTEXT_ENGINE_SYSTEM_ASSISTANT_BY_JOB_TYPE = new Map(
  CONTEXT_ENGINE_SYSTEM_ASSISTANTS.map((assistant) => [assistant.jobType, assistant])
);

export function findContextEngineSystemAssistantByRole(
  systemRole: string | undefined
): ContextEngineSystemAssistantDefinition | undefined {
  if (!systemRole) {
    return undefined;
  }

  return CONTEXT_ENGINE_SYSTEM_ASSISTANT_BY_ROLE.get(systemRole as BuiltinAssistantSystemRole);
}

export function findContextEngineSystemAssistantByJobType(
  jobType: string | undefined
): ContextEngineSystemAssistantDefinition | undefined {
  if (!jobType) {
    return undefined;
  }

  return CONTEXT_ENGINE_SYSTEM_ASSISTANT_BY_JOB_TYPE.get(jobType as ContextEngineAssistantJobType);
}

export function resolveContextEngineSystemRoleByJobType(
  jobType: string | undefined
): BuiltinAssistantSystemRole | undefined {
  return findContextEngineSystemAssistantByJobType(jobType)?.systemRole;
}

export function resolveContextEngineSystemAssistantRuntimeSpec(
  jobType: string | undefined
): ContextEngineSystemAssistantRuntimeSpec | undefined {
  return findContextEngineSystemAssistantByJobType(jobType)?.runtimeSpec;
}
