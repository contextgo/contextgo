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
};

export type SiteContentBundle = {
  docs: DocsSection;
  blog: BlogSection;
  changelog: ChangelogSection;
  resources: ResourcesSection;
  labels: SiteLabels;
};

export type DocGroup = {
  id: DocCategoryId;
  title: string;
  description: string;
  entries: ContentArticle[];
};
