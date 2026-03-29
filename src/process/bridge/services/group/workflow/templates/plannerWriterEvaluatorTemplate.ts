/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildEvaluatorPrompt,
  buildInitialWorkflowRunState,
  buildPlannerPrompt,
  buildWriterPrompt,
  resolveWorkflowRoleParticipants,
} from '../workflowHelpers';
import type { WorkflowRuntimeTemplate } from './index';

const withExecutionStyle = (prompt: string, detail: string): string => {
  return `${prompt}

[Execution Style]
${detail}`;
};

const buildSinglePassPlannerPrompt: WorkflowRuntimeTemplate['buildPlannerPrompt'] = (options) => {
  return withExecutionStyle(
    buildPlannerPrompt(options),
    '- Prefer a single cohesive build pass over many small rewrites.\n- Define what the evaluator should verify at the end of the main build.'
  );
};

const buildSinglePassWriterPrompt: WorkflowRuntimeTemplate['buildWriterPrompt'] = (options) => {
  return withExecutionStyle(
    buildWriterPrompt(options),
    '- Treat this as the main build pass for the artifact.\n- Make the artifact as complete and self-consistent as possible before review.'
  );
};

const buildSinglePassEvaluatorPrompt: WorkflowRuntimeTemplate['buildEvaluatorPrompt'] = (options) => {
  return withExecutionStyle(
    buildEvaluatorPrompt(options),
    '- This is a tail review after the main build pass.\n- Focus on whether the artifact is ready to accept, not on requesting speculative extra polish.'
  );
};

const resolveFinalDecision: WorkflowRuntimeTemplate['getFinalDecision'] = ({
  latestEvaluation,
  completedIteration,
  orchestration,
}) => {
  if (latestEvaluation?.decision) {
    return latestEvaluation.decision;
  }

  return completedIteration >= orchestration.maxIterations ? 'continue' : 'accept';
};

export const plannerWriterEvaluatorTemplate: WorkflowRuntimeTemplate = {
  id: 'planner-writer-evaluator',
  resolveParticipants: resolveWorkflowRoleParticipants,
  buildInitialRunState: buildInitialWorkflowRunState,
  buildPlannerPrompt,
  buildWriterPrompt,
  buildEvaluatorPrompt,
  shouldRunEvaluation: () => true,
  getFinalDecision: resolveFinalDecision,
};

export const planBuildEvaluateTemplate: WorkflowRuntimeTemplate = {
  id: 'plan-build-evaluate',
  resolveParticipants: resolveWorkflowRoleParticipants,
  buildInitialRunState: buildInitialWorkflowRunState,
  buildPlannerPrompt: buildSinglePassPlannerPrompt,
  buildWriterPrompt: buildSinglePassWriterPrompt,
  buildEvaluatorPrompt: buildSinglePassEvaluatorPrompt,
  shouldRunEvaluation: ({ orchestration, iteration }) => iteration >= orchestration.maxIterations,
  getFinalDecision: resolveFinalDecision,
};
