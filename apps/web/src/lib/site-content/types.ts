import 'server-only';

export type SiteLocale = 'en' | 'zh';
export type DocCategoryId = 'guides' | 'features' | 'operations';

export type ContentSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type ContentArticle = {
  slug: string;
  category?: DocCategoryId;
  eyebrow: string;
  title: string;
  summary: string;
  readingTime: string;
  updatedAt?: string;
  publishedAt?: string;
  sections: ContentSection[];
};

export type ContentCard = {
  eyebrow: string;
  title: string;
  summary: string;
  href: string;
  cta: string;
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
  entries: ContentArticle[];
};

export type BlogSection = {
  badge: string;
  title: string;
  description: string;
  featuredLabel: string;
  featuredDescription: string;
  entries: ContentArticle[];
};

export type ChangelogSection = {
  badge: string;
  title: string;
  description: string;
  summaryTitle: string;
  summaryBody: string;
  operationsTitle: string;
  operations: string[];
  notesTitle: string;
  notes: string[];
};

export type ResourcesSection = {
  badge: string;
  title: string;
  description: string;
  cards: ContentCard[];
};

export type SiteLabels = {
  updated: string;
  published: string;
  readingTime: string;
  backToDocs: string;
  backToBlog: string;
  latestRelease: string;
  releaseSource: string;
  openDownloadCenter: string;
  openReleasePage: string;
  articleSidebarTitle: string;
  articleSidebarBody: string;
  docsSource: string;
  docsSourceRelease: string;
  docsSourceFallback: string;
  openReleaseRepository: string;
  openVersionedDocs: string;
  releaseHistory: string;
  docsVersionLabel: string;
};

export type SiteContentBundle = {
  docs: DocsSection;
  blog: BlogSection;
  changelog: ChangelogSection;
  resources: ResourcesSection;
  labels: SiteLabels;
};

export type ReleaseDocsVersion = {
  version: string;
  exportedAt: string;
  sourceRef?: string;
};

export type ReleaseDocsLatest = {
  schemaVersion: 1;
  version: string;
  exportedAt: string;
  sourceRef?: string;
};

export type ReleaseDocsIndex = {
  schemaVersion: 1;
  latestVersion: string;
  exportedAt: string;
  versions: ReleaseDocsVersion[];
};

export type ReleaseDocsBundle = {
  schemaVersion: 1;
  version: string;
  locale: SiteLocale;
  exportedAt: string;
  sourceRef?: string;
  docs: DocsSection;
  labels: SiteLabels;
};

export type ResolvedReleaseDocs = {
  source: 'release-repo' | 'site-fallback';
  bundle: ReleaseDocsBundle;
  index: ReleaseDocsIndex;
};

export type DocGroup = {
  id: DocCategoryId;
  title: string;
  description: string;
  entries: ContentArticle[];
};
