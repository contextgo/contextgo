import type { AskAgentSelectionPayload, SpaceSelectionItem } from '../types';

export type AffineDocRef = {
  id: string;
  title: string;
  spaceId: string;
  preview?: string;
  content?: string;
};

export type AffineBoardCardRef = {
  id: string;
  title: string;
  preview?: string;
  markdown?: string;
  sourceCandidateId?: string;
};

export type AffineBoardRef = {
  id: string;
  title: string;
  spaceId: string;
  preview?: string;
  content?: string;
  cards?: readonly AffineBoardCardRef[];
};

export type AffineSelectionContext = {
  items: readonly SpaceSelectionItem[];
  summary?: string;
};

export type AffineEmbedTarget = {
  kind: 'doc' | 'board';
  spaceId: string;
  entityId: string;
};

export type AffineEmbedDescriptor = {
  src?: string;
  title: string;
  mode: 'iframe' | 'webview' | 'placeholder';
};

export type AffineProviderStatus = {
  mode: 'mock' | 'shell' | 'embedded';
  ready: boolean;
  label: string;
  description?: string;
  repoPath?: string;
  webAppUrl?: string;
};

export interface IAffineSpaceProvider {
  getStatus(): Promise<AffineProviderStatus>;
  listDocs(spaceId: string): Promise<readonly AffineDocRef[]>;
  listBoards(spaceId: string): Promise<readonly AffineBoardRef[]>;
  createDoc(spaceId: string, title: string, initialContent?: string): Promise<AffineDocRef>;
  createBoard(spaceId: string, title: string, initialContent?: string): Promise<AffineBoardRef>;
  openDoc(spaceId: string, docId: string): Promise<void>;
  openBoard(spaceId: string, boardId: string): Promise<void>;
  getEmbedDescriptor(target: AffineEmbedTarget): Promise<AffineEmbedDescriptor>;
  promoteCandidateToDoc(params: {
    spaceId: string;
    candidateId: string;
    docId?: string;
    title?: string;
    content?: string;
  }): Promise<AffineDocRef>;
  promoteCandidateToBoard(params: {
    spaceId: string;
    candidateId: string;
    boardId?: string;
    title?: string;
    content?: string;
  }): Promise<AffineBoardRef>;
  getSelectionContext(spaceId: string): Promise<AffineSelectionContext>;
  askAgentWithSelection(payload: AskAgentSelectionPayload): Promise<void>;
}
