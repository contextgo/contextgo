import 'server-only';

import { draftDocsCollections } from './public-content/generated/docs';
import {
  PUBLIC_CONTENT_SCHEMA_VERSION,
  type DocGroup,
  type PublicArticle,
  type ReleaseDocsArticlePayload,
  type ReleaseDocsIndex,
  type ReleaseDocsLatest,
  type ReleaseDocsSectionPayload,
  type ReleaseDocsVersion,
  type ResolvedReleaseDocs,
  type SiteLocale,
} from './public-content/types';

const DEFAULT_RELEASE_REPOSITORY = 'contextgo/contextgo-releases';
const DEFAULT_CONTENT_BRANCH = 'main';
const CACHE_REVALIDATE_SECONDS = 300;

const getReleaseDocsRepository = (): string => process.env.CONTEXTGO_RELEASE_REPO || DEFAULT_RELEASE_REPOSITORY;

const getReleaseSiteBaseUrl = (): string =>
  `https://raw.githubusercontent.com/${getReleaseDocsRepository()}/${DEFAULT_CONTENT_BRANCH}/site`;

const fetchReleaseJson = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Release docs request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

const isValidReleaseDocsLatest = (value: unknown): value is ReleaseDocsLatest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsLatest>;
  return candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION && typeof candidate.version === 'string';
};

const isValidReleaseDocsVersion = (value: unknown): value is ReleaseDocsVersion => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsVersion>;
  return typeof candidate.version === 'string' && typeof candidate.exportedAt === 'string';
};

const isValidReleaseDocsIndex = (value: unknown): value is ReleaseDocsIndex => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsIndex>;
  return (
    candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION &&
    typeof candidate.latestVersion === 'string' &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.versions) &&
    candidate.versions.every((entry) => isValidReleaseDocsVersion(entry))
  );
};

const isValidArticle = (value: unknown): value is PublicArticle => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PublicArticle>;
  return (
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.summary === 'string' &&
    typeof candidate.readingTime === 'string' &&
    typeof candidate.html === 'string'
  );
};

const isValidReleaseDocsSectionPayload = (value: unknown): value is ReleaseDocsSectionPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsSectionPayload>;
  return (
    candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION &&
    typeof candidate.version === 'string' &&
    (candidate.locale === 'en' || candidate.locale === 'zh') &&
    typeof candidate.exportedAt === 'string' &&
    Boolean(candidate.docs) &&
    Array.isArray(candidate.docs?.entries) &&
    Array.isArray(candidate.docs?.categories)
  );
};

const isValidReleaseDocsArticlePayload = (value: unknown): value is ReleaseDocsArticlePayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsArticlePayload>;
  return (
    candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION &&
    typeof candidate.version === 'string' &&
    (candidate.locale === 'en' || candidate.locale === 'zh') &&
    typeof candidate.exportedAt === 'string' &&
    isValidArticle(candidate.article)
  );
};

const createFallbackDocsIndex = (version: string): ReleaseDocsIndex => ({
  schemaVersion: PUBLIC_CONTENT_SCHEMA_VERSION,
  latestVersion: version,
  exportedAt: new Date(0).toISOString(),
  versions: [
    {
      version,
      exportedAt: new Date(0).toISOString(),
    },
  ],
});

export const createFallbackReleaseDocs = (locale: SiteLocale): ResolvedReleaseDocs => {
  const collection = draftDocsCollections[locale];
  return {
    source: 'site-fallback',
    bundle: {
      schemaVersion: collection.schemaVersion,
      version: collection.version,
      locale: collection.locale,
      exportedAt: collection.exportedAt,
      sourceRef: collection.sourceRef,
      docs: collection.docs,
    },
    index: createFallbackDocsIndex(collection.version),
    articles: collection.articles,
  };
};

export const getResolvedReleaseDocs = async (locale: SiteLocale): Promise<ResolvedReleaseDocs> => {
  try {
    const baseUrl = getReleaseSiteBaseUrl();
    const latest = await fetchReleaseJson<ReleaseDocsLatest>(`${baseUrl}/docs/latest.json`);

    if (!latest || !isValidReleaseDocsLatest(latest)) {
      return createFallbackReleaseDocs(locale);
    }

    const [index, bundle] = await Promise.all([
      fetchReleaseJson<ReleaseDocsIndex>(`${baseUrl}/docs/versions.json`),
      fetchReleaseJson<ReleaseDocsSectionPayload>(`${baseUrl}/docs/${latest.version}/${locale}/index.json`),
    ]);

    if (!bundle || !isValidReleaseDocsSectionPayload(bundle)) {
      return createFallbackReleaseDocs(locale);
    }

    return {
      source: 'release-repo',
      bundle,
      index: index && isValidReleaseDocsIndex(index) ? index : createFallbackDocsIndex(latest.version),
      articles: {},
    };
  } catch (error) {
    console.error('[web] Failed to fetch release docs:', error);
    return createFallbackReleaseDocs(locale);
  }
};

export const getReleaseDocGroups = (resolved: ResolvedReleaseDocs): DocGroup[] => {
  return resolved.bundle.docs.categories.map((category) => ({
    ...category,
    entries: resolved.bundle.docs.entries.filter((entry) => entry.category === category.id),
  }));
};

export const getReleaseDocEntry = async (resolved: ResolvedReleaseDocs, slug: string): Promise<PublicArticle | null> => {
  if (resolved.source === 'site-fallback') {
    return resolved.articles[slug] ?? null;
  }

  try {
    const articlePayload = await fetchReleaseJson<ReleaseDocsArticlePayload>(
      `${getReleaseSiteBaseUrl()}/docs/${resolved.bundle.version}/${resolved.bundle.locale}/${slug}/article.json`
    );

    if (articlePayload && isValidReleaseDocsArticlePayload(articlePayload)) {
      return articlePayload.article;
    }
  } catch (error) {
    console.error('[web] Failed to fetch release doc article:', error);
  }

  return draftDocsCollections[resolved.bundle.locale].articles[slug] ?? null;
};

export const getReleaseDocsRepositoryUrl = (): string => `https://github.com/${getReleaseDocsRepository()}`;
