import type { IContextMemoryView, IContextProfileView } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { buildSpaceCanvasBoard, buildSpaceProjectGroups } from '../utils/spaceCanvasBoard';
import type {
  SpaceAffineCanvasLabels,
  SpaceAffineCanvasParagraph,
  SpaceAffineCanvasProjection,
  SpaceAffineCanvasSelectionItem,
} from './types';

type ProjectSpaceToEdgelessInput = {
  spaceId: string;
  conversations: TChatConversation[];
  memories: IContextMemoryView[];
  profiles: IContextProfileView[];
  labels: SpaceAffineCanvasLabels;
};

const MAX_SUMMARY_LINES = 2;

const trimText = (value: string | undefined, fallback: string): string => {
  const next = value?.trim();
  return next && next.length > 0 ? next : fallback;
};

const takeSummaryLines = (values: readonly string[]): SpaceAffineCanvasParagraph[] => {
  return values.slice(0, MAX_SUMMARY_LINES).map((value) => ({ text: value, type: 'quote' }));
};

export const projectSpaceToEdgeless = (input: ProjectSpaceToEdgelessInput): SpaceAffineCanvasProjection => {
  const board = buildSpaceCanvasBoard({
    spaceId: input.spaceId,
    conversations: input.conversations,
    memoryCount: input.memories.length,
    profileCount: input.profiles.length,
  });
  const projectGroups = buildSpaceProjectGroups({
    spaceId: input.spaceId,
    conversations: input.conversations,
  });
  const projectGroupByKey = new Map(projectGroups.map((group) => [group.projectKey, group]));
  const projectTitleByConversationId = new Map<string, string>();

  projectGroups.forEach((group) => {
    group.sessions.forEach((session) => {
      projectTitleByConversationId.set(session.id, group.title);
    });
  });

  const items = board.nodes.map((node): SpaceAffineCanvasSelectionItem => {
    if (node.kind === 'project') {
      const group = projectGroupByKey.get(node.projectKey);
      const blocks: SpaceAffineCanvasParagraph[] = [
        { text: node.title, type: 'h3' },
        { text: input.labels.projectSummary(node.sessionCount, node.runningCount), type: 'text' },
      ];

      if (node.workingDirectory) {
        blocks.push({ text: node.workingDirectory, type: 'quote' });
      }

      if (group?.sessions[0]) {
        blocks.push({ text: trimText(group.sessions[0].name, group.sessions[0].id), type: 'quote' });
      }

      return {
        itemId: node.id,
        blocks,
        kind: 'project',
        projectKey: node.projectKey,
        title: node.title,
        workingDirectory: node.workingDirectory,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
    }

    if (node.kind === 'session') {
      const projectTitle = projectTitleByConversationId.get(node.conversationId);
      const conversation = input.conversations.find((item) => item.id === node.conversationId);
      const workingDirectory = conversation?.extra?.workingDirectory || conversation?.extra?.workspace;
      const blocks: SpaceAffineCanvasParagraph[] = [
        { text: node.title, type: 'h4' },
        {
          text: input.labels.sessionSummary(
            input.labels.backendLabel(node.backend),
            input.labels.statusLabels[node.status]
          ),
          type: 'text',
        },
      ];

      if (projectTitle) {
        blocks.push({ text: projectTitle, type: 'quote' });
      }

      if (workingDirectory) {
        blocks.push({ text: workingDirectory, type: 'quote' });
      }

      return {
        itemId: node.id,
        backend: node.backend,
        blocks,
        conversationId: node.conversationId,
        kind: 'session',
        status: node.status,
        title: node.title,
        workingDirectory,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
    }

    if (node.kind === 'memory') {
      return {
        itemId: node.id,
        blocks: [
          { text: input.labels.memoryTitle, type: 'h3' },
          { text: input.labels.memorySummary(node.count), type: 'text' },
          ...takeSummaryLines(input.memories.map((memory) => memory.summary)),
        ],
        kind: 'memory',
        title: input.labels.memoryTitle,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
    }

    return {
      itemId: node.id,
      blocks: [
        { text: input.labels.profileTitle, type: 'h3' },
        { text: input.labels.profileSummary(node.count), type: 'text' },
        ...takeSummaryLines(input.profiles.map((profile) => trimText(profile.summary, profile.key))),
      ],
      kind: 'profile',
      title: input.labels.profileTitle,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  });

  return { items };
};
