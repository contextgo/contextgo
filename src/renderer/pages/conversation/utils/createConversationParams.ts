/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IAssistantConversationCreateParams,
  ICreateConversationParams,
  IGitRepositoryInfo,
} from '@/common/adapter/ipcBridge';
import {
  DEFAULT_WORKFLOW_GROUP_TEMPLATE,
  getWorkflowGroupTemplateDefinition,
  type WorkflowTemplateRole,
  normalizeWorkflowGroupTemplate,
  normalizeWorkflowTemplateMaxIterations,
  normalizeWorkflowTemplateReviewMode,
  normalizeWorkflowTemplateScoreTarget,
} from '@/common/config/group';
import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import { ConfigStorage } from '@/common/config/storage';
import type {
  CollaborationMode,
  CollaborationParticipantRole,
  GroupCollaborationConfig,
  GroupParticipantRole,
  TProviderWithModel,
  WorkflowGroupReviewMode,
  WorkflowGroupTemplate,
  DiscussionGroupMode,
} from '@/common/config/storage';
import type { AcpBackend } from '@/common/types/acpTypes';
import { resolveLocaleKey, uuid } from '@/common/utils';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import { loadPresetAssistantResources } from '@/renderer/utils/model/presetAssistantResources';

export type GroupAssistantInput = {
  type: 'preset-assistant';
  participantKey: string;
  name: string;
  avatar?: string;
  description?: string;
  presetAgentType?: string;
};

export type GroupCliParticipantInput = {
  type: 'cli-agent';
  participantKey: string;
  name: string;
  avatar?: string;
  description?: string;
  agent: AvailableAgent;
};

type GroupParticipantInputBase = {
  role?: GroupParticipantRole;
};

export type GroupParticipantInput =
  | (GroupAssistantInput & GroupParticipantInputBase)
  | (GroupCliParticipantInput & GroupParticipantInputBase);

export type DiscussionGroupAssistantInput = GroupAssistantInput;
export type DiscussionGroupCliParticipantInput = GroupCliParticipantInput;
export type DiscussionGroupParticipantInput = GroupParticipantInput;

export type WorkflowGroupParticipantInput =
  | (GroupAssistantInput & { role: WorkflowTemplateRole })
  | (GroupCliParticipantInput & { role: WorkflowTemplateRole });

const HARNESS_ROLE_ORDER: CollaborationParticipantRole[] = ['planner', 'generator', 'evaluator'];

const resolveGroupCollaboration = (options: {
  collaborationMode?: CollaborationMode;
  gitRepository?: IGitRepositoryInfo;
}): GroupCollaborationConfig => {
  if (options.collaborationMode === 'planner-generator-evaluator') {
    return {
      mode: 'planner-generator-evaluator',
      executionBoundary: {
        type: 'git-repository',
        repositoryRoot: options.gitRepository?.repositoryRoot || '',
        branch: options.gitRepository?.branch ?? null,
        gitDir: options.gitRepository?.gitDir ?? null,
        remoteUrl: options.gitRepository?.remoteUrl ?? null,
      },
    };
  }

  return {
    mode: 'discussion',
    executionBoundary: {
      type: 'workspace',
    },
  };
};

const resolveParticipantRole = (
  collaborationMode: CollaborationMode | undefined,
  participantIndex: number,
  participantRole?: GroupParticipantRole
): GroupParticipantRole | undefined => {
  if (collaborationMode === 'planner-generator-evaluator') {
    return HARNESS_ROLE_ORDER[participantIndex] || 'participant';
  }

  return participantRole;
};

const buildGoogleAuthGeminiModel = (useModel: string, id = GOOGLE_AUTH_PROVIDER_ID): TProviderWithModel => {
  return {
    id,
    name: 'Gemini',
    useModel,
    platform: 'gemini-with-google-auth' as TProviderWithModel['platform'],
    baseUrl: '',
    apiKey: '',
  };
};

/**
 * Get the default Gemini model configuration from user settings.
 * Throws if no enabled provider or model is configured.
 * [BUG-3 fix]: callers must call this inside a try block.
 */
export async function getDefaultGeminiModel(): Promise<TProviderWithModel> {
  const providers = await ConfigStorage.get('model.config');

  if (providers && providers.length > 0) {
    const enabledProvider = providers.find((p) => p.enabled !== false);
    const enabledModel = enabledProvider?.model.find((m) => enabledProvider.modelEnabled?.[m] !== false);

    if (enabledProvider && (enabledModel || enabledProvider.model[0])) {
      return {
        id: enabledProvider.id,
        platform: enabledProvider.platform,
        name: enabledProvider.name,
        baseUrl: enabledProvider.baseUrl,
        apiKey: enabledProvider.apiKey,
        useModel: enabledModel || enabledProvider.model[0],
        capabilities: enabledProvider.capabilities,
        contextLimit: enabledProvider.contextLimit,
        modelProtocols: enabledProvider.modelProtocols,
        bedrockConfig: enabledProvider.bedrockConfig,
        enabled: enabledProvider.enabled,
        modelEnabled: enabledProvider.modelEnabled,
        modelHealth: enabledProvider.modelHealth,
      };
    }
  }

  const savedDefaultModel = await ConfigStorage.get('gemini.defaultModel');
  if (typeof savedDefaultModel === 'string' && savedDefaultModel) {
    return buildGoogleAuthGeminiModel(savedDefaultModel);
  }
  if (
    savedDefaultModel &&
    typeof savedDefaultModel === 'object' &&
    'useModel' in savedDefaultModel &&
    typeof savedDefaultModel.useModel === 'string' &&
    savedDefaultModel.useModel
  ) {
    return buildGoogleAuthGeminiModel(savedDefaultModel.useModel, savedDefaultModel.id || GOOGLE_AUTH_PROVIDER_ID);
  }

  throw new Error('No Gemini model configured');
}

/**
 * Determine the conversation type from a CLI agent's backend.
 * Current creation flows only emit product conversation types.
 */
export function getConversationTypeForBackend(backend: string): ICreateConversationParams['type'] {
  return backend === 'gemini' ? 'gemini' : 'acp';
}

/**
 * Determine the conversation type from a preset assistant's presetAgentType.
 * ACP-routed types include claude, opencode, and codex.
 */
export function getConversationTypeForPreset(presetAgentType: string): ICreateConversationParams['type'] {
  return presetAgentType && presetAgentType !== 'gemini' ? 'acp' : 'gemini';
}

/**
 * Build ICreateConversationParams for a CLI agent.
 * The backend will automatically fill in derived fields.
 */
export async function buildCliAgentParams(
  agent: AvailableAgent,
  workspace: string,
  spaceId?: string
): Promise<ICreateConversationParams> {
  const { backend, name: agentName, cliPath } = agent;
  const requestedWorkspace = workspace.trim();
  const agentWorkspace = typeof agent.workspace === 'string' ? agent.workspace.trim() : '';
  const resolvedWorkspace = requestedWorkspace || agentWorkspace;

  const type = getConversationTypeForBackend(backend);

  const extra: ICreateConversationParams['extra'] = {
    spaceId,
    workspace: resolvedWorkspace,
    customWorkspace: true,
    nativeWorkspaceBootstrap: Boolean(resolvedWorkspace.trim()),
  };

  if (type === 'acp') {
    extra.backend = backend;
    extra.agentName = agentName;
    if (cliPath) {
      extra.cliPath = cliPath;
    }
  }

  const model: TProviderWithModel =
    type === 'gemini'
      ? {
          id: 'gemini-placeholder',
          name: 'Gemini',
          useModel: 'default',
          platform: 'gemini-with-google-auth' as TProviderWithModel['platform'],
          baseUrl: '',
          apiKey: '',
        }
      : ({} as TProviderWithModel);

  return { type, model, name: agentName, extra };
}

/**
 * Build ICreateConversationParams for a preset assistant.
 */
export async function buildPresetAssistantParams(
  agent: AvailableAgent,
  workspace: string,
  language: string,
  spaceId?: string
): Promise<ICreateConversationParams> {
  const { customAgentId, presetAgentType = 'gemini' } = agent;
  const localeKey = resolveLocaleKey(language);

  const {
    rules: presetContext,
    enabledSkills,
    enabledHooks,
  } = await loadPresetAssistantResources({
    customAgentId,
    localeKey,
  });

  const type = getConversationTypeForPreset(presetAgentType);

  const extra: ICreateConversationParams['extra'] = {
    spaceId,
    workspace,
    customWorkspace: true,
    nativeWorkspaceBootstrap: Boolean(workspace.trim()),
    enabledSkills,
    enabledHooks,
    presetAssistantId: customAgentId,
  };

  if (type === 'gemini') {
    extra.presetRules = presetContext;
  } else {
    extra.presetContext = presetContext;
    if (type === 'acp') {
      extra.backend = presetAgentType as AcpBackend;
    }
  }

  const model = type === 'gemini' ? await getDefaultGeminiModel() : ({} as TProviderWithModel);
  return { type, model, name: agent.name, extra };
}

export const createGroupPlaceholderModel = (): TProviderWithModel => {
  return {
    id: 'group-placeholder',
    name: 'Group',
    useModel: 'group',
    platform: 'group' as TProviderWithModel['platform'],
    baseUrl: '',
    apiKey: '',
  } as TProviderWithModel;
};

export const createDiscussionGroupPlaceholderModel = createGroupPlaceholderModel;

const buildGroupParticipants = async (options: {
  spaceId?: string;
  workspace?: string;
  language: string;
  participants: GroupParticipantInput[];
  collaborationMode?: CollaborationMode;
}) => {
  const customWorkspace = Boolean(options.workspace?.trim());
  const normalizedWorkspace = options.workspace?.trim() || undefined;

  return Promise.all(
    options.participants.map(async (participant, participantIndex) => {
      const conversation =
        participant.type === 'preset-assistant'
          ? ((await buildPresetAssistantParams(
              {
                backend: 'custom',
                name: participant.name,
                customAgentId: participant.participantKey,
                isPreset: true,
                presetAgentType: participant.presetAgentType,
              },
              normalizedWorkspace || '',
              options.language,
              options.spaceId
            )) as IAssistantConversationCreateParams)
          : ((await buildCliAgentParams(
              participant.agent,
              normalizedWorkspace || '',
              options.spaceId
            )) as IAssistantConversationCreateParams);

      return {
        id: uuid(),
        participantType: participant.type,
        participantKey: participant.participantKey,
        assistantId: participant.type === 'preset-assistant' ? participant.participantKey : undefined,
        name: participant.name,
        avatar: participant.avatar,
        description: participant.description,
        role: resolveParticipantRole(options.collaborationMode, participantIndex, participant.role),
        conversation: {
          ...conversation,
          name: participant.name,
          extra: {
            ...conversation.extra,
            workspace: normalizedWorkspace,
            customWorkspace,
          },
        },
      };
    })
  );
};

export async function buildDiscussionGroupParams(options: {
  name: string;
  spaceId?: string;
  workspace?: string;
  language: string;
  mode: DiscussionGroupMode;
  participants: GroupParticipantInput[];
  collaborationMode?: CollaborationMode;
  gitRepository?: IGitRepositoryInfo;
}): Promise<ICreateConversationParams> {
  const customWorkspace = Boolean(options.workspace?.trim());
  const normalizedWorkspace = options.workspace?.trim() || undefined;
  const participants = await buildGroupParticipants({
    spaceId: options.spaceId,
    workspace: options.workspace,
    language: options.language,
    participants: options.participants,
    collaborationMode: options.collaborationMode,
  });
  const collaboration = resolveGroupCollaboration({
    collaborationMode: options.collaborationMode,
    gitRepository: options.gitRepository,
  });

  return {
    type: 'group',
    model: createGroupPlaceholderModel(),
    name: options.name,
    extra: {
      spaceId: options.spaceId,
      workspace: normalizedWorkspace,
      customWorkspace,
      participants,
      orchestration: {
        kind: 'discussion',
        mode: options.mode,
        rounds: options.mode === 'debate' ? 2 : 1,
      },
      collaboration,
    },
  };
}

export async function buildWorkflowGroupParams(options: {
  name: string;
  spaceId?: string;
  workspace?: string;
  language: string;
  template?: WorkflowGroupTemplate;
  participants: WorkflowGroupParticipantInput[];
  maxIterations?: number;
  scoreTarget?: number;
  artifactPath?: string;
  reviewMode?: WorkflowGroupReviewMode;
}): Promise<ICreateConversationParams> {
  const customWorkspace = Boolean(options.workspace?.trim());
  const normalizedWorkspace = options.workspace?.trim() || undefined;
  const template = normalizeWorkflowGroupTemplate(options.template || DEFAULT_WORKFLOW_GROUP_TEMPLATE);
  const templateDefinition = getWorkflowGroupTemplateDefinition(template);
  const participants = await buildGroupParticipants({
    spaceId: options.spaceId,
    workspace: options.workspace,
    language: options.language,
    participants: options.participants,
  });

  return {
    type: 'group',
    model: createGroupPlaceholderModel(),
    name: options.name,
    extra: {
      spaceId: options.spaceId,
      workspace: normalizedWorkspace,
      customWorkspace,
      participants,
      orchestration: {
        kind: 'workflow',
        template,
        maxIterations: normalizeWorkflowTemplateMaxIterations(options.maxIterations, template),
        scoreTarget: normalizeWorkflowTemplateScoreTarget(options.scoreTarget, template),
        artifactPath: options.artifactPath?.trim() || templateDefinition.defaults.artifactPath,
        reviewMode: normalizeWorkflowTemplateReviewMode(options.reviewMode, template),
      },
    },
  };
}
