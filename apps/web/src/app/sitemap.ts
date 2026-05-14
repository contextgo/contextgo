import type { MetadataRoute } from 'next';
import { draftBlogCollections } from '@/lib/public-content/generated/blog';
import { getIntentPages } from '@/lib/intentContent';
import type { SiteLocale } from '@/lib/public-content/types';
import { getAbsoluteSiteUrl, getLocalizedPath } from '@/lib/seo';

const locales: SiteLocale[] = ['en', 'zh'];
const staticPages = [
  { pathname: '', changeFrequency: 'weekly' as const, priority: 1 },
  { pathname: '/connect', changeFrequency: 'weekly' as const, priority: 0.8 },
  { pathname: '/download', changeFrequency: 'daily' as const, priority: 0.9 },
  { pathname: '/solutions', changeFrequency: 'weekly' as const, priority: 0.75 },
  { pathname: '/blog', changeFrequency: 'weekly' as const, priority: 0.8 },
  { pathname: '/changelog', changeFrequency: 'daily' as const, priority: 0.7 },
  { pathname: '/privacy', changeFrequency: 'monthly' as const, priority: 0.3 },
  { pathname: '/terms', changeFrequency: 'monthly' as const, priority: 0.3 },
];

const getLanguageAlternates = (pathname: string) => ({
  en: getAbsoluteSiteUrl(getLocalizedPath('en', pathname)),
  zh: getAbsoluteSiteUrl(getLocalizedPath('zh', pathname)),
});

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = staticPages.flatMap((page) =>
    locales.map((locale) => ({
      url: getAbsoluteSiteUrl(getLocalizedPath(locale, page.pathname)),
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: getLanguageAlternates(page.pathname),
      },
    }))
  );

  const blogEntries = locales.flatMap((locale) =>
    draftBlogCollections[locale].blog.entries.map((entry) => ({
      url: getAbsoluteSiteUrl(getLocalizedPath(locale, `/blog/${entry.slug}`)),
      lastModified: entry.publishedAt ? new Date(entry.publishedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      alternates: {
        languages: getLanguageAlternates(`/blog/${entry.slug}`),
      },
    }))
  );

  const solutionEntries = locales.flatMap((locale) =>
    getIntentPages(locale).map((page) => ({
      url: getAbsoluteSiteUrl(getLocalizedPath(locale, `/solutions/${page.slug}`)),
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      alternates: {
        languages: getLanguageAlternates(`/solutions/${page.slug}`),
      },
    }))
  );

  return [...staticEntries, ...blogEntries, ...solutionEntries];
}
