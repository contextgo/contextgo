/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS } from '@/common/config/workflowTemplates';
import type { WorkflowTemplateUiPackage } from './workflowUiRegistry';
import WorkflowHeaderAddon from './WorkflowHeaderAddon';

const uiByTemplateId = {
  'planner-writer-evaluator': {
    id: 'planner-writer-evaluator',
    HeaderAddon: WorkflowHeaderAddon,
  },
  'plan-build-evaluate': {
    id: 'plan-build-evaluate',
    HeaderAddon: WorkflowHeaderAddon,
  },
} as const;

export const BUILT_IN_WORKFLOW_TEMPLATE_UI_PACKAGES: WorkflowTemplateUiPackage[] =
  BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS.map((manifest) => ({
    manifest,
    ui: uiByTemplateId[manifest.id as keyof typeof uiByTemplateId],
  })).filter((templatePackage): templatePackage is WorkflowTemplateUiPackage => Boolean(templatePackage.ui));
