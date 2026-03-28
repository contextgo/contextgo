import { describe, expect, it } from 'vitest';
import {
  assignWorkflowParticipantRoles,
  buildInitialWorkflowRunState,
  extractWorkflowArtifactUpdate,
  normalizeWorkflowArtifactPath,
  normalizeWorkflowOrchestration,
  normalizeWorkflowParticipants,
  parseWorkflowEvaluation,
  resolveWorkflowRoleParticipants,
} from '@/process/bridge/services/group/workflow/workflowHelpers';

describe('normalizeWorkflowOrchestration', () => {
  it('fills planner-writer-evaluator defaults', () => {
    expect(normalizeWorkflowOrchestration()).toEqual({
      kind: 'workflow',
      template: 'planner-writer-evaluator',
      maxIterations: 3,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
    });
  });

  it('clamps iteration budgets and score targets', () => {
    expect(
      normalizeWorkflowOrchestration({
        kind: 'workflow',
        template: 'planner-writer-evaluator',
        maxIterations: 99,
        scoreTarget: 12,
        artifactPath: 'draft.md',
      })
    ).toEqual({
      kind: 'workflow',
      template: 'planner-writer-evaluator',
      maxIterations: 15,
      scoreTarget: 10,
      artifactPath: 'draft.md',
    });
  });
});

describe('normalizeWorkflowArtifactPath', () => {
  it('normalizes relative artifact paths within the shared workspace', () => {
    expect(normalizeWorkflowArtifactPath(' ./plans//release.md ')).toBe('plans/release.md');
  });

  it('falls back to the default artifact for invalid traversal paths', () => {
    expect(normalizeWorkflowArtifactPath('../release.md')).toBe('team-output.md');
    expect(normalizeWorkflowArtifactPath('/release.md')).toBe('team-output.md');
  });
});

describe('resolveWorkflowRoleParticipants', () => {
  it('backfills missing planner-writer-evaluator roles by order', () => {
    const participants = assignWorkflowParticipantRoles([
      {
        id: 'participant-1',
        participantType: 'cli-agent' as const,
        participantKey: 'codex',
        name: 'Planner',
        childConversationId: 'child-1',
      },
      {
        id: 'participant-2',
        participantType: 'cli-agent' as const,
        participantKey: 'qwen',
        name: 'Writer',
        childConversationId: 'child-2',
      },
      {
        id: 'participant-3',
        participantType: 'cli-agent' as const,
        participantKey: 'claude',
        name: 'Evaluator',
        childConversationId: 'child-3',
      },
    ]);

    expect(resolveWorkflowRoleParticipants(participants)).toMatchObject({
      planner: { id: 'participant-1', role: 'planner' },
      writer: { id: 'participant-2', role: 'writer' },
      evaluator: { id: 'participant-3', role: 'evaluator' },
    });
  });

  it('rejects participant sets that exceed the template contract', () => {
    expect(() =>
      normalizeWorkflowParticipants([
        {
          id: 'participant-1',
          participantType: 'cli-agent' as const,
          participantKey: 'codex',
          name: 'Planner',
          childConversationId: 'child-1',
        },
        {
          id: 'participant-2',
          participantType: 'cli-agent' as const,
          participantKey: 'qwen',
          name: 'Writer',
          childConversationId: 'child-2',
        },
        {
          id: 'participant-3',
          participantType: 'cli-agent' as const,
          participantKey: 'claude',
          name: 'Evaluator',
          childConversationId: 'child-3',
        },
        {
          id: 'participant-4',
          participantType: 'cli-agent' as const,
          participantKey: 'openclaw',
          name: 'Extra',
          childConversationId: 'child-4',
        },
      ])
    ).toThrow('requires exactly 3 participants');
  });

  it('builds initial run state around the planner stage', () => {
    const orchestration = normalizeWorkflowOrchestration();
    const participants = assignWorkflowParticipantRoles([
      {
        id: 'participant-1',
        participantType: 'cli-agent' as const,
        participantKey: 'codex',
        name: 'Planner',
        childConversationId: 'child-1',
      },
      {
        id: 'participant-2',
        participantType: 'cli-agent' as const,
        participantKey: 'qwen',
        name: 'Writer',
        childConversationId: 'child-2',
      },
      {
        id: 'participant-3',
        participantType: 'cli-agent' as const,
        participantKey: 'claude',
        name: 'Evaluator',
        childConversationId: 'child-3',
      },
    ]);

    expect(buildInitialWorkflowRunState(orchestration, participants)).toMatchObject({
      status: 'idle',
      stage: 'planning',
      iteration: 0,
      artifactPath: 'team-output.md',
      activeParticipantId: 'participant-1',
    });
  });
});

describe('extractWorkflowArtifactUpdate', () => {
  it('parses the required artifact contract blocks', () => {
    const update = extractWorkflowArtifactUpdate(`[Artifact Path]
team-output.md

[Artifact Status]
proposed

[Artifact Content]
\`\`\`md
# Release Plan

- Step 1
- Step 2
\`\`\`

[Change Summary]
- Added the first draft`);

    expect(update.path).toBe('team-output.md');
    expect(update.status).toBe('proposed');
    expect(update.content).toBe('# Release Plan\n\n- Step 1\n- Step 2\n');
  });

  it('does not infer missing headers from arbitrary fenced markdown', () => {
    const update = extractWorkflowArtifactUpdate(`\`\`\`md
# Draft
\`\`\``);

    expect(update.path).toBeUndefined();
    expect(update.status).toBeUndefined();
    expect(update.content).toBeUndefined();
  });
});

describe('parseWorkflowEvaluation', () => {
  it('parses structured evaluator JSON', () => {
    const evaluation = parseWorkflowEvaluation(
      `\`\`\`json
{"score": 8.5, "decision": "accept", "summary": "Ready to ship", "issues": ["Minor copy fix"], "nextActions": ["Polish intro"]}
\`\`\``,
      8
    );

    expect(evaluation).toEqual({
      score: 8.5,
      decision: 'accept',
      summary: 'Ready to ship',
      strengths: [],
      issues: ['Minor copy fix'],
      nextActions: ['Polish intro'],
      raw: expect.any(String),
    });
  });

  it('falls back to score-derived decisions when evaluator output is unstructured', () => {
    const evaluation = parseWorkflowEvaluation('Score: 6/10. Needs stronger acceptance criteria.', 8);

    expect(evaluation.score).toBe(6);
    expect(evaluation.decision).toBe('continue');
    expect(evaluation.summary).toContain('Score: 6/10');
  });
});
