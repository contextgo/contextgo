export const AGENT_PACKAGE_PROTOCOL_VERSION = 'agent-package.v1';
export const AGENT_PACKAGE_MANIFEST_FILE_NAME = 'agent-package.json';

export type AgentPackageWorkspaceAutomationProfile =
  | 'contextgo-harness'
  | 'everything-claude-code'
  | 'startup-strategist'
  | 'pm-workbench'
  | 'office-analyst'
  | 'finance-analyst'
  | 'design-director';

export type AgentPackageWorkspaceSkillBootstrapStrategy = 'enabled-skills' | 'packaged-skills';
export type AgentPackageRuntimeId = 'gemini' | 'claude' | 'codex' | 'opencode';

export type AgentPackageSourceKind = 'package-relative' | 'repo-relative' | 'workspace-automation-profile';

export type AgentPackageInstallSurface =
  | 'workspace-root-docs'
  | '.contextgo/skills'
  | '.contextgo/commands.json'
  | '.contextgo/hooks/'
  | '.contextgo/hooks.json'
  | '.contextgo/schedules.json';

export type AgentPackageRuntimeProjection = 'none' | 'native-skills-only';

export type AgentPackagePayloadId = 'workspaceScaffold' | 'skills' | 'commands' | 'hooks' | 'schedules';

export type AgentPackageSourceDescriptor = {
  kind: AgentPackageSourceKind;
  root: string;
};

type AgentPackagePayloadBase = {
  logicalId: AgentPackagePayloadId;
  sources: AgentPackageSourceDescriptor[];
  runtimeProjection: AgentPackageRuntimeProjection;
};

export type AgentPackageEntryDocument = {
  file: string;
  runtimeEntryProjections?: AgentPackageWorkspaceRuntimeEntryProjection[];
};

export type AgentPackageDocsDirectory = {
  root: string;
};

export type AgentPackageWorkspaceScaffoldTemplate = {
  source: string;
  target: string;
};

export type AgentPackageWorkspaceRuntimeEntryProjection = {
  runtime: AgentPackageRuntimeId;
  target: string;
};

export type AgentPackageWorkspaceScaffoldPayload = AgentPackagePayloadBase & {
  logicalId: 'workspaceScaffold';
  installSurface: 'workspace-root-docs';
  focusAreas: string[];
  suggestedArtifacts: string[];
  templates?: AgentPackageWorkspaceScaffoldTemplate[];
};

export type AgentPackageSkillsPayload = AgentPackagePayloadBase & {
  logicalId: 'skills';
  installSurface: '.contextgo/skills';
  bootstrapStrategy: AgentPackageWorkspaceSkillBootstrapStrategy;
  packagedSkillNames: string[];
  defaultEnabledSkillNames?: string[];
  hidePackageOwnedSkillsFromLibrary?: boolean;
};

export type AgentPackageCommandsPayload = AgentPackagePayloadBase & {
  logicalId: 'commands';
  installSurface: '.contextgo/commands.json';
  workspaceAutomationProfile: AgentPackageWorkspaceAutomationProfile;
};

export type AgentPackageHooksPayload = AgentPackagePayloadBase & {
  logicalId: 'hooks';
  installSurface: '.contextgo/hooks/';
  selectionSurface: '.contextgo/hooks.json';
  defaultEnabledHookNames?: string[];
};

export type AgentPackageSchedulesPayload = AgentPackagePayloadBase & {
  logicalId: 'schedules';
  installSurface: '.contextgo/schedules.json';
  workspaceAutomationProfile: AgentPackageWorkspaceAutomationProfile;
};

export type AgentPackageManifest = {
  protocolVersion: typeof AGENT_PACKAGE_PROTOCOL_VERSION;
  packageId: string;
  assistantPresetId: string;
  displayName: string;
  runtimeNeutral: true;
  entryDocument: AgentPackageEntryDocument;
  docsDirectory?: AgentPackageDocsDirectory;
  payloads: {
    workspaceScaffold?: AgentPackageWorkspaceScaffoldPayload;
    skills?: AgentPackageSkillsPayload;
    commands?: AgentPackageCommandsPayload;
    hooks?: AgentPackageHooksPayload;
    schedules?: AgentPackageSchedulesPayload;
  };
};

const AGENT_PACKAGE_SOURCE_KINDS = new Set<AgentPackageSourceKind>([
  'package-relative',
  'repo-relative',
  'workspace-automation-profile',
]);

const AGENT_PACKAGE_INSTALL_SURFACES = new Set<AgentPackageInstallSurface>([
  'workspace-root-docs',
  '.contextgo/skills',
  '.contextgo/commands.json',
  '.contextgo/hooks/',
  '.contextgo/hooks.json',
  '.contextgo/schedules.json',
]);

const AGENT_PACKAGE_RUNTIME_PROJECTIONS = new Set<AgentPackageRuntimeProjection>(['none', 'native-skills-only']);

const WORKSPACE_SKILL_BOOTSTRAP_STRATEGIES = new Set<AgentPackageWorkspaceSkillBootstrapStrategy>([
  'enabled-skills',
  'packaged-skills',
]);

const WORKSPACE_AUTOMATION_PROFILES = new Set<AgentPackageWorkspaceAutomationProfile>([
  'contextgo-harness',
  'everything-claude-code',
  'startup-strategist',
  'pm-workbench',
  'office-analyst',
  'finance-analyst',
  'design-director',
]);

const AGENT_PACKAGE_RUNTIME_IDS = new Set<AgentPackageRuntimeId>(['gemini', 'claude', 'codex', 'opencode']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'boolean' ? value : undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value.filter(isNonEmptyString).map((item) => item.trim());
  return parsed.length === value.length ? parsed : undefined;
}

function parseSources(value: unknown): AgentPackageSourceDescriptor[] | null {
  if (!Array.isArray(value) || !value.length) {
    return null;
  }

  const sources: AgentPackageSourceDescriptor[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const kind = item.kind;
    const root = item.root;
    if (
      !isNonEmptyString(kind) ||
      !AGENT_PACKAGE_SOURCE_KINDS.has(kind as AgentPackageSourceKind) ||
      !isNonEmptyString(root)
    ) {
      return null;
    }

    sources.push({
      kind: kind as AgentPackageSourceKind,
      root: root.trim(),
    });
  }

  return sources;
}

function parseWorkspaceScaffoldTemplates(value: unknown): AgentPackageWorkspaceScaffoldTemplate[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const templates: AgentPackageWorkspaceScaffoldTemplate[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isNonEmptyString(item.source) || !isNonEmptyString(item.target)) {
      return null;
    }

    templates.push({
      source: item.source.trim(),
      target: item.target.trim(),
    });
  }

  return templates;
}

function parseWorkspaceRuntimeEntryProjections(
  value: unknown
): AgentPackageWorkspaceRuntimeEntryProjection[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const projections: AgentPackageWorkspaceRuntimeEntryProjection[] = [];
  const seenRuntimes = new Set<AgentPackageRuntimeId>();

  for (const item of value) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.runtime) ||
      !AGENT_PACKAGE_RUNTIME_IDS.has(item.runtime as AgentPackageRuntimeId) ||
      !isNonEmptyString(item.target)
    ) {
      return null;
    }

    const runtime = item.runtime as AgentPackageRuntimeId;
    if (seenRuntimes.has(runtime)) {
      return null;
    }

    seenRuntimes.add(runtime);
    projections.push({
      runtime,
      target: item.target.trim(),
    });
  }

  return projections;
}

function parseEntryDocument(value: unknown): AgentPackageEntryDocument | null {
  if (!isRecord(value) || !isNonEmptyString(value.file)) {
    return null;
  }

  const runtimeEntryProjections = parseWorkspaceRuntimeEntryProjections(value.runtimeEntryProjections);
  if (runtimeEntryProjections === null) {
    return null;
  }

  return {
    file: value.file.trim(),
    runtimeEntryProjections,
  };
}

function parseDocsDirectory(value: unknown): AgentPackageDocsDirectory | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || !isNonEmptyString(value.root)) {
    return null;
  }

  return {
    root: value.root.trim(),
  };
}

type ParsedPayloadBase = Pick<AgentPackagePayloadBase, 'sources' | 'runtimeProjection'>;

function parsePayloadBase(
  value: unknown,
  logicalId: AgentPackagePayloadId
): (ParsedPayloadBase & { logicalId: AgentPackagePayloadId; installSurface?: AgentPackageInstallSurface }) | null {
  if (!isRecord(value)) {
    return null;
  }

  const payloadLogicalId = value.logicalId;
  const sources = parseSources(value.sources);
  const runtimeProjection = value.runtimeProjection;
  const installSurface = value.installSurface;

  if (
    payloadLogicalId !== logicalId ||
    !sources ||
    !isNonEmptyString(runtimeProjection) ||
    !AGENT_PACKAGE_RUNTIME_PROJECTIONS.has(runtimeProjection as AgentPackageRuntimeProjection) ||
    (installSurface !== undefined &&
      (!isNonEmptyString(installSurface) ||
        !AGENT_PACKAGE_INSTALL_SURFACES.has(installSurface as AgentPackageInstallSurface)))
  ) {
    return null;
  }

  return {
    logicalId,
    sources,
    runtimeProjection: runtimeProjection as AgentPackageRuntimeProjection,
    installSurface: installSurface as AgentPackageInstallSurface | undefined,
  };
}

function parseWorkspaceScaffoldPayload(value: unknown): AgentPackageWorkspaceScaffoldPayload | null {
  const base = parsePayloadBase(value, 'workspaceScaffold');
  if (!base || base.installSurface !== 'workspace-root-docs' || !isRecord(value)) {
    return null;
  }

  const focusAreas = parseStringArray(value.focusAreas);
  const suggestedArtifacts = parseStringArray(value.suggestedArtifacts);
  const templates = parseWorkspaceScaffoldTemplates(value.templates);
  if (!focusAreas || !suggestedArtifacts || templates === null) {
    return null;
  }

  return {
    logicalId: 'workspaceScaffold',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: 'workspace-root-docs',
    focusAreas,
    suggestedArtifacts,
    templates,
  };
}

function parseSkillsPayload(value: unknown): AgentPackageSkillsPayload | null {
  const base = parsePayloadBase(value, 'skills');
  if (!base || base.installSurface !== '.contextgo/skills' || !isRecord(value)) {
    return null;
  }

  const bootstrapStrategy = value.bootstrapStrategy;
  const packagedSkillNames = parseStringArray(value.packagedSkillNames);
  if (
    !isNonEmptyString(bootstrapStrategy) ||
    !WORKSPACE_SKILL_BOOTSTRAP_STRATEGIES.has(bootstrapStrategy as AgentPackageWorkspaceSkillBootstrapStrategy) ||
    !packagedSkillNames
  ) {
    return null;
  }

  const defaultEnabledSkillNames = parseStringArray(value.defaultEnabledSkillNames);
  const hidePackageOwnedSkillsFromLibrary = parseOptionalBoolean(value.hidePackageOwnedSkillsFromLibrary);
  if (value.defaultEnabledSkillNames !== undefined && !defaultEnabledSkillNames) {
    return null;
  }

  if (value.hidePackageOwnedSkillsFromLibrary !== undefined && hidePackageOwnedSkillsFromLibrary === undefined) {
    return null;
  }

  return {
    logicalId: 'skills',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: '.contextgo/skills',
    bootstrapStrategy: bootstrapStrategy as AgentPackageWorkspaceSkillBootstrapStrategy,
    packagedSkillNames,
    defaultEnabledSkillNames,
    hidePackageOwnedSkillsFromLibrary,
  };
}

function parseCommandsPayload(value: unknown): AgentPackageCommandsPayload | null {
  const base = parsePayloadBase(value, 'commands');
  if (!base || base.installSurface !== '.contextgo/commands.json' || !isRecord(value)) {
    return null;
  }

  const workspaceAutomationProfile = value.workspaceAutomationProfile;
  if (
    !isNonEmptyString(workspaceAutomationProfile) ||
    !WORKSPACE_AUTOMATION_PROFILES.has(workspaceAutomationProfile as AgentPackageWorkspaceAutomationProfile)
  ) {
    return null;
  }

  return {
    logicalId: 'commands',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: '.contextgo/commands.json',
    workspaceAutomationProfile: workspaceAutomationProfile as AgentPackageWorkspaceAutomationProfile,
  };
}

function parseHooksPayload(value: unknown): AgentPackageHooksPayload | null {
  const base = parsePayloadBase(value, 'hooks');
  if (!base || base.installSurface !== '.contextgo/hooks/' || !isRecord(value)) {
    return null;
  }

  const selectionSurface = value.selectionSurface;
  if (selectionSurface !== '.contextgo/hooks.json') {
    return null;
  }

  const defaultEnabledHookNames = parseStringArray(value.defaultEnabledHookNames);
  if (value.defaultEnabledHookNames !== undefined && !defaultEnabledHookNames) {
    return null;
  }

  return {
    logicalId: 'hooks',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: '.contextgo/hooks/',
    selectionSurface: '.contextgo/hooks.json',
    defaultEnabledHookNames,
  };
}

function parseSchedulesPayload(value: unknown): AgentPackageSchedulesPayload | null {
  const base = parsePayloadBase(value, 'schedules');
  if (!base || base.installSurface !== '.contextgo/schedules.json' || !isRecord(value)) {
    return null;
  }

  const workspaceAutomationProfile = value.workspaceAutomationProfile;
  if (
    !isNonEmptyString(workspaceAutomationProfile) ||
    !WORKSPACE_AUTOMATION_PROFILES.has(workspaceAutomationProfile as AgentPackageWorkspaceAutomationProfile)
  ) {
    return null;
  }

  return {
    logicalId: 'schedules',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: '.contextgo/schedules.json',
    workspaceAutomationProfile: workspaceAutomationProfile as AgentPackageWorkspaceAutomationProfile,
  };
}

export function parseAgentPackageManifest(value: unknown): AgentPackageManifest | null {
  if (!isRecord(value)) {
    return null;
  }

  const protocolVersion = value.protocolVersion;
  const packageId = value.packageId;
  const assistantPresetId = value.assistantPresetId;
  const displayName = value.displayName;
  const runtimeNeutral = value.runtimeNeutral;
  const entryDocument = parseEntryDocument(value.entryDocument);
  const docsDirectory = parseDocsDirectory(value.docsDirectory);
  const payloads = value.payloads;

  if (
    protocolVersion !== AGENT_PACKAGE_PROTOCOL_VERSION ||
    !isNonEmptyString(packageId) ||
    !isNonEmptyString(assistantPresetId) ||
    !isNonEmptyString(displayName) ||
    runtimeNeutral !== true ||
    !entryDocument ||
    docsDirectory === null ||
    !isRecord(payloads)
  ) {
    return null;
  }

  const workspaceScaffold =
    payloads.workspaceScaffold === undefined ? undefined : parseWorkspaceScaffoldPayload(payloads.workspaceScaffold);
  const skills = payloads.skills === undefined ? undefined : parseSkillsPayload(payloads.skills);
  const commands = payloads.commands === undefined ? undefined : parseCommandsPayload(payloads.commands);
  const hooks = payloads.hooks === undefined ? undefined : parseHooksPayload(payloads.hooks);
  const schedules = payloads.schedules === undefined ? undefined : parseSchedulesPayload(payloads.schedules);

  if (payloads.skills !== undefined && !skills) {
    return null;
  }

  if (payloads.workspaceScaffold !== undefined && !workspaceScaffold) {
    return null;
  }

  if (payloads.commands !== undefined && !commands) {
    return null;
  }

  if (payloads.hooks !== undefined && !hooks) {
    return null;
  }

  if (payloads.schedules !== undefined && !schedules) {
    return null;
  }

  return {
    protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
    packageId: packageId.trim(),
    assistantPresetId: assistantPresetId.trim(),
    displayName: displayName.trim(),
    runtimeNeutral: true,
    entryDocument,
    docsDirectory,
    payloads: {
      workspaceScaffold,
      skills,
      commands,
      hooks,
      schedules,
    },
  };
}
