/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS } from '@/common/config/workflowTemplates';
import type { WorkflowTemplateUiPackage } from './workflowUiRegistry';
import WorkflowHeaderAddon from './WorkflowHeaderAddon';

const uiByTemplateId: Record<string, WorkflowTemplateUiPackage['ui']> = {
  'planner-writer-evaluator': {
    id: 'planner-writer-evaluator',
    HeaderAddon: WorkflowHeaderAddon,
  },
  'plan-build-evaluate': {
    id: 'plan-build-evaluate',
    HeaderAddon: WorkflowHeaderAddon,
  },
};

export const BUILT_IN_WORKFLOW_TEMPLATE_UI_PACKAGES: WorkflowTemplateUiPackage[] =
  BUILT_IN_WORKFLOW_TEMPLATE_PACKAGE_MANIFESTS.reduce<WorkflowTemplateUiPackage[]>((packages, manifest) => {
    const ui = uiByTemplateId[manifest.id];
    if (ui) {
      packages.push({ manifest, ui });
    }
    return packages;
  }, []);
