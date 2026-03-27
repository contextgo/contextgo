export type ConnectorCategory =
  | 'googleWorkspace'
  | 'collaboration'
  | 'development'
  | 'knowledge'
  | 'design'
  | 'storage'
  | 'business'
  | 'data';

export type ConnectorResource =
  | 'chat'
  | 'docs'
  | 'wiki'
  | 'files'
  | 'repositories'
  | 'issues'
  | 'tasks'
  | 'calendar'
  | 'email'
  | 'sheets'
  | 'designs'
  | 'crm'
  | 'commerce'
  | 'analytics'
  | 'databases'
  | 'incidents';

export type ConnectorAuthType = 'oauth' | 'bot' | 'apiKey' | 'pat' | 'serviceAccount';

export type ConnectorStage = 'priority' | 'planned';

export type ConnectorDefinition = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
  category: ConnectorCategory;
  resources: ConnectorResource[];
  authType: ConnectorAuthType;
  stage: ConnectorStage;
  localLogo?: string;
};
