import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectCapabilityService } from '../../../../src/process/services/space/ProjectCapabilityService';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ProjectCapabilityService', () => {
  it('reads project-local skills, hooks, commands, and schedules into one capability snapshot', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-project-capability-'));
    tempDirs.push(root);

    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'agents'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, '.contextgo', 'hooks', 'continuity-handoff'), { recursive: true });

    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'SKILL.md'),
      [
        '---',
        'name: Release Guard',
        'description: Keep rollout changes narrow and verifiable.',
        'compatibility:',
        '  - Requires command-line tool `git`',
        '---',
        '',
        '# Release Guard',
        '',
        'Use this skill when release work must stay narrow and reversible.',
        '',
        '## Checklist',
        '',
        '- Verify the exact file set before editing.',
      ].join('\n'),
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'agents', 'openai.yaml'),
      [
        'interface:',
        '  display_name: Release Guard',
        '  short_description: Keep release work narrow.',
        'policy:',
        '  allow_implicit_invocation: true',
        '',
      ].join('\n'),
      'utf8'
    );

    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'hooks.json'),
      JSON.stringify({ enabledHooks: ['continuity-handoff'] }, null, 2) + '\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'hooks', 'continuity-handoff', 'manifest.json'),
      JSON.stringify(
        {
          name: 'continuity-handoff',
          description: 'Capture a concise handoff after each response.',
          category: 'continuity',
          executionType: 'native-projection',
          events: ['after_response', 'before_response'],
          outputTargets: ['chat-message', 'sidecar-file'],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'commands.json'),
      JSON.stringify(
        [
          {
            id: 'plan',
            enabled: false,
            name: 'plan',
            description: 'Plan before touching release code.',
            template: 'Write the release plan before editing code.',
          },
          {
            id: 'release-audit',
            enabled: true,
            name: 'release-audit',
            description: 'Audit release risk before rollout.',
            template: 'Audit the release path and list rollback risks.',
          },
        ],
        null,
        2
      ) + '\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'schedules.json'),
      JSON.stringify(
        {
          version: 1,
          conversationSchedules: [
            {
              id: 'schedule-1',
              name: 'Morning sync',
              enabled: true,
              schedule: {
                kind: 'cron',
                expr: '0 9 * * *',
                description: 'Every day at 09:00',
              },
              message: 'Share the release status.',
              conversationId: 'conv-1',
              conversationTitle: 'Release Session',
              agentType: 'codex',
              createdBy: 'agent',
              spaceId: 'space-1',
            },
          ],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const service = new ProjectCapabilityService();
    const snapshot = await service.readSnapshot(workspacePath);

    expect(snapshot).toBeDefined();
    expect(snapshot?.automationRootRelativePath).toBe('.contextgo');
    expect(snapshot?.counts).toEqual({
      skill: 1,
      hook: 1,
      command: 2,
      schedule: 1,
    });
    expect(snapshot?.skills).toEqual([
      expect.objectContaining({
        kind: 'skill',
        id: 'release-guard',
        name: 'Release Guard',
        workspaceRelativePath: '.contextgo/skills/release-guard',
        skillDocumentRelativePath: '.contextgo/skills/release-guard/SKILL.md',
        skillDocumentBody: [
          'Use this skill when release work must stay narrow and reversible.',
          '',
          '## Checklist',
          '',
          '- Verify the exact file set before editing.',
        ].join('\n'),
        implicitInvocation: true,
        openAIDisplayName: 'Release Guard',
        openAIShortDescription: 'Keep release work narrow.',
      }),
    ]);
    expect(snapshot?.hooks).toEqual([
      expect.objectContaining({
        kind: 'hook',
        id: 'continuity-handoff',
        selected: true,
        category: 'continuity',
        executionType: 'native-projection',
        workspaceRelativePath: '.contextgo/hooks/continuity-handoff',
        manifestRelativePath: '.contextgo/hooks/continuity-handoff/manifest.json',
        runnableEvents: ['after_response'],
        outputTargets: ['chat-message', 'sidecar-file'],
      }),
    ]);
    expect(snapshot?.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'command',
          id: 'plan',
          name: 'plan',
          enabled: false,
          commandType: 'project',
          description: 'Plan before touching release code.',
          template: 'Write the release plan before editing code.',
        }),
        expect.objectContaining({
          kind: 'command',
          id: 'release-audit',
          name: 'release-audit',
          enabled: true,
          commandType: 'project',
          template: 'Audit the release path and list rollback risks.',
        }),
      ])
    );
    expect(snapshot?.schedules).toEqual([
      expect.objectContaining({
        kind: 'schedule',
        id: 'schedule-1',
        name: 'Morning sync',
        enabled: true,
        scheduleKind: 'cron',
        scheduleLabel: '0 9 * * *',
        conversationId: 'conv-1',
        conversationTitle: 'Release Session',
        agentType: 'codex',
        createdBy: 'agent',
        spaceId: 'space-1',
      }),
    ]);
  });

  it('returns undefined for a missing workspace and empty arrays for missing automation files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-project-capability-'));
    tempDirs.push(root);

    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(workspacePath, { recursive: true });

    const service = new ProjectCapabilityService();
    const emptySnapshot = await service.readSnapshot(workspacePath);
    const missingSnapshot = await service.readSnapshot(path.join(root, 'missing-workspace'));

    expect(missingSnapshot).toBeUndefined();
    expect(emptySnapshot).toEqual(
      expect.objectContaining({
        workspacePath,
        counts: {
          skill: 0,
          hook: 0,
          command: 0,
          schedule: 0,
        },
        skills: [],
        hooks: [],
        commands: [],
        schedules: [],
      })
    );
  });
});
