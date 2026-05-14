import { describe, expect, it } from 'vitest';
import {
  buildDiscussionFinalSynthesisContent,
  buildDiscussionRoundPrompt,
  buildDiscussionRoundSummaryContent,
  normalizeGroupCollaboration,
  normalizeDiscussionOrchestration,
} from '@/process/bridge/services/group/discussion/discussionHelpers';

describe('normalizeDiscussionOrchestration', () => {
  it('defaults to a two-round debate flow', () => {
    expect(normalizeDiscussionOrchestration()).toEqual({
      kind: 'discussion',
      mode: 'debate',
      rounds: 2,
    });
  });

  it('forces broadcast mode back to a single round when rounds are missing', () => {
    expect(normalizeDiscussionOrchestration({ mode: 'broadcast' })).toEqual({
      kind: 'discussion',
      mode: 'broadcast',
      rounds: 1,
    });
  });

  it('forces relay mode back to a single round when rounds are missing', () => {
    expect(normalizeDiscussionOrchestration({ mode: 'relay' })).toEqual({
      kind: 'discussion',
      mode: 'relay',
      rounds: 1,
    });
  });

  it('backfills the discussion kind for older group data', () => {
    expect(normalizeDiscussionOrchestration({ mode: 'debate', rounds: 2 })).toEqual({
      kind: 'discussion',
      mode: 'debate',
      rounds: 2,
    });
  });
});

describe('buildDiscussionRoundPrompt', () => {
  it('defaults missing collaboration config to discussion mode', () => {
    expect(normalizeGroupCollaboration()).toEqual({
      mode: 'discussion',
      executionBoundary: {
        type: 'workspace',
      },
    });
  });

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

  it('builds a planner prompt for harness mode with git repository context', () => {
    const prompt = buildDiscussionRoundPrompt({
      collaboration: {
        mode: 'planner-generator-evaluator',
        executionBoundary: {
          type: 'git-repository',
          repositoryRoot: '/repo/app',
          branch: 'main',
          remoteUrl: 'git@github.com:example/repo.git',
        },
      },
      mode: 'debate',
      round: 1,
      userInput: 'Implement the release dashboard.',
      participantName: 'Planner Agent',
      participantRole: 'planner',
      peerSummaries: [],
    });

    expect(prompt).toContain('the Planner');
    expect(prompt).toContain('concrete implementation plan');
    expect(prompt).toContain('/repo/app');
    expect(prompt).toContain('Current Branch: main');
  });

  it('builds a generator prompt for harness mode with implementation guidance', () => {
    const prompt = buildDiscussionRoundPrompt({
      collaboration: {
        mode: 'planner-generator-evaluator',
        executionBoundary: {
          type: 'git-repository',
          repositoryRoot: '/repo/app',
        },
      },
      mode: 'debate',
      round: 1,
      userInput: 'Implement the release dashboard.',
      participantName: 'Generator Agent',
      participantRole: 'generator',
      peerSummaries: [],
    });

    expect(prompt).toContain('the Generator');
    expect(prompt).toContain('implementation work');
    expect(prompt).toContain('code-change strategy');
    expect(prompt).toContain('Evaluator');
  });

  it('builds an evaluator prompt for harness mode with PASS/FAIL gates', () => {
    const prompt = buildDiscussionRoundPrompt({
      collaboration: {
        mode: 'planner-generator-evaluator',
        executionBoundary: {
          type: 'git-repository',
          repositoryRoot: '/repo/app',
        },
      },
      mode: 'debate',
      round: 1,
      userInput: 'Implement the release dashboard.',
      participantName: 'Evaluator Agent',
      participantRole: 'evaluator',
      peerSummaries: [],
    });

    expect(prompt).toContain('the Evaluator');
    expect(prompt).toContain('PASS/FAIL rubric');
    expect(prompt).toContain('Stay read-only');
    expect(prompt).toContain('failure conditions');
  });
});

describe('discussion summaries', () => {
  it('builds a compact round summary from participant outputs', () => {
    const summary = buildDiscussionRoundSummaryContent({
      round: 2,
      summaries: [
        {
          participantId: 'a',
          participantName: 'Planner',
          content: 'Prefer a phased rollout with explicit rollback criteria.',
        },
      ],
    });

    expect(summary).toContain('## Round 2 Summary');
    expect(summary).toContain('Planner');
    expect(summary).toContain('Prefer a phased rollout');
  });

  it('builds a final synthesis from the latest participant views', () => {
    const synthesis = buildDiscussionFinalSynthesisContent({
      userInput: 'Choose the strongest rollout strategy.',
      roundSummaries: [
        {
          participantId: 'a',
          participantName: 'Planner',
          content: 'Choose phased rollout.',
        },
        {
          participantId: 'b',
          participantName: 'Reviewer',
          content: 'Keep tighter rollback thresholds.',
        },
      ],
    });

    expect(synthesis).toContain('## Group Synthesis');
    expect(synthesis).toContain('Choose the strongest rollout strategy.');
    expect(synthesis).toContain('Planner');
    expect(synthesis).toContain('Reviewer');
    expect(synthesis).toContain('Next Step');
  });
});
