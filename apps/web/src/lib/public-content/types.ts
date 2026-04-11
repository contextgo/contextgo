export const PUBLIC_CONTENT_SCHEMA_VERSION = 1;

export const PUBLIC_CONTENT_LOCALES = ['en', 'zh'] as const;
export type SiteLocale = (typeof PUBLIC_CONTENT_LOCALES)[number];

export const DOC_CATEGORY_IDS = ['guides', 'features', 'operations'] as const;
export type DocCategoryId = (typeof DOC_CATEGORY_IDS)[number];

export type PublicArticleMeta = {
  slug: string;
  category?: DocCategoryId;
  eyebrow: string;
  title: string;
  summary: string;
  readingTime: string;
  updatedAt?: string;
  publishedAt?: string;
};

export type PublicArticle = PublicArticleMeta & {
  html: string;
};

export type DocsSection = {
  badge: string;
  title: string;
  description: string;
  featuredLabel: string;
  featuredDescription: string;
  categories: Array<{
    id: DocCategoryId;
    title: string;
    description: string;
  }>;
  entries: PublicArticleMeta[];
};

export type BlogSection = {
  badge: string;
  title: string;
  description: string;
  featuredLabel: string;
  featuredDescription: string;
  entries: PublicArticleMeta[];
};

export type DocsCollection = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  version: string;
  locale: SiteLocale;
  exportedAt: string;
  sourceRef?: string;
  docs: DocsSection;
  articles: Record<string, PublicArticle>;
};

export type DocsCollectionMap = Record<SiteLocale, DocsCollection>;

export type BlogCollection = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  locale: SiteLocale;
  exportedAt: string;
  sourceRef?: string;
  blog: BlogSection;
  articles: Record<string, PublicArticle>;
};

export type BlogCollectionMap = Record<SiteLocale, BlogCollection>;

export type ReleaseDocsVersion = {
  version: string;
  exportedAt: string;
  sourceRef?: string;
};

export type ReleaseDocsLatest = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  version: string;
  exportedAt: string;
  sourceRef?: string;
};

export type ReleaseDocsIndex = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  latestVersion: string;
  exportedAt: string;
  versions: ReleaseDocsVersion[];
};

export type ReleaseDocsSectionPayload = Omit<DocsCollection, 'articles'>;

export type ReleaseDocsArticlePayload = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  version: string;
  locale: SiteLocale;
  exportedAt: string;
  sourceRef?: string;
  article: PublicArticle;
};

export type ReleaseBlogSectionPayload = Omit<BlogCollection, 'articles'>;

export type ReleaseBlogArticlePayload = {
  schemaVersion: typeof PUBLIC_CONTENT_SCHEMA_VERSION;
  locale: SiteLocale;
  exportedAt: string;
  sourceRef?: string;
  article: PublicArticle;
};

export type ResolvedReleaseDocs = {
  source: 'release-repo' | 'site-fallback';
  bundle: ReleaseDocsSectionPayload;
  index: ReleaseDocsIndex;
  articles: Record<string, PublicArticle>;
};

export type ResolvedReleaseBlog = {
  source: 'release-repo' | 'site-fallback';
  bundle: ReleaseBlogSectionPayload;
  articles: Record<string, PublicArticle>;
};

export type DocGroup = {
  id: DocCategoryId;
  title: string;
  description: string;
  entries: PublicArticleMeta[];
};
