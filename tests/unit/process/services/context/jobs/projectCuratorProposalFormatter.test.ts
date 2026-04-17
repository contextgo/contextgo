import { describe, expect, it } from 'vitest';
import { formatProjectCuratorProposal } from '../../../../../../src/process/services/context/jobs/ProjectCuratorProposalFormatter';

describe('ProjectCuratorProposalFormatter', () => {
  it('formats append-first AGENTS proposal notes with evidence and patch bullets', () => {
    const content = formatProjectCuratorProposal({
      title: 'AGENTS append proposal',
      targetPath: 'AGENTS.md',
      summary: 'Add a stable release-validation rule.',
      evidence: ['Observed in 3 session checkpoints.', 'Skill usage repeatedly referenced staged validation.'],
      additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
    });

    expect(content).toContain('# AGENTS append proposal');
    expect(content).toContain('- Target: `AGENTS.md`');
    expect(content).toContain('Observed in 3 session checkpoints.');
    expect(content).toContain('Skill usage repeatedly referenced staged validation.');
    expect(content).toContain('Add a short rule telling agents to keep release diffs minimal and validation explicit.');
  });
});
