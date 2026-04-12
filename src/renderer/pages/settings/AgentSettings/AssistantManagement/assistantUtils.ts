import { ASSISTANT_PRESETS } from '@/common/config/presets/assistantPresets';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import type {
  AssistantBadge,
  AssistantListItem,
  HookInfo,
  PendingSkill,
  RelevantAssistantHook,
  RelevantAssistantSkill,
  SkillInfo,
} from './types';

/**
 * Check if a builtin assistant has skills config (defaultEnabledSkills or skillFiles).
 */
export const hasBuiltinSkills = (assistantId: string): boolean => {
  if (!assistantId.startsWith('builtin-')) return false;
  const presetId = assistantId.replace('builtin-', '');
  const preset = ASSISTANT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  const hasDefaultSkills = preset.defaultEnabledSkills && preset.defaultEnabledSkills.length > 0;
  const hasSkillFiles = preset.skillFiles && Object.keys(preset.skillFiles).length > 0;
  return Boolean(hasDefaultSkills || hasSkillFiles);
};

/**
 * Check if a string is an emoji (simple check for common emoji patterns).
 */
export const isEmoji = (str: string): boolean => {
  if (!str) return false;
  const emojiRegex =
    /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;
  return emojiRegex.test(str);
};

/**
 * Resolve an avatar string to an image src URL, or undefined if it is not an image.
 */
export const resolveAvatarImageSrc = (
  avatar: string | undefined,
  avatarImageMap: Record<string, string>
): string | undefined => {
  const value = avatar?.trim();
  if (!value) return undefined;

  const mapped = avatarImageMap[value];
  if (mapped) return mapped;

  const resolved = resolveExtensionAssetUrl(value) || value;
  const isImage =
    /\.(svg|png|jpe?g|webp|gif)$/i.test(resolved) || /^(https?:|contextgo-asset:\/\/|file:\/\/|data:)/i.test(resolved);
  return isImage ? resolved : undefined;
};

/**
 * Sort assistants according to ASSISTANT_PRESETS order.
 */
export const sortAssistants = (agents: AssistantListItem[]): AssistantListItem[] => {
  const presetOrder = ASSISTANT_PRESETS.map((preset) => `builtin-${preset.id}`);
  return agents
    .filter((agent) => agent.isPreset)
    .toSorted((a, b) => {
      const indexA = presetOrder.indexOf(a.id);
      const indexB = presetOrder.indexOf(b.id);
      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }
      return 0;
    });
};

/**
 * Normalize raw extension assistant records into typed AssistantListItem[].
 */
export const normalizeExtensionAssistants = (extensionAssistants: Record<string, unknown>[]): AssistantListItem[] => {
  if (!Array.isArray(extensionAssistants) || extensionAssistants.length === 0) return [];

  return extensionAssistants
    .map((ext) => {
      const id = typeof ext.id === 'string' ? ext.id : '';
      const name = typeof ext.name === 'string' ? ext.name : '';
      if (!id || !name) return null;

      return {
        id,
        name,
        nameI18n: ext.nameI18n as Record<string, string> | undefined,
        description: typeof ext.description === 'string' ? ext.description : undefined,
        descriptionI18n: ext.descriptionI18n as Record<string, string> | undefined,
        avatar: typeof ext.avatar === 'string' ? ext.avatar : undefined,
        presetAgentType: typeof ext.presetAgentType === 'string' ? ext.presetAgentType : undefined,
        context: typeof ext.context === 'string' ? ext.context : undefined,
        contextI18n: ext.contextI18n as Record<string, string> | undefined,
        models: Array.isArray(ext.models) ? (ext.models as string[]) : undefined,
        enabledSkills: Array.isArray(ext.enabledSkills) ? (ext.enabledSkills as string[]) : undefined,
        enabledHooks: Array.isArray(ext.enabledHooks) ? (ext.enabledHooks as string[]) : undefined,
        prompts: Array.isArray(ext.prompts) ? (ext.prompts as string[]) : undefined,
        promptsI18n: ext.promptsI18n as Record<string, string[]> | undefined,
        isPreset: true,
        isBuiltin: false,
        enabled: true,
        _source: 'extension',
        _extensionName: typeof ext._extensionName === 'string' ? ext._extensionName : undefined,
        _kind: typeof ext._kind === 'string' ? ext._kind : undefined,
      } as AssistantListItem;
    })
    .filter((item): item is AssistantListItem => item !== null);
};

/**
 * Check if an assistant originates from an extension.
 */
export const isExtensionAssistant = (assistant: AssistantListItem | null | undefined): boolean => {
  if (!assistant) return false;
  return assistant._source === 'extension' || assistant.id.startsWith('ext-');
};

export const getAssistantBadges = (
  assistant: AssistantListItem,
  localeKey: string,
  t: (key: string, options?: Record<string, unknown>) => string
): AssistantBadge[] => {
  const badges: AssistantBadge[] = [];

  const harnessLabel = assistant.harnessTagI18n?.[localeKey] || assistant.harnessTagI18n?.['en-US'];
  if (harnessLabel) {
    badges.push({ key: 'harness', label: harnessLabel, tone: 'blue' });
  }

  const domainLabel = assistant.recommendedDomainI18n?.[localeKey] || assistant.recommendedDomainI18n?.['en-US'];
  if (domainLabel) {
    badges.push({ key: 'domain', label: domainLabel, tone: 'green' });
  }

  const workspaceHint =
    assistant.workspaceBootstrapHintI18n?.[localeKey] || assistant.workspaceBootstrapHintI18n?.['en-US'];
  if (workspaceHint) {
    badges.push({
      key: 'workspace',
      label: t('settings.assistantWorkspaceRecommended', { defaultValue: 'Workspace Recommended' }),
      tone: 'gold',
    });
  }

  return badges;
};

export const getRelevantAssistantSkills = ({
  availableSkills,
  selectedSkills,
  pendingSkills,
}: {
  availableSkills: SkillInfo[];
  selectedSkills: string[];
  pendingSkills: PendingSkill[];
}): RelevantAssistantSkill[] => {
  const selectedSkillNames = Array.from(new Set(selectedSkills));

  return selectedSkillNames.map((name) => {
    const pendingSkill = pendingSkills.find((skill) => skill.name === name);
    if (pendingSkill) {
      return {
        name,
        description: pendingSkill.description,
        isCustom: true,
        isPending: true,
      };
    }

    const existingSkill = availableSkills.find((skill) => skill.name === name);
    if (existingSkill) {
      return {
        name,
        description: existingSkill.description,
        compatibility: existingSkill.compatibility,
        dependencyHints: existingSkill.dependencyHints,
        openAIConfig: existingSkill.openAIConfig,
        isCustom: existingSkill.isCustom,
        isPending: false,
      };
    }

    return {
      name,
      description: '',
      compatibility: undefined,
      dependencyHints: undefined,
      openAIConfig: undefined,
      isCustom: false,
      isPending: false,
    };
  });
};

export const getRelevantAssistantHooks = ({
  availableHooks,
  selectedHooks,
}: {
  availableHooks: HookInfo[];
  selectedHooks: string[];
}): RelevantAssistantHook[] => {
  const selectedHookNames = Array.from(new Set(selectedHooks));

  return selectedHookNames.map((name) => {
    const existingHook = availableHooks.find((hook) => hook.name === name);
    if (existingHook) {
      return {
        name,
        description: existingHook.description,
        isCustom: existingHook.isCustom,
        hook: existingHook,
      };
    }

    return {
      name,
      description: '',
      isCustom: false,
      hook: undefined,
    };
  });
};

/**
 * Check whether a hook supports the currently selected backend.
 */
export const isHookSupportedByBackend = (
  hook: Pick<HookInfo, 'supportedBackends'>,
  backend: string | undefined
): boolean => {
  const normalizedBackend = backend?.trim();
  const supportedBackends = hook.supportedBackends
    ?.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!normalizedBackend || !supportedBackends || supportedBackends.length === 0) {
    return true;
  }

  return supportedBackends.includes(normalizedBackend);
};

/**
 * Return selected hook names that are incompatible with the current backend.
 */
export const getIncompatibleHookNames = (
  hooks: HookInfo[],
  selectedHookNames: string[],
  backend: string | undefined
): string[] => {
  const selectedHookSet = new Set(selectedHookNames);

  return hooks
    .filter((hook) => selectedHookSet.has(hook.name) && !isHookSupportedByBackend(hook, backend))
    .map((hook) => hook.name);
};
