export const AGENT_PACKAGE_PROTOCOL_VERSION = 'agent-package.v1';
export const AGENT_PACKAGE_MANIFEST_FILE_NAME = 'agent-package.json';

export type AgentPackageWorkspaceAutomationProfile =
  | 'contextgo-harness'
  | 'everything-claude-code'
  | 'startup-strategist'
  | 'pm-workbench'
  | 'office-analyst'
  | 'finance-analyst'
  | 'design-director'
  | 'figma-closed-loop'
  | 'marketing-creative-studio'
  | 'motion-studio'
  | 'visual-artifact-runner';

export type AgentPackageWorkspaceSkillBootstrapStrategy = 'enabled-skills' | 'packaged-skills';
export type AgentPackageRuntimeId = 'gemini' | 'claude' | 'codex' | 'opencode';

export type AgentPackageSourceKind = 'package-relative' | 'repo-relative' | 'workspace-automation-profile';

export type AgentPackageInstallSurface =
  | 'workspace-root-docs'
  | '.contextgo/connectors/'
  | '.contextgo/requirements/'
  | '.contextgo/skills'
  | '.contextgo/commands.json'
  | '.contextgo/hooks/'
  | '.contextgo/hooks.json'
  | '.contextgo/schedules.json';

export type AgentPackageRuntimeProjection = 'none' | 'native-skills-only';

export type AgentPackagePayloadId =
  | 'workspaceScaffold'
  | 'skills'
  | 'connectors'
  | 'requirements'
  | 'commands'
  | 'hooks'
  | 'schedules';

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

export type AgentPackageConnectorsPayload = AgentPackagePayloadBase & {
  logicalId: 'connectors';
  installSurface: '.contextgo/connectors/';
  connectorTypes: string[];
};

export type AgentPackageRequirementOwnerScope = {
  ownerSkillNames?: string[];
};

export type AgentPackageToolRequirement = AgentPackageRequirementOwnerScope & {
  id: string;
  kind: 'mcp' | 'cli' | 'builtin-tool';
  required: boolean;
  label: string;
  description?: string;
  mcp?: {
    serverId: string;
    transport: 'stdio' | 'streamable_http';
    url?: string;
    command?: string;
    args?: string[];
    envRefs?: string[];
  };
};

export type AgentPackageCredentialRequirement = AgentPackageRequirementOwnerScope & {
  id: string;
  kind: 'api_key' | 'oauth2' | 'service_account' | 'basic' | 'bearer_token';
  required: boolean;
  label: string;
  provider: string;
  description?: string;
  env?: string;
  scopes?: string[];
  fields?: Array<{
    key: string;
    label: string;
    secret: boolean;
    required: boolean;
  }>;
};

export type AgentPackageConnectorRequirement = AgentPackageRequirementOwnerScope & {
  id: string;
  connectorType: string;
  required: boolean;
  label: string;
  description?: string;
  capabilities?: string[];
  scopes?: string[];
};

export type AgentPackageRequirementsPayload = AgentPackagePayloadBase & {
  logicalId: 'requirements';
  installSurface: '.contextgo/requirements/';
  tools?: AgentPackageToolRequirement[];
  credentials?: AgentPackageCredentialRequirement[];
  connectors?: AgentPackageConnectorRequirement[];
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
    connectors?: AgentPackageConnectorsPayload;
    requirements?: AgentPackageRequirementsPayload;
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
  '.contextgo/connectors/',
  '.contextgo/requirements/',
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
  'figma-closed-loop',
  'marketing-creative-studio',
  'motion-studio',
  'visual-artifact-runner',
]);

const AGENT_PACKAGE_RUNTIME_IDS = new Set<AgentPackageRuntimeId>(['gemini', 'claude', 'codex', 'opencode']);
const AGENT_PACKAGE_TOOL_REQUIREMENT_KINDS = new Set<AgentPackageToolRequirement['kind']>([
  'mcp',
  'cli',
  'builtin-tool',
]);
const AGENT_PACKAGE_CREDENTIAL_REQUIREMENT_KINDS = new Set<AgentPackageCredentialRequirement['kind']>([
  'api_key',
  'oauth2',
  'service_account',
  'basic',
  'bearer_token',
]);
const AGENT_PACKAGE_MCP_TRANSPORTS = new Set<NonNullable<AgentPackageToolRequirement['mcp']>['transport']>([
  'stdio',
  'streamable_http',
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

function parseOptionalStringArray(value: unknown): string[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return parseStringArray(value) ?? null;
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

function parseConnectorsPayload(value: unknown): AgentPackageConnectorsPayload | null {
  const base = parsePayloadBase(value, 'connectors');
  if (
    !base ||
    base.installSurface !== '.contextgo/connectors/' ||
    base.runtimeProjection !== 'none' ||
    !isRecord(value)
  ) {
    return null;
  }

  const connectorTypes = parseStringArray(value.connectorTypes);
  if (!connectorTypes || connectorTypes.length === 0) {
    return null;
  }

  return {
    logicalId: 'connectors',
    sources: base.sources,
    runtimeProjection: 'none',
    installSurface: '.contextgo/connectors/',
    connectorTypes,
  };
}

function parseRequirementOwnerScope(value: Record<string, unknown>): AgentPackageRequirementOwnerScope | null {
  const ownerSkillNames = parseOptionalStringArray(value.ownerSkillNames);
  if (ownerSkillNames === null) {
    return null;
  }

  return { ownerSkillNames };
}

function parseMcpRequirement(value: unknown): AgentPackageToolRequirement['mcp'] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || !isNonEmptyString(value.serverId) || !isNonEmptyString(value.transport)) {
    return null;
  }

  const transport = value.transport as NonNullable<AgentPackageToolRequirement['mcp']>['transport'];
  if (!AGENT_PACKAGE_MCP_TRANSPORTS.has(transport)) {
    return null;
  }

  const args = parseOptionalStringArray(value.args);
  const envRefs = parseOptionalStringArray(value.envRefs);
  if (args === null || envRefs === null) {
    return null;
  }

  return {
    serverId: value.serverId.trim(),
    transport,
    url: isNonEmptyString(value.url) ? value.url.trim() : undefined,
    command: isNonEmptyString(value.command) ? value.command.trim() : undefined,
    args,
    envRefs,
  };
}

function parseToolRequirements(value: unknown): AgentPackageToolRequirement[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const requirements: AgentPackageToolRequirement[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.kind) ||
      !AGENT_PACKAGE_TOOL_REQUIREMENT_KINDS.has(item.kind as AgentPackageToolRequirement['kind']) ||
      typeof item.required !== 'boolean' ||
      !isNonEmptyString(item.label)
    ) {
      return null;
    }

    const ownerScope = parseRequirementOwnerScope(item);
    const mcp = parseMcpRequirement(item.mcp);
    if (ownerScope === null || mcp === null) {
      return null;
    }

    requirements.push({
      id: item.id.trim(),
      kind: item.kind as AgentPackageToolRequirement['kind'],
      required: item.required,
      label: item.label.trim(),
      description: isNonEmptyString(item.description) ? item.description.trim() : undefined,
      ownerSkillNames: ownerScope.ownerSkillNames,
      mcp,
    });
  }

  return requirements;
}

function parseCredentialRequirementFields(
  value: unknown
): AgentPackageCredentialRequirement['fields'] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const fields: NonNullable<AgentPackageCredentialRequirement['fields']> = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.key) ||
      !isNonEmptyString(item.label) ||
      typeof item.secret !== 'boolean' ||
      typeof item.required !== 'boolean'
    ) {
      return null;
    }

    fields.push({
      key: item.key.trim(),
      label: item.label.trim(),
      secret: item.secret,
      required: item.required,
    });
  }

  return fields;
}

function parseCredentialRequirements(value: unknown): AgentPackageCredentialRequirement[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const requirements: AgentPackageCredentialRequirement[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.kind) ||
      !AGENT_PACKAGE_CREDENTIAL_REQUIREMENT_KINDS.has(item.kind as AgentPackageCredentialRequirement['kind']) ||
      typeof item.required !== 'boolean' ||
      !isNonEmptyString(item.label) ||
      !isNonEmptyString(item.provider)
    ) {
      return null;
    }

    const ownerScope = parseRequirementOwnerScope(item);
    const scopes = parseOptionalStringArray(item.scopes);
    const fields = parseCredentialRequirementFields(item.fields);
    if (ownerScope === null || scopes === null || fields === null) {
      return null;
    }

    requirements.push({
      id: item.id.trim(),
      kind: item.kind as AgentPackageCredentialRequirement['kind'],
      required: item.required,
      label: item.label.trim(),
      provider: item.provider.trim(),
      description: isNonEmptyString(item.description) ? item.description.trim() : undefined,
      env: isNonEmptyString(item.env) ? item.env.trim() : undefined,
      scopes,
      fields,
      ownerSkillNames: ownerScope.ownerSkillNames,
    });
  }

  return requirements;
}

function parseConnectorRequirements(value: unknown): AgentPackageConnectorRequirement[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const requirements: AgentPackageConnectorRequirement[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.connectorType) ||
      typeof item.required !== 'boolean' ||
      !isNonEmptyString(item.label)
    ) {
      return null;
    }

    const ownerScope = parseRequirementOwnerScope(item);
    const capabilities = parseOptionalStringArray(item.capabilities);
    const scopes = parseOptionalStringArray(item.scopes);
    if (ownerScope === null || capabilities === null || scopes === null) {
      return null;
    }

    requirements.push({
      id: item.id.trim(),
      connectorType: item.connectorType.trim(),
      required: item.required,
      label: item.label.trim(),
      description: isNonEmptyString(item.description) ? item.description.trim() : undefined,
      capabilities,
      scopes,
      ownerSkillNames: ownerScope.ownerSkillNames,
    });
  }

  return requirements;
}

function parseRequirementsPayload(value: unknown): AgentPackageRequirementsPayload | null {
  const base = parsePayloadBase(value, 'requirements');
  if (
    !base ||
    base.installSurface !== '.contextgo/requirements/' ||
    base.runtimeProjection !== 'none' ||
    !isRecord(value)
  ) {
    return null;
  }

  const tools = parseToolRequirements(value.tools);
  const credentials = parseCredentialRequirements(value.credentials);
  const connectors = parseConnectorRequirements(value.connectors);
  if (tools === null || credentials === null || connectors === null) {
    return null;
  }

  if (!tools?.length && !credentials?.length && !connectors?.length) {
    return null;
  }

  return {
    logicalId: 'requirements',
    sources: base.sources,
    runtimeProjection: 'none',
    installSurface: '.contextgo/requirements/',
    tools,
    credentials,
    connectors,
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
  const connectors = payloads.connectors === undefined ? undefined : parseConnectorsPayload(payloads.connectors);
  const requirements =
    payloads.requirements === undefined ? undefined : parseRequirementsPayload(payloads.requirements);
  const commands = payloads.commands === undefined ? undefined : parseCommandsPayload(payloads.commands);
  const hooks = payloads.hooks === undefined ? undefined : parseHooksPayload(payloads.hooks);
  const schedules = payloads.schedules === undefined ? undefined : parseSchedulesPayload(payloads.schedules);

  if (payloads.skills !== undefined && !skills) {
    return null;
  }

  if (payloads.workspaceScaffold !== undefined && !workspaceScaffold) {
    return null;
  }

  if (payloads.connectors !== undefined && !connectors) {
    return null;
  }

  if (payloads.requirements !== undefined && !requirements) {
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
      connectors,
      requirements,
      commands,
      hooks,
      schedules,
    },
  };
}
