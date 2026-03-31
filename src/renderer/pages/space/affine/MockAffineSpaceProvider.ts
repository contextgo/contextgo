import type {
  AffineBoardCardRef,
  AffineBoardRef,
  AffineDocRef,
  AffineEmbedDescriptor,
  AffineEmbedTarget,
  AffineProviderStatus,
  AffineSelectionContext,
  IAffineSpaceProvider,
} from './IAffineSpaceProvider';
import type { AskAgentSelectionPayload } from '../types';

export type MockAffineSpaceProviderOptions = {
  docs?: readonly AffineDocRef[];
  boards?: readonly AffineBoardRef[];
  selection?: AffineSelectionContext;
  onAskAgentWithSelection?: (payload: AskAgentSelectionPayload) => void | Promise<void>;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPreview(content: string | undefined): string | undefined {
  if (!content) {
    return undefined;
  }
  return content.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' · ');
}

function createBoardCard(params: { candidateId: string; title: string; markdown?: string }): AffineBoardCardRef {
  return {
    id: createId('card'),
    title: params.title,
    markdown: params.markdown,
    preview: buildPreview(params.markdown),
    sourceCandidateId: params.candidateId,
  };
}

export class MockAffineSpaceProvider implements IAffineSpaceProvider {
  private docs: AffineDocRef[];
  private boards: AffineBoardRef[];
  private selection: AffineSelectionContext;
  private readonly onAskAgentWithSelection?: MockAffineSpaceProviderOptions['onAskAgentWithSelection'];

  constructor(options: MockAffineSpaceProviderOptions = {}) {
    this.docs = [...(options.docs ?? [])];
    this.boards = [...(options.boards ?? [])];
    this.selection =
      options.selection ??
      ({
        items: [],
        summary: 'No active selection',
      } satisfies AffineSelectionContext);
    this.onAskAgentWithSelection = options.onAskAgentWithSelection;
  }

  async getStatus(): Promise<AffineProviderStatus> {
    return {
      mode: 'mock',
      ready: true,
      label: 'Mock AFFiNE Provider',
      description: 'Markdown-first mock provider for docs and boards.',
    };
  }

  async listDocs(spaceId: string): Promise<readonly AffineDocRef[]> {
    return this.docs.filter((doc) => doc.spaceId === spaceId);
  }

  async listBoards(spaceId: string): Promise<readonly AffineBoardRef[]> {
    return this.boards.filter((board) => board.spaceId === spaceId);
  }

  async createDoc(spaceId: string, title: string, initialContent?: string): Promise<AffineDocRef> {
    const doc = {
      id: createId('doc'),
      title,
      spaceId,
      content: initialContent,
      preview: buildPreview(initialContent),
    } satisfies AffineDocRef;
    this.docs = [doc, ...this.docs];
    return doc;
  }

  async createBoard(spaceId: string, title: string, initialContent?: string): Promise<AffineBoardRef> {
    const board = {
      id: createId('board'),
      title,
      spaceId,
      content: initialContent,
      preview: buildPreview(initialContent),
      cards: [],
    } satisfies AffineBoardRef;
    this.boards = [board, ...this.boards];
    return board;
  }

  async openDoc(_spaceId: string, _docId: string): Promise<void> {}

  async openBoard(_spaceId: string, _boardId: string): Promise<void> {}

  async getEmbedDescriptor(target: AffineEmbedTarget): Promise<AffineEmbedDescriptor> {
    return {
      title: target.kind === 'doc' ? 'AFFiNE Doc Surface' : 'AFFiNE Canvas Surface',
      mode: 'placeholder',
    };
  }

  async promoteCandidateToDoc(params: {
    spaceId: string;
    candidateId: string;
    docId?: string;
    title?: string;
    content?: string;
  }): Promise<AffineDocRef> {
    if (params.docId) {
      const existing = this.docs.find((doc) => doc.id === params.docId && doc.spaceId === params.spaceId);
      if (existing) {
        return existing;
      }
    }
    return this.createDoc(params.spaceId, params.title || `Candidate ${params.candidateId}`, params.content);
  }

  async promoteCandidateToBoard(params: {
    spaceId: string;
    candidateId: string;
    boardId?: string;
    title?: string;
    content?: string;
  }): Promise<AffineBoardRef> {
    const card = createBoardCard({
      candidateId: params.candidateId,
      title: params.title || `Candidate ${params.candidateId}`,
      markdown: params.content,
    });

    if (params.boardId) {
      const existing = this.boards.find((board) => board.id === params.boardId && board.spaceId === params.spaceId);
      if (existing) {
        const nextBoard: AffineBoardRef = {
          ...existing,
          preview: card.preview ?? existing.preview,
          cards: [card, ...(existing.cards ?? [])],
        };
        this.boards = this.boards.map((board) => (board.id === existing.id ? nextBoard : board));
        return nextBoard;
      }
    }

    const board = await this.createBoard(params.spaceId, params.title || `Candidate ${params.candidateId}`, params.content);
    const nextBoard: AffineBoardRef = {
      ...board,
      cards: [card],
      preview: card.preview ?? board.preview,
    };
    this.boards = this.boards.map((item) => (item.id === board.id ? nextBoard : item));
    return nextBoard;
  }

  async getSelectionContext(spaceId: string): Promise<AffineSelectionContext> {
    return {
      ...this.selection,
      items: this.selection.items.filter((item) => item.id.length > 0),
      summary: this.selection.summary ?? `Selection inside ${spaceId}`,
    };
  }

  async askAgentWithSelection(payload: AskAgentSelectionPayload): Promise<void> {
    await this.onAskAgentWithSelection?.(payload);
  }
}
