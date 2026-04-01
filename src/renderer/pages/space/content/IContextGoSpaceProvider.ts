import type { AskAgentSelectionPayload, SpaceSelectionItem } from '../types';

export type ContextGoDocRef = {
  id: string;
  title: string;
  spaceId: string;
  preview?: string;
  content?: string;
};

export type ContextGoBoardCardRef = {
  id: string;
  title: string;
  preview?: string;
  markdown?: string;
  sourceCandidateId?: string;
};

export type ContextGoBoardRef = {
  id: string;
  title: string;
  spaceId: string;
  preview?: string;
  content?: string;
  cards?: readonly ContextGoBoardCardRef[];
};

export type ContextGoSelectionContext = {
  items: readonly SpaceSelectionItem[];
  summary?: string;
};

export type ContextGoEmbedTarget = {
  kind: 'doc' | 'board';
  spaceId: string;
  entityId: string;
};

export type ContextGoEmbedDescriptor = {
  src?: string;
  title: string;
  mode: 'iframe' | 'webview' | 'placeholder';
};

export type ContextGoSurfaceStatus = {
  mode: 'mock' | 'shell' | 'embedded';
  ready: boolean;
  label: string;
  description?: string;
  repoPath?: string;
  webAppUrl?: string;
};

export interface IContextGoSpaceProvider {
  getStatus(): Promise<ContextGoSurfaceStatus>;
  listDocs(spaceId: string): Promise<readonly ContextGoDocRef[]>;
  listBoards(spaceId: string): Promise<readonly ContextGoBoardRef[]>;
  createDoc(spaceId: string, title: string, initialContent?: string): Promise<ContextGoDocRef>;
  createBoard(spaceId: string, title: string, initialContent?: string): Promise<ContextGoBoardRef>;
  openDoc(spaceId: string, docId: string): Promise<void>;
  openBoard(spaceId: string, boardId: string): Promise<void>;
  getEmbedDescriptor(target: ContextGoEmbedTarget): Promise<ContextGoEmbedDescriptor>;
  promoteCandidateToDoc(params: {
    spaceId: string;
    candidateId: string;
    docId?: string;
    title?: string;
    content?: string;
  }): Promise<ContextGoDocRef>;
  promoteCandidateToBoard(params: {
    spaceId: string;
    candidateId: string;
    boardId?: string;
    title?: string;
    content?: string;
  }): Promise<ContextGoBoardRef>;
  getSelectionContext(spaceId: string): Promise<ContextGoSelectionContext>;
  askAgentWithSelection(payload: AskAgentSelectionPayload): Promise<void>;
}
