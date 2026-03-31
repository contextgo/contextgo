import { describe, expect, it, vi } from 'vitest';
import { AffineProviderBridge } from '../../../src/renderer/pages/space/affine/AffineProviderBridge';

describe('AffineProviderBridge', () => {
  it('returns provider status and delegates doc creation', async () => {
    const provider = new AffineProviderBridge({
      mode: 'shell',
      repoPath: '/Users/codefriday/workspace/project/contextgo/affine',
    });

    const status = await provider.getStatus();
    const doc = await provider.createDoc('space-1', 'Project Plan');

    expect(status.mode).toBe('shell');
    expect(status.repoPath).toContain('/affine');
    expect(doc.spaceId).toBe('space-1');
    expect(doc.title).toBe('Project Plan');
  });

  it('uses explicit open callbacks when provided', async () => {
    const onOpenDoc = vi.fn(async () => undefined);
    const onOpenBoard = vi.fn(async () => undefined);
    const provider = new AffineProviderBridge({ onOpenDoc, onOpenBoard });

    await provider.openDoc('space-1', 'doc-1');
    await provider.openBoard('space-1', 'board-1');

    expect(onOpenDoc).toHaveBeenCalledWith({ spaceId: 'space-1', docId: 'doc-1' });
    expect(onOpenBoard).toHaveBeenCalledWith({ spaceId: 'space-1', boardId: 'board-1' });
  });

  it('builds iframe embed descriptors in embedded mode', async () => {
    const provider = new AffineProviderBridge({
      mode: 'embedded',
      webAppUrl: 'http://localhost:3010',
    });

    const descriptor = await provider.getEmbedDescriptor({ kind: 'doc', spaceId: 'space-1', entityId: 'doc-1' });

    expect(descriptor.mode).toBe('iframe');
    expect(descriptor.src).toContain('/workspace/space-1/doc/doc-1');
  });
});
