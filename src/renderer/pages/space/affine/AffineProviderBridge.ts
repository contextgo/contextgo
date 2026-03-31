import type {
  AffineBoardRef,
  AffineDocRef,
  AffineEmbedDescriptor,
  AffineEmbedTarget,
  AffineProviderStatus,
  AffineSelectionContext,
  IAffineSpaceProvider,
} from './IAffineSpaceProvider';
import type { AskAgentSelectionPayload } from '../types';
import { MockAffineSpaceProvider, type MockAffineSpaceProviderOptions } from './MockAffineSpaceProvider';

export type AffineProviderBridgeOptions = MockAffineSpaceProviderOptions & {
  repoPath?: string;
  webAppUrl?: string;
  mode?: 'mock' | 'shell' | 'embedded';
  onOpenDoc?: (params: { spaceId: string; docId: string }) => void | Promise<void>;
  onOpenBoard?: (params: { spaceId: string; boardId: string }) => void | Promise<void>;
};

function buildEmbedUrl(baseUrl: string | undefined, target: AffineEmbedTarget): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  const normalized = baseUrl.replace(/\/$/, '');
  if (target.kind === 'doc') {
    return `${normalized}/workspace/${target.spaceId}/doc/${target.entityId}`;
  }
  return `${normalized}/workspace/${target.spaceId}/canvas/${target.entityId}`;
}

export class AffineProviderBridge implements IAffineSpaceProvider {
  private readonly delegate: MockAffineSpaceProvider;
  private readonly options: AffineProviderBridgeOptions;

  constructor(options: AffineProviderBridgeOptions = {}) {
    this.options = options;
    this.delegate = new MockAffineSpaceProvider(options);
  }

  async getStatus(): Promise<AffineProviderStatus> {
    return {
      mode: this.options.mode ?? 'shell',
      ready: true,
      label: 'AFFiNE Provider',
      description:
        this.options.mode === 'embedded'
          ? 'Embedded shell ready for AFFiNE doc/canvas mounting.'
          : 'Minimal bridge shell for future AFFiNE document and canvas embedding.',
      repoPath: this.options.repoPath,
      webAppUrl: this.options.webAppUrl,
    };
  }

  async listDocs(spaceId: string): Promise<readonly AffineDocRef[]> {
    return this.delegate.listDocs(spaceId);
  }

  async listBoards(spaceId: string): Promise<readonly AffineBoardRef[]> {
    return this.delegate.listBoards(spaceId);
  }

  async createDoc(spaceId: string, title: string, initialContent?: string): Promise<AffineDocRef> {
    return this.delegate.createDoc(spaceId, title, initialContent);
  }

  async createBoard(spaceId: string, title: string, initialContent?: string): Promise<AffineBoardRef> {
    return this.delegate.createBoard(spaceId, title, initialContent);
  }

  async openDoc(spaceId: string, docId: string): Promise<void> {
    if (this.options.onOpenDoc) {
      await this.options.onOpenDoc({ spaceId, docId });
      return;
    }

    const url = buildEmbedUrl(this.options.webAppUrl, { kind: 'doc', spaceId, entityId: docId });
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async openBoard(spaceId: string, boardId: string): Promise<void> {
    if (this.options.onOpenBoard) {
      await this.options.onOpenBoard({ spaceId, boardId });
      return;
    }

    const url = buildEmbedUrl(this.options.webAppUrl, { kind: 'board', spaceId, entityId: boardId });
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async getEmbedDescriptor(target: AffineEmbedTarget): Promise<AffineEmbedDescriptor> {
    const mode = this.options.mode ?? 'shell';
    const src = buildEmbedUrl(this.options.webAppUrl, target);

    if (mode !== 'embedded') {
      return {
        title: target.kind === 'doc' ? 'AFFiNE Doc Surface' : 'AFFiNE Canvas Surface',
        mode: 'placeholder',
      };
    }

    return {
      title: target.kind === 'doc' ? 'AFFiNE Doc Surface' : 'AFFiNE Canvas Surface',
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
  }): Promise<AffineDocRef> {
    return this.delegate.promoteCandidateToDoc(params);
  }

  async promoteCandidateToBoard(params: {
    spaceId: string;
    candidateId: string;
    boardId?: string;
    title?: string;
    content?: string;
  }): Promise<AffineBoardRef> {
    return this.delegate.promoteCandidateToBoard(params);
  }

  async getSelectionContext(spaceId: string): Promise<AffineSelectionContext> {
    return this.delegate.getSelectionContext(spaceId);
  }

  async askAgentWithSelection(payload: AskAgentSelectionPayload): Promise<void> {
    await this.delegate.askAgentWithSelection(payload);
  }
}
