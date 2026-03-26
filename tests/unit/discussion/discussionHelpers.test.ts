import { describe, expect, it } from 'vitest';
import {
  buildDiscussionRoundPrompt,
  normalizeDiscussionOrchestration,
} from '@/process/bridge/services/discussion/discussionHelpers';

describe('normalizeDiscussionOrchestration', () => {
  it('defaults to a two-round debate flow', () => {
    expect(normalizeDiscussionOrchestration()).toEqual({
      mode: 'debate',
      rounds: 2,
    });
  });

  it('forces broadcast mode back to a single round when rounds are missing', () => {
    expect(normalizeDiscussionOrchestration({ mode: 'broadcast' })).toEqual({
      mode: 'broadcast',
      rounds: 1,
    });
  });

  it('forces relay mode back to a single round when rounds are missing', () => {
    expect(normalizeDiscussionOrchestration({ mode: 'relay' })).toEqual({
      mode: 'relay',
      rounds: 1,
    });
  });
});

describe('buildDiscussionRoundPrompt', () => {
  it('returns the raw user input for broadcast mode', () => {
    expect(
      buildDiscussionRoundPrompt({
        mode: 'broadcast',
        round: 1,
        userInput: 'Compare these three architecture options.',
        participantName: 'Architect',
        peerSummaries: [],
      })
    ).toBe('Compare these three architecture options.');
  });

  it('includes peer responses for debate round two', () => {
    const prompt = buildDiscussionRoundPrompt({
      mode: 'debate',
      round: 2,
      userInput: 'Which rollout strategy should we choose?',
      participantName: 'Planner',
      peerSummaries: [
        {
          participantId: 'a',
          participantName: 'Critic',
          content: 'Prefer staged rollout with observability gates.',
        },
      ],
    });

    expect(prompt).toContain('Which rollout strategy should we choose?');
    expect(prompt).toContain('Critic');
    expect(prompt).toContain('Prefer staged rollout with observability gates.');
    expect(prompt).toContain('final recommendation');
  });

  it('uses earlier assistant responses for relay mode', () => {
    const prompt = buildDiscussionRoundPrompt({
      mode: 'relay',
      round: 1,
      userInput: 'Brainstorm a launch plan.',
      participantName: 'Operator',
      peerSummaries: [
        {
          participantId: 'a',
          participantName: 'Strategist',
          content: 'Start with a small beta cohort and instrument key metrics.',
        },
      ],
    });

    expect(prompt).toContain('Brainstorm a launch plan.');
    expect(prompt).toContain('Strategist');
    expect(prompt).toContain('Earlier Assistants');
    expect(prompt).toContain('continue the discussion');
  });

  it('falls back to an independent prompt when round two has no peer summaries', () => {
    const prompt = buildDiscussionRoundPrompt({
      mode: 'debate',
      round: 2,
      userInput: 'Assess the tradeoffs.',
      participantName: 'Reviewer',
      peerSummaries: [],
    });

    expect(prompt).toContain('Respond independently as Reviewer');
    expect(prompt).not.toContain('[Other Assistants]');
  });
});
