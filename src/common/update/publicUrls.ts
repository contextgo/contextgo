export const PUBLIC_RELEASE_REPOSITORY_URL = 'https://github.com/contextgo/contextgo-releases';
export const PUBLIC_RELEASES_URL = `${PUBLIC_RELEASE_REPOSITORY_URL}/releases`;
export const PUBLIC_RELEASE_ISSUES_URL = `${PUBLIC_RELEASE_REPOSITORY_URL}/issues`;
export const PUBLIC_WEBSITE_URL = 'https://contextgo.io';

export const PUBLIC_DOC_SLUGS = {
  connectorsAndChannels: 'connectors-and-channels',
  remoteAccess: 'remote-access',
  runtimeManagement: 'runtime-management',
  updatesAndTroubleshooting: 'updates-and-troubleshooting',
} as const;

type SupportedDocsLocale = 'en' | 'zh';

const normalizeDocsLocale = (language?: string): SupportedDocsLocale => {
  const normalized = (language || '').trim().toLowerCase();
  return normalized.startsWith('zh') ? 'zh' : 'en';
};

export const getPublicDocsUrl = (language?: string, slug?: string): string => {
  const locale = normalizeDocsLocale(language);
  const suffix = slug ? `/${slug}` : '';
  return `${PUBLIC_WEBSITE_URL}/${locale}/docs${suffix}`;
};
