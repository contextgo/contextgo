import { getBlogSection } from './blog';
import { getChangelogSection, getResourcesSection, getSiteLabels } from './common';
import { getDocsSection } from './docs';
import type { DocGroup, SiteContentBundle, SiteLocale } from './types';

export type {
  BlogSection,
  ChangelogSection,
  ContentArticle,
  ContentCard,
  ContentSection,
  DocCategoryId,
  DocGroup,
  DocsSection,
  ResourcesSection,
  SiteContentBundle,
  SiteLabels,
  SiteLocale,
} from './types';

export const getSiteContent = (locale: SiteLocale): SiteContentBundle => ({
  docs: getDocsSection(locale),
  blog: getBlogSection(locale),
  changelog: getChangelogSection(locale),
  resources: getResourcesSection(locale),
  labels: getSiteLabels(locale),
});

export const getDocEntries = (locale: SiteLocale) => getDocsSection(locale).entries;

export const getDocGroups = (locale: SiteLocale): DocGroup[] => {
  const docs = getDocsSection(locale);
  return docs.categories.map((category) => ({
    ...category,
    entries: docs.entries.filter((entry) => entry.category === category.id),
  }));
};

export const getBlogEntries = (locale: SiteLocale) => getBlogSection(locale).entries;

export const getDocEntry = (locale: SiteLocale, slug: string) =>
  getDocsSection(locale).entries.find((entry) => entry.slug === slug) ?? null;

export const getBlogEntry = (locale: SiteLocale, slug: string) =>
  getBlogSection(locale).entries.find((entry) => entry.slug === slug) ?? null;
