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
  notes: string[];
  runtime: Record<string, unknown>;
};
