/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowGroupTemplateDefinition } from '../group';
import type { WorkflowGroupTemplate } from '../storage';

export type WorkflowTemplatePackageManifest = {
  id: WorkflowGroupTemplate;
  definition: WorkflowGroupTemplateDefinition;
};
