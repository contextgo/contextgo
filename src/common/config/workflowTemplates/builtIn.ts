/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowTemplatePackageManifest } from './types';

export const BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS: WorkflowTemplatePackageManifest[] = [
  {
    id: 'planner-writer-evaluator',
    definition: {
      id: 'planner-writer-evaluator',
      labelKey: 'conversation.group.workflow.templatePlannerWriterEvaluator',
      hintKey: 'conversation.group.workflow.templatePlannerWriterEvaluatorHint',
      roleOrder: ['planner', 'writer', 'evaluator'],
      stageRoles: {
        planning: 'planner',
        writing: 'writer',
        evaluating: 'evaluator',
      },
      stages: [
        {
          id: 'plan-brief',
          kind: 'planning',
          role: 'planner',
          nextStageId: 'draft-artifact',
        },
        {
          id: 'draft-artifact',
          kind: 'writing',
          role: 'writer',
          nextStageId: 'review-artifact',
        },
        {
          id: 'review-artifact',
          kind: 'evaluating',
          role: 'evaluator',
        },
      ],
      requiredParticipantCount: 3,
      runStrategy: 'iterative',
      defaults: {
        maxIterations: 3,
        scoreTarget: 8,
        artifactPath: 'team-output.md',
        reviewMode: 'per-iteration',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 15,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [
        {
          key: 'maxIterations',
          type: 'number',
          labelKey: 'conversation.group.workflow.maxIterationsLabel',
          hintKey: 'conversation.group.workflow.maxIterationsHint',
          constraint: {
            min: 1,
            max: 15,
            step: 1,
          },
        },
        {
          key: 'scoreTarget',
          type: 'number',
          labelKey: 'conversation.group.workflow.scoreTargetLabel',
          hintKey: 'conversation.group.workflow.scoreTargetHint',
          constraint: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        },
        {
          key: 'artifactPath',
          type: 'string',
          labelKey: 'conversation.group.workflow.artifactPathLabel',
          hintKey: 'conversation.group.workflow.artifactPathHint',
          placeholder: 'team-output.md',
        },
        {
          key: 'reviewMode',
          type: 'select',
          labelKey: 'conversation.group.workflow.reviewModeLabel',
          hintKey: 'conversation.group.workflow.reviewModeHint',
          options: [
            {
              value: 'per-iteration',
              labelKey: 'conversation.group.workflow.reviewMode.perIteration',
            },
            {
              value: 'final-only',
              labelKey: 'conversation.group.workflow.reviewMode.finalOnly',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'plan-build-evaluate',
    definition: {
      id: 'plan-build-evaluate',
      labelKey: 'conversation.group.workflow.templatePlanBuildEvaluate',
      hintKey: 'conversation.group.workflow.templatePlanBuildEvaluateHint',
      roleOrder: ['planner', 'writer', 'evaluator'],
      stageRoles: {
        planning: 'planner',
        writing: 'writer',
        evaluating: 'evaluator',
      },
      stages: [
        {
          id: 'scope-build',
          kind: 'planning',
          role: 'planner',
          nextStageId: 'main-build',
        },
        {
          id: 'main-build',
          kind: 'writing',
          role: 'writer',
          nextStageId: 'tail-review',
        },
        {
          id: 'tail-review',
          kind: 'evaluating',
          role: 'evaluator',
        },
      ],
      requiredParticipantCount: 3,
      runStrategy: 'single-pass',
      defaults: {
        maxIterations: 1,
        scoreTarget: 8,
        artifactPath: 'team-output.md',
        reviewMode: 'final-only',
      },
      constraints: {
        maxIterations: {
          min: 1,
          max: 1,
          step: 1,
        },
        scoreTarget: {
          min: 0,
          max: 10,
          step: 0.5,
        },
      },
      fields: [
        {
          key: 'scoreTarget',
          type: 'number',
          labelKey: 'conversation.group.workflow.scoreTargetLabel',
          hintKey: 'conversation.group.workflow.scoreTargetHint',
          constraint: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        },
        {
          key: 'artifactPath',
          type: 'string',
          labelKey: 'conversation.group.workflow.artifactPathLabel',
          hintKey: 'conversation.group.workflow.artifactPathHint',
          placeholder: 'team-output.md',
        },
        {
          key: 'reviewMode',
          type: 'select',
          labelKey: 'conversation.group.workflow.reviewModeLabel',
          hintKey: 'conversation.group.workflow.reviewModeHint',
          options: [
            {
              value: 'final-only',
              labelKey: 'conversation.group.workflow.reviewMode.finalOnly',
            },
          ],
        },
      ],
    },
  },
];
