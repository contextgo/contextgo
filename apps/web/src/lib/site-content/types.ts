import 'server-only';

export type SiteLocale = 'en' | 'zh';

export type ContentCard = {
  eyebrow: string;
  title: string;
  summary: string;
  href: string;
  cta: string;
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
  changelog: ChangelogSection;
  resources: ResourcesSection;
  labels: SiteLabels;
};
