import type { TChatConversation } from '@/common/config/storage';

export type SpaceCanvasBoardSessionStatus = 'running' | 'ready';

export type SpaceProjectGroup = {
  projectKey: string;
  title: string;
  workingDirectory?: string;
  sessions: TChatConversation[];
  runningCount: number;
  lastActiveAt: number;
};

type SpaceCanvasBoardBaseNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accentToken: string;
};

export type SpaceCanvasBoardProjectNode = SpaceCanvasBoardBaseNode & {
  kind: 'project';
  projectKey: string;
  workingDirectory?: string;
  sessionCount: number;
  runningCount: number;
};

export type SpaceCanvasBoardSessionNode = SpaceCanvasBoardBaseNode & {
  kind: 'session';
  conversationId: string;
  backend: TChatConversation['type'];
  status: SpaceCanvasBoardSessionStatus;
};

export type SpaceCanvasBoardSummaryNode = SpaceCanvasBoardBaseNode & {
  kind: 'memory' | 'profile';
  count: number;
};

export type SpaceCanvasBoardNode =
  | SpaceCanvasBoardProjectNode
  | SpaceCanvasBoardSessionNode
  | SpaceCanvasBoardSummaryNode;

export type SpaceCanvasBoardEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'contains' | 'feeds';
};

export type SpaceCanvasBoard = {
  nodes: SpaceCanvasBoardNode[];
  edges: SpaceCanvasBoardEdge[];
};

type BuildSpaceCanvasBoardInput = {
  spaceId: string;
  conversations: TChatConversation[];
  memoryCount: number;
  profileCount: number;
};

type BuildSpaceProjectGroupsInput = Pick<BuildSpaceCanvasBoardInput, 'spaceId' | 'conversations'>;

const MAX_SESSION_NODES = 6;
const PROJECT_CARD_WIDTH = 268;
const PROJECT_CARD_HEIGHT = 144;
const SESSION_CARD_WIDTH = 232;
const SESSION_CARD_HEIGHT = 124;

const resolveWorkingDirectory = (conversation: TChatConversation): string | undefined => {
  const candidate = conversation.extra?.workingDirectory || conversation.extra?.workspace;
  return candidate && candidate.trim() ? candidate : undefined;
};

const inferProjectKey = (conversation: TChatConversation): string => {
  return resolveWorkingDirectory(conversation) || `project:${conversation.id}`;
};

const inferProjectTitle = (projectKey: string, conversations: TChatConversation[]): string => {
  const explicitWorkspace = conversations.map(resolveWorkingDirectory).find(Boolean);
  if (explicitWorkspace) {
    const segments = explicitWorkspace.split(/[\\/]/).filter(Boolean);
    return segments.at(-1) || explicitWorkspace;
  }

  const conversationName = conversations[0]?.name?.trim();
  if (conversationName) {
    return conversationName;
  }

  const keySegments = projectKey.split(/[\\/]/).filter(Boolean);
  return keySegments.at(-1) || projectKey;
};

const resolveSessionStatus = (conversation: TChatConversation): SpaceCanvasBoardSessionStatus => {
  return conversation.status === 'running' ? 'running' : 'ready';
};

export const buildSpaceProjectGroups = (input: BuildSpaceProjectGroupsInput): SpaceProjectGroup[] => {
  const relevantConversations = input.conversations.filter(
    (conversation) => conversation.extra?.spaceId === input.spaceId && conversation.extra?.archived !== true
  );
  const groupedProjects = new Map<string, TChatConversation[]>();

  for (const conversation of relevantConversations) {
    const projectKey = inferProjectKey(conversation);
    const sessions = groupedProjects.get(projectKey) ?? [];
    sessions.push(conversation);
    groupedProjects.set(projectKey, sessions);
  }

  return [...groupedProjects.entries()]
    .map(([projectKey, sessions]) => {
      const sortedSessions = [...sessions].toSorted((left, right) => (right.modifyTime || 0) - (left.modifyTime || 0));
      return {
        projectKey,
        title: inferProjectTitle(projectKey, sortedSessions),
        workingDirectory: sortedSessions.map(resolveWorkingDirectory).find(Boolean),
        sessions: sortedSessions,
        runningCount: sortedSessions.filter((session) => session.status === 'running').length,
        lastActiveAt: sortedSessions[0]?.modifyTime || 0,
      } satisfies SpaceProjectGroup;
    })
    .toSorted((left, right) => right.lastActiveAt - left.lastActiveAt);
};

export const buildSpaceCanvasBoard = (input: BuildSpaceCanvasBoardInput): SpaceCanvasBoard => {
  const projectEntries = buildSpaceProjectGroups(input);
  const nodes: SpaceCanvasBoardNode[] = [];
  const edges: SpaceCanvasBoardEdge[] = [];

  projectEntries.forEach((entry, index) => {
    const projectNodeId = `project:${index}`;
    const projectX = 80 + index * 360;
    const projectY = 80 + (index % 2) * 36;
    nodes.push({
      id: projectNodeId,
      kind: 'project',
      projectKey: entry.projectKey,
      title: entry.title,
      workingDirectory: entry.workingDirectory,
      sessionCount: entry.sessions.length,
      runningCount: entry.runningCount,
      x: projectX,
      y: projectY,
      width: PROJECT_CARD_WIDTH,
      height: PROJECT_CARD_HEIGHT,
      accentToken: 'rgb(var(--primary-6))',
    });

    entry.sessions.slice(0, MAX_SESSION_NODES).forEach((conversation, sessionIndex) => {
      const sessionNodeId = `session:${conversation.id}`;
      nodes.push({
        id: sessionNodeId,
        kind: 'session',
        conversationId: conversation.id,
        backend: conversation.type,
        status: resolveSessionStatus(conversation),
        title: conversation.name || conversation.id,
        x: projectX + 24 + (sessionIndex % 2) * 246,
        y: projectY + 206 + Math.floor(sessionIndex / 2) * 154,
        width: SESSION_CARD_WIDTH,
        height: SESSION_CARD_HEIGHT,
        accentToken: conversation.status === 'running' ? 'var(--success-6)' : 'var(--color-fill-4)',
      });
      edges.push({
        id: `${projectNodeId}->${sessionNodeId}`,
        from: projectNodeId,
        to: sessionNodeId,
        kind: 'contains',
      });
    });
  });

  const summaryBaseX = projectEntries.length === 0 ? 104 : 140 + projectEntries.length * 360;
  nodes.push({
    id: 'memory:summary',
    kind: 'memory',
    count: input.memoryCount,
    title: 'memory',
    x: summaryBaseX,
    y: 148,
    width: 236,
    height: 116,
    accentToken: 'var(--warning-6)',
  });
  nodes.push({
    id: 'profile:summary',
    kind: 'profile',
    count: input.profileCount,
    title: 'profile',
    x: summaryBaseX + 42,
    y: 330,
    width: 216,
    height: 108,
    accentToken: 'var(--arcoblue-6)',
  });

  projectEntries.forEach((_, index) => {
    const projectNodeId = `project:${index}`;
    edges.push({
      id: `${projectNodeId}->memory:summary`,
      from: projectNodeId,
      to: 'memory:summary',
      kind: 'feeds',
    });
  });

  return { nodes, edges };
};
