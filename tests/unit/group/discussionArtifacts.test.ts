import { describe, expect, it } from 'vitest';
import {
  buildHarnessArtifactManifest,
  buildHarnessArtifactPaths,
  buildHarnessRequestArtifactContent,
  buildHarnessRoleArtifactContent,
  isHarnessArtifactRole,
} from '@/common/utils/discussionArtifacts';

describe('discussionArtifacts', () => {
  it('builds stable harness artifact paths from the group conversation id', () => {
    expect(buildHarnessArtifactPaths('group/123')).toEqual({
      rootDir: '.contextgo/discussion-groups/group-123/latest',
      requestFile: '.contextgo/discussion-groups/group-123/latest/request.md',
      plannerFile: '.contextgo/discussion-groups/group-123/latest/planner.md',
      generatorFile: '.contextgo/discussion-groups/group-123/latest/generator.md',
      evaluatorFile: '.contextgo/discussion-groups/group-123/latest/evaluator.md',
      manifestFile: '.contextgo/discussion-groups/group-123/latest/manifest.json',
    });
  });

  it('formats request, role artifact, and manifest content from harness entries', () => {
    const paths = buildHarnessArtifactPaths('group-1');
    const entries = [
      {
        round: 1,
        role: 'planner' as const,
        participantId: 'p1',
        participantName: 'Planner Agent',
        summary: 'Break the work into milestones.',
        updatedAt: 1710000000000,
      },
      {
        round: 2,
        role: 'planner' as const,
        participantId: 'p1',
        participantName: 'Planner Agent',
        summary: 'Refine the highest-risk checkpoint.',
        updatedAt: 1710000001000,
      },
    ];

    const requestContent = buildHarnessRequestArtifactContent({
      conversationId: 'group-1',
      request: 'Build a release dashboard.',
      orchestrationMode: 'debate',
      updatedAt: 1710000000000,
    });
    const plannerContent = buildHarnessRoleArtifactContent({
      role: 'planner',
      entries,
      updatedAt: 1710000001000,
    });
    const manifestContent = buildHarnessArtifactManifest({
      conversationId: 'group-1',
      orchestrationMode: 'debate',
      executionBoundary: {
        type: 'git-repository',
        repositoryRoot: '/repo/app',
        branch: 'main',
      },
      status: 'running',
      updatedAt: 1710000001000,
      paths,
      entries,
    });

    expect(requestContent).toContain('# Harness Request');
    expect(requestContent).toContain('Build a release dashboard.');
    expect(plannerContent).toContain('# Planner Artifact');
    expect(plannerContent).toContain('## Round 2');
    expect(plannerContent).toContain('Refine the highest-risk checkpoint.');
    expect(manifestContent).toContain('"conversationId": "group-1"');
    expect(manifestContent).toContain('"planner": ".contextgo/discussion-groups/group-1/latest/planner.md"');
    expect(manifestContent).toContain('"repositoryRoot": "/repo/app"');
  });

  it('recognizes harness participant roles only for planner, generator, and evaluator', () => {
    expect(isHarnessArtifactRole('planner')).toBe(true);
    expect(isHarnessArtifactRole('generator')).toBe(true);
    expect(isHarnessArtifactRole('evaluator')).toBe(true);
    expect(isHarnessArtifactRole('participant')).toBe(false);
    expect(isHarnessArtifactRole(undefined)).toBe(false);
  });
});
