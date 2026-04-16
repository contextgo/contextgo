import { describe, expect, it } from 'vitest';
import { formatConnectorDigestEntry, formatSpaceCuratorProfileMemory } from '../../../../../../src/process/services/context/jobs/SpaceCuratorDistillationFormatter';

describe('SpaceCuratorDistillationFormatter', () => {
  it('formats profile-memory distillation notes with stable profile bullets', () => {
    const content = formatSpaceCuratorProfileMemory({
      title: 'Profile Memory',
      summary: 'Team prefers minimal diffs and explicit validation.',
      bullets: ['Observed across 3 project summaries.', 'Stable preference for staged verification.'],
      detail: 'Carry this preference into future project contexts.',
    });

    expect(content).toContain('# Profile Memory');
    expect(content).toContain('Observed across 3 project summaries.');
    expect(content).toContain('Stable preference for staged verification.');
    expect(content).toContain('Carry this preference into future project contexts.');
  });

  it('formats connector digest entries with source-aware bullets', () => {
    const content = formatConnectorDigestEntry({
      title: 'Connector Digest',
      summary: 'Digest newly ingested connector content into reusable context.',
      bullets: ['Connector: browser-activity', 'Source kind: web-resource', 'Title: Release checklist page'],
      detail: 'URI: https://example.com/release-checklist',
    });

    expect(content).toContain('### Connector Digest');
    expect(content).toContain('Connector: browser-activity');
    expect(content).toContain('Title: Release checklist page');
    expect(content).toContain('URI: https://example.com/release-checklist');
  });
});
