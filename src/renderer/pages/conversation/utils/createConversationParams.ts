/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import {
  type WorkflowTemplateRole,
  getWorkflowGroupTemplateDefinition,
  normalizeWorkflowGroupTemplate,
  normalizeWorkflowTemplateMaxIterations,
  normalizeWorkflowTemplateReviewMode,
  normalizeWorkflowTemplateScoreTarget,
} from '@/common/config/group';
import { ConfigStorage } from '@/common/config/storage';
import type { ICreateConversationParams } from '@/common/adapter/ipcBridge';
import type { IAssistantConversationCreateParams } from '@/common/adapter/ipcBridge';
import type { TProviderWithModel } from '@/common/config/storage';
import type {
  DiscussionGroupMode,
  GroupParticipantRole,
  WorkflowGroupReviewMode,
  WorkflowGroupTemplate,
} from '@/common/config/storage';
import { resolveLocaleKey } from '@/common/utils';
import { loadPresetAssistantResources } from '@/renderer/utils/model/presetAssistantResources';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import type { AcpBackend, AcpBackendAll } from '@/common/types/acpTypes';
import { uuid } from '@/common/utils';

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

export type WorkflowGroupParticipantInput =
  | (GroupAssistantInput & { role: WorkflowTemplateRole })
  | (GroupCliParticipantInput & { role: WorkflowTemplateRole });

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
 * [BUG-3 fix]: callers must call this inside a try block
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
 * codex uses ACP path (type: 'acp' + extra.backend = 'codex').
 */
export function getConversationTypeForBackend(backend: string): ICreateConversationParams['type'] {
  switch (backend) {
    case 'gemini':
      return 'gemini';
    case 'openclaw-gateway':
    case 'openclaw':
      return 'openclaw-gateway';
    case 'nanobot':
      return 'nanobot';
    default:
      // claude, qwen, codex, iflow, goose, auggie, kimi, opencode, copilot, qoder, codebuddy, droid, vibe, etc.
      // Note: codex now uses ACP path; legacy 'codex' type is not used for new conversations.
      return 'acp';
  }
}

/**
 * Determine the conversation type from a preset assistant's presetAgentType.
 * ACP-routed types include claude, codebuddy, opencode, qwen, codex.
 */
export function getConversationTypeForPreset(presetAgentType: string): ICreateConversationParams['type'] {
  return presetAgentType && presetAgentType !== 'gemini' ? 'acp' : 'gemini';
}

/**
 * Build ICreateConversationParams for a CLI agent.
 * The backend will automatically fill in derived fields (gateway.cliPath, runtimeValidation, etc.).
 * [BUG-3 fix]: callers must invoke this inside a try block because getDefaultGeminiModel may throw.
 */
export async function buildCliAgentParams(
  agent: AvailableAgent,
  workspace: string
): Promise<ICreateConversationParams> {
  const { backend, name: agentName, cliPath } = agent;
  const resolvedWorkspace = backend === 'openclaw-gateway' ? agent.workspace || workspace : workspace;

  const type = getConversationTypeForBackend(backend);

  const extra: ICreateConversationParams['extra'] = {
    workspace: resolvedWorkspace,
    customWorkspace: true,
  };

  if (type === 'acp' || type === 'openclaw-gateway') {
    extra.backend = backend as AcpBackendAll;
    extra.agentName = agentName;
    if (cliPath) extra.cliPath = cliPath;
    if (backend === 'openclaw-gateway') {
      extra.openclawAgentId = agent.openclawAgentId;
    }
  }

  // Gemini type uses a placeholder model (matching Guid page behavior in useGuidSend).
  // The Guid page uses currentModel || placeholderModel, so Gemini does NOT require
  // a configured model provider - it works with Google auth instead.
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
 * Applies 4-layer fallback for reading rules and skills (BUG-1 fix).
 * Uses resolveLocaleKey() to convert i18n.language to standard locale format (BUG-2 fix).
 * [BUG-3 fix]: callers must invoke this inside a try block because getDefaultGeminiModel may throw.
 */
export async function buildPresetAssistantParams(
  agent: AvailableAgent,
  workspace: string,
  language: string
): Promise<ICreateConversationParams> {
  const { customAgentId, presetAgentType = 'gemini' } = agent;

  // [BUG-2] Map raw i18n.language to standard locale key
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
    workspace,
    customWorkspace: true,
    enabledSkills,
    enabledHooks,
    presetAssistantId: customAgentId,
  };

  if (type === 'gemini') {
    // gemini uses presetRules field
    extra.presetRules = presetContext;
  } else {
    // acp uses presetContext field
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

const buildGroupParticipants = async (options: {
  workspace?: string;
  language: string;
  participants: GroupParticipantInput[];
}) => {
  const customWorkspace = Boolean(options.workspace?.trim());
  const normalizedWorkspace = options.workspace?.trim() || undefined;

  return Promise.all(
    options.participants.map(async (participant) => {
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
              options.language
            )) as IAssistantConversationCreateParams)
          : ((await buildCliAgentParams(
              participant.agent,
              normalizedWorkspace || ''
            )) as IAssistantConversationCreateParams);

      return {
        id: uuid(),
        participantType: participant.type,
        participantKey: participant.participantKey,
        assistantId: participant.type === 'preset-assistant' ? participant.participantKey : undefined,
        name: participant.name,
        avatar: participant.avatar,
        description: participant.description,
        role: participant.role,
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
  workspace?: string;
  language: string;
  mode: DiscussionGroupMode;
  participants: GroupParticipantInput[];
}): Promise<ICreateConversationParams> {
  const customWorkspace = Boolean(options.workspace?.trim());
  const normalizedWorkspace = options.workspace?.trim() || undefined;
  const participants = await buildGroupParticipants({
    workspace: options.workspace,
    language: options.language,
    participants: options.participants,
  });

  return {
    type: 'group',
    model: createGroupPlaceholderModel(),
    name: options.name,
    extra: {
      workspace: normalizedWorkspace,
      customWorkspace,
      participants,
      orchestration: {
        kind: 'discussion',
        mode: options.mode,
        rounds: options.mode === 'debate' ? 2 : 1,
      },
    },
  };
}

export async function buildWorkflowGroupParams(options: {
  name: string;
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
  const template = normalizeWorkflowGroupTemplate(options.template);
  const templateDefinition = getWorkflowGroupTemplateDefinition(template);
  const participants = await buildGroupParticipants({
    workspace: options.workspace,
    language: options.language,
    participants: options.participants,
  });

  return {
    type: 'group',
    model: createGroupPlaceholderModel(),
    name: options.name,
    extra: {
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
