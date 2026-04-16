import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SpaceVaultContextSyncService,
  createWorkspaceProjectSlug,
} from '../../../../src/process/services/space/SpaceVaultContextSyncService';

function makeConversation(spaceId: string, workspacePath: string) {
  return {
    id: 'conv-1',
    name: 'Release Session',
    type: 'codex',
    model: {
      id: 'model-1',
      name: 'GPT-5 Codex',
      useModel: 'gpt-5-codex',
      platform: 'openai',
      apiKey: '',
      baseUrl: '',
    },
    source: 'contextgo',
    createTime: 1,
    modifyTime: 1,
    extra: {
      spaceId,
      workspace: workspacePath,
      workingDirectory: workspacePath,
    },
  } as const;
}

function makeLongPromptConversation(spaceId: string, workspacePath: string) {
  return {
    ...makeConversation(spaceId, workspacePath),
    id: 'conv-prompt',
    name: '[Assistant Rules - You MUST follow these instructions]\n[Available Skills]\n[User Request]\nhello',
  } as const;
}

describe('SpaceVaultContextSyncService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('writes home, project, source, session, and canvas files into the bound vault', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, 'AGENTS.md'),
      '# Project Router\n\n- Start at [Guide](docs/guide.md)\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'docs', 'guide.md'),
      '# Guide\n\nMore context in [[deep-dive]] and [Project Router](../AGENTS.md).\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'docs', 'deep-dive.md'),
      '# Deep Dive\n\nReturn to [Guide](guide.md).\n',
      'utf8'
    );

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const spaceService = {
      getSpace: vi.fn(async () => space),
    };

    const service = new SpaceVaultContextSyncService(spaceService as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.appendUserTurnStarted({
      conversation: conversation as any,
      userInput: 'Ship a minimal patch.',
      preparedAt: Date.UTC(2026, 3, 8, 8, 0, 0),
      msgId: 'msg-1',
    });
    await service.appendAssistantTurnCompleted({
      conversation: conversation as any,
      assistantText: 'Decision: keep the patch minimal.',
      completedAt: Date.UTC(2026, 3, 8, 8, 0, 5),
      assistantMessageId: 'assistant-1',
      preparedAt: Date.UTC(2026, 3, 8, 8, 0, 0),
    });
    await service.appendContextCheckpoint({
      conversation: conversation as any,
      timestamp: Date.UTC(2026, 3, 8, 8, 0, 6),
      title: 'Context Window Prepared',
      bullets: ['Sections: 1', 'Memory refs: 0'],
      body: '- profile: Prefer minimal diffs.',
    });
    await service.appendConversationStopped({
      conversation: conversation as any,
      stoppedAt: Date.UTC(2026, 3, 8, 8, 0, 10),
      reason: 'user-stop',
      preparedAt: Date.UTC(2026, 3, 8, 8, 0, 0),
    });

    const homeContent = await fs.readFile(path.join(vaultPath, 'Home.md'), 'utf8');
    expect(homeContent).toContain('# My Space Space');
    expect(homeContent).toContain('[[Canvas/Space Overview|Space Overview Canvas]]');
    expect(homeContent).toContain('[[Projects/workspace/Sessions/conv-1|Release Session (conv-1)]]');

    const sessionPath = path.join(vaultPath, 'Projects', 'workspace', 'Sessions', 'conv-1.md');
    const sessionWorkingSetPath = path.join(
      vaultPath,
      'Projects',
      'workspace',
      '_context',
      'sessions',
      'conv-1',
      'working-set.md'
    );
    const sessionContent = await fs.readFile(sessionPath, 'utf8');
    expect(sessionContent).toContain('# Release Session (conv-1)');
    expect(sessionContent).toContain('- Space doc: [[Home|My Space Space]]');
    expect(sessionContent).toContain('Projects/workspace/_context/sessions/conv-1/working-set');
    expect(sessionContent).toContain('## Rolling Summary');
    expect(sessionContent).toContain('- User turns: 1');
    expect(sessionContent).toContain('- Assistant replies: 1');
    expect(sessionContent).toContain('- Interruptions: 1');
    expect(sessionContent).toContain('- Latest user goal: Ship a minimal patch.');
    expect(sessionContent).toContain('- Latest assistant outcome: Decision: keep the patch minimal.');
    expect(sessionContent).toContain('- Latest interruption reason: user-stop');
    expect(sessionContent).toContain('User Query Started');
    expect(sessionContent).toContain('Assistant Reply Completed');
    expect(sessionContent).toContain('Context Window Prepared');
    expect(sessionContent).toContain('- Sections: 1');
    expect(sessionContent).toContain('- profile: Prefer minimal diffs.');
    expect(sessionContent).toContain('Session Interrupted');

    const projectDir = (await fs.readdir(path.join(vaultPath, 'Projects')))[0];
    expect(projectDir).toBe('workspace');
    expect(homeContent).toContain(`[[Projects/${projectDir}/${projectDir}|workspace]]`);
    expect(sessionContent).toContain(`- Project doc: [[Projects/${projectDir}/${projectDir}|workspace]]`);
    const workingSetContent = await fs.readFile(sessionWorkingSetPath, 'utf8');
    expect(workingSetContent).toContain('# Release Session Working Set');
    expect(workingSetContent).toContain('No active task distilled yet.');

    const projectContent = await fs.readFile(path.join(vaultPath, 'Projects', projectDir, `${projectDir}.md`), 'utf8');
    expect(projectContent).toContain('# workspace');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/AGENTS|Project Router]]');
    expect(projectContent).toContain('Projects/workspace/Sessions/conv-1');
    expect(projectContent).toContain('## Source Graph');
    expect(projectContent).toContain('workspace Source Graph');
    expect(projectContent).toContain('workspace Baseline');
    expect(projectContent).toContain('### Graph Backbone');
    expect(projectContent).toContain('### Orphan Docs');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/docs/guide|Guide]]');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/docs/deep-dive|Deep Dive]]');
    expect(projectContent).not.toContain('Source (');

    const baselineContent = await fs.readFile(
      path.join(vaultPath, 'Projects', projectDir, '_context', 'baseline.md'),
      'utf8'
    );
    expect(baselineContent).toContain('# workspace Baseline');
    expect(baselineContent).toContain('## Canonical Instructions');
    expect(baselineContent).toContain('## Project Overview');

    const sourceContent = await fs.readFile(
      path.join(vaultPath, 'Projects', projectDir, 'Sources', 'docs', 'guide.md'),
      'utf8'
    );
    expect(sourceContent).toContain('> Mirrored from');
    expect(sourceContent).toContain('# Guide');
    expect(sourceContent).toContain('- Space doc: [[Home|My Space Space]]');
    expect(sourceContent).toContain(`- Project doc: [[Projects/${projectDir}/${projectDir}|workspace]]`);
    expect(sourceContent).toContain('## Graph Context');
    expect(sourceContent).toContain('Projects/' + projectDir + '/Sources/docs/deep-dive');
    expect(sourceContent).toContain('Projects/' + projectDir + '/Sources/AGENTS');
    expect(sourceContent).toContain('# Guide');

    const graphCanvas = JSON.parse(
      await fs.readFile(path.join(vaultPath, 'Projects', projectDir, 'Project Graph.canvas'), 'utf8')
    );
    expect(
      graphCanvas.nodes.some(
        (node: { file?: string }) => node.file === 'Projects/' + projectDir + '/' + projectDir + '.md'
      )
    ).toBe(true);
    expect(graphCanvas.nodes.some((node: { file?: string }) => node.file?.includes('Sources/docs/guide.md'))).toBe(
      true
    );
    expect(graphCanvas.edges.some((edge: { label?: string }) => edge.label === 'ref')).toBe(true);

    const canvas = JSON.parse(await fs.readFile(path.join(vaultPath, 'Canvas', 'Space Overview.canvas'), 'utf8'));
    expect(canvas.nodes.some((node: { file?: string }) => node.file === 'Home.md')).toBe(true);
    expect(canvas.nodes.some((node: { file?: string }) => node.file === 'Projects/workspace/Sessions/conv-1.md')).toBe(
      true
    );
  });

  it('writes the space overview immediately for a bound vault without waiting for a conversation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    await fs.mkdir(vaultPath, { recursive: true });

    const space = {
      id: 'space-bootstrap',
      name: 'Bootstrap Space',
      description: 'Created before any conversation exists.',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'Bootstrap-Space',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);

    await service.syncSpaceOverviewForSpace(space as any);

    const homeContent = await fs.readFile(path.join(vaultPath, 'Home.md'), 'utf8');
    expect(homeContent).toContain('contextgoType: space');
    expect(homeContent).toContain('spaceId: space-bootstrap');
    expect(homeContent).toContain('spaceName: Bootstrap Space');
    expect(homeContent).toContain('# Bootstrap Space Space');
    expect(homeContent).toContain('- Space ID: `space-bootstrap`');
    expect(homeContent).toContain('- Engine: `vault`');
    expect(homeContent).toContain('- Description: Created before any conversation exists.');
    expect(homeContent).toContain('- No projects synced yet.');

    const canvas = JSON.parse(await fs.readFile(path.join(vaultPath, 'Canvas', 'Space Overview.canvas'), 'utf8'));
    expect(canvas.nodes.some((node: { file?: string }) => node.file === 'Home.md')).toBe(true);
  });

  it('writes and reads a session working set section', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.writeSessionWorkingSet({
      conversation: conversation as any,
      timestamp: '2026-04-08T08:00:00.000Z',
      currentTask: 'Ship the release safely.',
      stableStrategies: ['Use the staged release checklist.'],
      failureModes: ['Long runs get interrupted by the user.'],
      pendingConstraints: ['Do not widen rollout without review.'],
      signalKinds: ['user_interrupt'],
      pressure: 58,
      sourceProfileKey: 'session.compaction.conv-1',
    });

    const mounted = await service.readSessionWorkingSetSection({ conversation: conversation as any });
    expect(mounted).toEqual(
      expect.objectContaining({
        id: 'session-working-set:conv-1',
        kind: 'profile',
      })
    );
    expect(mounted?.summary).toContain('Ship the release safely.');
    expect(mounted?.summary).toContain('Use the staged release checklist.');
  });

  it('appends session timeline events into a dedicated session timeline file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.appendSessionTimelineEvent({
      conversation: conversation as any,
      timestamp: '2026-04-23T13:00:00.000Z',
      title: 'User query',
      body: '用户发起 query: aaaa',
    });

    const timelinePath = path.join(
      vaultPath,
      'Projects',
      'workspace',
      '_context',
      'sessions',
      'conv-1',
      'timeline.md'
    );
    const timelineContent = await fs.readFile(timelinePath, 'utf8');
    expect(timelineContent).toContain('[2026-04-23 13:00:00]');
    expect(timelineContent).toContain('User query: 用户发起 query: aaaa');
  });

  it('writes and reads the session working-context file separately from the timeline', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.writeSessionWorkingContext({
      conversation: conversation as any,
      timestamp: '2026-04-23T13:10:00.000Z',
      currentTask: '整理发布前的回归检查',
      stableStrategies: ['先缩小改动面，再补验证。'],
      failureModes: ['长对话容易把约束冲掉。'],
      pendingConstraints: ['没有审批前不能扩大发布范围。'],
      signalKinds: ['context_window_prepared'],
      pressure: 42,
      sourceProfileKey: 'session.compaction.conv-1',
    });

    const mounted = await service.readSessionWorkingContextSection({ conversation: conversation as any });
    expect(mounted?.id).toBe('session-working-context:conv-1');
    expect(mounted?.summary).toContain('整理发布前的回归检查');
    expect(mounted?.summary).toContain('先缩小改动面，再补验证。');
  });

  it('skips vault sync when the target space is not bound to an obsidian vault', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(workspacePath, { recursive: true });

    const spaceService = {
      getSpace: vi.fn(async () => ({
        id: 'space-1',
        name: 'Detached Space',
        engine: 'memory',
        providerRef: undefined,
        createTime: 1,
        modifyTime: 1,
      })),
    };

    const service = new SpaceVaultContextSyncService(spaceService as any);

    await expect(
      service.ensureConversationContext({ conversation: makeConversation('space-1', workspacePath) as any })
    ).resolves.toBe(undefined);
    await expect(fs.access(path.join(root, 'workspace', 'Home.md'))).rejects.toThrow();
  });

  it('removes session and project docs when the last project conversation is deleted', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');
    await fs.writeFile(path.join(workspacePath, 'docs', 'guide.md'), '# Guide\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({
      getSpace: vi.fn(async () => space),
    } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.appendUserTurnStarted({
      conversation: conversation as any,
      userInput: 'Ship a minimal patch.',
      preparedAt: Date.UTC(2026, 3, 8, 8, 0, 0),
      msgId: 'msg-1',
    });

    const projectDir = (await fs.readdir(path.join(vaultPath, 'Projects')))[0];
    await service.removeConversationContext({
      conversation: conversation as any,
      remainingConversations: [],
    });

    await expect(fs.access(path.join(vaultPath, 'Projects', projectDir, 'Sessions', 'conv-1.md'))).rejects.toThrow();
    await expect(
      fs.access(path.join(vaultPath, 'Projects', projectDir, '_context', 'sessions', 'conv-1'))
    ).rejects.toThrow();
    await expect(fs.access(path.join(vaultPath, 'Projects', projectDir))).rejects.toThrow();

    const homeContent = await fs.readFile(path.join(vaultPath, 'Home.md'), 'utf8');
    expect(homeContent).toContain('No projects synced yet.');
    expect(homeContent).toContain('No sessions synced yet.');
  });

  it('writes promoted project context into a durable insights doc', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    const artifact = await service.writeProjectPromotion({
      spaceId: space.id,
      projectSlug: createWorkspaceProjectSlug(workspacePath),
      summary: 'Prefer minimal diffs and explicit validation steps.',
      detail: 'Observed after repeated release sessions converged on the same strategy.',
      sourceThreadIds: ['conv-1'],
      timestamp: '2026-04-08T08:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        projectSlug: createWorkspaceProjectSlug(workspacePath),
        noteTitle: 'workspace Insights',
        relativePath: 'Projects/workspace/Project Insights.md',
      })
    );

    const insightsContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', 'Project Insights.md'),
      'utf8'
    );
    expect(insightsContent).toContain('# workspace Insights');
    expect(insightsContent).toContain('[[Projects/workspace/workspace|workspace]]');
    expect(insightsContent).toContain('[[Projects/workspace/Sessions/conv-1]]');
    expect(insightsContent).toContain('Prefer minimal diffs and explicit validation steps.');
    expect(insightsContent).toContain('Observed after repeated release sessions converged on the same strategy.');

    const projectContent = await fs.readFile(path.join(vaultPath, 'Projects', 'workspace', 'workspace.md'), 'utf8');
    expect(projectContent).toContain('[[Projects/workspace/Project Insights|workspace Insights]]');
  });

  it('refreshes project capability docs on demand for a bound project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'agents'), {
      recursive: true,
    });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'SKILL.md'),
      ['---', 'name: Release Guard', 'description: Keep rollout changes narrow.', '---', '', '# Release Guard'].join(
        '\n'
      ),
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'agents', 'openai.yaml'),
      ['policy:', '  allow_implicit_invocation: true', ''].join('\n'),
      'utf8'
    );

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });

    const artifact = await service.curateProjectCapabilities({
      spaceId: space.id,
      projectSlug: createWorkspaceProjectSlug(workspacePath),
      summary: 'Refresh local project capabilities into the vault.',
      timestamp: '2026-04-08T08:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        projectSlug: createWorkspaceProjectSlug(workspacePath),
        noteTitle: 'workspace Capabilities',
        relativePath: 'Projects/workspace/_context/Capabilities.md',
        summary: 'Refresh local project capabilities into the vault.',
      })
    );

    const capabilitiesContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'Capabilities.md'),
      'utf8'
    );
    expect(capabilitiesContent).toContain('# workspace Capabilities');
    expect(capabilitiesContent).toContain('- Skills: 1');
    expect(capabilitiesContent).toContain(
      '[[Projects/workspace/_context/capabilities/skills/Release-Guard|Release Guard]]'
    );

    const capabilityDocContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'capabilities', 'skills', 'Release-Guard.md'),
      'utf8'
    );
    expect(capabilityDocContent).toContain('contextgoType: project-capability');
    expect(capabilityDocContent).toContain('- Capability kind: Skills');
    expect(capabilityDocContent).toContain('- Implicit invocation: enabled');
  });

  it('sanitizes imported session titles so graph nodes stay readable', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# AGENTS\n', 'utf8');

    const space = {
      id: 'space-1',
      name: 'My Space',
      engine: 'vault',
      providerRef: {
        kind: 'obsidian-vault',
        vaultPath,
        vaultName: 'My-Space-space-1',
        landingNotePath: 'Home.md',
      },
      createTime: 1,
      modifyTime: 1,
    } as const;

    const service = new SpaceVaultContextSyncService({ getSpace: vi.fn(async () => space) } as any);
    const conversation = makeLongPromptConversation(space.id, workspacePath);

    await service.ensureConversationContext({ conversation: conversation as any });
    await service.appendUserTurnStarted({
      conversation: conversation as any,
      userInput: 'hello',
      preparedAt: Date.UTC(2026, 3, 8, 8, 0, 0),
      msgId: 'msg-1',
    });

    const sessionContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', 'Sessions', 'conv-prompt.md'),
      'utf8'
    );
    expect(sessionContent).toContain('# conv-prompt Session (conv-pro)');

    const homeContent = await fs.readFile(path.join(vaultPath, 'Home.md'), 'utf8');
    expect(homeContent).toContain('[[Projects/workspace/Sessions/conv-prompt|conv-prompt Session (conv-pro)]]');
    expect(homeContent).not.toContain('Assistant Rules');
  });
});
