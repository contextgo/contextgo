import { describe, expect, it } from 'vitest';
import { getWorkflowTemplateStageDefinitions, registerWorkflowGroupTemplateDefinition } from '@/common/config/group';
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
      reviewMode: 'per-iteration',
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
      reviewMode: 'per-iteration',
    });
  });

  it('uses single-pass defaults for the plan-build-evaluate template', () => {
    expect(
      normalizeWorkflowOrchestration({
        kind: 'workflow',
        template: 'plan-build-evaluate',
      })
    ).toEqual({
      kind: 'workflow',
      template: 'plan-build-evaluate',
      maxIterations: 1,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
      reviewMode: 'final-only',
    });
  });

  it('accepts dynamically registered workflow templates', () => {
    registerWorkflowGroupTemplateDefinition({
      id: 'custom-long-run',
      labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
      hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
      roleOrder: ['planner', 'writer', 'evaluator'],
      stageRoles: {
        planning: 'planner',
        writing: 'writer',
        evaluating: 'evaluator',
      },
      requiredParticipantCount: 3,
      runStrategy: 'single-pass',
      defaults: {
        maxIterations: 2,
        scoreTarget: 9,
        artifactPath: 'custom-output.md',
        reviewMode: 'final-only',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 4,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [
        {
          key: 'scoreTarget',
          type: 'number',
          labelKey: 'conversation.group.workflow.scoreTargetLabel',
          hintKey: 'conversation.group.workflow.scoreTargetHint',
          constraint: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        },
      ],
    });

    expect(
      normalizeWorkflowOrchestration({
        kind: 'workflow',
        template: 'custom-long-run',
      })
    ).toEqual({
      kind: 'workflow',
      template: 'custom-long-run',
      maxIterations: 2,
      scoreTarget: 9,
      artifactPath: 'custom-output.md',
      reviewMode: 'final-only',
    });
  });

  it('assigns custom role ids from a dynamically registered template', () => {
    registerWorkflowGroupTemplateDefinition({
      id: 'research-build-critique',
      labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
      hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
      roleOrder: ['researcher', 'builder', 'critic'],
      stageRoles: {
        planning: 'researcher',
        writing: 'builder',
        evaluating: 'critic',
      },
      requiredParticipantCount: 3,
      runStrategy: 'iterative',
      defaults: {
        maxIterations: 2,
        scoreTarget: 7,
        artifactPath: 'artifact.md',
        reviewMode: 'per-iteration',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 5,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [
        {
          key: 'artifactPath',
          type: 'string',
          labelKey: 'conversation.group.workflow.artifactPathLabel',
          hintKey: 'conversation.group.workflow.artifactPathHint',
          placeholder: 'artifact.md',
        },
      ],
    });

    expect(
      normalizeWorkflowParticipants(
        [
          {
            id: 'participant-1',
            participantType: 'cli-agent' as const,
            participantKey: 'codex',
            name: 'Researcher',
            childConversationId: 'child-1',
          },
          {
            id: 'participant-2',
            participantType: 'cli-agent' as const,
            participantKey: 'qwen',
            name: 'Builder',
            childConversationId: 'child-2',
          },
          {
            id: 'participant-3',
            participantType: 'cli-agent' as const,
            participantKey: 'claude',
            name: 'Critic',
            childConversationId: 'child-3',
          },
        ],
        'research-build-critique'
      ).map((participant) => participant.role)
    ).toEqual(['researcher', 'builder', 'critic']);
  });

  it('rejects invalid stage bindings during template registration', () => {
    expect(() =>
      registerWorkflowGroupTemplateDefinition({
        id: 'invalid-stage-binding',
        labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
        hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
        roleOrder: ['researcher', 'builder', 'critic'],
        stageRoles: {
          planning: 'researcher',
          writing: 'researcher',
          evaluating: 'critic',
        },
        requiredParticipantCount: 3,
        runStrategy: 'iterative',
        defaults: {
          maxIterations: 2,
          scoreTarget: 7,
          artifactPath: 'artifact.md',
          reviewMode: 'per-iteration',
        },
        constraints: {
          maxIterations: {
            min: 1,
            max: 5,
            step: 1,
          },
          scoreTarget: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        },
        fields: [],
      })
    ).toThrow('must bind planning/writing/evaluating to distinct roles');
  });

  it('synthesizes a default stage graph when custom templates only declare stage roles', () => {
    registerWorkflowGroupTemplateDefinition({
      id: 'default-stage-graph-template',
      labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
      hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
      roleOrder: ['researcher', 'builder', 'critic'],
      stageRoles: {
        planning: 'researcher',
        writing: 'builder',
        evaluating: 'critic',
      },
      requiredParticipantCount: 3,
      runStrategy: 'iterative',
      defaults: {
        maxIterations: 2,
        scoreTarget: 7,
        artifactPath: 'artifact.md',
        reviewMode: 'per-iteration',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 5,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [],
    });

    expect(getWorkflowTemplateStageDefinitions('default-stage-graph-template')).toEqual([
      {
        id: 'planning',
        kind: 'planning',
        role: 'researcher',
        nextStageId: 'writing',
      },
      {
        id: 'writing',
        kind: 'writing',
        role: 'builder',
        nextStageId: 'evaluating',
      },
      {
        id: 'evaluating',
        kind: 'evaluating',
        role: 'critic',
      },
    ]);
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
      planning: { id: 'participant-1', role: 'planner' },
      writing: { id: 'participant-2', role: 'writer' },
      evaluating: { id: 'participant-3', role: 'evaluator' },
    });
  });

  it('resolves stage participants from custom stage role bindings', () => {
    registerWorkflowGroupTemplateDefinition({
      id: 'research-build-critique-stage-bound',
      labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
      hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
      roleOrder: ['researcher', 'builder', 'critic'],
      stageRoles: {
        planning: 'researcher',
        writing: 'builder',
        evaluating: 'critic',
      },
      requiredParticipantCount: 3,
      runStrategy: 'iterative',
      defaults: {
        maxIterations: 2,
        scoreTarget: 7,
        artifactPath: 'artifact.md',
        reviewMode: 'per-iteration',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 5,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [],
    });

    const participants = assignWorkflowParticipantRoles(
      [
        {
          id: 'participant-1',
          participantType: 'cli-agent' as const,
          participantKey: 'researcher',
          name: 'Researcher',
          childConversationId: 'child-1',
        },
        {
          id: 'participant-2',
          participantType: 'cli-agent' as const,
          participantKey: 'builder',
          name: 'Builder',
          childConversationId: 'child-2',
        },
        {
          id: 'participant-3',
          participantType: 'cli-agent' as const,
          participantKey: 'critic',
          name: 'Critic',
          childConversationId: 'child-3',
        },
      ],
      'research-build-critique-stage-bound'
    );

    expect(resolveWorkflowRoleParticipants(participants, 'research-build-critique-stage-bound')).toMatchObject({
      planning: { id: 'participant-1', role: 'researcher' },
      writing: { id: 'participant-2', role: 'builder' },
      evaluating: { id: 'participant-3', role: 'critic' },
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
      runId: expect.any(String),
      status: 'idle',
      stage: 'planning',
      activeStageId: 'plan-brief',
      iteration: 0,
      artifactPath: 'team-output.md',
      activeParticipantId: 'participant-1',
      stageHistory: [],
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
