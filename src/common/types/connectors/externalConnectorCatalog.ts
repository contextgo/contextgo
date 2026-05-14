export type ExternalConnectorWorkflowSurface = 'runtime' | 'source' | 'collect' | 'fetch' | 'activity';

export type ExternalConnectorWorkflowStatus = 'ready' | 'partial' | 'planned';

export type ExternalConnectorWorkflow = {
  id: string;
  label: string;
  surface: ExternalConnectorWorkflowSurface;
  status: ExternalConnectorWorkflowStatus;
  native_objects: string[];
  entrypoints: string[];
  writes_store: boolean;
  notes: string[];
};

export type ExternalConnectorCapabilitySourceKind =
  | 'official-cli-help'
  | 'official-cli-schema'
  | 'official-docs'
  | 'manual-curation';

export type ExternalConnectorCapabilitySource = {
  kind: ExternalConnectorCapabilitySourceKind;
  ref: string;
  note?: string;
};

export type ExternalConnectorCapabilityAction = {
  id: string;
  label: string;
  summary: string;
  entrypoints: string[];
  auth_modes: string[];
  notes?: string[];
  sources: ExternalConnectorCapabilitySource[];
};

export type ExternalConnectorCapabilityGroup = {
  id: string;
  label: string;
  summary: string;
  native_objects: string[];
  discovery_commands: string[];
  actions: ExternalConnectorCapabilityAction[];
  sources: ExternalConnectorCapabilitySource[];
};

export type ExternalConnectorCapabilitySchema = {
  version: number;
  extraction_mode: 'manual-curation' | 'help-derived' | 'schema-derived' | 'hybrid';
  discovery_commands: string[];
  notes: string[];
  groups: ExternalConnectorCapabilityGroup[];
};

export type ExternalConnectorCatalogDetails = {
  connector: string;
  kind: string;
  enabled: boolean;
  summary: string;
  runtime_dir: string;
  config_path: string | null;
  platform_access: string;
  runtime_boundary: string;
  native_surface: string[];
  implemented_workflows: ExternalConnectorWorkflow[];
  capabilities?: ExternalConnectorCapabilitySchema;
  notes: string[];
  runtime: Record<string, unknown>;
};
