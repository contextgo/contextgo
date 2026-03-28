/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiscussionGroupOrchestration, GroupOrchestration, WorkflowGroupOrchestration } from '@/common/config/storage';
import { normalizeDiscussionOrchestration } from './discussion/discussionHelpers';
import { normalizeWorkflowOrchestration } from './workflow/workflowHelpers';

type LegacyDiscussionOrchestration = Partial<DiscussionGroupOrchestration> & {
  kind?: 'discussion';
};

type LegacyWorkflowOrchestration = Partial<WorkflowGroupOrchestration> & {
  kind?: 'workflow';
};

type GroupOrchestrationInput = GroupOrchestration | LegacyDiscussionOrchestration | LegacyWorkflowOrchestration | undefined;

const isWorkflowOrchestrationLike = (value: GroupOrchestrationInput): value is LegacyWorkflowOrchestration => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    value.kind === 'workflow' ||
    typeof value.template === 'string' ||
    typeof value.maxIterations === 'number' ||
    typeof value.scoreTarget === 'number' ||
    typeof value.artifactPath === 'string'
  );
};

const isDiscussionOrchestrationLike = (value: GroupOrchestrationInput): value is LegacyDiscussionOrchestration => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return value.kind === 'discussion' || typeof value.mode === 'string' || typeof value.rounds === 'number';
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
