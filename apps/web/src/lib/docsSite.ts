const DEFAULT_DOCS_SITE_URL = 'https://docs.contextgo.io';

const LEGACY_DOC_PATHS: Record<string, string> = {
  'quick-start': 'start-here/quick-start',
  'product-model': 'start-here/product-map',
  'agent-workspace': 'workbench/conversation-cowork-workbench',
  'agent-packages': 'agents/agent-packages',
  'agent-collaboration': 'collaboration/collaboration-overview',
  'hooks-overview': 'agents/skill-market',
  'scheduled-tasks': 'use-cases/operations-and-automation-workflow',
  'skill-market': 'agents/skill-market',
  'runtime-management': 'agents/runtime-center',
  'connectors-and-channels': 'context/context-connector',
  'remote-access': 'remote/remote-access-overview',
  'cloud-account': 'manage/account-and-devices',
  'updates-and-troubleshooting': 'manage/troubleshooting',
};

const normalizePath = (value?: string): string => value?.replace(/^\/+|\/+$/g, '') ?? '';

export const getDocsSiteBaseUrl = (): string =>
  (process.env.NEXT_PUBLIC_DOCS_SITE_URL || DEFAULT_DOCS_SITE_URL).replace(/\/+$/g, '');

export const resolveDocsSitePath = (legacySlug?: string): string => {
  const normalized = normalizePath(legacySlug);

  if (!normalized) {
    return '';
  }

  return LEGACY_DOC_PATHS[normalized] || normalized;
};

export const getDocsSiteUrl = (legacySlug?: string): string => {
  const baseUrl = getDocsSiteBaseUrl();
  const path = resolveDocsSitePath(legacySlug);
  return path ? `${baseUrl}/${path}` : baseUrl;
};
