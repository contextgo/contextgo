import { getChangelogSection, getResourcesSection, getSiteLabels } from './common';
import type { SiteContentBundle, SiteLocale } from './types';

export type {
  ChangelogSection,
  ContentCard,
  ResourcesSection,
  SiteContentBundle,
  SiteLabels,
  SiteLocale,
} from './types';

export const getSiteContent = (locale: SiteLocale): SiteContentBundle => ({
  changelog: getChangelogSection(locale),
  resources: getResourcesSection(locale),
  labels: getSiteLabels(locale),
});
