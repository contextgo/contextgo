import type { TSpace } from '@/common/config/storage';
import type {
  ContextGoBoardRef,
  ContextGoDocRef,
  ContextGoEmbedDescriptor,
  ContextGoEmbedTarget,
  ContextGoSelectionContext,
  ContextGoSurfaceStatus,
  IContextGoSpaceProvider,
} from './IContextGoSpaceProvider';
import type { AskAgentSelectionPayload } from '../types';
import { MockContextGoContentProvider, type MockContextGoContentProviderOptions } from './MockContextGoContentProvider';

export type ContextGoContentBridgeOptions = MockContextGoContentProviderOptions & {
  space?: TSpace;
  repoPath?: string;
  webAppUrl?: string;
  mode?: 'mock' | 'shell' | 'embedded';
  onOpenDoc?: (params: { spaceId: string; docId: string }) => void | Promise<void>;
  onOpenBoard?: (params: { spaceId: string; boardId: string }) => void | Promise<void>;
};

function resolveWorkspaceId(space: TSpace | undefined, fallbackSpaceId: string): string {
  return space?.providerRef?.workspaceId || fallbackSpaceId;
}

function resolveTargetId(space: TSpace | undefined, target: ContextGoEmbedTarget): string {
  if (target.kind === 'doc') {
    return target.entityId || space?.providerRef?.homeDocId || target.spaceId;
  }

  return target.entityId || space?.providerRef?.homeBoardId || target.spaceId;
}

function buildEmbedUrl(baseUrl: string | undefined, target: ContextGoEmbedTarget, space?: TSpace): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  const normalized = baseUrl.replace(/\/$/, '');
  const workspaceId = resolveWorkspaceId(space, target.spaceId);
  const targetId = resolveTargetId(space, target);

  return `${normalized}/workspace/${workspaceId}/${targetId}?mode=${target.kind === 'doc' ? 'page' : 'edgeless'}`;
}

export class ContextGoContentBridge implements IContextGoSpaceProvider {
  private readonly delegate: MockContextGoContentProvider;
  private readonly options: ContextGoContentBridgeOptions;

  constructor(options: ContextGoContentBridgeOptions = {}) {
    this.options = options;
    this.delegate = new MockContextGoContentProvider(options);
  }

  async getStatus(): Promise<ContextGoSurfaceStatus> {
    return {
      mode: this.options.mode ?? 'shell',
      ready: true,
      label: 'Canvas Runtime',
      description:
        this.options.mode === 'embedded'
          ? 'Embedded content runtime ready for doc/canvas mounting.'
          : 'Minimal content bridge for future native document and canvas integration.',
      repoPath: this.options.repoPath,
      webAppUrl: this.options.webAppUrl,
    };
  }

  async listDocs(spaceId: string): Promise<readonly ContextGoDocRef[]> {
    return this.delegate.listDocs(spaceId);
  }

  async listBoards(spaceId: string): Promise<readonly ContextGoBoardRef[]> {
    return this.delegate.listBoards(spaceId);
  }

  async createDoc(spaceId: string, title: string, initialContent?: string): Promise<ContextGoDocRef> {
    return this.delegate.createDoc(spaceId, title, initialContent);
  }

  async createBoard(spaceId: string, title: string, initialContent?: string): Promise<ContextGoBoardRef> {
    return this.delegate.createBoard(spaceId, title, initialContent);
  }

  async openDoc(spaceId: string, docId: string): Promise<void> {
    if (this.options.onOpenDoc) {
      await this.options.onOpenDoc({ spaceId, docId });
      return;
    }

    const url = buildEmbedUrl(this.options.webAppUrl, { kind: 'doc', spaceId, entityId: docId }, this.options.space);
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async openBoard(spaceId: string, boardId: string): Promise<void> {
    if (this.options.onOpenBoard) {
      await this.options.onOpenBoard({ spaceId, boardId });
      return;
    }

    const url = buildEmbedUrl(
      this.options.webAppUrl,
      { kind: 'board', spaceId, entityId: boardId },
      this.options.space
    );
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async getEmbedDescriptor(target: ContextGoEmbedTarget): Promise<ContextGoEmbedDescriptor> {
    const mode = this.options.mode ?? 'shell';
    const src = buildEmbedUrl(this.options.webAppUrl, target, this.options.space);

    if (mode !== 'embedded') {
      return {
        title: target.kind === 'doc' ? 'Space Docs' : 'Space Canvas',
        mode: 'placeholder',
      };
    }

    return {
      title: target.kind === 'doc' ? 'Space Docs' : 'Space Canvas',
      mode: src ? 'iframe' : 'placeholder',
      src,
    };
  }

  async promoteCandidateToDoc(params: {
    spaceId: string;
    candidateId: string;
    docId?: string;
    title?: string;
    content?: string;
  }): Promise<ContextGoDocRef> {
    return this.delegate.promoteCandidateToDoc(params);
  }

  async promoteCandidateToBoard(params: {
    spaceId: string;
    candidateId: string;
    boardId?: string;
    title?: string;
    content?: string;
  }): Promise<ContextGoBoardRef> {
    return this.delegate.promoteCandidateToBoard(params);
  }

  async getSelectionContext(spaceId: string): Promise<ContextGoSelectionContext> {
    return this.delegate.getSelectionContext(spaceId);
  }

  async askAgentWithSelection(payload: AskAgentSelectionPayload): Promise<void> {
    await this.delegate.askAgentWithSelection(payload);
  }
}
