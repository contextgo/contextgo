/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CollaborationExecutionBoundary, DiscussionGroupMode } from '@/common/config/storage';
import {
  buildHarnessArtifactManifest,
  buildHarnessArtifactPaths,
  buildHarnessRequestArtifactContent,
  buildHarnessRoleArtifactContent,
  type HarnessArtifactEntry,
  type HarnessArtifactRole,
  type HarnessArtifactStatus,
} from '@/common/utils/discussionArtifacts';

const buildAbsolutePath = (workspace: string, relativePath: string): string => {
  return path.join(workspace, ...relativePath.split('/'));
};

const writeRoleArtifactFile = async (options: {
  workspace: string;
  relativePath: string;
  role: HarnessArtifactRole;
  entries: HarnessArtifactEntry[];
  updatedAt: number;
}): Promise<void> => {
  const content = buildHarnessRoleArtifactContent({
    role: options.role,
    entries: options.entries,
    updatedAt: options.updatedAt,
  });

  await writeFile(buildAbsolutePath(options.workspace, options.relativePath), content, 'utf-8');
};

export const persistHarnessArtifacts = async (options: {
  workspace?: string;
  conversationId: string;
  request: string;
  orchestrationMode: DiscussionGroupMode;
  executionBoundary: CollaborationExecutionBoundary;
  status: HarnessArtifactStatus;
  entries: HarnessArtifactEntry[];
  updatedAt?: number;
}): Promise<void> => {
  if (!options.workspace?.trim()) {
    return;
  }

  const updatedAt = options.updatedAt ?? Date.now();
  const paths = buildHarnessArtifactPaths(options.conversationId);
  const absoluteRootDir = buildAbsolutePath(options.workspace, paths.rootDir);
  await mkdir(absoluteRootDir, { recursive: true });

  await writeFile(
    buildAbsolutePath(options.workspace, paths.requestFile),
    buildHarnessRequestArtifactContent({
      conversationId: options.conversationId,
      request: options.request,
      orchestrationMode: options.orchestrationMode,
      updatedAt,
    }),
    'utf-8'
  );

  await Promise.all([
    writeRoleArtifactFile({
      workspace: options.workspace,
      relativePath: paths.plannerFile,
      role: 'planner',
      entries: options.entries,
      updatedAt,
    }),
    writeRoleArtifactFile({
      workspace: options.workspace,
      relativePath: paths.generatorFile,
      role: 'generator',
      entries: options.entries,
      updatedAt,
    }),
    writeRoleArtifactFile({
      workspace: options.workspace,
      relativePath: paths.evaluatorFile,
      role: 'evaluator',
      entries: options.entries,
      updatedAt,
    }),
  ]);

  await writeFile(
    buildAbsolutePath(options.workspace, paths.manifestFile),
    buildHarnessArtifactManifest({
      conversationId: options.conversationId,
      orchestrationMode: options.orchestrationMode,
      executionBoundary: options.executionBoundary,
      status: options.status,
      updatedAt,
      paths,
      entries: options.entries,
    }),
    'utf-8'
  );
};
