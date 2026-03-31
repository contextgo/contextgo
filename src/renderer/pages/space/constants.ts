import type { SpaceOverviewCardKey, SpacePrimaryView } from './types';

export const SPACE_PRIMARY_VIEWS: readonly SpacePrimaryView[] = ['overview', 'docs', 'canvas', 'context'];

export const SPACE_MVP_PRIMARY_VIEWS: readonly SpacePrimaryView[] = ['overview', 'docs', 'canvas', 'context'];

export const SPACE_OVERVIEW_CARDS: readonly SpaceOverviewCardKey[] = [
  'recent_threads',
  'recent_docs',
  'recent_artifacts',
  'connector_status',
  'pending_reviews',
];
