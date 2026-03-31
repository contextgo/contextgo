import { describe, expect, it } from 'vitest';
import { MockAffineSpaceProvider } from '../../../src/renderer/pages/space/affine/MockAffineSpaceProvider';

describe('MockAffineSpaceProvider', () => {
  it('adds candidate cards into the active board on promote-to-board', async () => {
    const provider = new MockAffineSpaceProvider({
      boards: [{ id: 'board-1', title: 'Launch Board', spaceId: 'space-1', cards: [] }],
    });

    const board = await provider.promoteCandidateToBoard({
      spaceId: 'space-1',
      candidateId: 'candidate-1',
      boardId: 'board-1',
      title: 'Release checklist decision',
      content: '# Release checklist decision\n\nUse the staged rollout checklist.',
    });

    expect(board.id).toBe('board-1');
    expect(board.cards?.length).toBe(1);
    expect(board.cards?.[0]?.title).toBe('Release checklist decision');
    expect(board.cards?.[0]?.preview).toContain('Release checklist decision');
  });
});
