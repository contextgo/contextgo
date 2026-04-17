export const PUBLIC_RELEASE_REPOSITORY_URL = 'https://github.com/contextgo/contextgo-releases';
export const PUBLIC_RELEASES_URL = `${PUBLIC_RELEASE_REPOSITORY_URL}/releases`;
export const PUBLIC_RELEASE_ISSUES_URL = `${PUBLIC_RELEASE_REPOSITORY_URL}/issues`;
export const PUBLIC_WEBSITE_URL = 'https://contextgo.io';
export const PUBLIC_DOCS_SITE_URL = 'https://docs.contextgo.io';

export const PUBLIC_DOC_SLUGS = {
  connectorsAndChannels: 'context/context-connector',
  remoteAccess: 'remote/remote-access-overview',
  runtimeManagement: 'agents/runtime-center',
  updatesAndTroubleshooting: 'manage/troubleshooting',
} as const;

export const getPublicDocsUrl = (language?: string, slug?: string): string => {
  void language;
  const suffix = slug ? `/${slug.replace(/^\/+/g, '')}` : '';
  return `${PUBLIC_DOCS_SITE_URL}${suffix}`;
};
