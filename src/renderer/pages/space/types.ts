export type SpacePrimaryView = 'overview' | 'docs' | 'canvas' | 'context';

export type SpaceSelectionKind =
  | 'document'
  | 'board'
  | 'artifact'
  | 'memory'
  | 'memory-candidate'
  | 'source'
  | 'thread'
  | 'database-record';

export type SpaceSelectionItem = {
  kind: SpaceSelectionKind;
  id: string;
  title?: string;
  summary?: string;
};

export type AskAgentSelectionPayload = {
  spaceId: string;
  view: SpacePrimaryView;
  items: readonly SpaceSelectionItem[];
};

export type SpaceOverviewCardKey =
  | 'recent_threads'
  | 'recent_docs'
  | 'recent_artifacts'
  | 'connector_status'
  | 'pending_reviews';
