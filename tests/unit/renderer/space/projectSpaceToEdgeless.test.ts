import type { IContextMemoryView, IContextProfileView } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { projectSpaceToEdgeless } from '@/renderer/pages/space/affine/projectSpaceToEdgeless';
import type { SpaceAffineCanvasLabels } from '@/renderer/pages/space/affine/types';
import { describe, expect, it } from 'vitest';

const createConversation = (overrides: Partial<TChatConversation>): TChatConversation => {
  return {
    id: 'conversation-1',
    name: 'Untitled',
    type: 'codex',
    createTime: 1,
    modifyTime: 1,
    status: 'finished',
    model: {
      id: 'provider-1',
      platform: 'openai',
      name: 'Provider',
      baseUrl: 'https://example.com',
      apiKey: 'key',
      useModel: 'gpt-4.1',
    },
    extra: {
      spaceId: 'space-1',
      workingDirectory: '/workspace/project-a',
      workspace: '/workspace/project-a',
    },
    ...overrides,
  } as TChatConversation;
};

const labels: SpaceAffineCanvasLabels = {
  backendLabel: (backend) => backend.toUpperCase(),
  memorySummary: (count) => `${count} memories`,
  memoryTitle: 'Context Memory',
  profileSummary: (count) => `${count} profiles`,
  profileTitle: 'Profiles',
  projectSummary: (sessionCount, runningCount) => `${sessionCount} sessions / ${runningCount} running`,
  sessionSummary: (backendLabel, statusLabel) => `${backendLabel} · ${statusLabel}`,
  statusLabels: {
    ready: 'Ready',
    running: 'Running',
  },
};

const memories: IContextMemoryView[] = [
  {
    id: 'memory-1',
    spaceId: 'space-1',
    kind: 'fact',
    tier: 'space',
    summary: 'Team prefers concise updates.',
    detail: 'Keep updates short.',
    confidence: 0.9,
    priority: 'high',
    state: 'accepted',
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
];

const profiles: IContextProfileView[] = [
  {
    id: 'profile-1',
    spaceId: 'space-1',
    key: 'team-style',
    summary: 'High review standard',
    confidence: 0.8,
    state: 'active',
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
];

describe('projectSpaceToEdgeless', () => {
  it('projects space conversations and context summaries into canvas items', () => {
    const projection = projectSpaceToEdgeless({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-a1',
          name: 'Alpha task',
          status: 'running',
          modifyTime: 50,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
        createConversation({
          id: 'conv-a2',
          name: 'Alpha review',
          type: 'gemini',
          modifyTime: 40,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
        createConversation({
          id: 'conv-b1',
          name: 'Beta task',
          modifyTime: 30,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-b',
            workspace: '/workspace/project-b',
          },
        }),
      ],
      memories,
      profiles,
      labels,
    });

    const projectItem = projection.items.find(
      (item) => item.kind === 'project' && item.projectKey === '/workspace/project-a'
    );
    expect(projectItem).toMatchObject({
      kind: 'project',
      title: 'project-a',
      workingDirectory: '/workspace/project-a',
    });
    expect(projectItem?.blocks[0]).toMatchObject({ text: 'project-a', type: 'h3' });
    expect(projectItem?.blocks[1]?.text).toContain('2 sessions');

    const runningSession = projection.items.find(
      (item) => item.kind === 'session' && item.conversationId === 'conv-a1'
    );
    expect(runningSession).toMatchObject({
      backend: 'codex',
      kind: 'session',
      status: 'running',
      workingDirectory: '/workspace/project-a',
    });
    expect(runningSession?.blocks.some((block) => block.text.includes('CODEX'))).toBe(true);

    const memoryItem = projection.items.find((item) => item.kind === 'memory');
    expect(memoryItem?.blocks.map((block) => block.text)).toContain('Team prefers concise updates.');

    const profileItem = projection.items.find((item) => item.kind === 'profile');
    expect(profileItem?.blocks.map((block) => block.text)).toContain('High review standard');
  });

  it('keeps summary items when a space has no linked sessions', () => {
    const projection = projectSpaceToEdgeless({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-other-space',
          extra: {
            spaceId: 'space-2',
            workingDirectory: '/workspace/project-z',
            workspace: '/workspace/project-z',
          },
        }),
      ],
      memories,
      profiles: [],
      labels,
    });

    expect(projection.items.filter((item) => item.kind === 'project')).toHaveLength(0);
    expect(projection.items.filter((item) => item.kind === 'session')).toHaveLength(0);
    expect(projection.items.filter((item) => item.kind === 'memory')).toHaveLength(1);
    expect(projection.items.filter((item) => item.kind === 'profile')).toHaveLength(1);
  });
});
