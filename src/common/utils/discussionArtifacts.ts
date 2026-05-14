/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CollaborationExecutionBoundary,
  CollaborationParticipantRole,
  DiscussionGroupMode,
  GroupParticipantRole,
} from '@/common/config/storage';

export const DISCUSSION_GROUP_ARTIFACT_ROOT = '.contextgo/discussion-groups';

export type HarnessArtifactRole = Extract<CollaborationParticipantRole, 'planner' | 'generator' | 'evaluator'>;

export type HarnessArtifactEntry = {
  round: number;
  role: HarnessArtifactRole;
  participantId: string;
  participantName: string;
  summary: string;
  updatedAt: number;
};

export type HarnessArtifactStatus = 'pending' | 'running' | 'finished' | 'error' | 'stopped';

export type HarnessArtifactPaths = {
  rootDir: string;
  requestFile: string;
  plannerFile: string;
  generatorFile: string;
  evaluatorFile: string;
  manifestFile: string;
};

export type HarnessArtifactManifest = {
  version: 1;
  conversationId: string;
  collaborationMode: 'planner-generator-evaluator';
  orchestrationMode: DiscussionGroupMode;
  status: HarnessArtifactStatus;
  updatedAt: string;
  executionBoundary: CollaborationExecutionBoundary;
  files: {
    request: string;
    planner: string;
    generator: string;
    evaluator: string;
    manifest: string;
  };
  rounds: Array<{
    round: number;
    role: HarnessArtifactRole;
    participantId: string;
    participantName: string;
    updatedAt: string;
  }>;
};

const sanitizePathSegment = (value: string): string => {
  return value.replace(/[\\/]+/g, '-');
};

const toRoleTitle = (role: HarnessArtifactRole): string => {
  if (role === 'planner') {
    return 'Planner';
  }
  if (role === 'generator') {
    return 'Generator';
  }
  return 'Evaluator';
};

const formatIsoTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toISOString();
};

export const isHarnessArtifactRole = (
  role?: CollaborationParticipantRole | GroupParticipantRole
): role is HarnessArtifactRole => {
  return role === 'planner' || role === 'generator' || role === 'evaluator';
};

export const buildHarnessArtifactPaths = (conversationId: string): HarnessArtifactPaths => {
  const safeConversationId = sanitizePathSegment(conversationId);
  const rootDir = `${DISCUSSION_GROUP_ARTIFACT_ROOT}/${safeConversationId}/latest`;

  return {
    rootDir,
    requestFile: `${rootDir}/request.md`,
    plannerFile: `${rootDir}/planner.md`,
    generatorFile: `${rootDir}/generator.md`,
    evaluatorFile: `${rootDir}/evaluator.md`,
    manifestFile: `${rootDir}/manifest.json`,
  };
};

export const buildHarnessRequestArtifactContent = (options: {
  conversationId: string;
  request: string;
  orchestrationMode: DiscussionGroupMode;
  updatedAt: number;
}): string => {
  const { conversationId, request, orchestrationMode, updatedAt } = options;

  return [
    '# Harness Request',
    '',
    `- Conversation ID: ${conversationId}`,
    `- Orchestration Mode: ${orchestrationMode}`,
    `- Updated At: ${formatIsoTimestamp(updatedAt)}`,
    '',
    '## User Input',
    '',
    request.trim(),
    '',
  ].join('\n');
};

export const buildHarnessRoleArtifactContent = (options: {
  role: HarnessArtifactRole;
  entries: HarnessArtifactEntry[];
  updatedAt: number;
}): string => {
  const { role, entries, updatedAt } = options;
  const matchingEntries = entries
    .filter((entry) => entry.role === role)
    .toSorted((left, right) => left.round - right.round);

  return [
    `# ${toRoleTitle(role)} Artifact`,
    '',
    `- Updated At: ${formatIsoTimestamp(updatedAt)}`,
    '',
    ...matchingEntries.flatMap((entry) => [
      `## Round ${entry.round}`,
      '',
      `- Participant: ${entry.participantName}`,
      `- Updated At: ${formatIsoTimestamp(entry.updatedAt)}`,
      '',
      entry.summary.trim(),
      '',
    ]),
  ].join('\n');
};

export const buildHarnessArtifactManifest = (options: {
  conversationId: string;
  orchestrationMode: DiscussionGroupMode;
  executionBoundary: CollaborationExecutionBoundary;
  status: HarnessArtifactStatus;
  updatedAt: number;
  paths: HarnessArtifactPaths;
  entries: HarnessArtifactEntry[];
}): string => {
  const { conversationId, orchestrationMode, executionBoundary, status, updatedAt, paths, entries } = options;

  const manifest: HarnessArtifactManifest = {
    version: 1,
    conversationId,
    collaborationMode: 'planner-generator-evaluator',
    orchestrationMode,
    status,
    updatedAt: formatIsoTimestamp(updatedAt),
    executionBoundary,
    files: {
      request: paths.requestFile,
      planner: paths.plannerFile,
      generator: paths.generatorFile,
      evaluator: paths.evaluatorFile,
      manifest: paths.manifestFile,
    },
    rounds: entries
      .slice()
      .toSorted((left, right) =>
        left.round === right.round ? left.role.localeCompare(right.role) : left.round - right.round
      )
      .map((entry) => ({
        round: entry.round,
        role: entry.role,
        participantId: entry.participantId,
        participantName: entry.participantName,
        updatedAt: formatIsoTimestamp(entry.updatedAt),
      })),
  };

  return JSON.stringify(manifest, null, 2);
};
