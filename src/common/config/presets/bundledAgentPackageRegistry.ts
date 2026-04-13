import path from 'path';
import type {
  AgentPackageDocsPayload,
  AgentPackageHooksPayload,
  AgentPackageManifest,
  AgentPackagePayloadId,
  AgentPackageRulesPayload,
  AgentPackageSchedulesPayload,
  AgentPackageSkillsPayload,
  AgentPackageSourceDescriptor,
  AgentPackageCommandsPayload,
} from '@/common/config/presets/agentPackageManifest';
import { parseAgentPackageManifest } from '@/common/config/presets/agentPackageManifest';
import morphPptManifestRaw from '@/process/resources/assistant/morph-ppt/agent-package.json';
import startupStrategistManifestRaw from '@/process/resources/assistant/startup/startup-strategist/agent-package.json';
import designDirectorManifestRaw from '@/process/resources/assistant/design/design-director/agent-package.json';
import pmWorkbenchManifestRaw from '@/process/resources/assistant/product/pm-workbench/agent-package.json';
import officeAnalystManifestRaw from '@/process/resources/assistant/office/office-analyst/agent-package.json';
import financeAnalystManifestRaw from '@/process/resources/assistant/finance/finance-analyst/agent-package.json';
import superpowersManifestRaw from '@/process/resources/assistant/engineering/superpowers/agent-package.json';
import everythingClaudeCodeManifestRaw from '@/process/resources/assistant/engineering/everything-in-claude-code/agent-package.json';

export type BundledAgentPackageDescriptor = {
  resourceDir: string;
  manifest: AgentPackageManifest;
};

function parseBundledManifest(raw: unknown, resourceDir: string): AgentPackageManifest {
  const manifest = parseAgentPackageManifest(raw);
  if (!manifest) {
    throw new Error(`Invalid bundled agent package manifest: ${resourceDir}`);
  }

  return manifest;
}

export const BUNDLED_AGENT_PACKAGE_DESCRIPTORS: readonly BundledAgentPackageDescriptor[] = [
  {
    resourceDir: 'src/process/resources/assistant/morph-ppt',
    manifest: parseBundledManifest(morphPptManifestRaw, 'src/process/resources/assistant/morph-ppt'),
  },
  {
    resourceDir: 'src/process/resources/assistant/startup/startup-strategist',
    manifest: parseBundledManifest(
      startupStrategistManifestRaw,
      'src/process/resources/assistant/startup/startup-strategist'
    ),
  },
  {
    resourceDir: 'src/process/resources/assistant/design/design-director',
    manifest: parseBundledManifest(designDirectorManifestRaw, 'src/process/resources/assistant/design/design-director'),
  },
  {
    resourceDir: 'src/process/resources/assistant/product/pm-workbench',
    manifest: parseBundledManifest(pmWorkbenchManifestRaw, 'src/process/resources/assistant/product/pm-workbench'),
  },
  {
    resourceDir: 'src/process/resources/assistant/office/office-analyst',
    manifest: parseBundledManifest(officeAnalystManifestRaw, 'src/process/resources/assistant/office/office-analyst'),
  },
  {
    resourceDir: 'src/process/resources/assistant/finance/finance-analyst',
    manifest: parseBundledManifest(
      financeAnalystManifestRaw,
      'src/process/resources/assistant/finance/finance-analyst'
    ),
  },
  {
    resourceDir: 'src/process/resources/assistant/engineering/superpowers',
    manifest: parseBundledManifest(superpowersManifestRaw, 'src/process/resources/assistant/engineering/superpowers'),
  },
  {
    resourceDir: 'src/process/resources/assistant/engineering/everything-in-claude-code',
    manifest: parseBundledManifest(
      everythingClaudeCodeManifestRaw,
      'src/process/resources/assistant/engineering/everything-in-claude-code'
    ),
  },
] as const;

const BUILTIN_ASSISTANT_PREFIX = 'builtin-';

function toBuiltinAssistantId(value: string): string {
  return value.startsWith(BUILTIN_ASSISTANT_PREFIX) ? value : `${BUILTIN_ASSISTANT_PREFIX}${value}`;
}

export function findBundledAgentPackageDescriptorByAssistantId(
  assistantId: string
): BundledAgentPackageDescriptor | undefined {
  const builtinAssistantId = toBuiltinAssistantId(assistantId);
  return BUNDLED_AGENT_PACKAGE_DESCRIPTORS.find(
    (descriptor) => descriptor.manifest.assistantPresetId === builtinAssistantId
  );
}

export function findBundledAgentPackageDescriptorByPackageId(
  packageId: string
): BundledAgentPackageDescriptor | undefined {
  return BUNDLED_AGENT_PACKAGE_DESCRIPTORS.find((descriptor) => descriptor.manifest.packageId === packageId);
}

type AgentPackagePayloadMap = AgentPackageManifest['payloads'];

export function getBundledAgentPackagePayload<K extends AgentPackagePayloadId>(
  assistantId: string,
  payloadId: K
): AgentPackagePayloadMap[K] | undefined {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  if (!descriptor) {
    return undefined;
  }

  return descriptor.manifest.payloads[payloadId] as AgentPackagePayloadMap[K] | undefined;
}

export function getBundledAgentPackageRulesFiles(assistantId: string): Record<string, string> | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'rules') as AgentPackageRulesPayload | undefined;
  return payload?.files;
}

export function getBundledAgentPackageDefaultEnabledSkillNames(assistantId: string): string[] | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'skills') as AgentPackageSkillsPayload | undefined;
  return payload?.defaultEnabledSkillNames ? [...payload.defaultEnabledSkillNames] : undefined;
}

export function getBundledAgentPackageOwnedSkillNames(assistantId: string): string[] | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'skills') as AgentPackageSkillsPayload | undefined;
  return payload?.packagedSkillNames ? [...payload.packagedSkillNames] : undefined;
}

export function getBundledAgentPackageHideOwnedSkillsFromLibrary(assistantId: string): boolean | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'skills') as AgentPackageSkillsPayload | undefined;
  return payload?.hidePackageOwnedSkillsFromLibrary;
}

export function hasBundledAgentPackageSkillsPayload(assistantId: string): boolean {
  return !!getBundledAgentPackagePayload(assistantId, 'skills');
}

export function getBundledAgentPackageDefaultEnabledHookNames(assistantId: string): string[] | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'hooks') as AgentPackageHooksPayload | undefined;
  return payload?.defaultEnabledHookNames ? [...payload.defaultEnabledHookNames] : undefined;
}

export function getBundledAgentPackageWorkspaceSkillBootstrapStrategy(
  assistantId: string
): AgentPackageSkillsPayload['bootstrapStrategy'] | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'skills') as AgentPackageSkillsPayload | undefined;
  return payload?.bootstrapStrategy;
}

export function getBundledAgentPackageWorkspaceAutomationProfile(assistantId: string): string | undefined {
  const commandsPayload = getBundledAgentPackagePayload(assistantId, 'commands') as
    | AgentPackageCommandsPayload
    | undefined;
  if (commandsPayload?.workspaceAutomationProfile) {
    return commandsPayload.workspaceAutomationProfile;
  }

  const schedulesPayload = getBundledAgentPackagePayload(assistantId, 'schedules') as
    | AgentPackageSchedulesPayload
    | undefined;
  return schedulesPayload?.workspaceAutomationProfile;
}

export function getBundledAgentPackageSkillSourceDescriptors(assistantId: string): AgentPackageSourceDescriptor[] {
  const payload = getBundledAgentPackagePayload(assistantId, 'skills') as AgentPackageSkillsPayload | undefined;
  return payload?.sources ? [...payload.sources] : [];
}

export function getBundledAgentPackageRuleSourceDescriptors(assistantId: string): AgentPackageSourceDescriptor[] {
  const payload = getBundledAgentPackagePayload(assistantId, 'rules') as AgentPackageRulesPayload | undefined;
  return payload?.sources ? [...payload.sources] : [];
}

export function resolveBundledAgentPackageSourceRelativeRoots(
  assistantId: string,
  payloadId: 'rules' | 'docs' | 'skills' | 'hooks'
): string[] {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  const payload = descriptor?.manifest.payloads[payloadId] as
    | AgentPackageRulesPayload
    | AgentPackageDocsPayload
    | AgentPackageSkillsPayload
    | AgentPackageHooksPayload
    | undefined;

  if (!descriptor || !payload) {
    return [];
  }

  return payload.sources
    .filter((source) => source.kind !== 'workspace-automation-profile')
    .map((source) =>
      source.kind === 'package-relative'
        ? path.posix.join(descriptor.resourceDir.replace(/\\/g, '/'), source.root)
        : source.root
    );
}
