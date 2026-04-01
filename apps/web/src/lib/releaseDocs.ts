import 'server-only';

import {
  type DocGroup,
  type ReleaseDocsBundle,
  type ReleaseDocsIndex,
  type ReleaseDocsLatest,
  type ReleaseDocsVersion,
  type ResolvedReleaseDocs,
  type SiteLocale,
} from './site-content/types';
import { getSiteLabels } from './site-content/common';
import { getDocsSection } from './site-content/docs';

const DEFAULT_RELEASE_REPOSITORY = 'contextgo/contextgo-releases';
const DEFAULT_DOCS_BRANCH = 'main';
const DOCS_SCHEMA_VERSION = 1;
const CACHE_REVALIDATE_SECONDS = 300;

const getReleaseDocsRepository = (): string => process.env.CONTEXTGO_RELEASE_REPO || DEFAULT_RELEASE_REPOSITORY;

const getReleaseDocsBaseUrl = (): string =>
  `https://raw.githubusercontent.com/${getReleaseDocsRepository()}/${DEFAULT_DOCS_BRANCH}/docs`;

const isValidReleaseDocsLatest = (value: unknown): value is ReleaseDocsLatest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsLatest>;
  return candidate.schemaVersion === DOCS_SCHEMA_VERSION && typeof candidate.version === 'string';
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
    candidate.schemaVersion === DOCS_SCHEMA_VERSION &&
    typeof candidate.latestVersion === 'string' &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.versions) &&
    candidate.versions.every((entry) => isValidReleaseDocsVersion(entry))
  );
};

const isValidReleaseDocsBundle = (value: unknown): value is ReleaseDocsBundle => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleaseDocsBundle>;
  return (
    candidate.schemaVersion === DOCS_SCHEMA_VERSION &&
    typeof candidate.version === 'string' &&
    (candidate.locale === 'en' || candidate.locale === 'zh') &&
    typeof candidate.exportedAt === 'string' &&
    Boolean(candidate.docs) &&
    Array.isArray(candidate.docs?.entries) &&
    Boolean(candidate.labels)
  );
};

const fetchReleaseDocsJson = async <T>(url: string): Promise<T | null> => {
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

const createFallbackDocsIndex = (version: string): ReleaseDocsIndex => ({
  schemaVersion: DOCS_SCHEMA_VERSION,
  latestVersion: version,
  exportedAt: new Date(0).toISOString(),
  versions: [
    {
      version,
      exportedAt: new Date(0).toISOString(),
    },
  ],
});

const createFallbackDocsBundle = (locale: SiteLocale): ReleaseDocsBundle => ({
  schemaVersion: DOCS_SCHEMA_VERSION,
  version: 'draft',
  locale,
  exportedAt: new Date(0).toISOString(),
  docs: getDocsSection(locale),
  labels: getSiteLabels(locale),
});

export const createFallbackReleaseDocs = (locale: SiteLocale): ResolvedReleaseDocs => {
  const bundle = createFallbackDocsBundle(locale);
  return {
    source: 'site-fallback',
    bundle,
    index: createFallbackDocsIndex(bundle.version),
  };
};

export const getResolvedReleaseDocs = async (locale: SiteLocale): Promise<ResolvedReleaseDocs> => {
  try {
    const baseUrl = getReleaseDocsBaseUrl();
    const latest = await fetchReleaseDocsJson<ReleaseDocsLatest>(`${baseUrl}/latest.json`);

    if (!latest || !isValidReleaseDocsLatest(latest)) {
      return createFallbackReleaseDocs(locale);
    }

    const [index, bundle] = await Promise.all([
      fetchReleaseDocsJson<ReleaseDocsIndex>(`${baseUrl}/versions.json`),
      fetchReleaseDocsJson<ReleaseDocsBundle>(`${baseUrl}/${latest.version}/${locale}.json`),
    ]);

    if (!bundle || !isValidReleaseDocsBundle(bundle)) {
      return createFallbackReleaseDocs(locale);
    }

    return {
      source: 'release-repo',
      bundle,
      index: index && isValidReleaseDocsIndex(index) ? index : createFallbackDocsIndex(latest.version),
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

export const getReleaseDocEntry = (resolved: ResolvedReleaseDocs, slug: string) => {
  return resolved.bundle.docs.entries.find((entry) => entry.slug === slug) ?? null;
};

export const getReleaseDocsRepositoryUrl = (): string => `https://github.com/${getReleaseDocsRepository()}`;
