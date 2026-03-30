/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DiscussionGroupOrchestration,
  GroupOrchestration,
  WorkflowGroupOrchestration,
} from '@/common/config/storage';
import { normalizeDiscussionOrchestration } from './discussion/discussionHelpers';
import { normalizeWorkflowOrchestration } from './workflow/workflowHelpers';

type LegacyDiscussionOrchestration = Partial<DiscussionGroupOrchestration> & {
  kind?: 'discussion';
};

type LegacyWorkflowOrchestration = Partial<WorkflowGroupOrchestration> & {
  kind?: 'workflow';
};

type GroupOrchestrationInput =
  | GroupOrchestration
  | LegacyDiscussionOrchestration
  | LegacyWorkflowOrchestration
  | undefined;

const isWorkflowOrchestrationLike = (value: GroupOrchestrationInput): value is LegacyWorkflowOrchestration => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as LegacyWorkflowOrchestration;

  return (
    candidate.kind === 'workflow' ||
    typeof candidate.template === 'string' ||
    typeof candidate.maxIterations === 'number' ||
    typeof candidate.scoreTarget === 'number' ||
    typeof candidate.artifactPath === 'string' ||
    typeof candidate.reviewMode === 'string'
  );
};

const isDiscussionOrchestrationLike = (value: GroupOrchestrationInput): value is LegacyDiscussionOrchestration => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as LegacyDiscussionOrchestration;

  return candidate.kind === 'discussion' || typeof candidate.mode === 'string' || typeof candidate.rounds === 'number';
};

export const normalizeStoredGroupOrchestration = (value?: GroupOrchestrationInput): GroupOrchestration => {
  if (isWorkflowOrchestrationLike(value)) {
    return normalizeWorkflowOrchestration(value);
  }

  return normalizeDiscussionOrchestration(isDiscussionOrchestrationLike(value) ? value : undefined);
};

export const normalizeStoredDiscussionOrchestration = (
  value?: GroupOrchestrationInput
): DiscussionGroupOrchestration => {
  return normalizeDiscussionOrchestration(isDiscussionOrchestrationLike(value) ? value : undefined);
};

export const normalizeStoredWorkflowOrchestration = (value?: GroupOrchestrationInput): WorkflowGroupOrchestration => {
  return normalizeWorkflowOrchestration(isWorkflowOrchestrationLike(value) ? value : undefined);
};
