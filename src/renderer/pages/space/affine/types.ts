import type { TChatConversation } from '@/common/config/storage';

export type SpaceAffineCanvasParagraph = {
  text: string;
  type: 'text' | 'h3' | 'h4' | 'quote';
};

export type SpaceAffineCanvasSelectionKind = 'project' | 'session' | 'memory' | 'profile';

export type SpaceAffineCanvasSelectionItem = {
  itemId: string;
  blocks: SpaceAffineCanvasParagraph[];
  conversationId?: string;
  kind: SpaceAffineCanvasSelectionKind;
  projectKey?: string;
  status?: 'ready' | 'running';
  title: string;
  workingDirectory?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backend?: TChatConversation['type'];
};

export type SpaceAffineCanvasProjection = {
  items: SpaceAffineCanvasSelectionItem[];
};

export type SpaceAffineCanvasLabels = {
  backendLabel: (backend: TChatConversation['type']) => string;
  memorySummary: (count: number) => string;
  memoryTitle: string;
  profileSummary: (count: number) => string;
  profileTitle: string;
  projectSummary: (sessionCount: number, runningCount: number) => string;
  sessionSummary: (backendLabel: string, statusLabel: string) => string;
  statusLabels: Record<'ready' | 'running', string>;
};
