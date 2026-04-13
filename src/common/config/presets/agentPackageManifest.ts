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

export type AgentPackageSourceKind = 'package-relative' | 'repo-relative' | 'workspace-automation-profile';

export type AgentPackageInstallSurface =
  | 'assistant-rules-cache'
  | 'package-docs'
  | '.contextgo/skills'
  | '.contextgo/commands.json'
  | '.contextgo/hooks/'
  | '.contextgo/hooks.json'
  | '.contextgo/schedules.json';

export type AgentPackageRuntimeProjection = 'none' | 'native-skills-only';

export type AgentPackagePayloadId = 'rules' | 'docs' | 'skills' | 'commands' | 'hooks' | 'schedules';

export type AgentPackageSourceDescriptor = {
  kind: AgentPackageSourceKind;
  root: string;
};

type AgentPackagePayloadBase = {
  logicalId: AgentPackagePayloadId;
  sources: AgentPackageSourceDescriptor[];
  runtimeProjection: AgentPackageRuntimeProjection;
};

export type AgentPackageRulesPayload = AgentPackagePayloadBase & {
  logicalId: 'rules';
  installSurface: 'assistant-rules-cache';
  files: Record<string, string>;
};

export type AgentPackageDocsPayload = AgentPackagePayloadBase & {
  logicalId: 'docs';
  installSurface: 'package-docs';
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
  payloads: {
    rules: AgentPackageRulesPayload;
    docs: AgentPackageDocsPayload;
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
  'assistant-rules-cache',
  'package-docs',
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

function parseFiles(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value);
  if (!entries.length) {
    return null;
  }

  const files: Record<string, string> = {};
  for (const [locale, filePath] of entries) {
    if (!isNonEmptyString(locale) || !isNonEmptyString(filePath)) {
      return null;
    }
    files[locale] = filePath.trim();
  }

  return files;
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

function parseRulesPayload(value: unknown): AgentPackageRulesPayload | null {
  const base = parsePayloadBase(value, 'rules');
  if (!base || base.installSurface !== 'assistant-rules-cache' || !isRecord(value)) {
    return null;
  }

  const files = parseFiles(value.files);
  if (!files) {
    return null;
  }

  return {
    logicalId: 'rules',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: 'assistant-rules-cache',
    files,
  };
}

function parseDocsPayload(value: unknown): AgentPackageDocsPayload | null {
  const base = parsePayloadBase(value, 'docs');
  if (!base || base.installSurface !== 'package-docs') {
    return null;
  }

  return {
    logicalId: 'docs',
    sources: base.sources,
    runtimeProjection: base.runtimeProjection,
    installSurface: 'package-docs',
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
  const payloads = value.payloads;

  if (
    protocolVersion !== AGENT_PACKAGE_PROTOCOL_VERSION ||
    !isNonEmptyString(packageId) ||
    !isNonEmptyString(assistantPresetId) ||
    !isNonEmptyString(displayName) ||
    runtimeNeutral !== true ||
    !isRecord(payloads)
  ) {
    return null;
  }

  const rules = parseRulesPayload(payloads.rules);
  const docs = parseDocsPayload(payloads.docs);
  const skills = payloads.skills === undefined ? undefined : parseSkillsPayload(payloads.skills);
  const commands = payloads.commands === undefined ? undefined : parseCommandsPayload(payloads.commands);
  const hooks = payloads.hooks === undefined ? undefined : parseHooksPayload(payloads.hooks);
  const schedules = payloads.schedules === undefined ? undefined : parseSchedulesPayload(payloads.schedules);

  if (!rules || !docs) {
    return null;
  }

  if (payloads.skills !== undefined && !skills) {
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
    payloads: {
      rules,
      docs,
      skills,
      commands,
      hooks,
      schedules,
    },
  };
}
