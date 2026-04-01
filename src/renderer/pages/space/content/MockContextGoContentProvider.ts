import type {
  ContextGoBoardCardRef,
  ContextGoBoardRef,
  ContextGoDocRef,
  ContextGoEmbedDescriptor,
  ContextGoEmbedTarget,
  ContextGoSelectionContext,
  ContextGoSurfaceStatus,
  IContextGoSpaceProvider,
} from './IContextGoSpaceProvider';
import type { AskAgentSelectionPayload } from '../types';

export type MockContextGoContentProviderOptions = {
  docs?: readonly ContextGoDocRef[];
  boards?: readonly ContextGoBoardRef[];
  selection?: ContextGoSelectionContext;
  onAskAgentWithSelection?: (payload: AskAgentSelectionPayload) => void | Promise<void>;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPreview(content: string | undefined): string | undefined {
  if (!content) {
    return undefined;
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
}

function createBoardCard(params: { candidateId: string; title: string; markdown?: string }): ContextGoBoardCardRef {
  return {
    id: createId('card'),
    title: params.title,
    markdown: params.markdown,
    preview: buildPreview(params.markdown),
    sourceCandidateId: params.candidateId,
  };
}

export class MockContextGoContentProvider implements IContextGoSpaceProvider {
  private docs: ContextGoDocRef[];
  private boards: ContextGoBoardRef[];
  private selection: ContextGoSelectionContext;
  private readonly onAskAgentWithSelection?: MockContextGoContentProviderOptions['onAskAgentWithSelection'];

  constructor(options: MockContextGoContentProviderOptions = {}) {
    this.docs = [...(options.docs ?? [])];
    this.boards = [...(options.boards ?? [])];
    this.selection =
      options.selection ??
      ({
        items: [],
        summary: 'No active selection',
      } satisfies ContextGoSelectionContext);
    this.onAskAgentWithSelection = options.onAskAgentWithSelection;
  }

  async getStatus(): Promise<ContextGoSurfaceStatus> {
    return {
      mode: 'mock',
      ready: true,
      label: 'Canvas Runtime',
      description: 'Markdown-first content runtime for docs and boards.',
    };
  }

  async listDocs(spaceId: string): Promise<readonly ContextGoDocRef[]> {
    return this.docs.filter((doc) => doc.spaceId === spaceId);
  }

  async listBoards(spaceId: string): Promise<readonly ContextGoBoardRef[]> {
    return this.boards.filter((board) => board.spaceId === spaceId);
  }

  async createDoc(spaceId: string, title: string, initialContent?: string): Promise<ContextGoDocRef> {
    const doc = {
      id: createId('doc'),
      title,
      spaceId,
      content: initialContent,
      preview: buildPreview(initialContent),
    } satisfies ContextGoDocRef;
    this.docs = [doc, ...this.docs];
    return doc;
  }

  async createBoard(spaceId: string, title: string, initialContent?: string): Promise<ContextGoBoardRef> {
    const board = {
      id: createId('board'),
      title,
      spaceId,
      content: initialContent,
      preview: buildPreview(initialContent),
      cards: [] as ContextGoBoardCardRef[],
    } satisfies ContextGoBoardRef;
    this.boards = [board, ...this.boards];
    return board;
  }

  async openDoc(_spaceId: string, _docId: string): Promise<void> {}

  async openBoard(_spaceId: string, _boardId: string): Promise<void> {}

  async getEmbedDescriptor(target: ContextGoEmbedTarget): Promise<ContextGoEmbedDescriptor> {
    return {
      title: target.kind === 'doc' ? 'Space Docs' : 'Space Canvas',
      mode: 'placeholder',
    };
  }

  async promoteCandidateToDoc(params: {
    spaceId: string;
    candidateId: string;
    docId?: string;
    title?: string;
    content?: string;
  }): Promise<ContextGoDocRef> {
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
  }): Promise<ContextGoBoardRef> {
    const card = createBoardCard({
      candidateId: params.candidateId,
      title: params.title || `Candidate ${params.candidateId}`,
      markdown: params.content,
    });

    if (params.boardId) {
      const existing = this.boards.find((board) => board.id === params.boardId && board.spaceId === params.spaceId);
      if (existing) {
        const nextBoard: ContextGoBoardRef = {
          ...existing,
          preview: card.preview ?? existing.preview,
          cards: [card, ...(existing.cards ?? [])],
        };
        this.boards = this.boards.map((board) => (board.id === existing.id ? nextBoard : board));
        return nextBoard;
      }
    }

    const board = await this.createBoard(
      params.spaceId,
      params.title || `Candidate ${params.candidateId}`,
      params.content
    );
    const nextBoard: ContextGoBoardRef = {
      ...board,
      cards: [card],
      preview: card.preview ?? board.preview,
    };
    this.boards = this.boards.map((item) => (item.id === board.id ? nextBoard : item));
    return nextBoard;
  }

  async getSelectionContext(spaceId: string): Promise<ContextGoSelectionContext> {
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
