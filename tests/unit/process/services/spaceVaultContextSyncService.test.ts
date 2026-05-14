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

const listCanvasNodeFiles = (canvas: { nodes?: Array<{ file?: string }> }): string[] => {
  return (canvas.nodes || []).flatMap((node) => (node.file ? [node.file] : []));
};

const resolveCanvasNodeTargets = (
  vaultPath: string,
  canvasRelativePath: string,
  canvas: { nodes?: Array<{ file?: string }> }
) => {
  const canvasDir = path.join(vaultPath, path.posix.dirname(canvasRelativePath));
  return listCanvasNodeFiles(canvas).map((file) => ({
    file,
    absolutePath: path.resolve(canvasDir, file),
  }));
};

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
    expect(homeContent).toContain('contextgoNamespace: space');
    expect(homeContent).toContain('contextgoProjection: semantic-context');
    expect(homeContent).toContain('[[Canvas/Space Overview|Space Overview Canvas]]');
    expect(homeContent).toContain('[[Projects/workspace/Sessions/conv-1|Release Session (conv-1)]]');

    const sessionPath = path.join(vaultPath, 'Projects', 'workspace', 'Sessions', 'conv-1.md');
    const legacyWorkingSetPath = path.join(
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
    expect(sessionContent).toContain('contextgoNamespace: session');
    expect(sessionContent).toContain('contextgoProjection: semantic-context');
    expect(sessionContent).toContain('- Space doc: [[Home|My Space Space]]');
    expect(sessionContent).toContain('Projects/workspace/_context/sessions/conv-1/working-context');
    expect(sessionContent).not.toContain('working-set');
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
    await expect(fs.access(legacyWorkingSetPath)).rejects.toThrow();

    const projectContent = await fs.readFile(path.join(vaultPath, 'Projects', projectDir, `${projectDir}.md`), 'utf8');
    expect(projectContent).toContain('# workspace');
    expect(projectContent).toContain('contextgoNamespace: project');
    expect(projectContent).toContain('contextgoProjection: semantic-context');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/AGENTS|Project Router]]');
    expect(projectContent).toContain('Projects/workspace/Sessions/conv-1');
    expect(projectContent).toContain('## Entry Points');
    expect(projectContent).toContain('## Promoted Context');
    expect(projectContent).toContain('## Related Sessions');
    expect(projectContent).toContain('## Project Automation');
    expect(projectContent).toContain('## Source Docs');
    expect(projectContent).toContain('## Source Graph');
    expect(projectContent).toContain('workspace Source Graph');
    expect(projectContent).toContain('workspace Baseline');
    expect(projectContent).toContain('workspace Insights');
    expect(projectContent).toContain('workspace Automation');
    expect(projectContent).toContain('### Graph Backbone');
    expect(projectContent).toContain('### Orphan Docs');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/docs/guide|Guide]]');
    expect(projectContent).toContain('[[Projects/' + projectDir + '/Sources/docs/deep-dive|Deep Dive]]');
    expect(projectContent).not.toContain('## Semantic Context');
    expect(projectContent).not.toContain('## Source Mirrors');
    expect(projectContent.indexOf('## Entry Points')).toBeLessThan(projectContent.indexOf('## Promoted Context'));
    expect(projectContent.indexOf('## Promoted Context')).toBeLessThan(projectContent.indexOf('## Related Sessions'));
    expect(projectContent.indexOf('## Related Sessions')).toBeLessThan(projectContent.indexOf('## Project Automation'));
    expect(projectContent.indexOf('## Project Automation')).toBeLessThan(projectContent.indexOf('## Source Docs'));
    expect(projectContent.indexOf('## Source Docs')).toBeLessThan(projectContent.indexOf('## Source Graph'));
    expect(
      projectContent.indexOf(`- Project graph canvas: [[Projects/${projectDir}/Project Graph|workspace Source Graph]]`)
    ).toBeLessThan(
      projectContent.indexOf(`- Project insights: [[Projects/${projectDir}/Project Insights|workspace Insights]]`)
    );
    expect(
      projectContent.indexOf(`- Project insights: [[Projects/${projectDir}/Project Insights|workspace Insights]]`)
    ).toBeLessThan(
      projectContent.indexOf(`- Project baseline: [[Projects/${projectDir}/_context/baseline|workspace Baseline]]`)
    );
    expect(projectContent).not.toContain('Source (');

    const baselineContent = await fs.readFile(
      path.join(vaultPath, 'Projects', projectDir, '_context', 'baseline.md'),
      'utf8'
    );
    expect(baselineContent).toContain('# workspace Baseline');
    expect(baselineContent).toContain('contextgoNamespace: project');
    expect(baselineContent).toContain('contextgoProjection: semantic-context');
    expect(baselineContent).toContain('## Canonical Instructions');
    expect(baselineContent).toContain('## Project Overview');

    const sourceContent = await fs.readFile(
      path.join(vaultPath, 'Projects', projectDir, 'Sources', 'docs', 'guide.md'),
      'utf8'
    );
    expect(sourceContent).toContain('contextgoNamespace: source');
    expect(sourceContent).toContain('contextgoProjection: source-mirror');
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
    expect(graphCanvas.nodes.some((node: { file?: string }) => node.file === projectDir + '.md')).toBe(true);
    expect(graphCanvas.nodes.some((node: { file?: string }) => node.file?.includes('Sources/docs/guide.md'))).toBe(
      true
    );
    expect(graphCanvas.edges.some((edge: { label?: string }) => edge.label === 'ref')).toBe(true);
    expect(
      resolveCanvasNodeTargets(vaultPath, `Projects/${projectDir}/Project Graph.canvas`, graphCanvas).every((node) =>
        node.absolutePath.startsWith(vaultPath)
      )
    ).toBe(true);
    await expect(
      Promise.all(
        resolveCanvasNodeTargets(vaultPath, `Projects/${projectDir}/Project Graph.canvas`, graphCanvas).map((node) =>
          fs.access(node.absolutePath)
        )
      )
    ).resolves.toHaveLength(listCanvasNodeFiles(graphCanvas).length);

    const canvas = JSON.parse(await fs.readFile(path.join(vaultPath, 'Canvas', 'Space Overview.canvas'), 'utf8'));
    expect(canvas.nodes.some((node: { file?: string }) => node.file === '../Home.md')).toBe(true);
    expect(
      canvas.nodes.some((node: { file?: string }) => node.file === '../Projects/workspace/Sessions/conv-1.md')
    ).toBe(true);
    expect(
      resolveCanvasNodeTargets(vaultPath, 'Canvas/Space Overview.canvas', canvas).every((node) =>
        node.absolutePath.startsWith(vaultPath)
      )
    ).toBe(true);
    await expect(
      Promise.all(
        resolveCanvasNodeTargets(vaultPath, 'Canvas/Space Overview.canvas', canvas).map((node) =>
          fs.access(node.absolutePath)
        )
      )
    ).resolves.toHaveLength(listCanvasNodeFiles(canvas).length);
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
    expect(homeContent).toContain('contextgoNamespace: space');
    expect(homeContent).toContain('contextgoProjection: semantic-context');
    expect(homeContent).toContain('spaceId: space-bootstrap');
    expect(homeContent).toContain('spaceName: Bootstrap Space');
    expect(homeContent).toContain('# Bootstrap Space Space');
    expect(homeContent).toContain('## Abstract');
    expect(homeContent).toContain('Created before any conversation exists.');
    expect(homeContent).toContain('## Overview');
    expect(homeContent).toContain('- Space ID: `space-bootstrap`');
    expect(homeContent).toContain('- Engine: `vault`');
    expect(homeContent).toContain('[[Space Console|Space Console]]');
    expect(homeContent).toContain('- No projects synced yet.');

    const consoleContent = await fs.readFile(path.join(vaultPath, 'Space Console.md'), 'utf8');
    expect(consoleContent).toContain('contextgoType: space-console');
    expect(consoleContent).toContain('contextgoProjection: governance-trace');
    expect(consoleContent).toContain('# Space Console');
    expect(consoleContent).toContain('## Current Situation');
    expect(consoleContent).toContain('- Active projects: 0');
    expect(consoleContent).toContain('[[System/Context Engine/Connector Digest|Connector Digest]]');
    expect(consoleContent).toContain('[[System/Agent Desk/Active Agents|Active Agents]]');
    expect(consoleContent).toContain('[[System/Workbench/Context Flow Workbench|Context Flow Workbench]]');

    const operationalPages = [
      ['System', 'Agent Desk', 'Active Agents.md'],
      ['System', 'Agent Desk', 'Decision Inbox.md'],
      ['System', 'Agent Desk', 'Artifact Ledger.md'],
      ['System', 'Workbench', 'Context Flow Workbench.md'],
      ['System', 'Workbench', 'Attention Queue.md'],
      ['System', 'Workbench', 'Signal Matrix.md'],
      ['System', 'Workbench', 'Handoff Bus.md'],
    ];
    await expect(
      Promise.all(operationalPages.map((segments) => fs.access(path.join(vaultPath, ...segments))))
    ).resolves.toHaveLength(operationalPages.length);

    const activeAgentsContent = await fs.readFile(
      path.join(vaultPath, 'System', 'Agent Desk', 'Active Agents.md'),
      'utf8'
    );
    expect(activeAgentsContent).toContain('## Agent Status');
    expect(activeAgentsContent).toContain('Session Steward');

    const workbenchContent = await fs.readFile(
      path.join(vaultPath, 'System', 'Workbench', 'Context Flow Workbench.md'),
      'utf8'
    );
    expect(workbenchContent).toContain('## Flow Map');
    expect(workbenchContent).toContain('flowchart LR');

    const canvas = JSON.parse(await fs.readFile(path.join(vaultPath, 'Canvas', 'Space Overview.canvas'), 'utf8'));
    expect(canvas.nodes.some((node: { file?: string }) => node.file === '../Home.md')).toBe(true);
    await expect(
      Promise.all(
        resolveCanvasNodeTargets(vaultPath, 'Canvas/Space Overview.canvas', canvas).map((node) =>
          fs.access(node.absolutePath)
        )
      )
    ).resolves.toHaveLength(listCanvasNodeFiles(canvas).length);
  });

  it('removes legacy session working-set artifacts during sync', async () => {
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
    const legacyWorkingSetPath = path.join(
      vaultPath,
      'Projects',
      'workspace',
      '_context',
      'sessions',
      'conv-1',
      'working-set.md'
    );

    await fs.mkdir(path.dirname(legacyWorkingSetPath), { recursive: true });
    await fs.writeFile(legacyWorkingSetPath, '# Legacy Working Set\n', 'utf8');

    await service.ensureConversationContext({ conversation: conversation as any });

    await expect(fs.access(legacyWorkingSetPath)).rejects.toThrow();
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
      title: 'Turn Started',
      body: 'Request captured and queued for context assembly.',
    });

    const timelinePath = path.join(vaultPath, 'Projects', 'workspace', '_context', 'sessions', 'conv-1', 'timeline.md');
    const timelineContent = await fs.readFile(timelinePath, 'utf8');
    expect(timelineContent).toContain('[2026-04-23 13:00:00]');
    expect(timelineContent).toContain('Turn Started: Request captured and queued for context assembly.');
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
      compactionJobId: 'context-job-1',
      lifecycleSummary: 'Compaction triggered after repeated interruptions.',
      artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
    });

    const workingContextPath = path.join(
      vaultPath,
      'Projects',
      'workspace',
      '_context',
      'sessions',
      'conv-1',
      'working-context.md'
    );
    const workingContextContent = await fs.readFile(workingContextPath, 'utf8');
    expect(workingContextContent).toContain('contextgoNamespace: session');
    expect(workingContextContent).toContain('contextgoProjection: semantic-context');
    expect(workingContextContent).toContain('## Compaction Provenance');
    expect(workingContextContent).toContain('- Operation: `session_compaction`');
    expect(workingContextContent).toContain('- Source profile: `session.compaction.conv-1`');
    expect(workingContextContent).toContain('- Compaction job: `context-job-1`');
    expect(workingContextContent).toContain(
      '- Artifact targets: `session_timeline`, `session_working_context`, `session_checkpoint`'
    );
    expect(workingContextContent).toContain('Compaction triggered after repeated interruptions.');

    const mounted = await service.readSessionWorkingContextSection({ conversation: conversation as any });
    expect(mounted?.id).toBe('session-working-context:conv-1');
    expect(mounted?.summary).toContain('整理发布前的回归检查');
    expect(mounted?.summary).toContain('先缩小改动面，再补验证。');
  });

  it('writes checkpoint provenance that links the session artifact triad for compaction', async () => {
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
    const checkpoint = await service.appendSessionCheckpoint({
      conversation: conversation as any,
      timestamp: '2026-04-23T13:12:00.000Z',
      kind: 'session-compaction',
      title: 'Session checkpoint',
      summary: 'Current task: stabilize release verification flow.',
      detail: 'Compaction summary body.',
      sourceProfileKey: 'session.compaction.conv-1',
      compactionJobId: 'context-job-1',
      lifecycleSummary: 'Compaction triggered after repeated interruptions.',
      artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      workingContextRelativePath: 'Projects/workspace/_context/sessions/conv-1/working-context.md',
      workingContextTitle: 'Release Session Working Context',
    });

    expect(checkpoint).toBeDefined();

    const checkpointPath = path.join(vaultPath, checkpoint!.relativePath);
    const checkpointContent = await fs.readFile(checkpointPath, 'utf8');
    expect(checkpointContent.startsWith('---\n')).toBe(true);
    expect(checkpointContent).toContain('contextgoType: session-checkpoint');
    expect(checkpointContent).toContain('contextgoNamespace: session');
    expect(checkpointContent).toContain('contextgoProjection: semantic-context');
    expect(checkpointContent).toContain('## Compaction Provenance');
    expect(checkpointContent).toContain('- Operation: `session_compaction`');
    expect(checkpointContent).toContain('- Source profile: `session.compaction.conv-1`');
    expect(checkpointContent).toContain('- Compaction job: `context-job-1`');
    expect(checkpointContent).toContain(
      '- Artifact targets: `session_timeline`, `session_working_context`, `session_checkpoint`'
    );
    expect(checkpointContent).toContain(
      '- Session timeline: [[Projects/workspace/_context/sessions/conv-1/timeline|Release Session Timeline]]'
    );
    expect(checkpointContent).toContain(
      '- Session working context: [[Projects/workspace/_context/sessions/conv-1/working-context|Release Session Working Context]]'
    );
  });

  it('materializes session archives with overview, extraction, and status files', async () => {
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
    const archive = await service.writeSessionArchive({
      conversation: conversation as any,
      archiveId: '2026-04-23T13-12-00Z-session-compaction',
      timestamp: '2026-04-23T13:12:00.000Z',
      title: 'Session archive',
      summary: 'Current task: stabilize release verification flow.',
      detail: 'Compaction summary body.',
      currentTask: 'Stabilize release verification flow.',
      stableStrategies: ['Keep the patch minimal.'],
      failureModes: ['Long sessions lose constraints.'],
      pendingConstraints: ['Do not broaden scope without approval.'],
      signalKinds: ['context_window_prepared'],
      pressure: 57,
      promotedCount: 2,
      pendingReviewCount: 1,
      sourceProfileKey: 'session.compaction.conv-1',
      compactionJobId: 'context-job-1',
      lifecycleSummary: 'Compaction triggered after repeated interruptions.',
      artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      workingContextRelativePath: 'Projects/workspace/_context/sessions/conv-1/working-context.md',
      workingContextTitle: 'Release Session Working Context',
      checkpointRelativePath: 'Projects/workspace/_context/sessions/conv-1/checkpoints/checkpoint.md',
      checkpointTitle: 'Session checkpoint',
    });

    expect(archive).toBeDefined();
    expect(archive!.overviewRelativePath).toBe(
      'Projects/workspace/_context/sessions/conv-1/archives/2026-04-23T13-12-00Z-session-compaction/overview.md'
    );
    expect(archive!.extractionRelativePath).toBe(
      'Projects/workspace/_context/sessions/conv-1/archives/2026-04-23T13-12-00Z-session-compaction/extraction.md'
    );
    expect(archive!.statusRelativePath).toBe(
      'Projects/workspace/_context/sessions/conv-1/archives/2026-04-23T13-12-00Z-session-compaction/status.json'
    );

    const overviewContent = await fs.readFile(path.join(vaultPath, archive!.overviewRelativePath), 'utf8');
    expect(overviewContent).toContain('contextgoType: session-archive');
    expect(overviewContent).toContain('archivePart: overview');
    expect(overviewContent).toContain('## Archive State');
    expect(overviewContent).toContain('- Pressure: 57');
    expect(overviewContent).toContain('- Promoted takeaways: 2');
    expect(overviewContent).toContain(
      '- Session checkpoint: [[Projects/workspace/_context/sessions/conv-1/checkpoints/checkpoint|Session checkpoint]]'
    );

    const extractionContent = await fs.readFile(path.join(vaultPath, archive!.extractionRelativePath), 'utf8');
    expect(extractionContent).toContain('archivePart: extraction');
    expect(extractionContent).toContain('## Stable Strategies');
    expect(extractionContent).toContain('- Keep the patch minimal.');
    expect(extractionContent).toContain('## Full Compaction Detail');
    expect(extractionContent).toContain('Compaction summary body.');

    const status = JSON.parse(await fs.readFile(path.join(vaultPath, archive!.statusRelativePath), 'utf8'));
    expect(status.contextgoType).toBe('session-archive-status');
    expect(status.state).toBe('materialized');
    expect(status.artifacts.overview).toBe(archive!.overviewRelativePath);
    expect(status.artifacts.extraction).toBe(archive!.extractionRelativePath);

    const relationLines = (
      await fs.readFile(path.join(vaultPath, 'System', 'Context Engine', 'Relations', 'relations.jsonl'), 'utf8')
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(relationLines).toHaveLength(7);
    expect(
      relationLines.some(
        (relation) =>
          relation.type === 'summarizes' &&
          relation.from === archive!.overviewRelativePath &&
          relation.to === 'Projects/workspace/_context/sessions/conv-1/working-context.md'
      )
    ).toBe(true);
    expect(
      relationLines.some(
        (relation) =>
          relation.type === 'derived_from' &&
          relation.from === archive!.extractionRelativePath &&
          relation.to === archive!.overviewRelativePath
      )
    ).toBe(true);
    expect(
      relationLines.some(
        (relation) =>
          relation.type === 'derived_from' &&
          relation.from === 'System/Context Engine/Memory/Workflows/Release-Session-Stable-Strategies.md' &&
          relation.to === archive!.overviewRelativePath
      )
    ).toBe(true);
    expect(
      relationLines.every(
        (relation) =>
          relation.id &&
          relation.spaceId === 'space-1' &&
          relation.conversationId === 'conv-1' &&
          relation.metadata.archiveId === '2026-04-23T13-12-00Z-session-compaction'
      )
    ).toBe(true);

    const workflowMemory = await fs.readFile(
      path.join(vaultPath, 'System', 'Context Engine', 'Memory', 'Workflows', 'Release-Session-Stable-Strategies.md'),
      'utf8'
    );
    expect(workflowMemory).toContain('contextgoType: schema-memory');
    expect(workflowMemory).toContain('contextgoNamespace: memory');
    expect(workflowMemory).toContain('contextgoProjection: schema-memory');
    expect(workflowMemory).toContain('memoryKind: Workflows');
    expect(workflowMemory).toContain('## Memory Items');
    expect(workflowMemory).toContain('- Keep the patch minimal.');
    expect(workflowMemory).toContain(
      `- Source: [[${archive!.overviewRelativePath.replace(/\.md$/, '')}|Session archive]]`
    );

    const patternMemory = await fs.readFile(
      path.join(vaultPath, 'System', 'Context Engine', 'Memory', 'Patterns', 'Release-Session-Failure-Modes.md'),
      'utf8'
    );
    expect(patternMemory).toContain('memoryKind: Patterns');
    expect(patternMemory).toContain('- Long sessions lose constraints.');

    const preferenceMemory = await fs.readFile(
      path.join(
        vaultPath,
        'System',
        'Context Engine',
        'Memory',
        'Preferences',
        'Release-Session-Pending-Constraints.md'
      ),
      'utf8'
    );
    expect(preferenceMemory).toContain('memoryKind: Preferences');
    expect(preferenceMemory).toContain('- Do not broaden scope without approval.');
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
    expect(insightsContent).toContain('contextgoNamespace: project');
    expect(insightsContent).toContain('contextgoProjection: semantic-context');
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
      [
        '---',
        'name: Release Guard',
        'description: Keep rollout changes narrow.',
        '---',
        '',
        '# Release Guard',
        '',
        'Use this skill when release work must stay narrowly scoped.',
        '',
        '## Checklist',
        '',
        '- Confirm the rollback path before editing.',
      ].join('\n'),
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
    await fs.mkdir(path.join(vaultPath, 'Projects', 'workspace', '_context', 'capabilities', 'skills'), {
      recursive: true,
    });
    await fs.writeFile(path.join(vaultPath, 'Projects', 'workspace', '_context', 'Capabilities.md'), '# legacy\n');
    await fs.writeFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'capabilities', 'skills', 'Legacy.md'),
      '# legacy\n'
    );

    const artifact = await service.curateProjectCapabilities({
      spaceId: space.id,
      projectSlug: createWorkspaceProjectSlug(workspacePath),
      summary: 'Refresh local project capabilities into the vault.',
      timestamp: '2026-04-08T08:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        projectSlug: createWorkspaceProjectSlug(workspacePath),
        noteTitle: 'workspace Automation',
        relativePath: 'Projects/workspace/_context/Automation.md',
        summary: 'Refresh local project capabilities into the vault.',
      })
    );

    const automationContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'Automation.md'),
      'utf8'
    );
    expect(automationContent).toContain('# workspace Automation');
    expect(automationContent).toContain('contextgoNamespace: automation');
    expect(automationContent).toContain('contextgoProjection: automation-inventory');
    expect(automationContent).toContain('- Skills: 1');
    expect(automationContent).toContain(
      '[[Projects/workspace/_context/automation/skills/Release-Guard|Release Guard]]'
    );

    const capabilityDocContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'automation', 'skills', 'Release-Guard.md'),
      'utf8'
    );
    expect(capabilityDocContent).toContain('contextgoType: project-automation-item');
    expect(capabilityDocContent).toContain('contextgoNamespace: automation');
    expect(capabilityDocContent).toContain('contextgoProjection: automation-inventory');
    expect(capabilityDocContent).toContain('- Automation kind: Skills');
    expect(capabilityDocContent).toContain('- Skill package root: `.contextgo/skills/release-guard`');
    expect(capabilityDocContent).toContain('- SKILL.md path: `.contextgo/skills/release-guard/SKILL.md`');
    expect(capabilityDocContent).toContain('- Implicit invocation: enabled');
    expect(capabilityDocContent).toContain('## SKILL.md');
    expect(capabilityDocContent).toContain('Use this skill when release work must stay narrowly scoped.');
    expect(capabilityDocContent).toContain('### Checklist');
    expect(capabilityDocContent).toContain('- Confirm the rollback path before editing.');
    await expect(
      fs.access(path.join(vaultPath, 'Projects', 'workspace', '_context', 'Capabilities.md'))
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(vaultPath, 'Projects', 'workspace', '_context', 'capabilities', 'skills', 'Legacy.md'))
    ).rejects.toThrow();
  });

  it('keeps skill package markdown out of source mirrors while retaining the SKILL.md automation note', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    const staleSkillReferenceMirrorPath = path.join(
      vaultPath,
      'Projects',
      'workspace',
      'Sources',
      '.contextgo',
      'skills',
      'release-guard',
      'references',
      'rollout.md'
    );
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'references'), {
      recursive: true,
    });
    await fs.writeFile(path.join(workspacePath, 'AGENTS.md'), '# Project Router\n', 'utf8');
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'SKILL.md'),
      [
        '---',
        'name: Release Guard',
        'description: Keep rollout changes narrow.',
        '---',
        '',
        '# Release Guard',
        '',
        'Use this skill when release work must stay narrowly scoped.',
      ].join('\n'),
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, '.contextgo', 'skills', 'release-guard', 'references', 'rollout.md'),
      '# Rollout Reference\n\nThis reference doc should stay out of the vault source graph.\n',
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
    await fs.mkdir(path.dirname(staleSkillReferenceMirrorPath), { recursive: true });
    await fs.writeFile(staleSkillReferenceMirrorPath, '# stale mirrored reference\n', 'utf8');

    await service.ensureConversationContext({ conversation: conversation as any });

    const projectContent = await fs.readFile(path.join(vaultPath, 'Projects', 'workspace', 'workspace.md'), 'utf8');
    expect(projectContent).toContain('[[Projects/workspace/Sources/AGENTS|Project Router]]');
    expect(projectContent).not.toContain('Sources/.contextgo/skills/release-guard/SKILL');
    expect(projectContent).not.toContain('Sources/.contextgo/skills/release-guard/references/rollout');

    await expect(fs.access(path.join(vaultPath, 'Projects', 'workspace', 'Sources', 'AGENTS.md'))).resolves.toBe(
      undefined
    );
    await expect(
      fs.access(path.join(vaultPath, 'Projects', 'workspace', 'Sources', '.contextgo', 'skills', 'release-guard'))
    ).rejects.toThrow();
    await expect(fs.access(staleSkillReferenceMirrorPath)).rejects.toThrow();

    const automationContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'Automation.md'),
      'utf8'
    );
    expect(automationContent).toContain('- Skills: 1');
    expect(automationContent).toContain(
      '[[Projects/workspace/_context/automation/skills/Release-Guard|Release Guard]]'
    );

    const capabilityDocContent = await fs.readFile(
      path.join(vaultPath, 'Projects', 'workspace', '_context', 'automation', 'skills', 'Release-Guard.md'),
      'utf8'
    );
    expect(capabilityDocContent).toContain('## SKILL.md');
    expect(capabilityDocContent).toContain('Use this skill when release work must stay narrowly scoped.');
    expect(capabilityDocContent).not.toContain('This reference doc should stay out of the vault source graph.');

    const graphCanvas = JSON.parse(
      await fs.readFile(path.join(vaultPath, 'Projects', 'workspace', 'Project Graph.canvas'), 'utf8')
    );
    expect(graphCanvas.nodes.some((node: { file?: string }) => node.file?.includes('Sources/.contextgo/skills'))).toBe(
      false
    );
    expect(
      graphCanvas.nodes.some((node: { file?: string }) =>
        node.file?.includes('_context/automation/skills/Release-Guard.md')
      )
    ).toBe(true);
  });

  it('writes project curator proposal notes under the project context proposals directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const workspacePath = path.join(root, 'workspace');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
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

    const artifact = await service.writeProjectCuratorProposal({
      spaceId: 'space-1',
      projectSlug: createWorkspaceProjectSlug(workspacePath),
      title: 'AGENTS append proposal',
      proposalKind: 'project_rules',
      summary: 'Add a stable release-validation rule.',
      targetPath: 'AGENTS.md',
      additions: ['Add a short rule telling agents to keep release diffs minimal and validation explicit.'],
      evidence: ['Observed in 3 session checkpoints.'],
      timestamp: '2026-04-16T08:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        relativePath: expect.stringContaining('_context/proposals'),
        summary: 'Add a stable release-validation rule.',
      })
    );

    const proposalPath = path.join(vaultPath, artifact!.relativePath);
    const proposalContent = await fs.readFile(proposalPath, 'utf8');
    expect(proposalContent.startsWith('---\n')).toBe(true);
    expect(proposalContent).toContain('contextgoType: project-curator-proposal');
    expect(proposalContent).toContain('contextgoNamespace: project');
    expect(proposalContent).toContain('contextgoProjection: semantic-context');
    expect(proposalContent).toContain('# AGENTS append proposal');
    expect(proposalContent).toContain('- Target: `AGENTS.md`');
    expect(proposalContent).toContain('Observed in 3 session checkpoints.');
    expect(proposalContent).toContain(
      'Add a short rule telling agents to keep release diffs minimal and validation explicit.'
    );
  });

  it('writes profile memory distillation into the context-engine system directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    await fs.mkdir(vaultPath, { recursive: true });

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

    const artifact = await service.writeProfileMemoryDistillation({
      spaceId: 'space-1',
      summary: 'Team prefers minimal diffs and explicit validation.',
      detail: 'Carry this preference into future project contexts.',
      bullets: ['Observed across 3 project summaries.'],
      timestamp: '2026-04-16T09:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        relativePath: expect.stringContaining('System/Context Engine'),
        summary: 'Team prefers minimal diffs and explicit validation.',
        spaceId: 'space-1',
      })
    );

    const profilePath = path.join(vaultPath, artifact!.relativePath);
    const profileContent = await fs.readFile(profilePath, 'utf8');
    expect(profileContent.startsWith('---\n')).toBe(true);
    expect(profileContent).toContain('contextgoType: profile-memory');
    expect(profileContent).toContain('contextgoNamespace: space');
    expect(profileContent).toContain('contextgoProjection: semantic-context');
    expect(profileContent).toContain('# Profile Memory');
    expect(profileContent).toContain('Observed across 3 project summaries.');
    expect(profileContent).toContain('Carry this preference into future project contexts.');
  });

  it('writes context run artifacts with contextgo metadata in frontmatter', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    await fs.mkdir(vaultPath, { recursive: true });

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

    const artifact = await service.writeContextRunArtifact({
      spaceId: 'space-1',
      runId: 'context-run-1',
      title: 'Context Run 1',
      summary: 'Trace retrieval and assembly decisions for this run.',
      detail: 'Included retrieval scoring and final token-budget trimming.',
      timestamp: '2026-04-16T10:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        relativePath: 'System/Context Engine/Runs/context-run-1.md',
        summary: 'Trace retrieval and assembly decisions for this run.',
        title: 'Context Run 1',
      })
    );

    const runPath = path.join(vaultPath, artifact!.relativePath);
    const runContent = await fs.readFile(runPath, 'utf8');
    expect(runContent.startsWith('---\n')).toBe(true);
    expect(runContent).toContain('contextgoType: context-run');
    expect(runContent).toContain('contextgoNamespace: space');
    expect(runContent).toContain('contextgoProjection: semantic-context');
    expect(runContent).toContain('runId: context-run-1');
    expect(runContent).toContain('<!-- contextgo-generated -->');
    expect(runContent).toContain('# Context Run 1');
    expect(runContent).toContain('Trace retrieval and assembly decisions for this run.');
  });

  it('stamps metadata on space memory distillation docs and upgrades legacy files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const legacyPath = path.join(vaultPath, 'System', 'Context Engine', 'Space Memory.md');
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(
      legacyPath,
      [
        '<!-- contextgo-generated -->',
        '',
        '# Space Memory Distillation',
        '',
        '### Earlier Distillation',
        '',
        '- Prior summary',
      ].join('\n'),
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

    const service = new SpaceVaultContextSyncService({
      getSpace: vi.fn(async () => space),
    } as any);

    const artifact = await service.writeSpaceMemoryDistillation({
      spaceId: 'space-1',
      summary: 'Cross-session summaries converged on the same release discipline.',
      detail: 'Preserve narrow diffs and explicit validation when promoting context.',
      timestamp: '2026-04-16T11:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        relativePath: 'System/Context Engine/Space Memory.md',
        summary: 'Cross-session summaries converged on the same release discipline.',
        spaceId: 'space-1',
        title: 'Space Memory Distillation',
      })
    );

    const spaceMemoryContent = await fs.readFile(legacyPath, 'utf8');
    expect(spaceMemoryContent.startsWith('---\n')).toBe(true);
    expect(spaceMemoryContent).toContain('contextgoType: space-memory-distillation');
    expect(spaceMemoryContent).toContain('contextgoNamespace: space');
    expect(spaceMemoryContent).toContain('contextgoProjection: semantic-context');
    expect(spaceMemoryContent).toContain('### Earlier Distillation');
    expect(spaceMemoryContent).toContain('Cross-session summaries converged on the same release discipline.');
  });

  it('stamps metadata on connector digest docs and upgrades legacy files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-vault-sync-'));
    tempDirs.push(root);

    const vaultPath = path.join(root, 'vault');
    const legacyPath = path.join(vaultPath, 'System', 'Context Engine', 'Connector Digest.md');
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(
      legacyPath,
      [
        '<!-- contextgo-generated -->',
        '',
        '# Connector Digest',
        '',
        '### Earlier Digest',
        '',
        '- Prior connector signal',
      ].join('\n'),
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

    const service = new SpaceVaultContextSyncService({
      getSpace: vi.fn(async () => space),
    } as any);

    const artifact = await service.writeConnectorDigest({
      spaceId: 'space-1',
      summary: 'Recent connector syncs surfaced repeated release-checklist references.',
      detail: 'Promote the repeated checklist into shared context once corroborated.',
      timestamp: '2026-04-16T12:00:00.000Z',
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        relativePath: 'System/Context Engine/Connector Digest.md',
        summary: 'Recent connector syncs surfaced repeated release-checklist references.',
        spaceId: 'space-1',
        title: 'Connector Digest',
      })
    );

    const digestContent = await fs.readFile(legacyPath, 'utf8');
    expect(digestContent.startsWith('---\n')).toBe(true);
    expect(digestContent).toContain('contextgoType: connector-digest');
    expect(digestContent).toContain('contextgoNamespace: space');
    expect(digestContent).toContain('contextgoProjection: semantic-context');
    expect(digestContent).toContain('### Earlier Digest');
    expect(digestContent).toContain('Recent connector syncs surfaced repeated release-checklist references.');
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
