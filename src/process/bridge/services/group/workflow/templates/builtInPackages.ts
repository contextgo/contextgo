/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS } from '@/common/config/workflowTemplates';
import type { WorkflowRuntimeTemplatePackage } from './index';
import { plannerWriterEvaluatorTemplate, planBuildEvaluateTemplate } from './plannerWriterEvaluatorTemplate';

const runtimeByTemplateId = {
  'planner-writer-evaluator': plannerWriterEvaluatorTemplate,
  'plan-build-evaluate': planBuildEvaluateTemplate,
} as const;

export const BUILT_IN_WORKFLOW_RUNTIME_TEMPLATE_PACKAGES: WorkflowRuntimeTemplatePackage[] =
  BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS.map((manifest) => ({
    manifest,
    runtime: runtimeByTemplateId[manifest.id as keyof typeof runtimeByTemplateId],
  })).filter((templatePackage): templatePackage is WorkflowRuntimeTemplatePackage => Boolean(templatePackage.runtime));
