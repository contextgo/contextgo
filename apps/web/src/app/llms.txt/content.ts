import { getDocsSiteBaseUrl } from '@/lib/docsSite';
import { getIntentPages } from '@/lib/intentContent';
import { draftBlogCollections } from '@/lib/public-content/generated/blog';
import { getAbsoluteSiteUrl } from '@/lib/seo';
import { getSiteContent } from '@/lib/site-content';

export const buildLlmsText = (): string => {
  const resources = getSiteContent('en').resources;
  const changelog = getSiteContent('en').changelog;
  const blogEntries = draftBlogCollections.en.blog.entries;
  const intentPages = getIntentPages('en');

  const lines = [
    '# ContextGo',
    '',
    '> ContextGo is a context-first AI workbench for connecting files, tasks, conversations, channels, and runtime state so agents can work inside real workflows.',
    '',
    '## Main site',
    `- Home: ${getAbsoluteSiteUrl('/en')}`,
    `- Connectors: ${getAbsoluteSiteUrl('/en/connect')}`,
    `- Download center: ${getAbsoluteSiteUrl('/en/download')}`,
    `- Solutions: ${getAbsoluteSiteUrl('/en/solutions')}`,
    `- Blog index: ${getAbsoluteSiteUrl('/en/blog')}`,
    `- Changelog: ${getAbsoluteSiteUrl('/en/changelog')}`,
    '',
    '## Documentation',
    `- Docs home: ${getDocsSiteBaseUrl()}`,
    `- Start here: ${getDocsSiteBaseUrl()}/start-here/index`,
    '',
    '## Product areas',
    ...resources.cards.map((card) => `- ${card.title}: ${getAbsoluteSiteUrl(`/en${card.href}`)}`),
    '',
    '## Search intent pages',
    ...intentPages.map((page) => `- ${page.title}: ${getAbsoluteSiteUrl(`/en/solutions/${page.slug}`)}`),
    '',
    '## Release operations',
    `- ${changelog.title}: ${getAbsoluteSiteUrl('/en/changelog')}`,
    '',
    '## Blog articles',
    ...blogEntries.map((entry) => `- ${entry.title}: ${getAbsoluteSiteUrl(`/en/blog/${entry.slug}`)}`),
  ];

  return `${lines.join('\n')}\n`;
};
