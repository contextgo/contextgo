/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BuiltInGroupParticipantRole,
  GroupParticipantRole,
  WorkflowGroupRunnableStage,
  WorkflowGroupReviewMode,
  WorkflowGroupTemplate,
} from './storage';
import {
  BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS,
  type WorkflowTemplatePackageManifest,
} from './workflowTemplates';

export type WorkflowTemplateRole = Exclude<GroupParticipantRole, 'custom'>;

export type WorkflowTemplateNumberConstraint = {
  min: number;
  max: number;
  step?: number;
};

export type WorkflowTemplateFieldDefinition =
  | {
      key: 'maxIterations' | 'scoreTarget';
      type: 'number';
      labelKey: string;
      hintKey: string;
      constraint: WorkflowTemplateNumberConstraint;
    }
  | {
      key: 'artifactPath';
      type: 'string';
      labelKey: string;
      hintKey: string;
      placeholder?: string;
    }
  | {
      key: 'reviewMode';
      type: 'select';
      labelKey: string;
      hintKey: string;
      options: Array<{
        value: WorkflowGroupReviewMode;
        labelKey: string;
      }>;
    };

export type WorkflowTemplateStageDefinition = {
  id: string;
  kind: WorkflowGroupRunnableStage;
  role: WorkflowTemplateRole;
  nextStageId?: string;
};

export type WorkflowGroupTemplateDefinition = {
  id: WorkflowGroupTemplate;
  labelKey: string;
  hintKey: string;
  roleOrder: WorkflowTemplateRole[];
  stageRoles?: {
    planning: WorkflowTemplateRole;
    writing: WorkflowTemplateRole;
    evaluating: WorkflowTemplateRole;
  };
  stages?: WorkflowTemplateStageDefinition[];
  requiredParticipantCount: number;
  runStrategy: 'iterative' | 'single-pass';
  defaults: {
    maxIterations: number;
    scoreTarget: number;
    artifactPath: string;
    reviewMode: WorkflowGroupReviewMode;
  };
  constraints: {
    maxIterations: WorkflowTemplateNumberConstraint;
    scoreTarget: WorkflowTemplateNumberConstraint;
  };
  fields: WorkflowTemplateFieldDefinition[];
};

export const DEFAULT_WORKFLOW_GROUP_TEMPLATE: WorkflowGroupTemplate = 'planner-writer-evaluator';

const workflowGroupTemplateDefinitionRegistry = new Map<WorkflowGroupTemplate, WorkflowGroupTemplateDefinition>();

const synthesizeWorkflowTemplateStages = (
  definition: Pick<WorkflowGroupTemplateDefinition, 'roleOrder' | 'stageRoles' | 'runStrategy'>
): WorkflowTemplateStageDefinition[] => {
  const stageRoles = definition.stageRoles || {
    planning: definition.roleOrder[0],
    writing: definition.roleOrder[1],
    evaluating: definition.roleOrder[2],
  };

  return [
    {
      id: 'planning',
      kind: 'planning',
      role: stageRoles.planning,
      nextStageId: 'writing',
    },
    {
      id: 'writing',
      kind: 'writing',
      role: stageRoles.writing,
      nextStageId: 'evaluating',
    },
    {
      id: 'evaluating',
      kind: 'evaluating',
      role: stageRoles.evaluating,
    },
  ];
};

const resolveWorkflowTemplateStages = (
  definition: WorkflowGroupTemplateDefinition
): WorkflowTemplateStageDefinition[] => {
  return definition.stages || synthesizeWorkflowTemplateStages(definition);
};

const validateWorkflowGroupTemplateDefinition = (definition: WorkflowGroupTemplateDefinition): void => {
  const uniqueRoles = new Set(definition.roleOrder);
  if (
    definition.roleOrder.length !== definition.requiredParticipantCount ||
    uniqueRoles.size !== definition.roleOrder.length
  ) {
    throw new Error(
      `Workflow template ${definition.id} must define exactly ${definition.requiredParticipantCount} unique roles.`
    );
  }

  const resolvedStages = resolveWorkflowTemplateStages(definition);
  const stageRoles = definition.stageRoles || {
    planning: resolvedStages.find((stage) => stage.kind === 'planning')?.role || definition.roleOrder[0],
    writing: resolvedStages.find((stage) => stage.kind === 'writing')?.role || definition.roleOrder[1],
    evaluating: resolvedStages.find((stage) => stage.kind === 'evaluating')?.role || definition.roleOrder[2],
  };
  const stageRoleValues = [stageRoles.planning, stageRoles.writing, stageRoles.evaluating];
  if (stageRoleValues.some((role) => !role || !uniqueRoles.has(role))) {
    throw new Error(`Workflow template ${definition.id} must bind planning/writing/evaluating stages to known roles.`);
  }

  if (new Set(stageRoleValues).size !== stageRoleValues.length) {
    throw new Error(`Workflow template ${definition.id} must bind planning/writing/evaluating to distinct roles.`);
  }

  const stageIds = new Set<string>();
  const runnableStageKinds = new Set<WorkflowGroupRunnableStage>();
  for (const stage of resolvedStages) {
    if (!stage.id.trim()) {
      throw new Error(`Workflow template ${definition.id} stage ids must be non-empty.`);
    }
    if (stageIds.has(stage.id)) {
      throw new Error(`Workflow template ${definition.id} stage ids must be unique.`);
    }
    if (!uniqueRoles.has(stage.role)) {
      throw new Error(`Workflow template ${definition.id} stage ${stage.id} must reference a known role.`);
    }

    stageIds.add(stage.id);
    runnableStageKinds.add(stage.kind);
  }

  for (const requiredKind of ['planning', 'writing', 'evaluating'] as const) {
    if (!runnableStageKinds.has(requiredKind)) {
      throw new Error(`Workflow template ${definition.id} must define a ${requiredKind} stage.`);
    }
  }

  for (const stage of resolvedStages) {
    if (stage.nextStageId && !stageIds.has(stage.nextStageId)) {
      throw new Error(
        `Workflow template ${definition.id} stage ${stage.id} points to unknown next stage ${stage.nextStageId}.`
      );
    }
  }
};

export const registerWorkflowGroupTemplateDefinition = (definition: WorkflowGroupTemplateDefinition): void => {
  validateWorkflowGroupTemplateDefinition(definition);
  workflowGroupTemplateDefinitionRegistry.set(definition.id, definition);
};

export const registerWorkflowTemplatePackageManifest = (manifest: WorkflowTemplatePackageManifest): void => {
  if (manifest.id !== manifest.definition.id) {
    throw new Error(`Workflow template manifest id mismatch: ${manifest.id} !== ${manifest.definition.id}`);
  }

  registerWorkflowGroupTemplateDefinition(manifest.definition);
};

for (const manifest of BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS) {
  registerWorkflowTemplatePackageManifest(manifest);
}

const clampNumber = (value: number, constraint: WorkflowTemplateNumberConstraint): number => {
  return Math.min(Math.max(value, constraint.min), constraint.max);
};

export const isWorkflowGroupTemplate = (value: unknown): value is WorkflowGroupTemplate => {
  return typeof value === 'string' && workflowGroupTemplateDefinitionRegistry.has(value);
};

export const normalizeWorkflowGroupTemplate = (value?: string): WorkflowGroupTemplate => {
  return isWorkflowGroupTemplate(value) ? value : DEFAULT_WORKFLOW_GROUP_TEMPLATE;
};

export const getWorkflowGroupTemplateDefinition = (value?: string): WorkflowGroupTemplateDefinition => {
  const template = normalizeWorkflowGroupTemplate(value);
  return (
    workflowGroupTemplateDefinitionRegistry.get(template) ||
    workflowGroupTemplateDefinitionRegistry.get(DEFAULT_WORKFLOW_GROUP_TEMPLATE)!
  );
};

export const listWorkflowGroupTemplateDefinitions = (): WorkflowGroupTemplateDefinition[] => {
  return Array.from(workflowGroupTemplateDefinitionRegistry.values());
};

export const getWorkflowTemplateRoleOrder = (value?: string): WorkflowTemplateRole[] => {
  return getWorkflowGroupTemplateDefinition(value).roleOrder;
};

export const getWorkflowTemplateStageDefinitions = (value?: string): WorkflowTemplateStageDefinition[] => {
  return resolveWorkflowTemplateStages(getWorkflowGroupTemplateDefinition(value));
};

const BUILT_IN_WORKFLOW_ROLE_SET = new Set<BuiltInGroupParticipantRole>(['planner', 'writer', 'evaluator']);

export const isBuiltInWorkflowRole = (role: string): role is BuiltInGroupParticipantRole => {
  return BUILT_IN_WORKFLOW_ROLE_SET.has(role as BuiltInGroupParticipantRole);
};

export const formatWorkflowRoleLabel = (role: string): string => {
  return role
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

export const normalizeWorkflowTemplateReviewMode = (
  value: WorkflowGroupReviewMode | undefined,
  template?: string
): WorkflowGroupReviewMode => {
  const definition = getWorkflowGroupTemplateDefinition(template);
  const allowedValues = new Set(
    definition.fields.flatMap((field) =>
      field.key === 'reviewMode' ? field.options.map((option) => option.value) : []
    )
  );
  if (!value || !allowedValues.has(value)) {
    return definition.defaults.reviewMode;
  }

  return value;
};
