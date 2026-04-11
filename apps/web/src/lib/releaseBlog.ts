import 'server-only';

import { draftBlogCollections } from './public-content/generated/blog';
import {
  PUBLIC_CONTENT_SCHEMA_VERSION,
  type PublicArticle,
  type ReleaseBlogArticlePayload,
  type ReleaseBlogSectionPayload,
  type ResolvedReleaseBlog,
  type SiteLocale,
} from './public-content/types';

const DEFAULT_RELEASE_REPOSITORY = 'contextgo/contextgo-releases';
const DEFAULT_CONTENT_BRANCH = 'main';
const CACHE_REVALIDATE_SECONDS = 300;

const getReleaseBlogRepository = (): string => process.env.CONTEXTGO_RELEASE_REPO || DEFAULT_RELEASE_REPOSITORY;

const getReleaseSiteBaseUrl = (): string =>
  `https://raw.githubusercontent.com/${getReleaseBlogRepository()}/${DEFAULT_CONTENT_BRANCH}/site`;

const fetchReleaseJson = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Release blog request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
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

const isValidReleaseBlogSectionPayload = (value: unknown): value is ReleaseBlogSectionPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseBlogSectionPayload>;
  return (
    candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION &&
    (candidate.locale === 'en' || candidate.locale === 'zh') &&
    typeof candidate.exportedAt === 'string' &&
    Boolean(candidate.blog) &&
    Array.isArray(candidate.blog?.entries)
  );
};

const isValidReleaseBlogArticlePayload = (value: unknown): value is ReleaseBlogArticlePayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseBlogArticlePayload>;
  return (
    candidate.schemaVersion === PUBLIC_CONTENT_SCHEMA_VERSION &&
    (candidate.locale === 'en' || candidate.locale === 'zh') &&
    typeof candidate.exportedAt === 'string' &&
    isValidArticle(candidate.article)
  );
};

export const createFallbackReleaseBlog = (locale: SiteLocale): ResolvedReleaseBlog => {
  const collection = draftBlogCollections[locale];
  return {
    source: 'site-fallback',
    bundle: {
      schemaVersion: collection.schemaVersion,
      locale: collection.locale,
      exportedAt: collection.exportedAt,
      sourceRef: collection.sourceRef,
      blog: collection.blog,
    },
    articles: collection.articles,
  };
};

export const getResolvedReleaseBlog = async (locale: SiteLocale): Promise<ResolvedReleaseBlog> => {
  try {
    const bundle = await fetchReleaseJson<ReleaseBlogSectionPayload>(`${getReleaseSiteBaseUrl()}/blog/${locale}/index.json`);

    if (!bundle || !isValidReleaseBlogSectionPayload(bundle)) {
      return createFallbackReleaseBlog(locale);
    }

    return {
      source: 'release-repo',
      bundle,
      articles: {},
    };
  } catch (error) {
    console.error('[web] Failed to fetch release blog:', error);
    return createFallbackReleaseBlog(locale);
  }
};

export const getReleaseBlogEntry = async (resolved: ResolvedReleaseBlog, slug: string): Promise<PublicArticle | null> => {
  if (resolved.source === 'site-fallback') {
    return resolved.articles[slug] ?? null;
  }

  try {
    const articlePayload = await fetchReleaseJson<ReleaseBlogArticlePayload>(
      `${getReleaseSiteBaseUrl()}/blog/${resolved.bundle.locale}/${slug}/article.json`
    );

    if (articlePayload && isValidReleaseBlogArticlePayload(articlePayload)) {
      return articlePayload.article;
    }
  } catch (error) {
    console.error('[web] Failed to fetch release blog article:', error);
  }

  return draftBlogCollections[resolved.bundle.locale].articles[slug] ?? null;
};
