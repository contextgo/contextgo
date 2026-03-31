/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowTemplatePackageManifest } from '@/common/config/workflowTemplates';
import type {
  GroupParticipant,
  WorkflowGroupOrchestration,
  WorkflowGroupRunState,
  WorkflowGroupTemplate,
} from '@/common/config/storage';
import type { WorkflowEvaluation, WorkflowRoleParticipants } from '../workflowHelpers';
import { BUILT_IN_WORKFLOW_RUNTIME_TEMPLATE_PACKAGES } from './builtInPackages';

export type WorkflowRuntimeTemplate = {
  id: WorkflowGroupTemplate;
  resolveParticipants: (participants: GroupParticipant[], template?: string) => WorkflowRoleParticipants;
  buildInitialRunState: (
    orchestration: WorkflowGroupOrchestration,
    participants?: Array<{ id: string; role?: GroupParticipant['role'] }>
  ) => WorkflowGroupRunState;
  buildPlannerPrompt: (options: {
    userInput: string;
    participantName: string;
    roleId?: GroupParticipant['role'];
    artifactPath: string;
    scoreTarget: number;
    maxIterations: number;
  }) => string;
  buildWriterPrompt: (options: {
    userInput: string;
    participantName: string;
    roleId?: GroupParticipant['role'];
    artifactPath: string;
    iteration: number;
    planningBrief: string;
    artifactContent?: string;
    evaluatorFeedback?: string;
  }) => string;
  buildEvaluatorPrompt: (options: {
    userInput: string;
    participantName: string;
    roleId?: GroupParticipant['role'];
    artifactPath: string;
    iteration: number;
    planningBrief: string;
    artifactContent: string;
    scoreTarget: number;
  }) => string;
  shouldRunEvaluation: (options: { iteration: number; orchestration: WorkflowGroupOrchestration }) => boolean;
  getFinalDecision: (options: {
    latestEvaluation: WorkflowEvaluation | null;
    completedIteration: number;
    orchestration: WorkflowGroupOrchestration;
  }) => 'continue' | 'accept' | 'stop';
};

export type WorkflowRuntimeTemplatePackage = {
  manifest: WorkflowTemplatePackageManifest;
  runtime: WorkflowRuntimeTemplate;
};

const workflowRuntimeTemplateRegistry = new Map<WorkflowGroupTemplate, WorkflowRuntimeTemplate>();

export const registerWorkflowRuntimeTemplate = (template: WorkflowRuntimeTemplate): void => {
  workflowRuntimeTemplateRegistry.set(template.id, template);
};

export const registerWorkflowRuntimeTemplatePackage = (templatePackage: WorkflowRuntimeTemplatePackage): void => {
  if (templatePackage.manifest.id !== templatePackage.runtime.id) {
    throw new Error(
      `Workflow runtime template package id mismatch: ${templatePackage.manifest.id} !== ${templatePackage.runtime.id}`
    );
  }

  registerWorkflowRuntimeTemplate(templatePackage.runtime);
};

for (const templatePackage of BUILT_IN_WORKFLOW_RUNTIME_TEMPLATE_PACKAGES) {
  registerWorkflowRuntimeTemplatePackage(templatePackage);
}

export const getWorkflowRuntimeTemplate = (template: WorkflowGroupTemplate): WorkflowRuntimeTemplate => {
  const resolvedTemplate = workflowRuntimeTemplateRegistry.get(template);
  if (!resolvedTemplate) {
    throw new Error(`Workflow runtime template is not registered: ${template}`);
  }

  return resolvedTemplate;
};
