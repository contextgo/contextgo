import path from 'path';
import type {
  AgentPackageConnectorsPayload,
  AgentPackageHooksPayload,
  AgentPackageManifest,
  AgentPackagePayloadId,
  AgentPackageRequirementsPayload,
  AgentPackageSchedulesPayload,
  AgentPackageSkillsPayload,
  AgentPackageSourceDescriptor,
  AgentPackageCommandsPayload,
} from '@/common/config/presets/agentPackageManifest';
import { parseAgentPackageManifest } from '@/common/config/presets/agentPackageManifest';
import morphPptManifestRaw from '@/process/resources/assistant/morph-ppt/agent-package.json';
import startupStrategistManifestRaw from '@/process/resources/assistant/startup/startup-strategist/agent-package.json';
import designDirectorManifestRaw from '@/process/resources/assistant/design/design-director/agent-package.json';
import figmaClosedLoopManifestRaw from '@/process/resources/assistant/design/figma-closed-loop/agent-package.json';
import marketingCreativeStudioManifestRaw from '@/process/resources/assistant/creative/marketing-creative-studio/agent-package.json';
import motionStudioManifestRaw from '@/process/resources/assistant/creative/motion-studio/agent-package.json';
import hyperframesVideoStudioManifestRaw from '@/process/resources/assistant/creative/hyperframes-video-studio/agent-package.json';
import visualArtifactRunnerManifestRaw from '@/process/resources/assistant/creative/visual-artifact-runner/agent-package.json';
import pmWorkbenchManifestRaw from '@/process/resources/assistant/product/pm-workbench/agent-package.json';
import officeAnalystManifestRaw from '@/process/resources/assistant/office/office-analyst/agent-package.json';
import financeAnalystManifestRaw from '@/process/resources/assistant/finance/finance-analyst/agent-package.json';
import superpowersManifestRaw from '@/process/resources/assistant/engineering/superpowers/agent-package.json';
import everythingClaudeCodeManifestRaw from '@/process/resources/assistant/engineering/everything-in-claude-code/agent-package.json';
import karpathyCodingGuardManifestRaw from '@/process/resources/assistant/engineering/karpathy-coding-guard/agent-package.json';

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
    resourceDir: 'src/process/resources/assistant/design/figma-closed-loop',
    manifest: parseBundledManifest(
      figmaClosedLoopManifestRaw,
      'src/process/resources/assistant/design/figma-closed-loop'
    ),
  },
  {
    resourceDir: 'src/process/resources/assistant/creative/marketing-creative-studio',
    manifest: parseBundledManifest(
      marketingCreativeStudioManifestRaw,
      'src/process/resources/assistant/creative/marketing-creative-studio'
    ),
  },
  {
    resourceDir: 'src/process/resources/assistant/creative/motion-studio',
    manifest: parseBundledManifest(motionStudioManifestRaw, 'src/process/resources/assistant/creative/motion-studio'),
  },
  {
    resourceDir: 'src/process/resources/assistant/creative/hyperframes-video-studio',
    manifest: parseBundledManifest(
      hyperframesVideoStudioManifestRaw,
      'src/process/resources/assistant/creative/hyperframes-video-studio'
    ),
  },
  {
    resourceDir: 'src/process/resources/assistant/creative/visual-artifact-runner',
    manifest: parseBundledManifest(
      visualArtifactRunnerManifestRaw,
      'src/process/resources/assistant/creative/visual-artifact-runner'
    ),
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
  {
    resourceDir: 'src/process/resources/assistant/engineering/karpathy-coding-guard',
    manifest: parseBundledManifest(
      karpathyCodingGuardManifestRaw,
      'src/process/resources/assistant/engineering/karpathy-coding-guard'
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

export function getBundledAgentPackageEntryDocumentFile(assistantId: string): string | undefined {
  return findBundledAgentPackageDescriptorByAssistantId(assistantId)?.manifest.entryDocument.file;
}

export function getBundledAgentPackageRuntimeEntryProjections(
  assistantId: string
): AgentPackageManifest['entryDocument']['runtimeEntryProjections'] | undefined {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  return descriptor?.manifest.entryDocument.runtimeEntryProjections
    ? [...descriptor.manifest.entryDocument.runtimeEntryProjections]
    : undefined;
}

export function getBundledAgentPackageDocsRoot(assistantId: string): string | undefined {
  return findBundledAgentPackageDescriptorByAssistantId(assistantId)?.manifest.docsDirectory?.root;
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

export function getBundledAgentPackageConnectorTypes(assistantId: string): string[] | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'connectors') as AgentPackageConnectorsPayload | undefined;
  return payload?.connectorTypes ? [...payload.connectorTypes] : undefined;
}

export function hasBundledAgentPackageConnectorsPayload(assistantId: string): boolean {
  return !!getBundledAgentPackagePayload(assistantId, 'connectors');
}

export function getBundledAgentPackageRequirements(assistantId: string): AgentPackageRequirementsPayload | undefined {
  const payload = getBundledAgentPackagePayload(assistantId, 'requirements') as
    | AgentPackageRequirementsPayload
    | undefined;
  return payload;
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

export function getBundledAgentPackageInstallSurfaces(assistantId: string): string[] {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  if (!descriptor) {
    return [];
  }

  const installSurfaces: string[] = [];

  const maybePush = (value: string | undefined): void => {
    if (value && !installSurfaces.includes(value)) {
      installSurfaces.push(value);
    }
  };

  maybePush(descriptor.manifest.payloads.skills?.installSurface);
  maybePush(descriptor.manifest.payloads.connectors?.installSurface);
  maybePush(descriptor.manifest.payloads.requirements?.installSurface);
  maybePush(descriptor.manifest.payloads.commands?.installSurface);
  maybePush(descriptor.manifest.payloads.hooks?.installSurface);
  maybePush(descriptor.manifest.payloads.hooks?.selectionSurface);
  maybePush(descriptor.manifest.payloads.schedules?.installSurface);

  return installSurfaces;
}

export function resolveBundledAgentPackageEntryDocumentRelativePath(assistantId: string): string | undefined {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  if (!descriptor) {
    return undefined;
  }

  return path.posix.join(descriptor.resourceDir.replace(/\\/g, '/'), descriptor.manifest.entryDocument.file);
}

export function resolveBundledAgentPackageSourceRelativeRoots(
  assistantId: string,
  payloadId: 'skills' | 'hooks'
): string[] {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  const payload = descriptor?.manifest.payloads[payloadId] as
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

export function resolveBundledAgentPackageDocsRootRelativePath(assistantId: string): string | undefined {
  const descriptor = findBundledAgentPackageDescriptorByAssistantId(assistantId);
  const docsRoot = descriptor?.manifest.docsDirectory?.root;
  if (!descriptor || !docsRoot) {
    return undefined;
  }

  return path.posix.join(descriptor.resourceDir.replace(/\\/g, '/'), docsRoot);
}
