/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GroupParticipantRole, WorkflowGroupTemplate } from './storage';

export type WorkflowTemplateRole = Exclude<GroupParticipantRole, 'custom'>;

export type WorkflowTemplateNumberConstraint = {
  min: number;
  max: number;
  step?: number;
};

export type WorkflowGroupTemplateDefinition = {
  id: WorkflowGroupTemplate;
  labelKey: string;
  hintKey: string;
  roleOrder: WorkflowTemplateRole[];
  requiredParticipantCount: number;
  defaults: {
    maxIterations: number;
    scoreTarget: number;
    artifactPath: string;
  };
  constraints: {
    maxIterations: WorkflowTemplateNumberConstraint;
    scoreTarget: WorkflowTemplateNumberConstraint;
  };
};

export const DEFAULT_WORKFLOW_GROUP_TEMPLATE: WorkflowGroupTemplate = 'planner-writer-evaluator';

export const WORKFLOW_GROUP_TEMPLATE_DEFINITIONS: Record<WorkflowGroupTemplate, WorkflowGroupTemplateDefinition> = {
  'planner-writer-evaluator': {
    id: 'planner-writer-evaluator',
    labelKey: 'conversation.group.workflow.templatePlannerWriterEvaluator',
    hintKey: 'conversation.group.workflow.templateHint',
    roleOrder: ['planner', 'writer', 'evaluator'],
    requiredParticipantCount: 3,
    defaults: {
      maxIterations: 3,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
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
  },
};

const clampNumber = (value: number, constraint: WorkflowTemplateNumberConstraint): number => {
  return Math.min(Math.max(value, constraint.min), constraint.max);
};

export const isWorkflowGroupTemplate = (value: unknown): value is WorkflowGroupTemplate => {
  return typeof value === 'string' && value in WORKFLOW_GROUP_TEMPLATE_DEFINITIONS;
};

export const normalizeWorkflowGroupTemplate = (value?: string): WorkflowGroupTemplate => {
  return isWorkflowGroupTemplate(value) ? value : DEFAULT_WORKFLOW_GROUP_TEMPLATE;
};

export const getWorkflowGroupTemplateDefinition = (value?: string): WorkflowGroupTemplateDefinition => {
  const template = normalizeWorkflowGroupTemplate(value);
  return WORKFLOW_GROUP_TEMPLATE_DEFINITIONS[template];
};

export const listWorkflowGroupTemplateDefinitions = (): WorkflowGroupTemplateDefinition[] => {
  return Object.values(WORKFLOW_GROUP_TEMPLATE_DEFINITIONS);
};

export const getWorkflowTemplateRoleOrder = (value?: string): WorkflowTemplateRole[] => {
  return getWorkflowGroupTemplateDefinition(value).roleOrder;
};

export const normalizeWorkflowTemplateMaxIterations = (value: number | undefined, template?: string): number => {
  const definition = getWorkflowGroupTemplateDefinition(template);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return definition.defaults.maxIterations;
  }

  return Math.round(clampNumber(value, definition.constraints.maxIterations));
};

export const normalizeWorkflowTemplateScoreTarget = (value: number | undefined, template?: string): number => {
  const definition = getWorkflowGroupTemplateDefinition(template);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return definition.defaults.scoreTarget;
  }

  const normalized = clampNumber(value, definition.constraints.scoreTarget);
  return Number(normalized.toFixed(1));
};
